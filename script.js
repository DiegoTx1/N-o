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
    MIN_COOLDOWN: 3,
    MAX_CONSECUTIVE_SIGNALS: 2
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
// SISTEMA DE LOGS
// =============================================
const LOG_LEVEL = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

function log(message, level = LOG_LEVEL.INFO) {
  const timestamp = new Date().toLocaleTimeString("pt-BR");
  const levelStr = ['ERROR', 'WARN', 'INFO', 'DEBUG'][level];
  
  console.log(`[${timestamp}] ${levelStr}: ${message}`);
  
  // Manter apenas os últimos 20 logs
  if (state.logs.length > 20) state.logs.shift();
  state.logs.push({timestamp, message, level});
}

// =============================================
// VALIDAÇÃO DE DADOS
// =============================================
function validarDados(dados) {
  if (!Array.isArray(dados) || dados.length === 0) {
    throw new Error("Dados inválidos ou vazios");
  }
  
  const ultimo = dados[dados.length - 1];
  if (!ultimo || typeof ultimo !== 'object') {
    throw new Error("Estrutura de dados inválida");
  }
  
  if (!ultimo.close || !ultimo.high || !ultimo.low || !ultimo.open) {
    throw new Error("Dados de preço incompletos");
  }
  
  // Verificar se os preços são válidos
  if (ultimo.high < ultimo.low || 
      ultimo.close > ultimo.high || 
      ultimo.close < ultimo.low ||
      ultimo.open > ultimo.high ||
      ultimo.open < ultimo.low) {
    throw new Error("Dados de preço inconsistentes");
  }
  
  // Verificar valores numéricos
  if (!isFinite(ultimo.close) || !isFinite(ultimo.high) || !isFinite(ultimo.low)) {
    throw new Error("Valores de preço não numéricos");
  }
  
  return true;
}

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
  
  // Calcular desvio padrão das volatilidades
  const mediaVol = volatilidades.reduce((a, b) => a + b, 0) / volatilidades.length;
  const desvios = volatilidades.map(v => Math.pow(v - mediaVol, 2));
  const desvioPadrao = Math.sqrt(desvios.reduce((a, b) => a + b, 0) / desvios.length);
  
  state.contadorLaterais = countLaterais;
  
  // Lateralidade confirmada se 70% das velas estiverem abaixo do limiar E baixa volatilidade
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
  
  // Calcular níveis com média ponderada
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
  const startIdx = Math.max(1, closes.length - 5); // Considerar apenas últimos 5 períodos
  
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
    // Verificar dados válidos
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
  
  // Resetar cache se os dados mudaram
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
    
    const rs = state.rsiCache.avgLoss === 0 ? Infinity : state.rsiCache.avgGain / state.rsiCache.avgLoss;
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
  
  const rs = state.rsiCache.avgLoss === 0 ? Infinity : state.rsiCache.avgGain / state.rsiCache.avgLoss;
  return 100 - (100 / (1 + rs));
}

function calcularStochastic(highs, lows, closes, 
                          periodoK = CONFIG.PERIODOS.STOCH_K, 
                          periodoD = CONFIG.PERIODOS.STOCH_D) {
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
    log("Erro no cálculo Stochastic: " + e.message, LOG_LEVEL.ERROR);
    return { k: 50, d: 50 };
  }
}

function calcularMACD(closes, rapida = CONFIG.PERIODOS.MACD_RAPIDA, 
                    lenta = CONFIG.PERIODOS.MACD_LENTA, 
                    sinal = CONFIG.PERIODOS.MACD_SINAL) {
  try {
    // Resetar cache se os dados mudaram
    if (closes.length !== state.macdCache.lastLength) {
      state.macdCache = {
        emaRapida: null,
        emaLenta: null,
        macdLine: [],
        signalLine: [],
        lastLength: closes.length
      };
    }
    
    // Resetar cache se os dados mudaram drasticamente
    if (state.macdCache.emaRapida === null || 
        (closes.length > 1 && Math.abs(closes[closes.length-1] - closes[closes.length-2]) > (state.atrGlobal * 3 || 0.1))) {
      state.macdCache = {
        emaRapida: null,
        emaLenta: null,
        macdLine: [],
        signalLine: [],
        lastLength: closes.length
      };
    }
    
    if (state.macdCache.emaRapida === null || state.macdCache.emaLenta === null) {
      const emaRapida = calcularMedia.exponencial(closes, rapida);
      const emaLenta = calcularMedia.exponencial(closes, lenta);
      
      if (emaRapida.length === 0 || emaLenta.length === 0) {
        return { histograma: 0, macdLinha: 0, sinalLinha: 0 };
      }
      
      const startIdx = Math.max(0, lenta - rapida);
      const macdLinha = emaRapida.slice(startIdx).map((val, idx) => val - emaLenta[idx]);
      const sinalLinha = calcularMedia.exponencial(macdLinha, sinal);
      
      const ultimoMACD = macdLinha[macdLinha.length - 1] || 0;
      const ultimoSinal = sinalLinha[sinalLinha.length - 1] || 0;
      
      state.macdCache = {
        emaRapida: emaRapida[emaRapida.length - 1],
        emaLenta: emaLenta[emaLenta.length - 1],
        macdLine: macdLinha,
        signalLine: sinalLinha,
        lastLength: closes.length
      };
      
      return {
        histograma: ultimoMACD - ultimoSinal,
        macdLinha: ultimoMACD,
        sinalLinha: ultimoSinal
      };
    }
    
    const kRapida = 2 / (rapida + 1);
    const kLenta = 2 / (lenta + 1);
    const kSinal = 2 / (sinal + 1);
    
    const novoValor = closes[closes.length - 1];
    
    state.macdCache.emaRapida = novoValor * kRapida + state.macdCache.emaRapida * (1 - kRapida);
    state.macdCache.emaLenta = novoValor * kLenta + state.macdCache.emaLenta * (1 - kLenta);
    
    const novaMacdLinha = state.macdCache.emaRapida - state.macdCache.emaLenta;
    state.macdCache.macdLine.push(novaMacdLinha);
    
    if (state.macdCache.signalLine.length === 0) {
      state.macdCache.signalLine.push(novaMacdLinha);
    } else {
      const ultimoSinal = state.macdCache.signalLine[state.macdCache.signalLine.length - 1];
      const novoSignal = novaMacdLinha * kSinal + ultimoSinal * (1 - kSinal);
      state.macdCache.signalLine.push(novoSignal);
    }
    
    // Manter apenas os últimos 100 valores
    if (state.macdCache.macdLine.length > 100) state.macdCache.macdLine.shift();
    if (state.macdCache.signalLine.length > 100) state.macdCache.signalLine.shift();
    
    const ultimoMACD = novaMacdLinha;
    const ultimoSinal = state.macdCache.signalLine[state.macdCache.signalLine.length - 1];
    
    return {
      histograma: ultimoMACD - ultimoSinal,
      macdLinha: ultimoMACD,
      sinalLinha: ultimoSinal
    };
  } catch (e) {
    log("Erro no cálculo MACD: " + e.message, LOG_LEVEL.ERROR);
    return { histograma: 0, macdLinha: 0, sinalLinha: 0 };
  }
}

function calcularATR(dados, periodo = CONFIG.PERIODOS.ATR) {
  try {
    if (!Array.isArray(dados) || dados.length < periodo + 1) return 0;
    
    const trValues = [];
    for (let i = 1; i < dados.length; i++) {
      const tr = Math.max(
        dados[i].high - dados[i].low,
        Math.abs(dados[i].high - dados[i-1].close),
        Math.abs(dados[i].low - dados[i-1].close)
      );
      trValues.push(tr);
    }
    
    return calcularMedia.simples(trValues.slice(-periodo), periodo);
  } catch (e) {
    log("Erro no cálculo ATR: " + e.message, LOG_LEVEL.ERROR);
    return 0;
  }
}

function calcularSuperTrend(dados, periodo = CONFIG.PERIODOS.SUPERTREND, multiplicador = 3) {
  try {
    if (dados.length < periodo) return { direcao: 0, valor: 0 };
    
    state.atrGlobal = calcularATR(dados, periodo);
    
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
    // Manter apenas os últimos 50 valores
    if (state.superTrendCache.length > 50) state.superTrendCache.shift();
    
    return { direcao, valor: superTrend };
    
  } catch (e) {
    log("Erro no cálculo SuperTrend: " + e.message, LOG_LEVEL.ERROR);
    return { direcao: 0, valor: 0 };
  }
}

function detectarDivergencias(closes, rsis, highs, lows) {
  try {
    const lookback = Math.min(30, closes.length - 1); // Limitar para performance
    const extremeLookback = CONFIG.PERIODOS.EXTREME_LOOKBACK;
    
    if (closes.length < lookback || rsis.length < lookback) {
      return { divergenciaRSI: false, tipoDivergencia: "NENHUMA" };
    }
    
    const startIdx = closes.length - lookback;
    const priceSlice = closes.slice(startIdx);
    const rsiSlice = rsis.slice(startIdx);
    const highSlice = highs.slice(startIdx);
    const lowSlice = lows.slice(startIdx);
    
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
          extremes.push({ index: i + startIdx, value: data[i] });
        }
      }
      return extremes;
    };
    
    const priceHighs = findExtremes(highSlice, true);
    const priceLows = findExtremes(lowSlice, false);
    const rsiHighs = findExtremes(rsiSlice, true);
    const rsiLows = findExtremes(rsiSlice, false);
    
    let divergenciaRegularAlta = false;
    let divergenciaRegularBaixa = false;
    
    // Verificar divergências regulares
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
    
    return {
      divergenciaRSI: divergenciaRegularAlta || divergenciaRegularBaixa,
      tipoDivergencia: divergenciaRegularAlta ? "ALTA" : 
                      divergenciaRegularBaixa ? "BAIXA" : "NENHUMA"
    };
  } catch (e) {
    log("Erro na detecção de divergências: " + e.message, LOG_LEVEL.ERROR);
    return { divergenciaRSI: false, tipoDivergencia: "NENHUMA" };
  }
}

// =============================================
// CALCULADOR DE SCORE OTIMIZADO
// =============================================
function calcularScoreDirecional(direcao, indicadores, divergencias) {
  let score = 50; // Base

  const { rsi, stoch, macd, close, emaCurta, emaMedia, tendencia, volumeRelativo, vwap, bandasBollinger } = indicadores;

  // Alinhamento com tendência
  if ((direcao === 'ALTA' && tendencia.tendencia.includes('ALTA')) ||
      (direcao === 'BAIXA' && tendencia.tendencia.includes('BAIXA'))) {
    score += Math.min(20, tendencia.forca / 5);
  }

  // Confirmação de indicadores
  if (direcao === 'ALTA') {
    if (rsi > 30 && rsi < 70) score += 5;
    if (stoch.k > 20 && stoch.k < 80) score += 5;
    if (macd.histograma > 0) score += 10;
    if (close > emaCurta) score += 5;
    if (close > vwap) score += 5;
    if (close > bandasBollinger.medio) score += 5;
  } else {
    if (rsi < 70 && rsi > 30) score += 5;
    if (stoch.k < 80 && stoch.k > 20) score += 5;
    if (macd.histograma < 0) score += 10;
    if (close < emaCurta) score += 5;
    if (close < vwap) score += 5;
    if (close < bandasBollinger.medio) score += 5;
  }

  // Volume
  if (volumeRelativo > CONFIG.LIMIARES.VOLUME_ALERTA) score += 10;

  // Divergências
  if (divergencias.divergenciaRSI) {
    if ((direcao === 'ALTA' && divergencias.tipoDivergencia === 'ALTA') ||
        (direcao === 'BAIXA' && divergencias.tipoDivergencia === 'BAIXA')) {
      score += 15;
    }
  }

  return Math.min(100, Math.max(0, score));
}

// =============================================
// GERADOR DE SINAIS OTIMIZADO
// =============================================
function gerarSinal(indicadores, divergencias, lateral) {
  const scoreAlta = calcularScoreDirecional('ALTA', indicadores, divergencias);
  const scoreBaixa = calcularScoreDirecional('BAIXA', indicadores, divergencias);
  
  const { rsi, stoch, macd, close, volumeRelativo, bandasBollinger, tendencia } = indicadores;

  // Condições mínimas para entrada
  const condicoesMinimasAlta = 
    scoreAlta >= 70 &&
    close > indicadores.vwap &&
    macd.histograma > macd.sinalLinha * 0.5 &&
    volumeRelativo > 1.2;

  const condicoesMinimasBaixa = 
    scoreBaixa >= 70 &&
    close < indicadores.vwap &&
    macd.histograma < macd.sinalLinha * 0.5 &&
    volumeRelativo > 1.2;

  // Estratégia 1: Tendência forte com confirmação
  if (tendencia.forca > 75) {
    if (tendencia.tendencia.includes("ALTA") && condicoesMinimasAlta && scoreAlta >= 80) {
      return "CALL";
    }
    if (tendencia.tendencia.includes("BAIXA") && condicoesMinimasBaixa && scoreBaixa >= 80) {
      return "PUT";
    }
  }

  // Estratégia 2: Divergências fortes
  if (divergencias.divergenciaRSI && scoreAlta >= 85 && condicoesMinimasAlta) {
    return "CALL";
  }
  if (divergencias.divergenciaRSI && scoreBaixa >= 85 && condicoesMinimasBaixa) {
    return "PUT";
  }

  // Estratégia 3: Breakout de lateralidade
  if (lateral && state.contadorLaterais > 15 && volumeRelativo > 2) {
    const bandaWidth = (bandasBollinger.superior - bandasBollinger.inferior) / bandasBollinger.medio;
    if (bandaWidth < 0.03) {
      if (close > bandasBollinger.superior * 0.998 && condicoesMinimasAlta) return "CALL";
      if (close < bandasBollinger.inferior * 1.002 && condicoesMinimasBaixa) return "PUT";
    }
  }

  // Estratégia 4: Reversão de sobrevenda/sobrecompra
  const rsiOversold = rsi < CONFIG.LIMIARES.RSI_OVERSOLD;
  const rsiOverbought = rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT;
  const stochOversold = stoch.k < CONFIG.LIMIARES.STOCH_OVERSOLD;
  const stochOverbought = stoch.k > CONFIG.LIMIARES.STOCH_OVERBOUGHT;

  if (rsiOversold && stochOversold && condicoesMinimasAlta && !lateral) {
    return "CALL";
  }
  
  if (rsiOverbought && stochOverbought && condicoesMinimasBaixa && !lateral) {
    return "PUT";
  }

  return "ESPERAR";
}

// =============================================
// CALCULADOR DE CONFIANÇA OTIMIZADO
// =============================================
function calcularScore(sinal, indicadores, divergencias) {
  if (sinal === "ESPERAR") return 0;
  
  const direcao = sinal === "CALL" ? "ALTA" : "BAIXA";
  return calcularScoreDirecional(direcao, indicadores, divergencias);
}

// =============================================
// GERENCIAMENTO DE SINAIS CONSECUTIVOS
// =============================================
function gerenciarSinaisConsecutivos(sinal) {
  const agora = Date.now();
  const tempoDesdeUltimoSinal = (agora - state.lastSignalTime) / 60000; // em minutos
  
  // Resetar contador se passou mais de 10 minutos
  if (tempoDesdeUltimoSinal > 10) {
    state.consecutiveSignalCount = 0;
  }
  
  if (sinal !== "ESPERAR" && sinal === state.ultimoSinal) {
    state.consecutiveSignalCount = (state.consecutiveSignalCount || 0) + 1;
    
    // Limitar sinais consecutivos do mesmo tipo
    if (state.consecutiveSignalCount > CONFIG.LIMIARES.MAX_CONSECUTIVE_SIGNALS) {
      log(`Sinal ${sinal} ignorado - muitos sinais consecutivos`, LOG_LEVEL.WARN);
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
    
    if (sinal === "CALL") comandoElement.textContent += " 📈";
    else if (sinal === "PUT") comandoElement.textContent += " 📉";
    else if (sinal === "ESPERAR") comandoElement.textContent += " ✋";
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
  }
  
  const atualizacaoElement = document.getElementById("ultima-atualizacao");
  if (atualizacaoElement) {
    atualizacaoElement.textContent = state.ultimaAtualizacao;
  }
}

// =============================================
// CORE DO SISTEMA COM GESTÃO DE SINAIS
// =============================================
async function analisarMercado() {
  if (state.leituraEmAndamento) {
    log("Análise já em andamento, ignorando...", LOG_LEVEL.DEBUG);
    return;
  }
  
  state.leituraEmAndamento = true;
  let analysisTimeout = null;
  
  try {
    // Timeout de segurança para análise
    analysisTimeout = setTimeout(() => {
      log("Análise está demorando muito, forçando finalização", LOG_LEVEL.WARN);
      state.leituraEmAndamento = false;
    }, 15000);
    
    log("Iniciando análise de mercado...", LOG_LEVEL.INFO);
    
    const dados = await obterDadosTwelveData();
    validarDados(dados);
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

    // Calcular EMAs com validação
    const calcularEMA = (dados, periodo) => {
      if (dados.length < periodo) {
        log(`Dados insuficientes para EMA${periodo}: ${dados.length}`, LOG_LEVEL.WARN);
        return null;
      }
      const emaArray = calcularMedia.exponencial(dados, periodo);
      return emaArray.length > 0 ? emaArray[emaArray.length - 1] : null;
    };

    const ema5 = calcularEMA(closes, CONFIG.PERIODOS.EMA_CURTA);
    const ema13 = calcularEMA(closes, CONFIG.PERIODOS.EMA_MEDIA);
    const ema50 = calcularEMA(closes, CONFIG.PERIODOS.EMA_50);

    // Calcular novos indicadores
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
      log(`Sinal ${sinal} gerado - ativando cooldown`, LOG_LEVEL.INFO);
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
        <li>📊 Tendência: ${state.tendenciaDetectada} (${state.forcaTendencia}%)</li>
        <li>💰 Preço: ${indicadores.close.toFixed(2)}</li>
        <li>📉 RSI: ${rsi.toFixed(2)} ${rsi < CONFIG.LIMIARES.RSI_OVERSOLD ? '🔻' : rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT ? '🔺' : ''}</li>
        <li>📊 MACD: ${macd.histograma > 0 ? '+' : ''}${macd.histograma.toFixed(4)} ${macd.histograma > 0 ? '🟢' : '🔴'}</li>
        <li>📈 Stochastic: ${stoch.k.toFixed(2)}/${stoch.d.toFixed(2)}</li>
        <li>📌 Médias: EMA5 ${ema5?.toFixed(2) || 'N/A'} | EMA13 ${ema13?.toFixed(2) || 'N/A'} | EMA50 ${ema50?.toFixed(2) || 'N/A'}</li>
        <li>📊 Suporte: ${state.suporteKey.toFixed(2)} | Resistência: ${state.resistenciaKey.toFixed(2)}</li>
        <li>⚠️ Divergência: ${divergencias.tipoDivergencia}</li>
        <li>🚦 SuperTrend: ${superTrend.direcao > 0 ? 'ALTA' : 'BAIXA'} (${superTrend.valor.toFixed(2)})</li>
        <li>⚡ Volatilidade (ATR): ${atr.toFixed(4)}</li>
        <li>🔄 Lateral: ${lateral ? 'SIM' : 'NÃO'}</li>
        <li>💹 Volume: ${(state.volumeRelativo * 100).toFixed(0)}% ${state.volumeRelativo > CONFIG.LIMIARES.VOLUME_ALERTA ? '🚀' : ''}</li>
        <li>📊 VWAP: ${state.vwap.toFixed(2)}</li>
        <li>📊 Bollinger: ${state.bandasBollinger.superior.toFixed(2)} | ${state.bandasBollinger.inferior.toFixed(2)}</li>
        <li>📦 OBV: ${state.obv > 0 ? '↑' : '↓'} ${Math.abs(state.obv).toFixed(0)}</li>
      `;
    }

    state.ultimos.unshift(`${state.ultimaAtualizacao} - ${sinal} (${score}%)`);
    if (state.ultimos.length > 8) state.ultimos.pop();
    const ultimosElement = document.getElementById("ultimos");
    if (ultimosElement) ultimosElement.innerHTML = state.ultimos.map(i => `<li>${i}</li>`).join("");

    state.tentativasErro = 0;
    log(`Análise concluída - Sinal: ${sinal}, Score: ${score}%`, LOG_LEVEL.INFO);
    
  } catch (e) {
    log("Erro na análise: " + e.message, LOG_LEVEL.ERROR);
    atualizarInterface("ERRO", 0, "ERRO", 0);
    
    const criteriosElement = document.getElementById("criterios");
    if (criteriosElement) {
      criteriosElement.innerHTML = `<li>ERRO: ${e.message}</li>`;
    }
    
    if (++state.tentativasErro > 3) {
      log("Muitos erros consecutivos, recarregando aplicação...", LOG_LEVEL.ERROR);
      setTimeout(() => {
        document.body.innerHTML = '<div style="text-align:center;padding:50px;color:white">Erro crítico. Recarregando...</div>';
        setTimeout(() => location.reload(), 3000);
      }, 10000);
    }
  } finally {
    if (analysisTimeout) clearTimeout(analysisTimeout);
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
    
    log(`Obtendo dados da API (chave ${currentKeyIndex + 1})...`, LOG_LEVEL.DEBUG);
    
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
    
    log(`Dados obtidos: ${data.values.length} velas`, LOG_LEVEL.DEBUG);
    
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
    log("Erro ao obter dados: " + e.message, LOG_LEVEL.ERROR);
    
    errorCount++;
    if (errorCount >= 2) {
      currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
      errorCount = 0;
      log(`Alternando para chave API: ${currentKeyIndex + 1}`, LOG_LEVEL.WARN);
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
  log("Iniciando aplicativo de análise...", LOG_LEVEL.INFO);
  
  // Atualizar relógio a cada segundo
  setInterval(atualizarRelogio, 1000);
  
  // Sincronizar timer e iniciar análises
  sincronizarTimer();
  
  // Primeira análise
  setTimeout(analisarMercado, 2000);
}

// Health check simplificado
function healthCheck() {
  return {
    uptime: Date.now() - state.startTime,
    logs: state.logs.length,
    errors: state.tentativasErro,
    marketOpen: state.marketOpen,
    lastUpdate: state.ultimaAtualizacao
  };
}

// Iniciar quando o documento estiver pronto
if (document.readyState === "complete") {
  iniciarAplicativo();
} else {
  document.addEventListener("DOMContentLoaded", iniciarAplicativo);
}

// Expor funções para debugging (opcional)
if (typeof window !== 'undefined') {
  window.healthCheck = healthCheck;
  window.state = state;
  window.CONFIG = CONFIG;
}
