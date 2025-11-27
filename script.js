// =============================================
// CONFIGURAÇÕES GLOBAIS PARA BITCOIN CASH (BCH/USD)
// =============================================
const state = {
  ultimos: [],
  timer: 60,
  ultimaAtualizacao: "",
  leituraEmAndamento: false,
  intervaloAtual: null,
  tentativasErro: 0,
  ultimoSinal: null,
  ultimoScore: 0,
  contadorLaterais: 0,
  marketOpen: true,
  tendenciaDetectada: "NEUTRA",
  forcaTendencia: 0,
  dadosHistoricos: [],
  resistenciaKey: 0,
  suporteKey: 0,
  rsiCache: { avgGain: 0, avgLoss: 0, initialized: false, lastLength: 0 },
  emaCache: {
    ema5: null,
    ema13: null,
    ema50: null,
    ema200: null,
    lastLength: 0
  },
  macdCache: {
    emaRapida: null,
    emaLenta: null,
    macdLine: [],
    signalLine: [],
    lastLength: 0
  },
  superTrendCache: [],
  atrGlobal: 0,
  rsiHistory: [],
  cooldown: 0,
  volumeRelativo: 0,
  obv: 0,
  vwap: 0,
  bandasBollinger: {
    superior: 0,
    inferior: 0,
    medio: 0
  },
  lastSignalTime: 0,
  consecutiveSignalCount: 0,
  logs: [],
  startTime: Date.now()
};

const CONFIG = {
  API_ENDPOINTS: {
    TWELVE_DATA: "https://api.twelvedata.com"
  },
  PARES: {
    CRYPTO_IDX: "BCH/USD"
  },
  PERIODOS: {
    RSI: 14,
    STOCH_K: 14,
    STOCH_D: 3,
    EMA_CURTA: 5,
    EMA_MEDIA: 13,
    EMA_50: 50,
    EMA_LONGA: 200,
    MACD_RAPIDA: 12,
    MACD_LENTA: 26,
    MACD_SINAL: 9,
    VELAS_CONFIRMACAO: 3,
    ANALISE_LATERAL: 20,
    ATR: 14,
    SUPERTREND: 10,
    DIVERGENCIA_LOOKBACK: 8,
    EXTREME_LOOKBACK: 2,
    BOLLINGER: 20,
    VOLUME_LOOKBACK: 10,
    VWAP: 20
  },
  LIMIARES: {
    SCORE_ALTO: 70,
    SCORE_MEDIO: 55,
    RSI_OVERBOUGHT: 70,
    RSI_OVERSOLD: 30,
    STOCH_OVERBOUGHT: 80,
    STOCH_OVERSOLD: 20,
    VARIACAO_LATERAL: 0.008,
    ATR_LIMIAR: 0.02,
    LATERALIDADE_LIMIAR: 0.008,
    VOLUME_ALERTA: 1.3,
    MIN_COOLDOWN: 2,
    MAX_CONSECUTIVE_SIGNALS: 2
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
let errorCount = 0;

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

function atualizarInterface(sinal, score, tendencia, forcaTendencia) {
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
    if (score >= CONFIG.LIMIARES.SCORE_ALTO) {
      scoreElement.style.color = '#00ff00';
    } else if (score >= CONFIG.LIMIARES.SCORE_MEDIO) {
      scoreElement.style.color = '#ffff00';
    } else {
      scoreElement.style.color = '#ff0000';
    }
  }
}

// =============================================
// INDICADORES TÉCNICOS SIMPLIFICADOS
// =============================================
const calcularMedia = {
  simples: (dados, periodo) => {
    if (!Array.isArray(dados) || dados.length < periodo) return null;
    const slice = dados.slice(-periodo);
    return slice.reduce((a, b) => a + b, 0) / periodo;
  },

  exponencial: (dados, periodo) => {
    if (!Array.isArray(dados) || dados.length < periodo) return null;
    
    const k = 2 / (periodo + 1);
    let ema = calcularMedia.simples(dados.slice(0, periodo), periodo);
    if (ema === null) return null;
    
    for (let i = periodo; i < dados.length; i++) {
      ema = dados[i] * k + ema * (1 - k);
    }
    
    return ema;
  }
};

function calcularRSI(closes, periodo = CONFIG.PERIODOS.RSI) {
  if (closes.length < periodo + 1) return 50;
  
  let gains = 0;
  let losses = 0;
  
  for (let i = 1; i <= periodo; i++) {
    const diff = closes[closes.length - i] - closes[closes.length - i - 1];
    if (diff > 0) {
      gains += diff;
    } else {
      losses -= diff;
    }
  }
  
  const avgGain = gains / periodo;
  const avgLoss = losses / periodo;
  
  if (avgLoss === 0) return 100;
  
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calcularStochastic(highs, lows, closes, periodoK = CONFIG.PERIODOS.STOCH_K) {
  if (closes.length < periodoK) return { k: 50, d: 50 };
  
  const currentClose = closes[closes.length - 1];
  const periodHighs = highs.slice(-periodoK);
  const periodLows = lows.slice(-periodoK);
  
  const highestHigh = Math.max(...periodHighs);
  const lowestLow = Math.min(...periodLows);
  
  if (highestHigh === lowestLow) return { k: 50, d: 50 };
  
  const k = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
  
  return {
    k: k,
    d: k
  };
}

function calcularMACD(closes, rapida = CONFIG.PERIODOS.MACD_RAPIDA, lenta = CONFIG.PERIODOS.MACD_LENTA) {
  if (closes.length < lenta) return { histograma: 0, macdLinha: 0, sinalLinha: 0 };
  
  const emaRapida = calcularMedia.exponencial(closes, rapida);
  const emaLenta = calcularMedia.exponencial(closes, lenta);
  
  if (emaRapida === null || emaLenta === null) {
    return { histograma: 0, macdLinha: 0, sinalLinha: 0 };
  }
  
  const macdLinha = emaRapida - emaLenta;
  
  return {
    histograma: macdLinha,
    macdLinha: macdLinha,
    sinalLinha: 0
  };
}

function calcularBandasBollinger(closes, periodo = CONFIG.PERIODOS.BOLLINGER) {
  if (closes.length < periodo) {
    const media = calcularMedia.simples(closes, closes.length) || closes[closes.length - 1];
    return { superior: media, inferior: media, medio: media };
  }
  
  const slice = closes.slice(-periodo);
  const media = calcularMedia.simples(slice, periodo);
  
  let somaQuadrados = 0;
  slice.forEach(valor => {
    somaQuadrados += Math.pow(valor - media, 2);
  });
  
  const desvioPadrao = Math.sqrt(somaQuadrados / periodo);
  
  return {
    superior: media + (desvioPadrao * 2),
    inferior: media - (desvioPadrao * 2),
    medio: media
  };
}

// =============================================
// ANÁLISE TÉCNICA SIMPLIFICADA
// =============================================
function avaliarTendencia(ema5, ema13, ema50) {
  if (ema5 === null || ema13 === null || ema50 === null) {
    return { tendencia: "NEUTRA", forca: 0 };
  }
  
  const diffCurta = ema5 - ema13;
  const diffLonga = ema13 - ema50;
  const forca = Math.min(100, (Math.abs(diffCurta) * 100 + Math.abs(diffLonga) * 50));
  
  if (diffCurta > 0 && diffLonga > 0) {
    return { tendencia: "ALTA", forca };
  } else if (diffCurta < 0 && diffLonga < 0) {
    return { tendencia: "BAIXA", forca };
  } else {
    return { tendencia: "NEUTRA", forca: 0 };
  }
}

function detectarLateralidade(closes, periodo = CONFIG.PERIODOS.ANALISE_LATERAL) {
  if (closes.length < periodo) return false;
  
  let variacaoTotal = 0;
  for (let i = closes.length - 1; i > closes.length - periodo; i--) {
    if (i === 0) break;
    const variacao = Math.abs((closes[i] - closes[i-1]) / closes[i-1]);
    variacaoTotal += variacao;
  }
  
  const variacaoMedia = variacaoTotal / periodo;
  return variacaoMedia < CONFIG.LIMIARES.LATERALIDADE_LIMIAR;
}

function calcularZonasPreco(dados, periodo = 20) {
  if (dados.length < periodo) periodo = dados.length;
  
  const slice = dados.slice(-periodo);
  const highs = slice.map(v => v.high);
  const lows = slice.map(v => v.low);
  
  const resistencia = Math.max(...highs);
  const suporte = Math.min(...lows);
  
  return {
    resistencia,
    suporte,
    pivot: (resistencia + suporte) / 2
  };
}

// =============================================
// SISTEMA DE SINAIS SIMPLIFICADO
// =============================================
function calcularScore(sinal, indicadores) {
  if (sinal === "ESPERAR") return 0;
  
  let score = 50;
  const { rsi, stoch, macd, close, emaCurta, emaMedia, tendencia, bandasBollinger } = indicadores;

  // Tendência
  if (tendencia.forca > 50) {
    if ((sinal === "CALL" && tendencia.tendencia === "ALTA") ||
        (sinal === "PUT" && tendencia.tendencia === "BAIXA")) {
      score += 20;
    }
  }

  // RSI
  if (sinal === "CALL") {
    if (rsi < CONFIG.LIMIARES.RSI_OVERSOLD) score += 15;
    if (rsi > 30 && rsi < 70) score += 10;
  } else {
    if (rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT) score += 15;
    if (rsi > 30 && rsi < 70) score += 10;
  }

  // MACD
  if ((sinal === "CALL" && macd.histograma > 0) ||
      (sinal === "PUT" && macd.histograma < 0)) {
    score += 15;
  }

  // Médias
  if ((sinal === "CALL" && close > emaCurta) ||
      (sinal === "PUT" && close < emaCurta)) {
    score += 10;
  }

  // Bollinger
  if ((sinal === "CALL" && close < bandasBollinger.inferior) ||
      (sinal === "PUT" && close > bandasBollinger.superior)) {
    score += 10;
  }

  return Math.min(100, Math.max(0, score));
}

function gerarSinal(indicadores, lateral) {
  const { rsi, stoch, macd, close, emaCurta, emaMedia, tendencia, bandasBollinger } = indicadores;

  // Sinal CALL
  if (rsi < CONFIG.LIMIARES.RSI_OVERSOLD && 
      macd.histograma > 0 &&
      close > emaCurta &&
      !lateral) {
    return "CALL";
  }

  // Sinal PUT
  if (rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT && 
      macd.histograma < 0 &&
      close < emaCurta &&
      !lateral) {
    return "PUT";
  }

  // Sinal por tendência forte
  if (tendencia.forca > 70) {
    if (tendencia.tendencia === "ALTA" && close > emaMedia) {
      return "CALL";
    }
    if (tendencia.tendencia === "BAIXA" && close < emaMedia) {
      return "PUT";
    }
  }

  // Sinal por Bollinger
  if (close < bandasBollinger.inferior && macd.histograma > 0) {
    return "CALL";
  }
  if (close > bandasBollinger.superior && macd.histograma < 0) {
    return "PUT";
  }

  return "ESPERAR";
}

// =============================================
// API E DADOS
// =============================================
async function obterDadosTwelveData() {
  try {
    const apiKey = API_KEYS[currentKeyIndex];
    const url = `${CONFIG.API_ENDPOINTS.TWELVE_DATA}/time_series?symbol=${CONFIG.PARES.CRYPTO_IDX}&interval=1min&outputsize=100&apikey=${apiKey}`;
    
    console.log("Obtendo dados da API...");
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
    
    errorCount++;
    if (errorCount >= 2) {
      currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
      errorCount = 0;
      console.log("Alternando para chave API:", currentKeyIndex + 1);
    }
    
    throw e;
  }
}

// =============================================
// FUNÇÃO PRINCIPAL CORRIGIDA
// =============================================
async function analisarMercado() {
  if (state.leituraEmAndamento) {
    console.log("Leitura já em andamento...");
    return;
  }
  
  state.leituraEmAndamento = true;
  
  try {
    console.log("Iniciando análise...");
    const dados = await obterDadosTwelveData();
    state.dadosHistoricos = dados;
    
    if (dados.length < 10) {
      throw new Error(`Dados insuficientes (${dados.length} velas)`);
    }
    
    const velaAtual = dados[dados.length - 1];
    const closes = dados.map(v => v.close);
    const highs = dados.map(v => v.high);
    const lows = dados.map(v => v.low);

    // Calcular indicadores básicos
    const ema5 = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_CURTA);
    const ema13 = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_MEDIA);
    const ema50 = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_50);
    
    const rsi = calcularRSI(closes);
    const stoch = calcularStochastic(highs, lows, closes);
    const macd = calcularMACD(closes);
    const bandasBollinger = calcularBandasBollinger(closes);
    
    const tendencia = avaliarTendencia(ema5, ema13, ema50);
    const lateral = detectarLateralidade(closes);
    const zonas = calcularZonasPreco(dados);
    
    state.resistenciaKey = zonas.resistencia;
    state.suporteKey = zonas.suporte;
    state.tendenciaDetectada = tendencia.tendencia;
    state.forcaTendencia = tendencia.forca;

    const indicadores = {
      rsi,
      stoch,
      macd,
      emaCurta: ema5,
      emaMedia: ema13,
      ema50,
      close: velaAtual.close,
      tendencia,
      bandasBollinger
    };

    let sinal = gerarSinal(indicadores, lateral);
    const score = calcularScore(sinal, indicadores);

    state.ultimoSinal = sinal;
    state.ultimoScore = score;
    state.ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR");

    console.log(`Sinal: ${sinal}, Score: ${score}%`);

    // Atualizar interface
    atualizarInterface(sinal, score, state.tendenciaDetectada, state.forcaTendencia);

    const criteriosElement = document.getElementById("criterios");
    if (criteriosElement) {
      criteriosElement.innerHTML = `
        <li>🎯 BITCOIN CASH (BCH/USD)</li>
        <li>📊 Tendência: ${state.tendenciaDetectada} (${Math.round(state.forcaTendencia)}%)</li>
        <li>💰 Preço: $${indicadores.close.toFixed(2)}</li>
        <li>📉 RSI: ${rsi.toFixed(1)} ${rsi < CONFIG.LIMIARES.RSI_OVERSOLD ? '🔻' : rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT ? '🔺' : ''}</li>
        <li>📊 MACD: ${macd.histograma > 0 ? '+' : ''}${macd.histograma.toFixed(4)}</li>
        <li>📈 Stochastic: ${stoch.k.toFixed(1)}</li>
        <li>📌 EMA5: ${ema5?.toFixed(2) || 'N/A'} | EMA13: ${ema13?.toFixed(2) || 'N/A'}</li>
        <li>📊 Suporte: $${state.suporteKey.toFixed(2)} | Resistência: $${state.resistenciaKey.toFixed(2)}</li>
        <li>🔄 Lateral: ${lateral ? 'SIM' : 'NÃO'}</li>
        <li>📊 Bollinger: ${(indicadores.close > bandasBollinger.medio ? 'ACIMA' : 'ABAIXO')}</li>
        <li style="color: #00ff00; font-weight: bold;">🎯 SINAL: ${sinal} (${score}% confiança)</li>
      `;
    }

    state.ultimos.unshift(`${state.ultimaAtualizacao} - ${sinal} (${score}%)`);
    if (state.ultimos.length > 6) state.ultimos.pop();
    
    const ultimosElement = document.getElementById("ultimos");
    if (ultimosElement) {
      ultimosElement.innerHTML = state.ultimos.map(i => `<li>${i}</li>`).join("");
    }

    state.tentativasErro = 0;
    
  } catch (e) {
    console.error("Erro na análise:", e);
    atualizarInterface("ERRO", 0, "ERRO", 0);
    
    const criteriosElement = document.getElementById("criterios");
    if (criteriosElement) {
      criteriosElement.innerHTML = `
        <li style="color: red;">ERRO: ${e.message}</li>
        <li>Tentando novamente em 60 segundos...</li>
      `;
    }
    
    state.tentativasErro++;
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
  console.log("Iniciando TX1 Bitcoin Cash...");
  
  // Atualizar relógio
  setInterval(atualizarRelogio, 1000);
  
  // Iniciar timer
  sincronizarTimer();
  
  // Primeira análise em 3 segundos
  setTimeout(() => {
    analisarMercado();
  }, 3000);
}

// Iniciar quando o documento estiver pronto
if (document.readyState === "complete") {
  iniciarAplicativo();
} else {
  document.addEventListener("DOMContentLoaded", iniciarAplicativo);
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
