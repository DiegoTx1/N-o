// =============================================
// CONFIGURAÇÕES GLOBAIS (ATUALIZADAS PARA BINANCE)
// =============================================
const state = {
  timer: 60,
  leituraEmAndamento: false,
  intervaloAtual: null,
  ultimoSinal: null,
  ultimoScore: 0,
  websocket: null,
  timeOffset: 0,
  reconnectDelay: 5000,
  maxReconnectAttempts: 10,
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
    EMA_LONGA: 50,  // Reduzido para melhor performance
    SMA_VOLUME: 20,
    MACD_RAPIDA: 12,
    MACD_LENTA: 26,
    MACD_SINAL: 9,
    ATR: 14,
    VOLUME_PROFILE: 40,  // Período reduzido
    LIQUIDITY_ZONES: 15   // Período reduzido
  },
  LIMIARES: {
    SCORE_OPERAR: 85,
    SCORE_ALERTA: 70,
    VOLAT_MINIMA: 0.005
  }
};

// =============================================
// SISTEMA DE TENDÊNCIA OTIMIZADO
// =============================================
function avaliarTendencia(closes, ema8, ema21) {
  const ultimoClose = closes[closes.length - 1];
  const distancia = Math.abs(ema8 - ema21);
  const forcaBase = Math.min(100, Math.round(distancia / ultimoClose * 1000));
  
  if (forcaBase > 80) {
    return { 
      tendencia: ema8 > ema21 ? "FORTE_ALTA" : "FORTE_BAIXA",
      forca: forcaBase
    };
  }
  
  return { 
    tendencia: "NEUTRA", 
    forca: 0 
  };
}

// =============================================
// GERADOR DE SINAIS CONFIÁVEIS
// =============================================
function gerarSinal(indicadores) {
  const { close, emaCurta, volume, volumeMedia, atr, volatilidade } = indicadores;
  
  // Proteção contra volatilidade baixa
  if (volatilidade < CONFIG.LIMIARES.VOLAT_MINIMA) return "ESPERAR";

  // Filtro de volume
  const limiarVolume = volumeMedia * 1.5;
  if (volume < limiarVolume) return "ESPERAR";

  // Sinal de compra
  if (indicadores.tendencia.tendencia === "FORTE_ALTA" && 
      close > emaCurta && 
      indicadores.macd.histograma > 0) {
    return "CALL";
  }
  
  // Sinal de venda
  if (indicadores.tendencia.tendencia === "FORTE_BAIXA" && 
      close < emaCurta && 
      indicadores.macd.histograma < 0) {
    return "PUT";
  }
  
  return "ESPERAR";
}

// =============================================
// CALCULADOR DE CONFIANÇA RIGOROSO
// =============================================
function calcularScore(sinal, indicadores) {
  let score = 50;

  // Fatores principais
  if (indicadores.tendencia.tendencia.includes(sinal === "CALL" ? "ALTA" : "BAIXA")) score += 25;
  if (indicadores.volume > indicadores.volumeMedia * 1.8) score += 15;
  if (Math.abs(indicadores.rsi - 50) > 20) score += 10;

  return Math.min(100, Math.max(0, score));
}

// =============================================
// FUNÇÕES UTILITÁRIAS OTIMIZADAS
// =============================================
function formatarTimer(segundos) {
  return `0:${segundos.toString().padStart(2, '0')}`;
}

function atualizarInterface(sinal, score) {
  const comandoElement = document.getElementById("comando");
  if (comandoElement) {
    comandoElement.textContent = sinal;
    comandoElement.className = sinal.toLowerCase();
    
    if (sinal === "CALL") comandoElement.textContent += " 📈";
    else if (sinal === "PUT") comandoElement.textContent += " 📉";
    else comandoElement.textContent += " ✋";
  }
  
  const scoreElement = document.getElementById("score");
  if (scoreElement) {
    scoreElement.textContent = `Confiança: ${score}%`;
    scoreElement.style.color = score >= 85 ? '#00ff00' : score >= 70 ? '#ffff00' : '#ff0000';
  }
}

// =============================================
// INDICADORES TÉCNICOS OTIMIZADOS
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

function calcularRSI(closes, periodo = CONFIG.PERIODOS.RSI) {
  if (closes.length < periodo + 1) return 50;
  
  let gains = 0, losses = 0;
  for (let i = 1; i <= periodo; i++) {
    const diff = closes[i] - closes[i - 1];
    diff > 0 ? gains += diff : losses -= diff;
  }

  const rs = (gains / periodo) / Math.max(losses / periodo, 1e-8);
  return 100 - (100 / (1 + rs));
}

function calcularMACD(closes) {
  const ema12 = calcularMedia.exponencial(closes, 12);
  const ema26 = calcularMedia.exponencial(closes, 26);
  
  if (ema12.length < 26 || ema26.length < 26) {
    return { histograma: 0 };
  }
  
  const macdLinha = ema12.slice(14).map((val, idx) => val - ema26[idx + 14]);
  const sinalLinha = calcularMedia.exponencial(macdLinha, 9);
  
  return {
    histograma: macdLinha[macdLinha.length - 1] - sinalLinha[sinalLinha.length - 1] || 0
  };
}

function calcularVolatilidade(closes) {
  if (closes.length < 20) return 0;
  
  const ultimos = closes.slice(-20);
  const media = ultimos.reduce((a, b) => a + b, 0) / 20;
  const variancia = ultimos.reduce((sum, val) => sum + Math.pow(val - media, 2), 0) / 20;
  return Math.sqrt(variancia) / closes[closes.length - 1];
}

// =============================================
// CORE DO SISTEMA (ALTAMENTE OTIMIZADO)
// =============================================
async function analisarMercado() {
  if (state.leituraEmAndamento) return;
  state.leituraEmAndamento = true;
  
  try {
    // Obter dados da API
    const response = await fetch(
      `${CONFIG.API_ENDPOINTS.BINANCE}/klines?symbol=${CONFIG.PARES.CRYPTO_IDX}&interval=1m&limit=70`
    );
    
    if (!response.ok) throw new Error("Falha na API");
    const data = await response.json();
    
    // Processar dados
    const closes = data.map(item => parseFloat(item[4]));
    const volumes = data.map(item => parseFloat(item[5]));
    const currentClose = closes[closes.length - 1];
    
    // Calcular indicadores essenciais
    const ema8 = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_CURTA).pop() || 0;
    const ema21 = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_MEDIA).pop() || 0;
    const volumeMedia = volumes.slice(-CONFIG.PERIODOS.SMA_VOLUME).reduce((a, b) => a + b, 0) / CONFIG.PERIODOS.SMA_VOLUME;
    
    const indicadores = {
      rsi: calcularRSI(closes),
      macd: calcularMACD(closes),
      emaCurta: ema8,
      close: currentClose,
      volume: volumes[volumes.length - 1],
      volumeMedia,
      volatilidade: calcularVolatilidade(closes),
      tendencia: avaliarTendencia(closes, ema8, ema21)
    };

    // Gerar sinal
    const sinal = gerarSinal(indicadores);
    const score = calcularScore(sinal, indicadores);

    // Atualizar interface
    atualizarInterface(sinal, score);

    // Alertar para sinais fortes
    if (score >= CONFIG.LIMIARES.SCORE_OPERAR) {
      console.warn(`!!! SINAL FORTE ${sinal} - ${score}% !!!`);
      new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQ').play().catch(() => {});
    }

  } catch (e) {
    console.error("Erro na análise:", e);
    atualizarInterface("ERRO", 0);
  } finally {
    state.leituraEmAndamento = false;
  }
}

// =============================================
// WEBSOCKET LEVE
// =============================================
function iniciarWebSocket() {
  if (state.websocket) return;
  
  const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${CONFIG.PARES.CRYPTO_IDX.toLowerCase()}@kline_1m`);
  state.websocket = ws;

  ws.onopen = () => {
    console.log('Conectado');
    state.reconnectAttempts = 0;
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.k && data.k.x) analisarMercado();
    } catch {}
  };

  ws.onerror = (error) => {
    console.error('Erro WS:', error);
    ws.close();
  };

  ws.onclose = () => {
    if (state.reconnectAttempts < 5) {
      setTimeout(() => {
        state.reconnectAttempts++;
        iniciarWebSocket();
      }, 2000);
    }
  };
}

// =============================================
// CONTROLE DE TEMPO
// =============================================
function sincronizarTimer() {
  clearInterval(state.intervaloAtual);
  
  state.intervaloAtual = setInterval(() => {
    state.timer--;
    const timerElement = document.getElementById("timer");
    if (timerElement) {
      timerElement.textContent = formatarTimer(state.timer);
      timerElement.style.color = state.timer <= 5 ? 'red' : '';
    }
    
    if (state.timer <= 0) {
      state.timer = 60;
      analisarMercado();
    }
  }, 1000);
}

// =============================================
// INICIALIZAÇÃO LEVE
// =============================================
function iniciarAplicativo() {
  // Elementos mínimos necessários
  if (!document.getElementById("comando") || !document.getElementById("score")) {
    return setTimeout(iniciarAplicativo, 500);
  }
  
  // Iniciar componentes
  iniciarWebSocket();
  sincronizarTimer();
  
  // Primeira análise imediata
  analisarMercado();
}

// Iniciar quando o documento estiver pronto
document.addEventListener("DOMContentLoaded", iniciarAplicativo);
