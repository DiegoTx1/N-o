// =============================================
// CONFIGURAÇÕES ESSENCIAIS
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
  tendenciaDetectada: "NEUTRA",
  forcaTendencia: 0,
  dadosHistoricos: [],
  resistenciaKey: 0,
  suporteKey: 0,
  rsiCache: { avgGain: 0, avgLoss: 0, initialized: false, lastLength: 0 },
  superTrendCache: [],
  atrGlobal: 0,
  rsiHistory: [],
  cooldown: 0,
  volumeRelativo: 0,
  vwap: 0,
  bandasBollinger: { superior: 0, inferior: 0, medio: 0 },
  lastSignalTime: 0,
  consecutiveSignalCount: 0
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
    MACD_RAPIDA: 6,
    MACD_LENTA: 13,
    MACD_SINAL: 9,
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
    SCORE_ALTO: 65,
    SCORE_MEDIO: 50,
    RSI_OVERBOUGHT: 75,
    RSI_OVERSOLD: 25,
    STOCH_OVERBOUGHT: 80,
    STOCH_OVERSOLD: 20,
    VARIACAO_LATERAL: 0.015,
    LATERALIDADE_LIMIAR: 0.015,
    VOLUME_ALERTA: 1.4,
    MIN_COOLDOWN: 1,
    MAX_CONSECUTIVE_SIGNALS: 3
  }
};

// =============================================
// GERENCIADOR DE CHAVES API (MANTIDO)
// =============================================
const API_KEYS = ["0105e6681b894e0185704171c53f5075", "b9d6a5d8a4a24a8f8d6f7d8c6f8d7a5d"];
let currentKeyIndex = 0;
let errorCount = 0;

// =============================================
// CACHE SIMPLIFICADO
// =============================================
const CacheManager = {
  rsi: { data: null, timestamp: 0, ttl: 30000 },
  ema: { data: null, timestamp: 0, ttl: 30000 },
  macd: { data: null, timestamp: 0, ttl: 30000 },
  stoch: { data: null, timestamp: 0, ttl: 30000 },
  
  get(key) {
    const item = this[key];
    return item && Date.now() - item.timestamp < item.ttl ? item.data : null;
  },
  
  set(key, data) {
    this[key] = { data, timestamp: Date.now(), ttl: 30000 };
  }
};

// =============================================
// FUNÇÕES UTILITÁRIAS ESSENCIAIS
// =============================================
function formatarTimer(segundos) {
  return `0:${segundos.toString().padStart(2, '0')}`;
}

function atualizarRelogio() {
  const elementoHora = document.getElementById("hora");
  if (elementoHora) {
    const now = new Date();
    state.ultimaAtualizacao = now.toLocaleTimeString("pt-BR", {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
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
      try { document.getElementById("som-call")?.play(); } catch(e) {}
    } else if (sinal === "PUT") {
      comandoElement.textContent = "PUT 📉";
      try { document.getElementById("som-put")?.play(); } catch(e) {}
    } else if (sinal === "ESPERAR") {
      comandoElement.textContent = "ESPERAR ✋";
    }
  }
  
  const scoreElement = document.getElementById("score");
  if (scoreElement) {
    scoreElement.textContent = `Confiança: ${score}%`;
    scoreElement.style.color = score >= CONFIG.LIMIARES.SCORE_ALTO ? '#00ff00' : 
                              score >= CONFIG.LIMIARES.SCORE_MEDIO ? '#ffff00' : '#ff0000';
  }
  
  const tendenciaElement = document.getElementById("tendencia");
  const forcaElement = document.getElementById("forca-tendencia");
  if (tendenciaElement && forcaElement) {
    tendenciaElement.textContent = tendencia;
    forcaElement.textContent = `${Math.round(forcaTendencia)}%`;
    tendenciaElement.className = `indicator-value ${
      tendencia.includes("ALTA") ? "positive" : 
      tendencia.includes("BAIXA") ? "negative" : "neutral"
    }`;
  }
}

// =============================================
// INDICADORES ESSENCIAIS (APENAS OS USADOS)
// =============================================
const calcularMedia = {
  simples: (dados, periodo) => {
    if (!Array.isArray(dados) || dados.length < periodo) return null;
    const slice = dados.slice(-periodo);
    return slice.reduce((a, b) => a + b, 0) / periodo;
  },

  exponencial: (dados, periodo, cacheKey = null) => {
    if (!Array.isArray(dados) || dados.length < periodo) return [];
    
    if (cacheKey) {
      const cached = CacheManager.get(cacheKey);
      if (cached) return cached;
    }
    
    const k = 2 / (periodo + 1);
    let ema = calcularMedia.simples(dados.slice(0, periodo), periodo);
    if (ema === null) return [];
    
    const emaArray = [ema];
    for (let i = periodo; i < dados.length; i++) {
      ema = dados[i] * k + ema * (1 - k);
      emaArray.push(ema);
    }
    
    if (cacheKey) CacheManager.set(cacheKey, emaArray);
    return emaArray;
  }
};

function calcularRSI(closes, periodo = CONFIG.PERIODOS.RSI) {
  if (closes.length < periodo + 1) return 50;
  
  const cacheKey = `rsi_${periodo}`;
  const cached = CacheManager.get(cacheKey);
  if (cached) return cached;
  
  if (closes.length !== state.rsiCache.lastLength) {
    state.rsiCache = { avgGain: 0, avgLoss: 0, initialized: false, lastLength: closes.length };
  }
  
  if (!state.rsiCache.initialized) {
    let gains = 0, losses = 0;
    for (let i = 1; i <= periodo; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff > 0) gains += diff; else losses -= diff;
    }
    state.rsiCache.avgGain = gains / periodo;
    state.rsiCache.avgLoss = losses / periodo;
    state.rsiCache.initialized = true;
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
  
  CacheManager.set(cacheKey, rsi);
  return rsi;
}

function calcularStochastic(highs, lows, closes) {
  try {
    const periodoK = CONFIG.PERIODOS.STOCH_K;
    const periodoD = CONFIG.PERIODOS.STOCH_D;
    
    if (closes.length < periodoK) return { k: 50, d: 50 };
    
    const cacheKey = `stoch_${periodoK}_${periodoD}`;
    const cached = CacheManager.get(cacheKey);
    if (cached) return cached;
    
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
      kSuavizado.push(calcularMedia.simples(slice, periodoD) || 50);
    }
    
    const resultado = {
      k: kSuavizado[kSuavizado.length - 1] || 50,
      d: kSuavizado[kSuavizado.length - 1] || 50 // Simplificado
    };
    
    CacheManager.set(cacheKey, resultado);
    return resultado;
  } catch (e) {
    return { k: 50, d: 50 };
  }
}

function calcularMACD(closes) {
  try {
    const rapida = CONFIG.PERIODOS.MACD_RAPIDA;
    const lenta = CONFIG.PERIODOS.MACD_LENTA;
    const sinal = CONFIG.PERIODOS.MACD_SINAL;
    
    if (closes.length < lenta) return { histograma: 0, macdLinha: 0, sinalLinha: 0 };
    
    const cacheKey = `macd_${rapida}_${lenta}_${sinal}`;
    const cached = CacheManager.get(cacheKey);
    if (cached) return cached;
    
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
    
    const resultado = {
      histograma: ultimoMACD - ultimoSinal,
      macdLinha: ultimoMACD,
      sinalLinha: ultimoSinal
    };
    
    CacheManager.set(cacheKey, resultado);
    return resultado;
  } catch (e) {
    return { histograma: 0, macdLinha: 0, sinalLinha: 0 };
  }
}

function calcularATR(dados) {
  try {
    const periodo = CONFIG.PERIODOS.ATR;
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
    return 0.01;
  }
}

function calcularSuperTrend(dados) {
  try {
    const periodo = CONFIG.PERIODOS.SUPERTREND;
    if (dados.length < periodo) return { direcao: 0, valor: dados[dados.length-1]?.close || 0 };
    
    const atr = calcularATR(dados);
    const current = dados[dados.length - 1];
    const hl2 = (current.high + current.low) / 2;
    
    const upperBand = hl2 + (3 * atr);
    const lowerBand = hl2 - (3 * atr);
    
    let superTrend, direcao;
    
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
    if (state.superTrendCache.length > 20) state.superTrendCache.shift();
    
    return { direcao, valor: superTrend };
  } catch (e) {
    return { direcao: 0, valor: dados[dados.length-1]?.close || 0 };
  }
}

function calcularVolumeRelativo(volumes) {
  const periodo = CONFIG.PERIODOS.VOLUME_LOOKBACK;
  if (volumes.length < periodo) return 1;
  
  const slice = volumes.slice(-periodo);
  const mediaVolume = calcularMedia.simples(slice, periodo);
  const volumeRecente = volumes.slice(-3);
  const volumeMedioRecente = calcularMedia.simples(volumeRecente, 3);
  
  return volumeMedioRecente / mediaVolume;
}

function calcularVWAP(dados) {
  const periodo = CONFIG.PERIODOS.VWAP;
  if (dados.length < periodo) return dados[dados.length-1]?.close || 0;
  
  let tpTotal = 0, volumeTotal = 0;
  const slice = dados.slice(-periodo);
  
  slice.forEach(v => {
    if (!v.high || !v.low || !v.close || !v.volume) return;
    const tp = (v.high + v.low + v.close) / 3;
    tpTotal += tp * v.volume;
    volumeTotal += v.volume;
  });
  
  return volumeTotal > 0 ? tpTotal / volumeTotal : (dados[dados.length-1]?.close || 0);
}

function calcularBandasBollinger(closes) {
  const periodo = CONFIG.PERIODOS.BOLLINGER;
  if (closes.length < periodo) {
    const media = closes.length > 0 ? calcularMedia.simples(closes, closes.length) : 0;
    return { superior: media, inferior: media, medio: media };
  }
  
  const slice = closes.slice(-periodo);
  const media = calcularMedia.simples(slice, periodo);
  
  let somaQuadrados = 0;
  slice.forEach(valor => somaQuadrados += Math.pow(valor - media, 2));
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
  const forca = Math.min(100, (Math.abs(diffCurta) * 2000 + Math.abs(diffLonga) * 1000));
  
  if (forca > 75) {
    return diffCurta > 0 && diffLonga > 0 
      ? { tendencia: "FORTE_ALTA", forca }
      : diffCurta < 0 && diffLonga < 0 
        ? { tendencia: "FORTE_BAIXA", forca }
        : { tendencia: "NEUTRA", forca: 0 };
  }
  
  if (forca > 45) {
    return diffCurta > 0 ? { tendencia: "ALTA", forca } : { tendencia: "BAIXA", forca };
  }
  
  return { tendencia: "NEUTRA", forca: 0 };
}

function detectarLateralidade(closes) {
  const periodo = CONFIG.PERIODOS.ANALISE_LATERAL;
  const limiar = CONFIG.LIMIARES.LATERALIDADE_LIMIAR;
  
  if (closes.length < periodo) return false;
  
  let countLaterais = 0;
  for (let i = closes.length - 1; i > closes.length - periodo; i--) {
    if (i === 0) break;
    const variacao = Math.abs((closes[i] - closes[i-1]) / closes[i-1]);
    if (variacao < limiar) countLaterais++;
  }
  
  return countLaterais > periodo * 0.65;
}

function calcularZonasPreco(dados) {
  const periodo = Math.min(50, dados.length);
  const slice = dados.slice(-periodo);
  const highs = slice.map(v => v.high);
  const lows = slice.map(v => v.low);
  
  return {
    resistencia: (Math.max(...highs) * 0.6 + calcularMedia.simples(highs, highs.length) * 0.4),
    suporte: (Math.min(...lows) * 0.6 + calcularMedia.simples(lows, lows.length) * 0.4)
  };
}

function detectarDivergencias(closes, rsis) {
  try {
    const lookback = Math.min(20, closes.length - 1);
    if (closes.length < lookback || rsis.length < lookback) {
      return { divergenciaRSI: false, tipoDivergencia: "NENHUMA" };
    }
    
    // Simplificação: verificar apenas os últimos pontos
    const ultimoClose = closes[closes.length - 1];
    const penultimoClose = closes[closes.length - 2];
    const ultimoRSI = rsis[rsis.length - 1];
    const penultimoRSI = rsis[rsis.length - 2];
    
    if (ultimoClose > penultimoClose && ultimoRSI < penultimoRSI) {
      return { divergenciaRSI: true, tipoDivergencia: "BAIXA" };
    }
    
    if (ultimoClose < penultimoClose && ultimoRSI > penultimoRSI) {
      return { divergenciaRSI: true, tipoDivergencia: "ALTA" };
    }
    
    return { divergenciaRSI: false, tipoDivergencia: "NENHUMA" };
  } catch (e) {
    return { divergenciaRSI: false, tipoDivergencia: "NENHUMA" };
  }
}

// =============================================
// SISTEMA DE SINAIS OTIMIZADO
// =============================================
function calcularScoreDirecional(direcao, indicadores, divergencias) {
  let score = 50;
  const { rsi, stoch, macd, close, tendencia, volumeRelativo, vwap, superTrend } = indicadores;

  // Tendência
  if ((direcao === 'ALTA' && tendencia.tendencia.includes('ALTA')) ||
      (direcao === 'BAIXA' && tendencia.tendencia.includes('BAIXA'))) {
    score += Math.min(25, tendencia.forca / 4);
  }

  // Indicadores
  if (direcao === 'ALTA') {
    if (rsi > 30 && rsi < 80) score += 10;
    if (stoch.k > 25) score += 8;
    if (macd.histograma > -0.001) score += 15;
    if (close > vwap) score += 10;
    if (superTrend.direcao > 0) score += 12;
  } else {
    if (rsi < 70 && rsi > 20) score += 10;
    if (stoch.k < 75) score += 8;
    if (macd.histograma < 0.001) score += 15;
    if (close < vwap) score += 10;
    if (superTrend.direcao < 0) score += 12;
  }

  // Volume e Divergências
  if (volumeRelativo > 1.2) score += 10;
  if (divergencias.divergenciaRSI) score += 15;
  if (tendencia.forca > 60) score += 10;

  return Math.min(100, Math.max(20, score));
}

function gerarSinal(indicadores, divergencias, lateral) {
  const scoreAlta = calcularScoreDirecional('ALTA', indicadores, divergencias);
  const scoreBaixa = calcularScoreDirecional('BAIXA', indicadores, divergencias);
  
  const { rsi, stoch, macd, close, volumeRelativo, tendencia, superTrend, vwap } = indicadores;

  // Condições base simplificadas
  const condicoesAlta = close > vwap && macd.histograma > -0.005 && volumeRelativo > 0.8;
  const condicoesBaixa = close < vwap && macd.histograma < 0.005 && volumeRelativo > 0.8;

  // 1. Tendência forte
  if (tendencia.forca > 50) {
    if (tendencia.tendencia.includes("ALTA") && scoreAlta >= 55 && condicoesAlta) return "CALL";
    if (tendencia.tendencia.includes("BAIXA") && scoreBaixa >= 55 && condicoesBaixa) return "PUT";
  }

  // 2. Condições extremas
  if (rsi < 25 && stoch.k < 20 && scoreAlta >= 58 && !lateral) return "CALL";
  if (rsi > 75 && stoch.k > 80 && scoreBaixa >= 58 && !lateral) return "PUT";

  // 3. SuperTrend
  if (superTrend.direcao > 0 && scoreAlta >= 58 && condicoesAlta) return "CALL";
  if (superTrend.direcao < 0 && scoreBaixa >= 58 && condicoesBaixa) return "PUT";

  return "ESPERAR";
}

function gerenciarSinaisConsecutivos(sinal) {
  const agora = Date.now();
  const tempoDesdeUltimoSinal = (agora - state.lastSignalTime) / 60000;
  
  if (tempoDesdeUltimoSinal > 15) state.consecutiveSignalCount = 0;
  
  if (sinal !== "ESPERAR" && sinal === state.ultimoSinal) {
    state.consecutiveSignalCount++;
    if (state.consecutiveSignalCount > CONFIG.LIMIARES.MAX_CONSECUTIVE_SIGNALS) return "ESPERAR";
  } else if (sinal !== "ESPERAR") {
    state.consecutiveSignalCount = 1;
  }
  
  state.lastSignalTime = agora;
  return sinal;
}

// =============================================
// FUNÇÃO PRINCIPAL SIMPLIFICADA
// =============================================
async function obterDadosTwelveData() {
  try {
    const apiKey = API_KEYS[currentKeyIndex];
    const url = `${CONFIG.API_ENDPOINTS.TWELVE_DATA}/time_series?symbol=${CONFIG.PARES.CRYPTO_IDX}&interval=1min&outputsize=100&apikey=${apiKey}`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Falha na API: ${response.status}`);
    
    const data = await response.json();
    if (data.status === 'error') throw new Error(data.message);
    if (!data.values || data.values.length === 0) throw new Error("Dados vazios");
    
    return data.values.reverse().map(item => ({
      time: item.datetime,
      open: parseFloat(item.open),
      high: parseFloat(item.high),
      low: parseFloat(item.low),
      close: parseFloat(item.close),
      volume: parseFloat(item.volume) || 1
    }));
  } catch (e) {
    errorCount++;
    if (errorCount >= 2) {
      currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
      errorCount = 0;
    }
    throw e;
  }
}

async function analisarMercado() {
  if (state.leituraEmAndamento) return;
  state.leituraEmAndamento = true;
  
  try {
    const dados = await obterDadosTwelveData();
    if (dados.length < 15) throw new Error(`Dados insuficientes (${dados.length} velas)`);
    
    state.dadosHistoricos = dados;
    const velaAtual = dados[dados.length - 1];
    const closes = dados.map(v => v.close);
    const highs = dados.map(v => v.high);
    const lows = dados.map(v => v.low);
    const volumes = dados.map(v => v.volume);

    // Calcular indicadores essenciais
    const zonas = calcularZonasPreco(dados);
    state.resistenciaKey = zonas.resistencia;
    state.suporteKey = zonas.suporte;

    const calcularEMA = (dados, periodo, cacheKey) => {
      const emaArray = calcularMedia.exponencial(dados, periodo, cacheKey);
      return emaArray.length > 0 ? emaArray[emaArray.length - 1] : null;
    };

    const ema5 = calcularEMA(closes, CONFIG.PERIODOS.EMA_CURTA, 'ema_5');
    const ema13 = calcularEMA(closes, CONFIG.PERIODOS.EMA_MEDIA, 'ema_13');
    const ema50 = calcularEMA(closes, CONFIG.PERIODOS.EMA_50, 'ema_50');

    state.volumeRelativo = calcularVolumeRelativo(volumes);
    state.vwap = calcularVWAP(dados);
    state.bandasBollinger = calcularBandasBollinger(closes);

    const superTrend = calcularSuperTrend(dados);
    const rsi = calcularRSI(closes);
    const stoch = calcularStochastic(highs, lows, closes);
    const macd = calcularMACD(closes);

    // Manter histórico RSI para divergências
    state.rsiHistory.push(rsi);
    if (state.rsiHistory.length > 20) state.rsiHistory.shift();
    
    const divergencias = detectarDivergencias(closes, state.rsiHistory);
    const tendencia = avaliarTendencia(ema5, ema13, ema50);
    const lateral = detectarLateralidade(closes);

    state.tendenciaDetectada = tendencia.tendencia;
    state.forcaTendencia = tendencia.forca;

    const indicadores = { rsi, stoch, macd, close: velaAtual.close, superTrend, tendencia, volumeRelativo: state.volumeRelativo, vwap: state.vwap };

    let sinal = gerarSinal(indicadores, divergencias, lateral);
    sinal = gerenciarSinaisConsecutivos(sinal);
    
    if (sinal !== "ESPERAR" && state.cooldown <= 0) {
      state.cooldown = CONFIG.LIMIARES.MIN_COOLDOWN;
    } else if (state.cooldown > 0) {
      state.cooldown--;
      sinal = "ESPERAR";
    }

    const score = calcularScoreDirecional(sinal === "CALL" ? "ALTA" : "BAIXA", indicadores, divergencias);
    state.ultimoSinal = sinal;
    state.ultimoScore = score;
    state.ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR");

    atualizarInterface(sinal, score, state.tendenciaDetectada, state.forcaTendencia);

    // Atualizar interface
    const criteriosElement = document.getElementById("criterios");
    if (criteriosElement) {
      criteriosElement.innerHTML = `
        <li>🎯 BITCOIN CASH (BCH/USD) - $${indicadores.close.toFixed(2)}</li>
        <li>📊 ${state.tendenciaDetectada} (${Math.round(state.forcaTendencia)}%)</li>
        <li>📉 RSI: ${rsi.toFixed(1)} | MACD: ${macd.histograma > 0 ? '+' : ''}${macd.histograma.toFixed(4)}</li>
        <li>📈 Stochastic: ${stoch.k.toFixed(1)} | Volume: ${(state.volumeRelativo * 100).toFixed(0)}%</li>
        <li>📊 S: $${state.suporteKey.toFixed(2)} | R: $${state.resistenciaKey.toFixed(2)}</li>
      `;
    }

    state.ultimos.unshift(`${state.ultimaAtualizacao} - ${sinal} (${score}%)`);
    if (state.ultimos.length > 5) state.ultimos.pop();
    
    const ultimosElement = document.getElementById("ultimos");
    if (ultimosElement) ultimosElement.innerHTML = state.ultimos.map(i => `<li>${i}</li>`).join("");

  } catch (e) {
    console.error("Erro na análise:", e);
    atualizarInterface("ERRO", 0, "ERRO", 0);
  } finally {
    state.leituraEmAndamento = false;
  }
}

// =============================================
// CONTROLE DE TEMPO (MANTIDO)
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

function iniciarAplicativo() {
  setInterval(atualizarRelogio, 1000);
  sincronizarTimer();
  setTimeout(analisarMercado, 2000);
}

if (document.readyState === "complete") iniciarAplicativo();
else document.addEventListener("DOMContentLoaded", iniciarAplicativo);
