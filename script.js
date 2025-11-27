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
    SCORE_ALTO: 70,
    SCORE_MEDIO: 55,
    RSI_OVERBOUGHT: 75,
    RSI_OVERSOLD: 25,
    STOCH_OVERBOUGHT: 80,
    STOCH_OVERSOLD: 20,
    VARIACAO_LATERAL: 0.008,
    ATR_LIMIAR: 0.025,
    LATERALIDADE_LIMIAR: 0.008,
    VOLUME_ALERTA: 1.5,
    MIN_COOLDOWN: 2,
    MAX_CONSECUTIVE_SIGNALS: 2
  },
  PESOS: {
    RSI: 1.6,
    MACD: 2.1,
    TENDENCIA: 2.6,
    STOCH: 1.1,
    SUPERTREND: 1.8,
    DIVERGENCIA: 1.9,
    VOLUME: 1.6,
    VWAP: 1.2,
    BOLLINGER: 1.3
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
// SISTEMA DE TENDÊNCIA OTIMIZADO
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
// DETECÇÃO DE LATERALIDADE MELHORADA
// =============================================
function detectarLateralidade(closes, periodo = CONFIG.PERIODOS.ANALISE_LATERAL, limiar = CONFIG.LIMIARES.LATERALIDADE_LIMIAR) {
  if (closes.length < periodo) return false;
  
  let countLaterais = 0;
  const volatilidades = [];
  
  for (let i = closes.length - 1; i > closes.length - periodo; i--) {
    if (i === 0) break;
    const variacao = Math.abs((closes[i] - closes[i-1]) / closes[i-1]);
    volatilidades.push(variacao);
    if (variacao < limiar) countLaterais++;
  }
  
  const mediaVol = volatilidades.reduce((a, b) => a + b, 0) / volatilidades.length;
  const desvios = volatilidades.map(v => Math.pow(v - mediaVol, 2));
  const desvioPadrao = Math.sqrt(desvios.reduce((a, b) => a + b, 0) / desvios.length);
  
  state.contadorLaterais = countLaterais;
  
  return countLaterais > periodo * 0.7 && desvioPadrao < limiar * 0.5;
}

// =============================================
// CÁLCULO DE SUPORTE/RESISTÊNCIA DINÂMICO
// =============================================
function calcularZonasPreco(dados, periodo = 50) {
  if (dados.length < periodo) periodo = dados.length;
  
  const slice = dados.slice(-periodo);
  const highs = slice.map(v => v.high);
  const lows = slice.map(v => v.low);
  const closes = slice.map(v => v.close);
  
  const resistencia = (Math.max(...highs) * 0.6 + calcularMedia.simples(highs, highs.length) * 0.4);
  const suporte = (Math.min(...lows) * 0.6 + calcularMedia.simples(lows, lows.length) * 0.4);
  
  return {
    resistencia,
    suporte,
    pivot: (resistencia + suporte + closes[closes.length-1]) / 3
  };
}

// =============================================
// INDICADORES PARA CRIPTO (OTIMIZADOS)
// =============================================

// 1. Volume Relativo com suavização
function calcularVolumeRelativo(volumes, periodo = CONFIG.PERIODOS.VOLUME_LOOKBACK) {
  if (volumes.length < periodo) return 0;
  
  const slice = volumes.slice(-periodo);
  const mediaVolume = calcularMedia.simples(slice, periodo);
  const ultimosVolumes = volumes.slice(-3);
  const volumeMedioRecente = calcularMedia.simples(ultimosVolumes, 3);
  
  return volumeMedioRecente / mediaVolume;
}

// 2. On-Balance Volume (OBV) com ajuste
function calcularOBV(closes, volumes) {
  if (closes.length < 2) return 0;
  
  let obv = state.obv || 0;
  const startIdx = Math.max(1, closes.length - 5);
  
  for (let i = startIdx; i < closes.length; i++) {
    if (closes[i] > closes[i-1]) {
      obv += volumes[i];
    } else if (closes[i] < closes[i-1]) {
      obv -= volumes[i];
    }
  }
  return obv;
}

// 3. VWAP com verificação de dados
function calcularVWAP(dados, periodo = CONFIG.PERIODOS.VWAP) {
  if (dados.length < periodo) return 0;
  
  let tpTotal = 0;
  let volumeTotal = 0;
  
  const slice = dados.slice(-periodo);
  slice.forEach(v => {
    if (!v.high || !v.low || !v.close || !v.volume) return;
    
    const tp = (v.high + v.low + v.close) / 3;
    tpTotal += tp * v.volume;
    volumeTotal += v.volume;
  });
  
  return volumeTotal > 0 ? tpTotal / volumeTotal : 0;
}

// 4. Bandas de Bollinger
function calcularBandasBollinger(closes, periodo = CONFIG.PERIODOS.BOLLINGER, desvios = 2) {
  if (closes.length < periodo) return { superior: 0, inferior: 0, medio: 0 };
  
  const slice = closes.slice(-periodo);
  const media = calcularMedia.simples(slice, periodo);
  
  let somaQuadrados = 0;
  slice.forEach(valor => {
    somaQuadrados += Math.pow(valor - media, 2);
  });
  
  const desvioPadrao = Math.sqrt(somaQuadrados / periodo);
  
  return {
    superior: media + (desvioPadrao * desvios),
    inferior: media - (desvioPadrao * desvios),
    medio: media
  };
}

// =============================================
// INDICADORES TÉCNICOS CORRIGIDOS
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
    if (ema === null) return [];
    
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
  
  if (closes.length !== state.rsiCache.lastLength) {
    state.rsiCache = { avgGain: 0, avgLoss: 0, initialized: false, lastLength: closes.length };
  }
  
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
    
    const rs = state.rsiCache.avgLoss === 0 ? 100 : state.rsiCache.avgGain / state.rsiCache.avgLoss;
    return 100 - (100 / (1 + rs));
  }
  
  const diff = closes[closes.length - 1] - closes[closes.length - 2];
  
  if (diff > 0) {
    state.rsiCache.avgGain = ((state.rsiCache.avgGain * (periodo - 1)) + diff) / periodo;
    state.rsiCache.avgLoss = (state.rsiCache.avgLoss * (periodo - 1)) / periodo;
  } else {
    state.rsiCache.avgGain = (state.rsiCache.avgGain * (periodo - 1)) / periodo;
    state.rsiCache.avgLoss = ((state.rsiCache.avgLoss * (periodo - 1)) - diff) / periodo;
  }
  
  const rs = state.rsiCache.avgLoss === 0 ? 100 : state.rsiCache.avgGain / state.rsiCache.avgLoss;
  const rsi = 100 - (100 / (1 + rs));
  
  state.rsiHistory.push(rsi);
  if (state.rsiHistory.length > 50) state.rsiHistory.shift();
  
  return rsi;
}

function calcularStochastic(highs, lows, closes, periodoK = CONFIG.PERIODOS.STOCH_K, periodoD = CONFIG.PERIODOS.STOCH_D) {
  try {
    if (closes.length < periodoK) return { k: 50, d: 50 };
    
    const kValues = [];
    for (let i = periodoK - 1; i < closes.length; i++) {
      const startIndex = Math.max(0, i - periodoK + 1);
      const sliceHigh = highs.slice(startIndex, i + 1);
      const sliceLow = lows.slice(startIndex, i + 1);
      
      if (sliceHigh.length === 0 || sliceLow.length === 0) {
        kValues.push(50);
        continue;
      }
      
      const highestHigh = Math.max(...sliceHigh);
      const lowestLow = Math.min(...sliceLow);
      const range = highestHigh - lowestLow;
      const k = range !== 0 ? ((closes[i] - lowestLow) / range) * 100 : 50;
      kValues.push(k);
    }
    
    const kSuavizado = [];
    for (let i = periodoD - 1; i < kValues.length; i++) {
      const startIndex = Math.max(0, i - periodoD + 1);
      const slice = kValues.slice(startIndex, i + 1);
      const mediaK = calcularMedia.simples(slice, periodoD) || 50;
      kSuavizado.push(mediaK);
    }
    
    const dValues = [];
    for (let i = periodoD - 1; i < kSuavizado.length; i++) {
      const startIndex = Math.max(0, i - periodoD + 1);
      const slice = kSuavizado.slice(startIndex, i + 1);
      dValues.push(calcularMedia.simples(slice, periodoD) || 50);
    }
    
    return {
      k: kSuavizado[kSuavizado.length - 1] || 50,
      d: dValues[dValues.length - 1] || 50
    };
  } catch (e) {
    console.error("Erro no cálculo Stochastic:", e);
    return { k: 50, d: 50 };
  }
}

function calcularMACD(closes, rapida = CONFIG.PERIODOS.MACD_RAPIDA, lenta = CONFIG.PERIODOS.MACD_LENTA, sinal = CONFIG.PERIODOS.MACD_SINAL) {
  try {
    if (closes.length < lenta) {
      return { histograma: 0, macdLinha: 0, sinalLinha: 0 };
    }
    
    const emaRapida = calcularMedia.exponencial(closes, rapida);
    const emaLenta = calcularMedia.exponencial(closes, lenta);
    
    if (emaRapida.length === 0 || emaLenta.length === 0) {
      return { histograma: 0, macdLinha: 0, sinalLinha: 0 };
    }
    
    const startIdx = Math.max(0, lenta - rapida);
    const macdLinha = emaRapida.slice(startIdx).map((val, idx) => val - emaLenta[idx]);
    
    if (macdLinha.length < sinal) {
      return { histograma: 0, macdLinha: macdLinha[macdLinha.length-1] || 0, sinalLinha: 0 };
    }
    
    const sinalLinha = calcularMedia.exponencial(macdLinha, sinal);
    
    const ultimoMACD = macdLinha[macdLinha.length - 1] || 0;
    const ultimoSinal = sinalLinha[sinalLinha.length - 1] || 0;
    
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
    if (!Array.isArray(dados) || dados.length < periodo + 1) return 0.01;
    
    const trValues = [];
    for (let i = 1; i < dados.length; i++) {
      const tr = Math.max(
        dados[i].high - dados[i].low,
        Math.abs(dados[i].high - dados[i-1].close),
        Math.abs(dados[i].low - dados[i-1].close)
      );
      trValues.push(tr);
    }
    
    return calcularMedia.simples(trValues.slice(-periodo), periodo) || 0.01;
  } catch (e) {
    console.error("Erro no cálculo ATR:", e);
    return 0.01;
  }
}

function calcularSuperTrend(dados, periodo = CONFIG.PERIODOS.SUPERTREND, multiplicador = 3) {
  try {
    if (dados.length < periodo) return { direcao: 0, valor: dados[dados.length-1]?.close || 0 };
    
    const atr = calcularATR(dados, periodo);
    const current = dados[dados.length - 1];
    const hl2 = (current.high + current.low) / 2;
    
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
    if (state.superTrendCache.length > 50) state.superTrendCache.shift();
    
    return { direcao, valor: superTrend };
    
  } catch (e) {
    console.error("Erro no cálculo SuperTrend:", e);
    return { direcao: 0, valor: dados[dados.length-1]?.close || 0 };
  }
}

function detectarDivergencias(closes, rsis, highs, lows) {
  try {
    const lookback = Math.min(20, closes.length - 1);
    const extremeLookback = 2;
    
    if (closes.length < lookback || rsis.length < lookback) {
      return { divergenciaRSI: false, tipoDivergencia: "NENHUMA" };
    }
    
    const startIdx = closes.length - lookback;
    const priceSlice = closes.slice(startIdx);
    const rsiSlice = rsis.slice(-lookback);
    const highSlice = highs.slice(startIdx);
    const lowSlice = lows.slice(startIdx);
    
    const priceHighs = [];
    const priceLows = [];
    const rsiHighs = [];
    const rsiLows = [];
    
    for (let i = extremeLookback; i < priceSlice.length - extremeLookback; i++) {
      if (priceSlice[i] >= priceSlice[i-1] && priceSlice[i] >= priceSlice[i+1] &&
          priceSlice[i] >= priceSlice[i-2] && priceSlice[i] >= priceSlice[i+2]) {
        priceHighs.push({ index: i + startIdx, value: priceSlice[i] });
      }
      
      if (priceSlice[i] <= priceSlice[i-1] && priceSlice[i] <= priceSlice[i+1] &&
          priceSlice[i] <= priceSlice[i-2] && priceSlice[i] <= priceSlice[i+2]) {
        priceLows.push({ index: i + startIdx, value: priceSlice[i] });
      }
    }
    
    for (let i = extremeLookback; i < rsiSlice.length - extremeLookback; i++) {
      if (rsiSlice[i] >= rsiSlice[i-1] && rsiSlice[i] >= rsiSlice[i+1]) {
        rsiHighs.push({ index: i, value: rsiSlice[i] });
      }
      
      if (rsiSlice[i] <= rsiSlice[i-1] && rsiSlice[i] <= rsiSlice[i+1]) {
        rsiLows.push({ index: i, value: rsiSlice[i] });
      }
    }
    
    let divergenciaRegularAlta = false;
    let divergenciaRegularBaixa = false;
    
    if (priceHighs.length >= 2 && rsiHighs.length >= 2) {
      const lastPriceHigh = priceHighs[priceHighs.length - 1];
      const prevPriceHigh = priceHighs[priceHighs.length - 2];
      const lastRsiHigh = rsiHighs[rsiHighs.length - 1];
      const prevRsiHigh = rsiHighs[rsiHighs.length - 2];
      
      if (lastPriceHigh.value > prevPriceHigh.value && lastRsiHigh.value < prevRsiHigh.value) {
        divergenciaRegularBaixa = true;
      }
    }
    
    if (priceLows.length >= 2 && rsiLows.length >= 2) {
      const lastPriceLow = priceLows[priceLows.length - 1];
      const prevPriceLow = priceLows[priceLows.length - 2];
      const lastRsiLow = rsiLows[rsiLows.length - 1];
      const prevRsiLow = rsiLows[rsiLows.length - 2];
      
      if (lastPriceLow.value < prevPriceLow.value && lastRsiLow.value > prevRsiLow.value) {
        divergenciaRegularAlta = true;
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
// CALCULADOR DE SCORE CORRIGIDO
// =============================================
function calcularScoreDirecional(direcao, indicadores, divergencias) {
  let score = 65; // AUMENTEI A BASE para 65 (era 50)

  const { rsi, stoch, macd, close, emaCurta, emaMedia, tendencia, volumeRelativo, vwap, bandasBollinger } = indicadores;

  // Alinhamento com tendência (SIMPLIFICADO)
  if ((direcao === 'ALTA' && tendencia.tendencia.includes('ALTA')) ||
      (direcao === 'BAIXA' && tendencia.tendencia.includes('BAIXA'))) {
    score += 15; // Reduzido de 20 para 15
  }

  // Confirmação de indicadores (SIMPLIFICADO)
  if (direcao === 'ALTA') {
    if (rsi < 70) score += 5;
    if (macd.histograma > 0) score += 10;
    if (close > emaCurta) score += 5;
  } else {
    if (rsi > 30) score += 5;
    if (macd.histograma < 0) score += 10;
    if (close < emaCurta) score += 5;
  }

  // Volume (SIMPLIFICADO)
  if (volumeRelativo > CONFIG.LIMIARES.VOLUME_ALERTA) score += 8;

  // Divergências (SIMPLIFICADO)
  if (divergencias.divergenciaRSI) {
    if ((direcao === 'ALTA' && divergencias.tipoDivergencia === 'ALTA') ||
        (direcao === 'BAIXA' && divergencias.tipoDivergencia === 'BAIXA')) {
      score += 10;
    }
  }

  return Math.min(100, Math.max(0, score));
}

// =============================================
// GERADOR DE SINAIS CORRIGIDO
// =============================================
function gerarSinal(indicadores, divergencias, lateral) {
  const scoreAlta = calcularScoreDirecional('ALTA', indicadores, divergencias);
  const scoreBaixa = calcularScoreDirecional('BAIXA', indicadores, divergencias);
  
  const { rsi, stoch, macd, close, volumeRelativo, bandasBollinger, tendencia, superTrend } = indicadores;

  console.log(`DEBUG - Scores: ALTA ${scoreAlta}%, BAIXA ${scoreBaixa}%`);

  // Estratégia SIMPLIFICADA - condições mais fáceis
  const rsiOversold = rsi < CONFIG.LIMIARES.RSI_OVERSOLD;
  const rsiOverbought = rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT;

  // CALL simples: RSI oversold + MACD positivo
  if (rsiOversold && macd.histograma > 0 && scoreAlta >= 60) {
    console.log("SINAL CALL: RSI oversold + MACD positivo");
    return "CALL";
  }

  // PUT simples: RSI overbought + MACD negativo  
  if (rsiOverbought && macd.histograma < 0 && scoreBaixa >= 60) {
    console.log("SINAL PUT: RSI overbought + MACD negativo");
    return "PUT";
  }

  // CALL por tendência
  if (tendencia.tendencia.includes("ALTA") && scoreAlta >= 65) {
    console.log("SINAL CALL: Tendência de alta");
    return "CALL";
  }

  // PUT por tendência
  if (tendencia.tendencia.includes("BAIXA") && scoreBaixa >= 65) {
    console.log("SINAL PUT: Tendência de baixa");
    return "PUT";
  }

  console.log("SEM SINAL: Condições não atendidas");
  return "ESPERAR";
}

// =============================================
// CALCULADOR DE CONFIANÇA CORRIGIDO
// =============================================
function calcularScore(sinal, indicadores, divergencias) {
  if (sinal === "ESPERAR") return 0;
  
  const direcao = sinal === "CALL" ? "ALTA" : "BAIXA";
  const score = calcularScoreDirecional(direcao, indicadores, divergencias);
  
  console.log(`DEBUG - Score final para ${sinal}: ${score}%`);
  
  return score;
}

// =============================================
// GERENCIAMENTO DE SINAIS CONSECUTIVOS
// =============================================
function gerenciarSinaisConsecutivos(sinal) {
  const agora = Date.now();
  const tempoDesdeUltimoSinal = (agora - state.lastSignalTime) / 60000;
  
  if (tempoDesdeUltimoSinal > 10) {
    state.consecutiveSignalCount = 0;
  }
  
  if (sinal !== "ESPERAR" && sinal === state.ultimoSinal) {
    state.consecutiveSignalCount = (state.consecutiveSignalCount || 0) + 1;
    
    if (state.consecutiveSignalCount > CONFIG.LIMIARES.MAX_CONSECUTIVE_SIGNALS) {
      return "ESPERAR";
    }
  } else if (sinal !== "ESPERAR") {
    state.consecutiveSignalCount = 1;
  }
  
  state.lastSignalTime = agora;
  return sinal;
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
    
    if (sinal === "CALL") comandoElement.textContent = "CALL 📈";
    else if (sinal === "PUT") comandoElement.textContent = "PUT 📉";
    else if (sinal === "ESPERAR") comandoElement.textContent = "ESPERAR ✋";
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
    forcaElement.textContent = `${Math.round(forcaTendencia)}%`;
  }
  
  const atualizacaoElement = document.getElementById("ultima-atualizacao");
  if (atualizacaoElement) {
    atualizacaoElement.textContent = state.ultimaAtualizacao;
  }
}

// =============================================
// FUNÇÃO PRINCIPAL
// =============================================
async function analisarMercado() {
  if (state.leituraEmAndamento) return;
  state.leituraEmAndamento = true;
  
  try {
    console.log("=== INICIANDO ANÁLISE ===");
    const dados = await obterDadosTwelveData();
    state.dadosHistoricos = dados;
    
    if (dados.length < 20) {
      throw new Error(`Dados insuficientes (${dados.length} velas)`);
    }
    
    const velaAtual = dados[dados.length - 1];
    const closes = dados.map(v => v.close);
    const highs = dados.map(v => v.high);
    const lows = dados.map(v => v.low);
    const volumes = dados.map(v => v.volume);

    // Calcular zonas de preço
    const zonas = calcularZonasPreco(dados);
    state.resistenciaKey = zonas.resistencia;
    state.suporteKey = zonas.suporte;

    // Calcular EMAs
    const calcularEMA = (dados, periodo) => {
      const emaArray = calcularMedia.exponencial(dados, periodo);
      return emaArray.length > 0 ? emaArray[emaArray.length - 1] : null;
    };

    const ema5 = calcularEMA(closes, CONFIG.PERIODOS.EMA_CURTA);
    const ema13 = calcularEMA(closes, CONFIG.PERIODOS.EMA_MEDIA);
    const ema50 = calcularEMA(closes, CONFIG.PERIODOS.EMA_50);

    // Calcular indicadores
    state.volumeRelativo = calcularVolumeRelativo(volumes);
    state.obv = calcularOBV(closes, volumes);
    state.vwap = calcularVWAP(dados);
    state.bandasBollinger = calcularBandasBollinger(closes);

    const superTrend = calcularSuperTrend(dados);
    const rsi = calcularRSI(closes);
    const stoch = calcularStochastic(highs, lows, closes);
    const macd = calcularMACD(closes);
    const atr = calcularATR(dados);
    
    // Preencher histórico de RSI
    if (state.rsiHistory.length === 0) {
      for (let i = CONFIG.PERIODOS.RSI; i < closes.length; i++) {
        state.rsiHistory.push(calcularRSI(closes.slice(0, i+1)));
      }
    } else {
      state.rsiHistory.push(calcularRSI(closes));
      if (state.rsiHistory.length > 100) state.rsiHistory.shift();
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
      superTrend,
      tendencia,
      atr,
      volumeRelativo: state.volumeRelativo,
      vwap: state.vwap,
      bandasBollinger: state.bandasBollinger
    };

    let sinal = gerarSinal(indicadores, divergencias, lateral);
    
    // Gerenciar cooldown e sinais consecutivos
    sinal = gerenciarSinaisConsecutivos(sinal);
    
    if (sinal !== "ESPERAR" && state.cooldown <= 0) {
      state.cooldown = CONFIG.LIMIARES.MIN_COOLDOWN;
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
        <li>🎯 BITCOIN CASH (BCH/USD)</li>
        <li>📊 Tendência: ${state.tendenciaDetectada} (${Math.round(state.forcaTendencia)}%)</li>
        <li>💰 Preço: $${indicadores.close.toFixed(2)}</li>
        <li>📉 RSI: ${rsi.toFixed(1)} ${rsi < CONFIG.LIMIARES.RSI_OVERSOLD ? '🔻' : rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT ? '🔺' : ''}</li>
        <li>📊 MACD: ${macd.histograma > 0 ? '+' : ''}${macd.histograma.toFixed(4)}</li>
        <li>📈 Stochastic: ${stoch.k.toFixed(1)}/${stoch.d.toFixed(1)}</li>
        <li>📌 EMA5: ${ema5?.toFixed(2) || 'N/A'} | EMA13: ${ema13?.toFixed(2) || 'N/A'}</li>
        <li>📊 Suporte: $${state.suporteKey.toFixed(2)} | Resistência: $${state.resistenciaKey.toFixed(2)}</li>
        <li>⚠️ Divergência: ${divergencias.tipoDivergencia}</li>
        <li>🚦 SuperTrend: ${superTrend.direcao > 0 ? 'ALTA' : 'BAIXA'}</li>
        <li>⚡ ATR: ${atr.toFixed(4)}</li>
        <li>🔄 Lateral: ${lateral ? 'SIM' : 'NÃO'}</li>
        <li>💹 Volume: ${(state.volumeRelativo * 100).toFixed(0)}% ${state.volumeRelativo > CONFIG.LIMIARES.VOLUME_ALERTA ? '🚀' : ''}</li>
        <li>📊 VWAP: $${state.vwap.toFixed(2)}</li>
        <li style="color: yellow; font-weight: bold;">🎯 SINAL: ${sinal} (${score}% confiança)</li>
      `;
    }

    state.ultimos.unshift(`${state.ultimaAtualizacao} - ${sinal} (${score}%)`);
    if (state.ultimos.length > 8) state.ultimos.pop();
    const ultimosElement = document.getElementById("ultimos");
    if (ultimosElement) ultimosElement.innerHTML = state.ultimos.map(i => `<li>${i}</li>`).join("");

    state.tentativasErro = 0;
    console.log(`=== ANÁLISE CONCLUÍDA: ${sinal} (${score}%) ===`);

  } catch (e) {
    console.error("Erro na análise:", e);
    atualizarInterface("ERRO", 0, "ERRO", 0);
    
    const criteriosElement = document.getElementById("criterios");
    if (criteriosElement) {
      criteriosElement.innerHTML = `<li>ERRO: ${e.message}</li>`;
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
    
    errorCount++;
    if (errorCount >= 2) {
      currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
      errorCount = 0;
      console.log(`Alternando para chave API: ${currentKeyIndex + 1}`);
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
// INICIALIZAÇÃO
// =============================================
function iniciarAplicativo() {
  console.log("🚀 INICIANDO TX1 BITCOIN CASH...");
  
  // Atualizar relógio a cada segundo
  setInterval(atualizarRelogio, 1000);
  
  // Sincronizar timer e iniciar análises
  sincronizarTimer();
  
  // Primeira análise
  setTimeout(analisarMercado, 2000);
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
