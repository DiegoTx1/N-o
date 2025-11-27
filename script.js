// =============================================
// CONFIGURAÇÕES SIMPLIFICADAS
// =============================================
const state = {
  ultimos: [],
  timer: 60,
  ultimaAtualizacao: "",
  leituraEmAndamento: false,
  intervaloAtual: null,
  ultimoSinal: null,
  ultimoScore: 0,
  dadosHistoricos: [],
  rsiHistory: []
};

const CONFIG = {
  API_ENDPOINTS: {
    TWELVE_DATA: "https://api.twelvedata.com"
  },
  PARES: {
    CRYPTO_IDX: "BCH/USD"
  }
};

// =============================================
// GERENCIADOR DE CHAVES API
// =============================================
const API_KEYS = [
  "0105e6681b894e0185704171c53f5075",
  "b9d6a5d8a4a24a8f8d6f7d8c6f8d7a5d"
];
let currentKeyIndex = 0;

// =============================================
// FUNÇÕES UTILITÁRIAS
// =============================================
function formatarTimer(segundos) {
  return `0:${segundos.toString().padStart(2, '0')}`;
}

function atualizarRelogio() {
  const elementoHora = document.getElementById("hora");
  if (elementoHora) {
    const now = new Date();
    state.ultimaAtualizacao = now.toLocaleTimeString("pt-BR", {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    elementoHora.textContent = state.ultimaAtualizacao;
  }
}

function atualizarInterface(sinal, score) {
  const comandoElement = document.getElementById("comando");
  if (comandoElement) {
    comandoElement.textContent = sinal;
    comandoElement.className = sinal.toLowerCase();
    
    if (sinal === "CALL") {
      comandoElement.textContent = "CALL 📈";
      try {
        document.getElementById("som-call").play();
      } catch (e) {}
    } else if (sinal === "PUT") {
      comandoElement.textContent = "PUT 📉";
      try {
        document.getElementById("som-put").play();
      } catch (e) {}
    } else if (sinal === "ESPERAR") {
      comandoElement.textContent = "ESPERAR ✋";
    }
  }
  
  const scoreElement = document.getElementById("score");
  if (scoreElement) {
    scoreElement.textContent = `Confiança: ${score}%`;
    if (score >= 70) {
      scoreElement.style.color = '#00ff00';
    } else if (score >= 50) {
      scoreElement.style.color = '#ffff00';
    } else {
      scoreElement.style.color = '#ff0000';
    }
  }
}

// =============================================
// INDICADORES SIMPLIFICADOS
// =============================================
function calcularMediaSimples(dados, periodo) {
  if (!Array.isArray(dados) || dados.length < periodo) return null;
  const slice = dados.slice(-periodo);
  return slice.reduce((a, b) => a + b, 0) / periodo;
}

function calcularRSI(closes) {
  if (closes.length < 15) return 50;
  
  let gains = 0;
  let losses = 0;
  
  for (let i = 1; i < 15; i++) {
    const diff = closes[closes.length - i] - closes[closes.length - i - 1];
    if (diff > 0) {
      gains += diff;
    } else {
      losses -= diff;
    }
  }
  
  if (losses === 0) return 100;
  if (gains === 0) return 0;
  
  const rs = gains / losses;
  return 100 - (100 / (1 + rs));
}

function calcularMACD(closes) {
  if (closes.length < 26) return { histograma: 0 };
  
  const ema12 = calcularMediaSimples(closes.slice(-12), 12);
  const ema26 = calcularMediaSimples(closes.slice(-26), 26);
  
  if (ema12 === null || ema26 === null) return { histograma: 0 };
  
  const macd = ema12 - ema26;
  return { histograma: macd };
}

// =============================================
// SISTEMA DE SINAIS SUPER SIMPLES
// =============================================
function gerarSinalSimples(rsi, macd, precoAtual, mediaMovel) {
  console.log(`Analisando: RSI=${rsi.toFixed(1)}, MACD=${macd.histograma.toFixed(4)}`);
  
  let sinal = "ESPERAR";
  let score = 0;

  // Estratégia 1: RSI Oversold/Overbought
  if (rsi < 25 && macd.histograma > 0) {
    sinal = "CALL";
    score = 75;
    console.log("SINAL CALL: RSI oversold + MACD positivo");
  }
  else if (rsi > 75 && macd.histograma < 0) {
    sinal = "PUT";
    score = 75;
    console.log("SINAL PUT: RSI overbought + MACD negativo");
  }
  
  // Estratégia 2: Tendência MACD
  else if (macd.histograma > 0.5 && rsi < 60) {
    sinal = "CALL";
    score = 65;
    console.log("SINAL CALL: MACD forte positivo");
  }
  else if (macd.histograma < -0.5 && rsi > 40) {
    sinal = "PUT";
    score = 65;
    console.log("SINAL PUT: MACD forte negativo");
  }
  
  // Estratégia 3: RSI médio com confirmação
  else if (rsi < 40 && macd.histograma > 0) {
    sinal = "CALL";
    score = 60;
    console.log("SINAL CALL: RSI baixo + MACD positivo");
  }
  else if (rsi > 60 && macd.histograma < 0) {
    sinal = "PUT";
    score = 60;
    console.log("SINAL PUT: RSI alto + MACD negativo");
  }

  return { sinal, score };
}

// =============================================
// API E DADOS
// =============================================
async function obterDadosTwelveData() {
  try {
    const apiKey = API_KEYS[currentKeyIndex];
    const url = `${CONFIG.API_ENDPOINTS.TWELVE_DATA}/time_series?symbol=${CONFIG.PARES.CRYPTO_IDX}&interval=1min&outputsize=30&apikey=${apiKey}`;
    
    console.log("Obtendo dados do Bitcoin Cash...");
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Falha na API: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.status === 'error') {
      throw new Error(data.message || `Erro Twelve Data: ${data.code}`);
    }
    
    if (!data.values || data.values.length === 0) {
      throw new Error("Dados vazios da API");
    }
    
    console.log("Dados recebidos:", data.values.length, "velas");
    
    const valores = data.values.reverse();
    
    return valores.map(item => ({
      time: item.datetime,
      open: parseFloat(item.open),
      high: parseFloat(item.high),
      low: parseFloat(item.low),
      close: parseFloat(item.close),
      volume: parseFloat(item.volume) || 1
    }));
  } catch (e) {
    console.error("Erro ao obter dados:", e);
    
    // Alternar para próxima chave
    currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
    console.log(`Alternando para chave API: ${currentKeyIndex + 1}`);
    
    throw e;
  }
}

// =============================================
// FUNÇÃO PRINCIPAL SIMPLIFICADA
// =============================================
async function analisarMercado() {
  if (state.leituraEmAndamento) return;
  
  state.leituraEmAndamento = true;
  
  try {
    console.log("=== INICIANDO ANÁLISE ===");
    const dados = await obterDadosTwelveData();
    
    if (dados.length < 10) {
      throw new Error(`Dados insuficientes (${dados.length} velas)`);
    }
    
    const velaAtual = dados[dados.length - 1];
    const closes = dados.map(v => v.close);

    // Calcular indicadores básicos
    const rsi = calcularRSI(closes);
    const macd = calcularMACD(closes);
    const mediaMovel = calcularMediaSimples(closes, 10);

    console.log(`Preço: $${velaAtual.close.toFixed(2)}, RSI: ${rsi.toFixed(1)}, MACD: ${macd.histograma.toFixed(4)}`);

    // Gerar sinal
    const { sinal, score } = gerarSinalSimples(rsi, macd, velaAtual.close, mediaMovel);

    state.ultimoSinal = sinal;
    state.ultimoScore = score;
    state.ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR");

    // Atualizar interface
    atualizarInterface(sinal, score);

    // Atualizar critérios técnicos
    const criteriosElement = document.getElementById("criterios");
    if (criteriosElement) {
      criteriosElement.innerHTML = `
        <li>🎯 BITCOIN CASH (BCH/USD)</li>
        <li>💰 Preço: $${velaAtual.close.toFixed(2)}</li>
        <li>📉 RSI: ${rsi.toFixed(1)} ${rsi < 30 ? '🔻' : rsi > 70 ? '🔺' : ''}</li>
        <li>📊 MACD: ${macd.histograma > 0 ? '+' : ''}${macd.histograma.toFixed(4)}</li>
        <li>📈 Média Móvel (10): $${mediaMovel?.toFixed(2) || 'N/A'}</li>
        <li style="color: #00ff00; font-weight: bold; font-size: 18px;">
          🎯 SINAL: ${sinal} (${score}% confiança)
        </li>
        <li style="color: #ffff00;">
          ⏰ Próxima análise em: <span id="timer">60</span>s
        </li>
      `;
    }

    // Atualizar últimos sinais
    state.ultimos.unshift(`${state.ultimaAtualizacao} - ${sinal} (${score}%)`);
    if (state.ultimos.length > 5) state.ultimos.pop();
    
    const ultimosElement = document.getElementById("ultimos");
    if (ultimosElement) {
      ultimosElement.innerHTML = state.ultimos.map(i => `<li>${i}</li>`).join("");
    }

    console.log(`=== ANÁLISE CONCLUÍDA: ${sinal} (${score}%) ===`);

  } catch (e) {
    console.error("Erro na análise:", e);
    atualizarInterface("ERRO", 0);
    
    const criteriosElement = document.getElementById("criterios");
    if (criteriosElement) {
      criteriosElement.innerHTML = `
        <li style="color: red;">ERRO: ${e.message}</li>
        <li>Tentando novamente em 60 segundos...</li>
      `;
    }
  } finally {
    state.leituraEmAndamento = false;
  }
}

// =============================================
// CONTROLE DE TEMPO
// =============================================
function sincronizarTimer() {
  clearInterval(state.intervaloAtual);
  const agora = new Date();
  const segundos = agora.getSeconds();
  state.timer = 60 - segundos;
  
  const elementoTimer = document.getElementById("timer");
  if (elementoTimer) {
    elementoTimer.textContent = formatarTimer(state.timer);
  }
  
  state.intervaloAtual = setInterval(() => {
    state.timer--;
    
    if (elementoTimer) {
      elementoTimer.textContent = formatarTimer(state.timer);
    }
    
    if (state.timer <= 0) {
      clearInterval(state.intervaloAtual);
      analisarMercado();
      sincronizarTimer();
    }
  }, 1000);
}

// =============================================
// INICIALIZAÇÃO
// =============================================
function iniciarAplicativo() {
  console.log("🚀 INICIANDO TX1 BITCOIN CASH (VERSÃO SIMPLIFICADA)");
  
  // Atualizar relógio
  setInterval(atualizarRelogio, 1000);
  
  // Iniciar timer
  sincronizarTimer();
  
  // Primeira análise em 2 segundos
  setTimeout(() => {
    analisarMercado();
  }, 2000);
}

// Sistema de histórico WIN/LOSS
let wins = 0;
let losses = 0;

function registrar(resultado) {
  if (resultado === 'WIN') {
    wins++;
    alert('🎉 WIN registrado!');
  } else if (resultado === 'LOSS') {
    losses++;
    alert('💔 LOSS registrado!');
  }
  
  document.getElementById('historico').textContent = `${wins} WIN / ${losses} LOSS`;
}

// Iniciar quando o documento estiver pronto
if (document.readyState === "complete") {
  iniciarAplicativo();
} else {
  document.addEventListener("DOMContentLoaded", iniciarAplicativo);
}
