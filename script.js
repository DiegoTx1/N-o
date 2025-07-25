// =============================================
// CONFIGURAÇÕES GLOBAIS (OTIMIZADAS PARA CRYPTO IDX)
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
  rsiCache: { avgGain: 0, avgLoss: 0, initialized: false, lastClose: 0 },
  emaCache: {
    ema5: null,
    ema13: null,
    ema50: null,
    ema200: null
  },
  macdCache: {
    emaRapida: null,
    emaLenta: null,
    macdLine: [],
    signalLine: []
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
  stochasticCache: {
    kValues: [],
    dValues: []
  }
};

const CONFIG = {
  API_ENDPOINTS: {
    TWELVE_DATA: "https://api.twelvedata.com"
  },
  PARES: {
    CRYPTO_IDX: "BTC/USD"
  },
  PERIODOS: {
    RSI: 9,
    STOCH_K: 14,
    STOCH_D: 3,
    EMA_CURTA: 5,
    EMA_MEDIA: 13,
    EMA_50: 50,
    EMA_LONGA: 200,
    MACD_RAPIDA: 6,
    MACD_LENTA: 13,
    MACD_SINAL: 9,
    VELAS_CONFIRMACAO: 3,
    ANALISE_LATERAL: 20,
    ATR: 14,
    SUPERTREND: 7,
    DIVERGENCIA_LOOKBACK: 8,
    EXTREME_LOOKBACK: 2,
    BOLLINGER: 20,
    VOLUME_LOOKBACK: 10,
    VWAP: 20
  },
  LIMIARES: {
    SCORE_ALTO: 85,
    SCORE_MEDIO: 70,
    RSI_OVERBOUGHT: 78,
    RSI_OVERSOLD: 22,
    STOCH_OVERBOUGHT: 85,
    STOCH_OVERSOLD: 15,
    VARIACAO_LATERAL: 0.008,
    ATR_LIMIAR: 0.025,
    LATERALIDADE_LIMIAR: 0.008,
    VOLUME_ALERTA: 1.5,
    VOLUME_MINIMO: 0.8
  },
  PESOS: {
    RSI: 1.7,
    MACD: 2.2,
    TENDENCIA: 2.8,
    STOCH: 1.2,
    SUPERTREND: 1.9,
    DIVERGENCIA: 2.0,
    VOLUME: 1.5,
    VWAP: 1.3,
    BOLLINGER: 1.4
  }
};

// =============================================
// GERENCIADOR DE CHAVES API
// =============================================
const API_KEYS = [
  "0105e6681b894e0185704171c53f5075",
  "b5c4b035a4a24d5b9f3b5b3d5c7e9f7a",
  "d1e0a8c8a0e84e8f9f4e5b5d5c7e9f7a"
];
let currentKeyIndex = 0;
let errorCount = 0;

// =============================================
// SISTEMA DE TENDÊNCIA OTIMIZADO (COM EMA50)
// =============================================
function avaliarTendencia(ema5, ema13, ema50) {
  if (ema5 === null || ema13 === null || ema50 === null) {
    return { tendencia: "NEUTRA", forca: 0 };
  }
  
  const diffCurta = ema5 - ema13;
  const diffLonga = ema13 - ema50;
  const forca = Math.min(100, (Math.abs(diffCurta) * 5000 + Math.abs(diffLonga) * 3000));
  
  if (forca > 80) {
    return diffCurta > 0 && diffLonga > 0 
      ? { tendencia: "FORTE_ALTA", forca }
      : diffCurta < 0 && diffLonga < 0 
        ? { tendencia: "FORTE_BAIXA", forca }
        : { tendencia: "NEUTRA", forca: 0 };
  }
  
  if (forca > 45) {
    return diffCurta > 0 
      ? { tendencia: "ALTA", forca } 
      : { tendencia: "BAIXA", forca };
  }
  
  return { tendencia: "NEUTRA", forca: 0 };
}

// =============================================
// DETECÇÃO DE LATERALIDADE (OTIMIZADA)
// =============================================
function detectarLateralidade(closes, periodo = CONFIG.PERIODOS.ANALISE_LATERAL, limiar = CONFIG.LIMIARES.LATERALIDADE_LIMIAR) {
  if (closes.length < periodo) return false;
  
  let countLaterais = 0;
  for (let i = closes.length - 1; i > closes.length - periodo; i--) {
    const variacao = Math.abs((closes[i] - closes[i-1]) / closes[i-1]);
    if (variacao < limiar) countLaterais++;
  }
  
  state.contadorLaterais = countLaterais;
  return countLaterais > periodo * 0.7;
}

// =============================================
// CÁLCULO DE SUPORTE/RESISTÊNCIA
// =============================================
function calcularZonasPreco(dados, periodo = 50) {
  if (!dados || dados.length === 0) return { resistencia: 0, suporte: 0, pivot: 0 };
  
  if (dados.length < periodo) periodo = dados.length;
  const slice = dados.slice(-periodo);
  const highs = slice.map(v => v.high);
  const lows = slice.map(v => v.low);
  return {
    resistencia: Math.max(...highs),
    suporte: Math.min(...lows),
    pivot: (Math.max(...highs) + Math.min(...lows) + dados[dados.length-1].close) / 3
  };
}

// =============================================
// INDICADORES PARA CRIPTO (OTIMIZADOS)
// =============================================

// 1. Volume Relativo (com cache)
function calcularVolumeRelativo(volumes, periodo = CONFIG.PERIODOS.VOLUME_LOOKBACK) {
  if (!volumes || volumes.length < periodo) return 0;
  
  const ultimoVolume = volumes[volumes.length - 1];
  
  // Se já temos dados suficientes, calcula incrementalmente
  if (state.volumeRelativo > 0 && volumes.length >= periodo) {
    const primeiroVolume = volumes[volumes.length - periodo];
    const mediaAnterior = state.volumeRelativo * periodo;
    const novaMedia = (mediaAnterior - primeiroVolume + ultimoVolume) / periodo;
    return novaMedia;
  }
  
  // Cálculo completo
  const slice = volumes.slice(-periodo);
  const mediaVolume = calcularMedia.simples(slice, periodo);
  return ultimoVolume / mediaVolume;
}

// 2. On-Balance Volume (OBV) incremental
function atualizarOBV(closeAtual, closeAnterior, volumeAtual) {
  if (closeAtual > closeAnterior) {
    state.obv += volumeAtual;
  } else if (closeAtual < closeAnterior) {
    state.obv -= volumeAtual;
  }
  return state.obv;
}

// 3. VWAP otimizado
function atualizarVWAP(dados, periodo = CONFIG.PERIODOS.VWAP) {
  if (!dados || dados.length < periodo) return 0;
  
  const novoDado = dados[dados.length - 1];
  const tp = (novoDado.high + novoDado.low + novoDado.close) / 3;
  
  // Se já temos VWAP calculado, atualiza incrementalmente
  if (state.vwap > 0 && dados.length > periodo) {
    const dadoRemovido = dados[dados.length - periodo - 1];
    const tpRemovido = (dadoRemovido.high + dadoRemovido.low + dadoRemovido.close) / 3;
    
    state.vwap = ((state.vwap * periodo * dadoRemovido.volume) - (tpRemovido * dadoRemovido.volume) + (tp * novoDado.volume)) / 
                 (periodo * novoDado.volume - dadoRemovido.volume + novoDado.volume);
    return state.vwap;
  }
  
  // Cálculo completo
  return calcularVWAP(dados, periodo);
}

// 4. Bandas de Bollinger com cache
function calcularBandasBollinger(closes, periodo = CONFIG.PERIODOS.BOLLINGER, desvios = 2) {
  if (!closes || closes.length < periodo) 
    return { superior: 0, inferior: 0, medio: state.bandasBollinger.medio || 0 };
  
  const media = calcularMedia.simples(closes.slice(-periodo), periodo);
  
  let somaQuadrados = 0;
  const slice = closes.slice(-periodo);
  slice.forEach(valor => {
    somaQuadrados += Math.pow(valor - media, 2);
  });
  
  const desvioPadrao = Math.sqrt(somaQuadrados / periodo);
  
  state.bandasBollinger = {
    superior: media + (desvioPadrao * desvios),
    inferior: media - (desvioPadrao * desvios),
    medio: media
  };
  
  return state.bandasBollinger;
}

// =============================================
// GERADOR DE SINAIS OTIMIZADO
// =============================================
function gerarSinal(indicadores, divergencias, lateral) {
  const {
    rsi,
    stoch,
    macd,
    close,
    emaCurta,
    emaMedia,
    ema50,
    superTrend,
    tendencia,
    volumeRelativo,
    vwap,
    bandasBollinger,
    closeAnterior
  } = indicadores;

  // Filtro de volume mínimo
  if (volumeRelativo < CONFIG.LIMIARES.VOLUME_MINIMO) {
    return "ESPERAR";
  }

  // 1. Tendência forte com volume
  if (tendencia.forca > 80 && volumeRelativo > CONFIG.LIMIARES.VOLUME_ALERTA) {
    if (tendencia.tendencia === "FORTE_ALTA" && 
        close > vwap && 
        close > bandasBollinger.medio &&
        close > closeAnterior) {
      return "CALL";
    }
    if (tendencia.tendencia === "FORTE_BAIXA" && 
        close < vwap && 
        close < bandasBollinger.medio &&
        close < closeAnterior) {
      return "PUT";
    }
  }

  // 2. Breakout com volume e Bollinger
  const limiteBreakout = (bandasBollinger.superior - bandasBollinger.inferior) * 0.1;
  
  if (close > (bandasBollinger.superior + limiteBreakout) && 
      volumeRelativo > 1.8 &&
      close > closeAnterior) {
    return "CALL";
  }
  
  if (close < (bandasBollinger.inferior - limiteBreakout) && 
      volumeRelativo > 1.8 &&
      close < closeAnterior) {
    return "PUT";
  }

  // 3. Divergências com confirmação de tendência
  if (divergencias.divergenciaRSI) {
    if (divergencias.tipoDivergencia === "ALTA" && 
        state.obv > 0 &&
        tendencia.tendencia.includes("ALTA")) {
      return "CALL";
    }
    
    if (divergencias.tipoDivergencia === "BAIXA" && 
        state.obv < 0 &&
        tendencia.tendencia.includes("BAIXA")) {
      return "PUT";
    }
  }

  // 4. Reversão com múltiplos indicadores
  if (rsi < CONFIG.LIMIARES.RSI_OVERSOLD && 
      stoch.k < CONFIG.LIMIARES.STOCH_OVERSOLD && 
      close > vwap && 
      macd.histograma > 0 &&
      close > closeAnterior) {
    return "CALL";
  }
  
  if (rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT && 
      stoch.k > CONFIG.LIMIARES.STOCH_OVERBOUGHT && 
      close < vwap && 
      macd.histograma < 0 &&
      close < closeAnterior) {
    return "PUT";
  }
  
  return "ESPERAR";
}

// =============================================
// CALCULADOR DE CONFIANÇA OTIMIZADO
// =============================================
function calcularScore(sinal, indicadores, divergencias) {
  let score = 65;

  const fatores = {
    alinhamentoTendencia: sinal === "CALL" && indicadores.tendencia.tendencia.includes("ALTA") ||
                          sinal === "PUT" && indicadores.tendencia.tendencia.includes("BAIXA") ? 25 : 0,
    divergencia: divergencias.divergenciaRSI ? 20 : 0,
    volume: indicadores.volumeRelativo > CONFIG.LIMIARES.VOLUME_ALERTA ? 15 : 0,
    vwap: sinal === "CALL" && indicadores.close > indicadores.vwap ? 10 : 
           sinal === "PUT" && indicadores.close < indicadores.vwap ? 10 : 0,
    bollinger: sinal === "CALL" && indicadores.close > indicadores.bandasBollinger.medio ? 8 :
               sinal === "PUT" && indicadores.close < indicadores.bandasBollinger.medio ? 8 : 0,
    obv: (sinal === "CALL" && state.obv > 0) || (sinal === "PUT" && state.obv < 0) ? 7 : 0,
    confirmacao: indicadores.close > indicadores.closeAnterior ? 5 : -5
  };
  
  score += Object.values(fatores).reduce((sum, val) => sum + val, 0);
  
  // Penalizar lateralidade prolongada
  if (state.contadorLaterais > 5) score = Math.max(0, score - 15);
  
  // Reforçar sinais com múltiplas confirmações
  if (fatores.alinhamentoTendencia > 0 && fatores.volume > 0 && fatores.vwap > 0) {
    score = Math.min(100, score + 10);
  }
  
  return Math.min(100, Math.max(0, score));
}

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
    state.marketOpen = true;
  }
}

function atualizarInterface(sinal, score, tendencia, forcaTendencia) {
  if (!state.marketOpen) return;
  
  const comandoElement = document.getElementById("comando");
  if (comandoElement) {
    comandoElement.textContent = sinal;
    comandoElement.className = sinal.toLowerCase();
    
    if (sinal === "CALL") comandoElement.innerHTML = "CALL 📈";
    else if (sinal === "PUT") comandoElement.innerHTML = "PUT 📉";
    else if (sinal === "ESPERAR") comandoElement.innerHTML = "ESPERAR ✋";
    else comandoElement.innerHTML = "ERRO ❌";
  }
  
  const scoreElement = document.getElementById("score");
  if (scoreElement) {
    scoreElement.textContent = `Confiança: ${score}%`;
    if (score >= CONFIG.LIMIARES.SCORE_ALTO) scoreElement.style.color = '#00ff00';
    else if (score >= CONFIG.LIMIARES.SCORE_MEDIO) scoreElement.style.color = '#ffff00';
    else scoreElement.style.color = '#ff0000';
  }
  
  const tendenciaElement = document.getElementById("tendencia");
  const forcaElement = document.getElementById("forca-tendencia");
  if (tendenciaElement && forcaElement) {
    tendenciaElement.textContent = tendencia;
    forcaElement.textContent = `${forcaTendencia}%`;
    
    // Cores baseadas na tendência
    if (tendencia.includes("ALTA")) {
      tendenciaElement.style.color = '#00ff00';
      forcaElement.style.color = '#00ff00';
    } else if (tendencia.includes("BAIXA")) {
      tendenciaElement.style.color = '#ff0000';
      forcaElement.style.color = '#ff0000';
    } else {
      tendenciaElement.style.color = '#ffff00';
      forcaElement.style.color = '#ffff00';
    }
  }
}

// =============================================
// INDICADORES TÉCNICOS (OTIMIZADOS)
// =============================================
const calcularMedia = {
  simples: (dados, periodo) => {
    if (!Array.isArray(dados) || dados.length < periodo) return null;
    const slice = dados.slice(-periodo);
    return slice.reduce((a, b) => a + b, 0) / periodo;
  },

  exponencial: (dados, periodo) => {
    if (!Array.isArray(dados) || dados.length < periodo) return [];
    
    const k = 2 / (periodo + 1);
    let ema = calcularMedia.simples(dados.slice(0, periodo), periodo);
    const emaArray = [ema];
    
    for (let i = periodo; i < dados.length; i++) {
      ema = dados[i] * k + ema * (1 - k);
      emaArray.push(ema);
    }
    
    return emaArray;
  }
};

function calcularRSI(closes, periodo = CONFIG.PERIODOS.RSI) {
  try {
    if (closes.length < periodo + 1) return 50;
    
    const ultimoClose = closes[closes.length - 1];
    
    if (!state.rsiCache.initialized) {
      let gains = 0, losses = 0;
      for (let i = 1; i <= periodo; i++) {
        const diff = closes[i] - closes[i - 1];
        if (diff > 0) gains += diff;
        else losses -= diff;
      }
      
      state.rsiCache.avgGain = gains / periodo;
      state.rsiCache.avgLoss = losses / periodo;
      state.rsiCache.initialized = true;
      state.rsiCache.lastClose = closes[closes.length - 1];
      
      const rs = state.rsiCache.avgLoss === 0 ? Infinity : state.rsiCache.avgGain / state.rsiCache.avgLoss;
      return 100 - (100 / (1 + rs));
    }
    
    const diff = ultimoClose - state.rsiCache.lastClose;
    state.rsiCache.lastClose = ultimoClose;
    
    if (diff > 0) {
      state.rsiCache.avgGain = ((state.rsiCache.avgGain * (periodo - 1)) + diff) / periodo;
      state.rsiCache.avgLoss = (state.rsiCache.avgLoss * (periodo - 1)) / periodo;
    } else {
      state.rsiCache.avgGain = (state.rsiCache.avgGain * (periodo - 1)) / periodo;
      state.rsiCache.avgLoss = ((state.rsiCache.avgLoss * (periodo - 1)) - diff) / periodo;
    }
    
    const rs = state.rsiCache.avgLoss === 0 ? Infinity : state.rsiCache.avgGain / state.rsiCache.avgLoss;
    return 100 - (100 / (1 + rs));
  } catch (e) {
    console.error("Erro no cálculo RSI:", e);
    return 50;
  }
}

function calcularStochastic(highs, lows, closes, 
                          periodoK = CONFIG.PERIODOS.STOCH_K, 
                          periodoD = CONFIG.PERIODOS.STOCH_D) {
  try {
    if (closes.length < periodoK) return { k: 50, d: 50 };
    
    // Usar cálculo incremental se possível
    if (state.stochasticCache.kValues.length > 0 && 
        state.stochasticCache.kValues.length === closes.length - 1) {
      
      const i = closes.length - 1;
      const startIndex = Math.max(0, i - periodoK + 1);
      const sliceHigh = highs.slice(startIndex, i + 1);
      const sliceLow = lows.slice(startIndex, i + 1);
      
      const highestHigh = Math.max(...sliceHigh);
      const lowestLow = Math.min(...sliceLow);
      const range = highestHigh - lowestLow;
      const k = range !== 0 ? ((closes[i] - lowestLow) / range) * 100 : 50;
      
      state.stochasticCache.kValues.push(k);
      
      // Calcular K suavizado (D)
      if (state.stochasticCache.kValues.length >= periodoD) {
        const kSlice = state.stochasticCache.kValues.slice(-periodoD);
        const d = calcularMedia.simples(kSlice, periodoD) || 50;
        state.stochasticCache.dValues.push(d);
      } else {
        state.stochasticCache.dValues.push(50);
      }
      
      return {
        k: state.stochasticCache.kValues[state.stochasticCache.kValues.length - 1],
        d: state.stochasticCache.dValues[state.stochasticCache.dValues.length - 1]
      };
    }
    
    // Cálculo completo
    state.stochasticCache = { kValues: [], dValues: [] };
    
    const kValues = [];
    for (let i = periodoK - 1; i < closes.length; i++) {
      const startIndex = Math.max(0, i - periodoK + 1);
      const sliceHigh = highs.slice(startIndex, i + 1);
      const sliceLow = lows.slice(startIndex, i + 1);
      
      const highestHigh = Math.max(...sliceHigh);
      const lowestLow = Math.min(...sliceLow);
      const range = highestHigh - lowestLow;
      const k = range !== 0 ? ((closes[i] - lowestLow) / range) * 100 : 50;
      kValues.push(k);
      state.stochasticCache.kValues.push(k);
    }
    
    const dValues = [];
    for (let i = periodoD - 1; i < kValues.length; i++) {
      const startIndex = Math.max(0, i - periodoD + 1);
      const slice = kValues.slice(startIndex, i + 1);
      dValues.push(calcularMedia.simples(slice, periodoD) || 50);
      state.stochasticCache.dValues.push(dValues[dValues.length - 1]);
    }
    
    return {
      k: kValues[kValues.length - 1] || 50,
      d: dValues[dValues.length - 1] || 50
    };
  } catch (e) {
    console.error("Erro no cálculo Stochastic:", e);
    return { k: 50, d: 50 };
  }
}

function calcularMACD(closes, rapida = CONFIG.PERIODOS.MACD_RAPIDA, 
                    lenta = CONFIG.PERIODOS.MACD_LENTA, 
                    sinal = CONFIG.PERIODOS.MACD_SINAL) {
  try {
    if (closes.length < lenta) return { histograma: 0, macdLinha: 0, sinalLinha: 0 };
    
    // Inicializar cache se necessário
    if (state.macdCache.emaRapida === null || state.macdCache.emaLenta === null) {
      const emaRapida = calcularMedia.exponencial(closes, rapida);
      const emaLenta = calcularMedia.exponencial(closes, lenta);
      
      const startIdx = Math.max(0, lenta - rapida);
      const macdLinha = emaRapida.slice(startIdx).map((val, idx) => val - emaLenta[idx]);
      const sinalLinha = calcularMedia.exponencial(macdLinha, sinal);
      
      state.macdCache = {
        emaRapida: emaRapida[emaRapida.length - 1],
        emaLenta: emaLenta[emaLenta.length - 1],
        macdLine: macdLinha,
        signalLine: sinalLinha
      };
    } else {
      // Atualização incremental
      const kRapida = 2 / (rapida + 1);
      const kLenta = 2 / (lenta + 1);
      const kSinal = 2 / (sinal + 1);
      
      const novoValor = closes[closes.length - 1];
      
      state.macdCache.emaRapida = novoValor * kRapida + state.macdCache.emaRapida * (1 - kRapida);
      state.macdCache.emaLenta = novoValor * kLenta + state.macdCache.emaLenta * (1 - kLenta);
      
      const novaMacdLinha = state.macdCache.emaRapida - state.macdCache.emaLenta;
      
      let novoSinal;
      if (state.macdCache.signalLine.length === 0) {
        novoSinal = novaMacdLinha;
      } else {
        const ultimoSinal = state.macdCache.signalLine[state.macdCache.signalLine.length - 1];
        novoSinal = novaMacdLinha * kSinal + ultimoSinal * (1 - kSinal);
      }
      
      state.macdCache.macdLine.push(novaMacdLinha);
      state.macdCache.signalLine.push(novoSinal);
    }
    
    const ultimoMACD = state.macdCache.macdLine[state.macdCache.macdLine.length - 1] || 0;
    const ultimoSinal = state.macdCache.signalLine[state.macdCache.signalLine.length - 1] || 0;
    
    return {
      histograma: ultimoMACD - ultimoSinal,
      macdLinha: ultimoMACD,
      sinalLinha: ultimoSinal
    };
  } catch (e) {
    console.error("Erro no cálculo MACD:", e);
    return { histograma: 0, macdLinha: 0, sinalLinha: 0 };
  }
}

function calcularATR(dados, periodo = CONFIG.PERIODOS.ATR) {
  try {
    if (!Array.isArray(dados) || dados.length < periodo + 1) return 0;
    
    // Se já temos ATR calculado, atualiza incrementalmente
    if (state.atrGlobal > 0 && dados.length > periodo + 1) {
      const novoDado = dados[dados.length - 1];
      const anterior = dados[dados.length - 2];
      
      const tr = Math.max(
        novoDado.high - novoDado.low,
        Math.abs(novoDado.high - anterior.close),
        Math.abs(novoDado.low - anterior.close)
      );
      
      state.atrGlobal = ((state.atrGlobal * (periodo - 1)) + tr) / periodo;
      return state.atrGlobal;
    }
    
    // Cálculo completo
    const trValues = [];
    for (let i = 1; i < dados.length; i++) {
      const tr = Math.max(
        dados[i].high - dados[i].low,
        Math.abs(dados[i].high - dados[i-1].close),
        Math.abs(dados[i].low - dados[i-1].close)
      );
      trValues.push(tr);
    }
    
    state.atrGlobal = calcularMedia.simples(trValues.slice(-periodo), periodo);
    return state.atrGlobal;
  } catch (e) {
    console.error("Erro no cálculo ATR:", e);
    return 0;
  }
}

function calcularSuperTrend(dados, periodo = CONFIG.PERIODOS.SUPERTREND, multiplicador = 3) {
  try {
    if (dados.length < periodo) return { direcao: 0, valor: 0 };
    
    if (state.atrGlobal === 0) {
      state.atrGlobal = calcularATR(dados, periodo);
    }
    
    const current = dados[dados.length - 1];
    const hl2 = (current.high + current.low) / 2;
    const atr = state.atrGlobal;
    
    const upperBand = hl2 + (multiplicador * atr);
    const lowerBand = hl2 - (multiplicador * atr);
    
    let superTrend;
    let direcao;
    
    if (state.superTrendCache.length === 0) {
      superTrend = upperBand;
      direcao = 1;
    } else {
      const prev = dados[dados.length - 2];
      const prevSuperTrend = state.superTrendCache[state.superTrendCache.length - 1];
      
      if (prev.close > prevSuperTrend.valor) {
        direcao = 1;
        superTrend = Math.max(lowerBand, prevSuperTrend.valor);
      } else {
        direcao = -1;
        superTrend = Math.min(upperBand, prevSuperTrend.valor);
      }
    }
    
    state.superTrendCache.push({ direcao, valor: superTrend });
    if (state.superTrendCache.length > 100) state.superTrendCache.shift();
    
    return { direcao, valor: superTrend };
    
  } catch (e) {
    console.error("Erro no cálculo SuperTrend:", e);
    return { direcao: 0, valor: 0 };
  }
}

function detectarDivergencias(closes, rsis, highs, lows) {
  try {
    const lookback = CONFIG.PERIODOS.DIVERGENCIA_LOOKBACK;
    const extremeLookback = CONFIG.PERIODOS.EXTREME_LOOKBACK;
    
    if (closes.length < lookback || rsis.length < lookback) {
      return { divergenciaRSI: false, tipoDivergencia: "NENHUMA" };
    }
    
    const findExtremes = (data, isHigh = true) => {
      const extremes = [];
      for (let i = extremeLookback; i < data.length - extremeLookback; i++) {
        let isExtreme = true;
        
        for (let j = 1; j <= extremeLookback; j++) {
          if (isHigh) {
            if (data[i] <= data[i-j] || data[i] <= data[i+j]) {
              isExtreme = false;
              break;
            }
          } else {
            if (data[i] >= data[i-j] || data[i] >= data[i+j]) {
              isExtreme = false;
              break;
            }
          }
        }
        
        if (isExtreme) {
          extremes.push({ index: i, value: data[i] });
        }
      }
      return extremes;
    };
    
    const priceHighs = findExtremes(highs, true);
    const priceLows = findExtremes(lows, false);
    const rsiHighs = findExtremes(rsis, true);
    const rsiLows = findExtremes(rsis, false);
    
    let divergenciaRegularAlta = false;
    let divergenciaRegularBaixa = false;
    
    // Verificar divergências de alta (preço faz fundo mais baixo, RSI faz fundo mais alto)
    if (priceLows.length >= 2 && rsiLows.length >= 2) {
      const lastPriceLow = priceLows[priceLows.length - 1];
      const prevPriceLow = priceLows[priceLows.length - 2];
      const lastRsiLow = rsiLows[rsiLows.length - 1];
      const prevRsiLow = rsiLows[rsiLows.length - 2];
      
      if (lastPriceLow.value < prevPriceLow.value && 
          lastRsiLow.value > prevRsiLow.value) {
        divergenciaRegularAlta = true;
      }
    }
    
    // Verificar divergências de baixa (preço faz topo mais alto, RSI faz topo mais baixo)
    if (priceHighs.length >= 2 && rsiHighs.length >= 2) {
      const lastPriceHigh = priceHighs[priceHighs.length - 1];
      const prevPriceHigh = priceHighs[priceHighs.length - 2];
      const lastRsiHigh = rsiHighs[rsiHighs.length - 1];
      const prevRsiHigh = rsiHighs[rsiHighs.length - 2];
      
      if (lastPriceHigh.value > prevPriceHigh.value && 
          lastRsiHigh.value < prevRsiHigh.value) {
        divergenciaRegularBaixa = true;
      }
    }
    
    return {
      divergenciaRSI: divergenciaRegularAlta || divergenciaRegularBaixa,
      tipoDivergencia: divergenciaRegularAlta ? "ALTA" : 
                      divergenciaRegularBaixa ? "BAIXA" : "NENHUMA"
    };
  } catch (e) {
    console.error("Erro na detecção de divergências:", e);
    return { divergenciaRSI: false, tipoDivergencia: "NENHUMA" };
  }
}

// =============================================
// CORE DO SISTEMA (OTIMIZADO)
// =============================================
async function analisarMercado() {
  if (state.leituraEmAndamento) return;
  state.leituraEmAndamento = true;
  
  try {
    const dados = await obterDadosTwelveData();
    if (!dados || dados.length === 0) {
      throw new Error("Dados vazios da API");
    }
    
    state.dadosHistoricos = dados;
    
    if (dados.length < 20) {
      throw new Error(`Dados insuficientes (${dados.length} velas)`);
    }
    
    const velaAtual = dados[dados.length - 1];
    const velaAnterior = dados[dados.length - 2] || velaAtual;
    const closes = dados.map(v => v.close);
    const highs = dados.map(v => v.high);
    const lows = dados.map(v => v.low);
    const volumes = dados.map(v => v.volume);

    // Calcular EMAs
    const calcularEMA = (dados, periodo) => {
      const emaArray = calcularMedia.exponencial(dados, periodo);
      return emaArray[emaArray.length - 1];
    };

    const ema5 = calcularEMA(closes, CONFIG.PERIODOS.EMA_CURTA);
    const ema13 = calcularEMA(closes, CONFIG.PERIODOS.EMA_MEDIA);
    const ema50 = calcularEMA(closes, CONFIG.PERIODOS.EMA_50);

    // Calcular e atualizar indicadores
    state.volumeRelativo = calcularVolumeRelativo(volumes);
    state.obv = atualizarOBV(velaAtual.close, velaAnterior.close, velaAtual.volume);
    state.vwap = atualizarVWAP(dados);
    state.bandasBollinger = calcularBandasBollinger(closes);
    const zonas = calcularZonasPreco(dados);
    state.resistenciaKey = zonas.resistencia;
    state.suporteKey = zonas.suporte;

    const superTrend = calcularSuperTrend(dados);
    const rsi = calcularRSI(closes);
    const stoch = calcularStochastic(highs, lows, closes);
    const macd = calcularMACD(closes);
    const atr = calcularATR(dados);
    
    // Atualizar histórico de RSI
    if (state.rsiHistory.length === 0) {
      for (let i = CONFIG.PERIODOS.RSI; i < closes.length; i++) {
        state.rsiHistory.push(calcularRSI(closes.slice(0, i+1)));
      }
    } else {
      state.rsiHistory.push(rsi);
    }
    
    const divergencias = detectarDivergencias(closes, state.rsiHistory, highs, lows);
    const tendencia = avaliarTendencia(ema5, ema13, ema50);
    const lateral = detectarLateralidade(closes);

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
      closeAnterior: velaAnterior.close,
      superTrend,
      tendencia,
      atr,
      volumeRelativo: state.volumeRelativo,
      vwap: state.vwap,
      bandasBollinger: state.bandasBollinger
    };

    let sinal = gerarSinal(indicadores, divergencias, lateral);
    
    // Aplicar cooldown
    if (sinal !== "ESPERAR" && state.cooldown <= 0) {
      state.cooldown = 3;
    } else if (state.cooldown > 0) {
      state.cooldown--;
      sinal = "ESPERAR";
    }

    const score = calcularScore(sinal, indicadores, divergencias);

    state.ultimoSinal = sinal;
    state.ultimoScore = score;
    state.ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR");

    atualizarInterface(sinal, score, state.tendenciaDetectada, state.forcaTendencia);

    const criteriosElement = document.getElementById("criterios");
    if (criteriosElement) {
      criteriosElement.innerHTML = `
        <div class="indicador-categoria">
          <h4><i class="fas fa-trend-up"></i> Tendência & Momentum</h4>
          <ul>
            <li>📊 Tendência: <span class="${state.tendenciaDetectada.includes('ALTA') ? 'positivo' : state.tendenciaDetectada.includes('BAIXA') ? 'negativo' : 'neutro'}">${state.tendenciaDetectada}</span> (${state.forcaTendencia}%)</li>
            <li>📉 RSI: ${rsi.toFixed(2)} ${rsi < CONFIG.LIMIARES.RSI_OVERSOLD ? '🔻(Oversold)' : rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT ? '🔺(Overbought)' : ''}</li>
            <li>📊 MACD: ${macd.histograma > 0 ? '+' : ''}${macd.histograma.toFixed(4)} ${macd.histograma > 0 ? '🟢(Alta)' : '🔴(Baixa)'}</li>
            <li>📈 Stochastic: K${stoch.k.toFixed(2)}/D${stoch.d.toFixed(2)}</li>
          </ul>
        </div>
        
        <div class="indicador-categoria">
          <h4><i class="fas fa-layer-group"></i> Médias & Suporte</h4>
          <ul>
            <li>📌 Médias: EMA5 ${ema5.toFixed(2)} | EMA13 ${ema13.toFixed(2)} | EMA50 ${ema50.toFixed(2)}</li>
            <li>📊 Suporte: ${state.suporteKey.toFixed(2)} | Resistência: ${state.resistenciaKey.toFixed(2)}</li>
            <li>🚦 SuperTrend: ${superTrend.direcao > 0 ? '🟢ALTA' : '🔴BAIXA'} (${superTrend.valor.toFixed(2)})</li>
          </ul>
        </div>
        
        <div class="indicador-categoria">
          <h4><i class="fas fa-chart-bar"></i> Volume & Volatilidade</h4>
          <ul>
            <li>⚡ Volatilidade (ATR): ${atr.toFixed(4)}</li>
            <li>🔄 Lateral: ${lateral ? 'SIM ⚠️' : 'NÃO'}</li>
            <li>💹 Volume: ${(state.volumeRelativo * 100).toFixed(0)}% ${state.volumeRelativo > CONFIG.LIMIARES.VOLUME_ALERTA ? '🚀' : state.volumeRelativo < CONFIG.LIMIARES.VOLUME_MINIMO ? '⚠️' : ''}</li>
            <li>📊 VWAP: ${state.vwap.toFixed(2)}</li>
            <li>📊 Bollinger: ${state.bandasBollinger.superior.toFixed(2)} | ${state.bandasBollinger.inferior.toFixed(2)}</li>
            <li>📦 OBV: ${state.obv > 0 ? '↑' : '↓'} ${Math.abs(state.obv).toFixed(0)}</li>
          </ul>
        </div>
        
        <div class="indicador-categoria">
          <h4><i class="fas fa-search"></i> Padrões & Divergências</h4>
          <ul>
            <li>⚠️ Divergência: ${divergencias.tipoDivergencia} ${divergencias.divergenciaRSI ? '✅' : '❌'}</li>
          </ul>
        </div>
      `;
    }

    state.ultimos.unshift(`${state.ultimaAtualizacao} - ${sinal} (${score}%)`);
    if (state.ultimos.length > 8) state.ultimos.pop();
    const ultimosElement = document.getElementById("ultimos");
    if (ultimosElement) ultimosElement.innerHTML = state.ultimos.map(i => `<li>${i}</li>`).join("");

    state.tentativasErro = 0;
  } catch (e) {
    console.error("Erro na análise:", e);
    atualizarInterface("ERRO", 0, "ERRO", 0);
    
    const criteriosElement = document.getElementById("criterios");
    if (criteriosElement) {
      criteriosElement.innerHTML = `<li class="erro">ERRO: ${e.message || e}</li>`;
    }
    
    if (++state.tentativasErro > 3) {
      setTimeout(() => {
        console.log("Recarregando devido a múltiplos erros...");
        location.reload();
      }, 10000);
    }
  } finally {
    state.leituraEmAndamento = false;
  }
}

// =============================================
// FUNÇÕES DE DADOS (TWELVE DATA API)
// =============================================
async function obterDadosTwelveData() {
  try {
    const apiKey = API_KEYS[currentKeyIndex];
    const url = `${CONFIG.API_ENDPOINTS.TWELVE_DATA}/time_series?symbol=${CONFIG.PARES.CRYPTO_IDX}&interval=1min&outputsize=100&apikey=${apiKey}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Falha na API: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.status === 'error') {
      throw new Error(data.message || `Erro Twelve Data: ${data.code}`);
    }
    
    const valores = data.values ? data.values.reverse() : [];
    
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
      console.log(`Alternando para API key: ${currentKeyIndex}`);
    }
    
    throw e;
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
    elementoTimer.style.color = state.timer <= 5 ? 'red' : '';
  }
  
  state.intervaloAtual = setInterval(() => {
    state.timer--;
    
    if (elementoTimer) {
      elementoTimer.textContent = formatarTimer(state.timer);
      elementoTimer.style.color = state.timer <= 5 ? 'red' : '';
    }
    
    if (state.timer <= 0) {
      clearInterval(state.intervaloAtual);
      analisarMercado();
      sincronizarTimer();
    }
  }, 1000);
}

// =============================================
// INICIALIZAÇÃO (INTERFACE MODERNA)
// =============================================
function iniciarAplicativo() {
  // Criar interface moderna
  const container = document.createElement('div');
  container.style = `
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
    max-width: 900px; 
    margin: 20px auto; 
    padding: 25px; 
    background: #1e1f29; 
    border-radius: 15px; 
    color: #f5f6fa; 
    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    border: 1px solid #33354a;
  `;
  
  container.innerHTML = `
    <h1 style="text-align: center; color: #6c5ce7; margin-bottom: 30px; font-size: 28px;">
      <i class="fab fa-bitcoin"></i> Robô de Trading CRYPTO IDX PRO
    </h1>
    
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 25px; margin-bottom: 30px;">
      <div id="comando" style="font-size: 32px; font-weight: 700; padding: 25px; border-radius: 12px; text-align: center; background: #2c2d3a; display: flex; align-items: center; justify-content: center; min-height: 120px; flex-direction: column;">
        <div style="font-size: 18px; margin-bottom: 10px; opacity: 0.8;">SINAL ATUAL</div>
        --
      </div>
      
      <div style="display: flex; flex-direction: column; justify-content: center; background: #2c2d3a; padding: 20px; border-radius: 12px;">
        <div id="score" style="font-size: 22px; font-weight: 600; margin-bottom: 15px; text-align: center;">--</div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
          <div style="text-align: center; background: #3a3b4a; padding: 10px; border-radius: 8px;">
            <div style="font-size: 14px; opacity: 0.8;">Atualização</div>
            <div id="hora" style="font-size: 18px; font-weight: 600;">--:--:--</div>
          </div>
          
          <div style="text-align: center; background: #3a3b4a; padding: 10px; border-radius: 8px;">
            <div style="font-size: 14px; opacity: 0.8;">Próxima Análise</div>
            <div id="timer" style="font-size: 18px; font-weight: 600;">0:60</div>
          </div>
        </div>
      </div>
    </div>
    
    <div style="background: #2c2d3a; padding: 20px; border-radius: 12px; margin-bottom: 25px;">
      <div style="display: flex; align-items: center; margin-bottom: 15px;">
        <i class="fas fa-chart-line" style="color: #6c5ce7; margin-right: 10px;"></i>
        <h3 style="margin: 0; color: #6c5ce7;">Tendência: 
          <span id="tendencia">--</span> 
          <span id="forca-tendencia">--</span>%
        </h3>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 25px;">
        <div style="background: #3a3b4a; padding: 15px; border-radius: 8px;">
          <h4 style="margin-top: 0; margin-bottom: 10px; color: #a29bfe; display: flex; align-items: center;">
            <i class="fas fa-history"></i> Últimos Sinais
          </h4>
          <ul id="ultimos" style="list-style: none; padding: 0; margin: 0; max-height: 200px; overflow-y: auto;"></ul>
        </div>
        
        <div style="background: #3a3b4a; padding: 15px; border-radius: 8px; max-height: 500px; overflow-y: auto;">
          <h4 style="margin-top: 0; margin-bottom: 10px; color: #a29bfe; display: flex; align-items: center;">
            <i class="fas fa-chart-bar"></i> Indicadores Técnicos
          </h4>
          <div id="criterios" style="display: grid; grid-template-columns: 1fr; gap: 15px;"></div>
        </div>
      </div>
    </div>
    
    <div style="text-align: center; font-size: 14px; opacity: 0.7; padding-top: 15px; border-top: 1px solid #3a3b4a;">
      <i class="fas fa-sync-alt"></i> CRYPTO IDX - Análise em tempo real | Atualizado: ${new Date().toLocaleTimeString()}
    </div>
  `;
  document.body.appendChild(container);
  document.body.style.backgroundColor = "#13141a";
  document.body.style.margin = "0";
  document.body.style.padding = "20px";
  document.body.style.minHeight = "100vh";
  
  // Adicionar Font Awesome
  const fontAwesome = document.createElement('link');
  fontAwesome.rel = 'stylesheet';
  fontAwesome.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css';
  document.head.appendChild(fontAwesome);

  // Adicionar estilos dinâmicos
  const style = document.createElement('style');
  style.textContent = `
    .call { 
      background: linear-gradient(135deg, #00b894, #00cec9) !important; 
      color: white !important;
      box-shadow: 0 4px 20px rgba(0, 184, 148, 0.3);
      border: 2px solid #00cec9;
    }
    .put { 
      background: linear-gradient(135deg, #ff7675, #d63031) !important; 
      color: white !important;
      box-shadow: 0 4px 20px rgba(255, 118, 117, 0.3);
      border: 2px solid #d63031;
    }
    .esperar { 
      background: linear-gradient(135deg, #0984e3, #6c5ce7) !important; 
      color: white !important;
      box-shadow: 0 4px 20px rgba(108, 92, 231, 0.3);
      border: 2px solid #6c5ce7;
    }
    .erro { 
      background: #fdcb6e !important; 
      color: #2d3436 !important;
      border: 2px solid #e17055;
    }
    body {
      transition: background 0.5s ease;
    }
    #comando {
      transition: all 0.5s cubic-bezier(0.68, -0.55, 0.27, 1.55);
      text-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }
    .indicador-categoria {
      background: #2c2d3a;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 15px;
      border-left: 3px solid #6c5ce7;
    }
    .indicador-categoria h4 {
      margin-top: 0;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
    }
    .indicador-categoria i {
      margin-right: 8px;
    }
    ul {
      padding-left: 20px;
    }
    li {
      margin-bottom: 8px;
      font-size: 14px;
      display: flex;
    }
    .positivo {
      color: #00ff00;
      font-weight: bold;
    }
    .negativo {
      color: #ff0000;
      font-weight: bold;
    }
    .neutro {
      color: #ffff00;
      font-weight: bold;
    }
    .erro {
      color: #ff6b6b;
      font-weight: bold;
    }
    #criterios {
      max-height: 400px;
      overflow-y: auto;
    }
    #ultimos {
      max-height: 200px;
      overflow-y: auto;
    }
    #ultimos::-webkit-scrollbar, #criterios::-webkit-scrollbar {
      width: 6px;
    }
    #ultimos::-webkit-scrollbar-track, #criterios::-webkit-scrollbar-track {
      background: #2c2d3a;
    }
    #ultimos::-webkit-scrollbar-thumb, #criterios::-webkit-scrollbar-thumb {
      background: #6c5ce7;
      border-radius: 3px;
    }
  `;
  document.head.appendChild(style);

  // Iniciar processos
  setInterval(atualizarRelogio, 1000);
  sincronizarTimer();
  
  // Primeira análise
  setTimeout(analisarMercado, 1500);
}

// Iniciar quando o documento estiver pronto
if (document.readyState === "complete") iniciarAplicativo();
else document.addEventListener("DOMContentLoaded", iniciarAplicativo);
