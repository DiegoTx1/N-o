// =============================================
// CONFIGURAÇÕES GLOBAIS
// =============================================
const state = {
  timer: 60,
  leituraEmAndamento: false,
  intervaloAtual: null,
  websocket: null,
  timeOffset: 0,
  reconnectDelay: 5000,
  reconnectAttempts: 0
};

const CONFIG = {
  API_ENDPOINTS: {
    BINANCE: "https://api.binance.com/api/v3",
    WORLD_TIME: "https://worldtimeapi.org/api/ip"
  },
  PARES: {
    CRYPTO_IDX: "BTCUSDT"
  },
  PERIODOS: {
    RSI: 14,
    EMA_CURTA: 8,
    EMA_MEDIA: 21,
    SMA_VOLUME: 20,
    MACD_RAPIDA: 12,
    MACD_LENTA: 26,
    MACD_SINAL: 9
  },
  LIMIARES: {
    SCORE_OPERAR: 85,
    SCORE_ALERTA: 70,
    VOLAT_MINIMA: 0.005
  }
};

// =============================================
// SISTEMA DE TENDÊNCIA
// =============================================
function avaliarTendencia(ema8, ema21, close) {
  const distancia = Math.abs(ema8 - ema21);
  const forca = Math.min(100, Math.round(distancia / close * 1000));
  
  if (forca > 80) {
    return ema8 > ema21 ? "FORTE_ALTA" : "FORTE_BAIXA";
  }
  return "NEUTRA";
}

// =============================================
// GERADOR DE SINAIS
// =============================================
function gerarSinal(indicadores) {
  const { close, emaCurta, volume, volumeMedia, volatilidade, macd, tendencia } = indicadores;
  
  // Filtros básicos
  if (volatilidade < CONFIG.LIMIARES.VOLAT_MINIMA) return "ESPERAR";
  if (volume < volumeMedia * 1.5) return "ESPERAR";
  
  // Sinal de CALL
  if (tendencia === "FORTE_ALTA" && close > emaCurta && macd.histograma > 0) {
    return "CALL";
  }
  
  // Sinal de PUT
  if (tendencia === "FORTE_BAIXA" && close < emaCurta && macd.histograma < 0) {
    return "PUT";
  }
  
  return "ESPERAR";
}

// =============================================
// CALCULADOR DE CONFIANÇA
// =============================================
function calcularScore(sinal, indicadores) {
  let score = 50;
  
  // Fatores principais
  if (indicadores.tendencia.includes("FORTE")) score += 25;
  if (indicadores.volume > indicadores.volumeMedia * 2) score += 15;
  if ((sinal === "CALL" && indicadores.rsi < 40) || (sinal === "PUT" && indicadores.rsi > 60)) score += 10;
  
  return Math.min(100, score);
}

// =============================================
// FUNÇÕES UTILITÁRIAS
// =============================================
function formatarTimer(segundos) {
  return `0:${segundos.toString().padStart(2, '0')}`;
}

function atualizarInterface(sinal, score) {
  const comandoElement = document.getElementById("comando");
  if (comandoElement) {
    comandoElement.textContent = sinal;
    comandoElement.className = sinal.toLowerCase();
    
    if (sinal === "CALL") comandoElement.innerHTML = "CALL 📈";
    else if (sinal === "PUT") comandoElement.innerHTML = "PUT 📉";
    else comandoElement.innerHTML = "ESPERAR ✋";
  }
  
  const scoreElement = document.getElementById("score");
  if (scoreElement) {
    scoreElement.textContent = `Confiança: ${score}%`;
    scoreElement.style.color = score >= 85 ? '#00ff00' : score >= 70 ? '#ffff00' : '#ff0000';
  }
  
  const timerElement = document.getElementById("timer");
  if (timerElement) {
    timerElement.textContent = formatarTimer(state.timer);
    timerElement.style.color = state.timer <= 10 ? 'red' : 'white';
  }
}

// =============================================
// INDICADORES TÉCNICOS (OTIMIZADOS)
// =============================================
const calcularMedia = {
  exponencial: (dados, periodo) => {
    if (dados.length < periodo) return new Array(dados.length).fill(0);
    
    const k = 2 / (periodo + 1);
    let ema = dados.slice(0, periodo).reduce((a, b) => a + b, 0) / periodo;
    const emaArray = [ema];
    
    for (let i = periodo; i < dados.length; i++) {
      ema = dados[i] * k + ema * (1 - k);
      emaArray.push(ema);
    }
    
    return emaArray;
  }
};

function calcularRSI(closes, periodo = 14) {
  if (closes.length < periodo + 1) return 50;
  
  let gains = 0;
  let losses = 0;
  
  for (let i = 1; i <= periodo; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  
  const avgGain = gains / periodo;
  const avgLoss = Math.max(losses / periodo, 0.000001);
  
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calcularMACD(closes) {
  const ema12 = calcularMedia.exponencial(closes, 12);
  const ema26 = calcularMedia.exponencial(closes, 26);
  
  if (ema26.length < 26) return { histograma: 0 };
  
  const start = ema12.length - ema26.length;
  const macdLine = [];
  
  for (let i = 0; i < ema26.length; i++) {
    macdLine.push(ema12[start + i] - ema26[i]);
  }
  
  const signalLine = calcularMedia.exponencial(macdLine, 9);
  
  if (signalLine.length < 1) return { histograma: 0 };
  
  return {
    histograma: macdLine[macdLine.length - 1] - signalLine[signalLine.length - 1]
  };
}

function calcularVolatilidade(closes) {
  if (closes.length < 20) return 0;
  
  const ultimos = closes.slice(-20);
  const media = ultimos.reduce((a, b) => a + b, 0) / 20;
  const variacao = ultimos.map(c => Math.pow(c - media, 2));
  const variancia = variacao.reduce((a, b) => a + b, 0) / 20;
  
  return Math.sqrt(variancia) / closes[closes.length - 1];
}

// =============================================
// CORE DO SISTEMA
// =============================================
async function analisarMercado() {
  if (state.leituraEmAndamento) return;
  state.leituraEmAndamento = true;
  
  try {
    // Obter dados da API
    const response = await fetch(
      `${CONFIG.API_ENDPOINTS.BINANCE}/klines?symbol=${CONFIG.PARES.CRYPTO_IDX}&interval=1m&limit=70`
    );
    
    if (!response.ok) throw new Error("Falha na API: " + response.status);
    
    const data = await response.json();
    const closes = data.map(item => parseFloat(item[4]));
    const volumes = data.map(item => parseFloat(item[5]));
    const currentClose = closes[closes.length - 1];
    const currentVolume = volumes[volumes.length - 1];
    
    // Calcular indicadores
    const ema8 = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_CURTA).pop();
    const ema21 = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_MEDIA).pop();
    const volumeMedia = volumes.slice(-CONFIG.PERIODOS.SMA_VOLUME).reduce((a, b) => a + b, 0) / CONFIG.PERIODOS.SMA_VOLUME;
    
    const indicadores = {
      rsi: calcularRSI(closes),
      macd: calcularMACD(closes),
      emaCurta: ema8,
      close: currentClose,
      volume: currentVolume,
      volumeMedia: volumeMedia,
      volatilidade: calcularVolatilidade(closes),
      tendencia: avaliarTendencia(ema8, ema21, currentClose)
    };

    // Gerar sinal
    const sinal = gerarSinal(indicadores);
    const score = calcularScore(sinal, indicadores);

    // Atualizar interface
    atualizarInterface(sinal, score);

    // Alertar para sinais fortes
    if (score >= CONFIG.LIMIARES.SCORE_OPERAR) {
      console.log(`SINAL FORTE: ${sinal} (${score}%)`);
      try {
        const audio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==');
        audio.play();
      } catch (e) {
        console.log("Alerta sonoro não suportado");
      }
    }

  } catch (e) {
    console.error("Erro na análise:", e);
    atualizarInterface("ERRO", 0);
  } finally {
    state.leituraEmAndamento = false;
  }
}

// =============================================
// WEBSOCKET CONFIÁVEL
// =============================================
function iniciarWebSocket() {
  if (state.websocket) {
    try {
      state.websocket.close();
    } catch (e) {
      console.log("Erro ao fechar WebSocket anterior:", e);
    }
  }
  
  const ws = new WebSocket(`wss://stream.binance.com:9443/ws/btcusdt@kline_1m`);
  state.websocket = ws;

  ws.onopen = () => {
    console.log('WebSocket conectado');
    state.reconnectAttempts = 0;
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.k?.x) { // Verifica se é o fechamento da vela
        analisarMercado();
        state.timer = 60; // Reinicia o temporizador
      }
    } catch (e) {
      console.log("Erro ao processar mensagem WS:", e);
    }
  };

  ws.onerror = (error) => {
    console.error('Erro no WebSocket:', error);
  };

  ws.onclose = () => {
    console.log('WebSocket fechado. Reconectando...');
    setTimeout(iniciarWebSocket, 3000);
  };
}

// =============================================
// CONTROLE DE TEMPO
// =============================================
function iniciarTimer() {
  clearInterval(state.intervaloAtual);
  
  state.intervaloAtual = setInterval(() => {
    state.timer--;
    atualizarInterface(
      document.getElementById("comando")?.textContent || "ESPERAR", 
      document.getElementById("score")?.textContent.split(" ")[1] || 0
    );
    
    if (state.timer <= 0) {
      analisarMercado();
      state.timer = 60;
    }
  }, 1000);
}

// =============================================
// INICIALIZAÇÃO CONFIÁVEL
// =============================================
async function iniciarAplicativo() {
  // Garante que os elementos DOM existem
  if (!document.getElementById("comando")) {
    document.body.innerHTML = `
      <div id="comando" style="font-size:24px;font-weight:bold;">CARREGANDO...</div>
      <div id="score">-</div>
      <div id="timer">-</div>
    `;
  }
  
  // Iniciar componentes
  iniciarWebSocket();
  iniciarTimer();
  
  // Primeira análise imediata
  analisarMercado();
  
  // Atualizar timer a cada segundo
  setInterval(() => {
    state.timer--;
    const timerElement = document.getElementById("timer");
    if (timerElement) timerElement.textContent = formatarTimer(state.timer);
  }, 1000);
}

// Iniciar quando o documento estiver pronto
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", iniciarAplicativo);
} else {
  iniciarAplicativo();
}
