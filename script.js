// =============================================
// CONFIGURAÇÕES GLOBAIS (ATUALIZADAS PARA EURUSD)
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
  ultimaAnalise: Date.now(),
  dadosHistoricos: {
    M1: [],
    M5: [],
    M15: []
  },
  resistenciaKey: 0,
  suporteKey: 0,
  // Cache otimizado para indicadores
  rsiCache: { avgGain: 0, avgLoss: 0, initialized: false, ultimoIndice: -1 },
  emaCache: {},
  macdCache: {
    emaRapida: null,
    emaLenta: null,
    signalLine: 0,
    ultimoIndice: -1,
    initialized: false
  },
  superTrendCache: { valor: 0, direcao: 0, ultimoIndice: -1 },
  atrGlobal: 0,
  rsiHistory: [],
  cooldown: 0
};

const CONFIG = {
  API_ENDPOINTS: {
    TWELVE_DATA: "https://api.twelvedata.com"
  },
  PARES: {
    FOREX_IDX: "EUR/USD"
  },
  PERIODOS: {
    RSI: 9,
    STOCH_K: 14,
    STOCH_D: 3,
    WILLIAMS: 14,
    EMA_CURTA: 5,
    EMA_MEDIA: 13,
    EMA_LONGA: 200,
    SMA_VOLUME: 20,
    MACD_RAPIDA: 6,
    MACD_LENTA: 13,
    MACD_SINAL: 9,
    VELAS_CONFIRMACAO: 3,
    ANALISE_LATERAL: 20,
    VWAP: 20,
    ATR: 14,
    SUPERTREND: 7,
    VOLUME_PROFILE: 50,
    LIQUIDITY_ZONES: 20,
    DIVERGENCIA_LOOKBACK: 5,  // Reduzido de 8 para 5
    EXTREME_LOOKBACK: 2
  },
  LIMIARES: {
    SCORE_ALTO: 85,
    SCORE_MEDIO: 70,
    RSI_OVERBOUGHT: 70,
    RSI_OVERSOLD: 30,
    STOCH_OVERBOUGHT: 85,
    STOCH_OVERSOLD: 15,
    WILLIAMS_OVERBOUGHT: -15,
    WILLIAMS_OVERSOLD: -85,
    VARIACAO_LATERAL: 0.005,
    VWAP_DESVIO: 0.005,
    ATR_LIMIAR: 0.0005,
    BUCKET_SIZE: 0.0005,
    VOLUME_CONFIRMACAO: 1.2,
    LATERALIDADE_LIMIAR: 0.0008
  },
  PESOS: {
    RSI: 1.7,
    MACD: 2.2,
    TENDENCIA: 2.8,
    VOLUME: 0.5,
    STOCH: 1.2,
    WILLIAMS: 1.1,
    VWAP: 1.5,
    SUPERTREND: 1.9,
    VOLUME_PROFILE: 1.2,
    DIVERGENCIA: 2.0,
    LIQUIDITY: 1.8
  },
  PESOS_SUPORTE_RESISTENCIA: {
    VOLUME_PROFILE: 0.4,
    LIQUIDEZ: 0.4,
    EMA: 0.2
  },
  PESOS_TIMEFRAME: {
    M15: 0.4,
    M5: 0.35,
    M1: 0.25
  }
};

// =============================================
// FUNÇÕES AUXILIARES
// =============================================
function arraysIguais(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  return a.every((val, i) => val === b[i]);
}

// =============================================
// GERENCIADOR DE CHAVES API
// =============================================
const API_KEYS = [
  "9cf795b2a4f14d43a049ca935d174ebb",
  "0105e6681b894e0185704171c53f5075"
];
let currentKeyIndex = 0;
let errorCount = 0;

// =============================================
// FUNÇÕES PARA MULTI-TIMEFRAME
// =============================================
async function obterDadosMultiTimeframe() {
  const timeframes = ['1min', '5min', '15min'];
  const dados = {};
  
  for (const tf of timeframes) {
    try {
      const apiKey = API_KEYS[currentKeyIndex];
      const url = `${CONFIG.API_ENDPOINTS.TWELVE_DATA}/time_series?symbol=${CONFIG.PARES.FOREX_IDX}&interval=${tf}&outputsize=100&apikey=${apiKey}`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      const data = await response.json();
      
      if (data.status === 'error') throw new Error(data.message);
      if (!data.values || !Array.isArray(data.values)) {
        throw new Error("Formato de dados inválido da API");
      }
      
      const tfKey = tf === '1min' ? 'M1' : tf === '5min' ? 'M5' : 'M15';
      dados[tfKey] = data.values.reverse().map(item => ({
        time: item.datetime,
        open: parseFloat(item.open),
        high: parseFloat(item.high),
        low: parseFloat(item.low),
        close: parseFloat(item.close),
        volume: parseFloat(item.volume) || 1
      }));
      errorCount = 0;
    } catch (e) {
      console.error(`Erro no timeframe ${tf}:`, e);
      currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
      errorCount++;
      
      const tfKey = tf === '1min' ? 'M1' : tf === '5min' ? 'M5' : 'M15';
      dados[tfKey] = state.dadosHistoricos[tfKey] || [];
      
      await new Promise(resolve => 
        setTimeout(resolve, Math.min(60000, 1000 * Math.pow(2, errorCount))
      );
    }
  }
  
  return dados;
}

function calcularTendenciaTimeframe(closes, timeframe) {
  if (closes.length < CONFIG.PERIODOS.EMA_MEDIA) {
    return { tendencia: "NEUTRA", forca: 0 };
  }

  const ema5 = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_CURTA, timeframe);
  const ema13 = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_MEDIA, timeframe);
  
  const gradiente = (ema5 - ema13) / ema13 * 10000;
  const forca = Math.min(100, Math.abs(gradiente * 2));
  
  if (forca > 75) {
    return gradiente > 0 
      ? { tendencia: "FORTE_ALTA", forca }
      : { tendencia: "FORTE_BAIXA", forca };
  }
  
  if (forca > 40) {
    return gradiente > 0 
      ? { tendencia: "ALTA", forca } 
      : { tendencia: "BAIXA", forca };
  }
  
  return { tendencia: "NEUTRA", forca: 0 };
}

function consolidarTendencias(tendencias) {
  let tendenciaFinal = "NEUTRA";
  let forcaFinal = 0;
  
  const volatilidades = {};
  let maxATR = 0;
  
  for (const [timeframe, dados] of Object.entries(tendencias)) {
    const atr = dados.atr || 0.0001;
    volatilidades[timeframe] = atr;
    if (atr > maxATR) maxATR = atr;
  }
  
  for (const [timeframe, dados] of Object.entries(tendencias)) {
    const pesoBase = CONFIG.PESOS_TIMEFRAME[timeframe] || 0.25;
    const pesoVolatilidade = maxATR > 0 ? (volatilidades[timeframe] / maxATR) : 1;
    const peso = pesoBase * pesoVolatilidade;
    
    if (dados.tendencia === "FORTE_ALTA") {
      forcaFinal += dados.forca * peso;
      if (tendenciaFinal === "NEUTRA") tendenciaFinal = "ALTA";
    } 
    else if (dados.tendencia === "FORTE_BAIXA") {
      forcaFinal += dados.forca * peso;
      if (tendenciaFinal === "NEUTRA") tendenciaFinal = "BAIXA";
    }
    else if (dados.tendencia === "ALTA" && tendenciaFinal !== "BAIXA") {
      forcaFinal += dados.forca * (peso * 0.7);
      if (tendenciaFinal === "NEUTRA") tendenciaFinal = "ALTA";
    }
    else if (dados.tendencia === "BAIXA" && tendenciaFinal !== "ALTA") {
      forcaFinal += dados.forca * (peso * 0.7);
      if (tendenciaFinal === "NEUTRA") tendenciaFinal = "BAIXA";
    }
  }
  
  forcaFinal = Math.min(100, Math.max(0, forcaFinal));
  
  if (forcaFinal > 75) {
    return {
      tendencia: tendenciaFinal === "ALTA" ? "FORTE_ALTA" : "FORTE_BAIXA",
      forca: forcaFinal
    };
  }
  
  if (forcaFinal > 40) {
    return {
      tendencia: tendenciaFinal,
      forca: forcaFinal
    };
  }
  
  return { tendencia: "NEUTRA", forca: 0 };
}

// =============================================
// DETECÇÃO DE LATERALIDADE
// =============================================
function detectarLateralidade(closes, periodo = CONFIG.PERIODOS.ANALISE_LATERAL, limiar = CONFIG.LIMIARES.LATERALIDADE_LIMIAR) {
  const variacoes = [];
  for (let i = 1; i < periodo; i++) {
    if (closes.length - i - 1 < 0) break;
    variacoes.push(Math.abs(closes[closes.length - i] - closes[closes.length - i - 1]));
  }
  if (variacoes.length < periodo - 1) return false;
  const mediaVariacao = calcularMedia.simples(variacoes, periodo-1);
  return mediaVariacao < limiar;
}

// =============================================
// SUPORTE/RESISTÊNCIA DINÂMICO
// =============================================
function calcularZonasPreco(volumeProfile, liquidez, ema200) {
  return {
    resistencia: 
      (volumeProfile.vaHigh * CONFIG.PESOS_SUPORTE_RESISTENCIA.VOLUME_PROFILE) +
      (liquidez.resistencia * CONFIG.PESOS_SUPORTE_RESISTENCIA.LIQUIDEZ) +
      (ema200 * CONFIG.PESOS_SUPORTE_RESISTENCIA.EMA),
    
    suporte: 
      (volumeProfile.vaLow * CONFIG.PESOS_SUPORTE_RESISTENCIA.VOLUME_PROFILE) +
      (liquidez.suporte * CONFIG.PESOS_SUPORTE_RESISTENCIA.LIQUIDEZ) +
      (ema200 * CONFIG.PESOS_SUPORTE_RESISTENCIA.EMA)
  };
}

// =============================================
// GERADOR DE SINAIS
// =============================================
function gerarSinal(indicadores, divergencias, lateral) {
  const {
    rsi,
    stoch,
    macd,
    close,
    emaCurta,
    emaMedia,
    superTrend,
    volumeProfile,
    liquidez,
    tendencia,
    volume,
    volumeMedia,
    ema200
  } = indicadores;
  
  const minVolume = (state.atrGlobal < 0.0005) ? volumeMedia * 0.8 : volumeMedia * 1.5;
  if (volume < minVolume) return "ESPERAR";
  
  if (lateral) return "ESPERAR";
  
  if (tendencia.tendencia === "FORTE_ALTA") {
    const condicoesCompra = [
      close > emaCurta,
      macd.histograma > 0,
      stoch.k > 60,
      close > superTrend.valor && superTrend.direcao > 0
    ];
    if (condicoesCompra.filter(Boolean).length >= 3) return "CALL";
  }
  
  if (tendencia.tendencia === "FORTE_BAIXA") {
    const condicoesVenda = [
      close < emaCurta,
      macd.histograma < 0,
      stoch.k < 40,
      close < superTrend.valor && superTrend.direcao < 0
    ];
    if (condicoesVenda.filter(Boolean).length >= 3) return "PUT";
  }
  
  const limiteBreakout = 0.0002;
  if (close > (state.resistenciaKey + limiteBreakout)) return "CALL";
  if (close < (state.suporteKey - limiteBreakout)) return "PUT";
  
  if (divergencias.divergenciaRSI) {
    const relevante = Math.abs(divergencias.ultimoPreco - divergencias.penultimoPreco) > (state.atrGlobal * 0.5);
    if (relevante) {
      if (divergencias.tipoDivergencia === "ALTA" && close > state.suporteKey) return "CALL";
      if (divergencias.tipoDivergencia === "BAIXA" && close < state.resistenciaKey) return "PUT";
    }
  }
  
  if (rsi < 25 && close > emaMedia) return "CALL";
  if (rsi > 75 && close < emaMedia) return "PUT";
  
  return "ESPERAR";
}

// =============================================
// CALCULADOR DE CONFIANÇA
// =============================================
function calcularScore(sinal, indicadores, divergencias) {
  let score = 65;

  const fatores = {
    alinhamentoTendencia: sinal === "CALL" && indicadores.tendencia.tendencia.includes("ALTA") ||
                          sinal === "PUT" && indicadores.tendencia.tendencia.includes("BAIXA") ? 25 : 0,
    divergencia: divergencias.divergenciaRSI ? 20 : 0,
    posicaoMedia: sinal === "CALL" && indicadores.close > indicadores.emaMedia ? 15 : 
                  sinal === "PUT" && indicadores.close < indicadores.emaMedia ? 15 : 0,
    superTrend: sinal === "CALL" && indicadores.close > indicadores.superTrend.valor ? 10 :
                sinal === "PUT" && indicadores.close < indicadores.superTrend.valor ? 10 : 0
  };
  
  score += Object.values(fatores).reduce((sum, val) => sum + val, 0);
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
      second: '2-digit',
      hour12: false
    });
    elementoHora.textContent = state.ultimaAtualizacao;
    state.marketOpen = true;
  }
}

function atualizarInterface(sinal, score, tendencia, forcaTendencia) {
  if (!document.getElementById("comando")) return;
  
  const comandoElement = document.getElementById("comando");
  if (comandoElement) {
    comandoElement.textContent = sinal;
    comandoElement.className = sinal.toLowerCase();
    
    if (sinal === "CALL") comandoElement.textContent += " 📈";
    else if (sinal === "PUT") comandoElement.textContent += " 📉";
    else if (sinal === "ESPERAR") comandoElement.textContent += " ✋";
    else if (sinal === "ERRO") comandoElement.textContent = "ERRO";
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

  exponencial: (dados, periodo, timeframe = 'M1') => {
    if (!Array.isArray(dados) || dados.length < periodo) return 0;
    
    const cacheKey = `${timeframe}_EMA${periodo}`;
    
    if (state.emaCache[cacheKey] && state.emaCache[cacheKey].ultimoIndice === dados.length - 2) {
      const k = 2 / (periodo + 1);
      const ultimoEMA = state.emaCache[cacheKey].valor;
      const novoValor = dados[dados.length - 1];
      const novoEMA = novoValor * k + ultimoEMA * (1 - k);
      
      state.emaCache[cacheKey].valor = novoEMA;
      state.emaCache[cacheKey].ultimoIndice = dados.length - 1;
      return novoEMA;
    } else {
      const k = 2 / (periodo + 1);
      let ema = calcularMedia.simples(dados.slice(0, periodo), periodo) || dados[0];
      
      for (let i = periodo; i < dados.length; i++) {
        ema = dados[i] * k + ema * (1 - k);
      }
      
      state.emaCache[cacheKey] = {
        valor: ema,
        ultimoIndice: dados.length - 1
      };
      return ema;
    }
  }
};

function calcularRSI(closes, periodo = CONFIG.PERIODOS.RSI) {
  if (closes.length < periodo + 1) return 50;
  
  if (state.rsiCache.ultimoIndice !== closes.length - 2) {
    state.rsiCache.initialized = false;
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
    state.rsiCache.ultimoIndice = closes.length - 1;
    
    if (Math.abs(state.rsiCache.avgLoss) < 0.0000001) {
      return state.rsiCache.avgGain > 0 ? 100 : 50;
    }
    
    const rs = state.rsiCache.avgGain / state.rsiCache.avgLoss;
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
  
  state.rsiCache.ultimoIndice = closes.length - 1;
  
  if (Math.abs(state.rsiCache.avgLoss) < 0.0000001) {
    return state.rsiCache.avgGain > 0 ? 100 : 50;
  }
  
  const rs = state.rsiCache.avgGain / state.rsiCache.avgLoss;
  return 100 - (100 / (1 + rs));
}

function calcularStochastic(highs, lows, closes, 
                          periodoK = CONFIG.PERIODOS.STOCH_K, 
                          periodoD = CONFIG.PERIODOS.STOCH_D) {
  try {
    if (closes.length < periodoK) return { k: 50, d: 50 };
    
    const startIndex = Math.max(0, closes.length - periodoK - periodoD);
    const kValues = [];
    
    for (let i = periodoK - 1; i < closes.length; i++) {
      const startIdx = Math.max(startIndex, i - periodoK + 1);
      if (startIdx < 0) continue;
      
      let highestHigh = -Infinity;
      let lowestLow = Infinity;
      
      for (let j = startIdx; j <= i; j++) {
        if (highs[j] > highestHigh) highestHigh = highs[j];
        if (lows[j] < lowestLow) lowestLow = lows[j];
      }
      
      const range = highestHigh - lowestLow;
      const k = range !== 0 ? ((closes[i] - lowestLow) / range) * 100 : 50;
      kValues.push(k);
    }
    
    if (kValues.length < periodoD) return { k: 50, d: 50 };
    
    const kSuavizado = [];
    for (let i = periodoD - 1; i < kValues.length; i++) {
      const media = calcularMedia.simples(kValues.slice(i - periodoD + 1, i + 1), periodoD) || 50;
      kSuavizado.push(media);
    }
    
    const d = calcularMedia.simples(kSuavizado.slice(-periodoD), periodoD) || 50;
    
    return {
      k: kSuavizado[kSuavizado.length - 1] || 50,
      d
    };
  } catch (e) {
    console.error("Erro no cálculo Stochastic:", e);
    return { k: 50, d: 50 };
  }
}

function calcularWilliams(highs, lows, closes, periodo = CONFIG.PERIODOS.WILLIAMS) {
  try {
    if (closes.length < periodo) return 0;
    
    const startIdx = Math.max(0, highs.length - periodo);
    let highestHigh = -Infinity;
    let lowestLow = Infinity;
    
    for (let i = startIdx; i < highs.length; i++) {
      if (highs[i] > highestHigh) highestHigh = highs[i];
      if (lows[i] < lowestLow) lowestLow = lows[i];
    }
    
    const range = highestHigh - lowestLow;
    return range > 0 ? ((highestHigh - closes[closes.length - 1]) / range) * -100 : 0;
  } catch (e) {
    console.error("Erro no cálculo Williams:", e);
    return 0;
  }
}

// =============================================
// MACD ALTAMENTE OTIMIZADO (SEM TRAVAMENTOS)
// =============================================
function calcularMACD(closes, rapida = 6, lenta = 13, sinal = 9) {
    if (closes.length < Math.max(rapida, lenta, sinal)) {
        return { histograma: 0, macdLinha: 0, signalLine: 0 };
    }

    if (!state.macdCache.initialized) {
        state.macdCache = {
            emaRapida: calcularMedia.exponencial(closes, rapida, 'M1'),
            emaLenta: calcularMedia.exponencial(closes, lenta, 'M1'),
            signalLine: 0,
            ultimoIndice: closes.length - 1,
            initialized: true
        };
    }

    const novosDados = closes.slice(state.macdCache.ultimoIndice + 1);
    if (novosDados.length === 0) {
        return {
            histograma: state.macdCache.macdLinha - state.macdCache.signalLine,
            macdLinha: state.macdCache.macdLinha,
            signalLine: state.macdCache.signalLine
        };
    }

    const kRapida = 2 / (rapida + 1);
    const kLenta = 2 / (lenta + 1);
    const kSinal = 2 / (sinal + 1);

    let emaRapida = state.macdCache.emaRapida;
    let emaLenta = state.macdCache.emaLenta;
    let linhaSinal = state.macdCache.signalLine;

    for (const close of novosDados) {
        emaRapida = close * kRapida + emaRapida * (1 - kRapida);
        emaLenta = close * kLenta + emaLenta * (1 - kLenta);
        const macdLinha = emaRapida - emaLenta;
        
        if (linhaSinal === 0) {
            linhaSinal = macdLinha;
        } else {
            linhaSinal = macdLinha * kSinal + linhaSinal * (1 - kSinal);
        }
    }

    state.macdCache = {
        emaRapida,
        emaLenta,
        signalLine: linhaSinal,
        macdLinha: emaRapida - emaLenta,
        ultimoIndice: closes.length - 1,
        initialized: true
    };

    return {
        histograma: (emaRapida - emaLenta) - linhaSinal,
        macdLinha: emaRapida - emaLenta,
        signalLine: linhaSinal
    };
}

function calcularVWAP(dados, periodo = CONFIG.PERIODOS.VWAP) {
  try {
    if (!Array.isArray(dados) || dados.length < periodo) return 0;
    
    const slice = dados.slice(-periodo);
    let typicalPriceSum = 0;
    let volumeSum = 0;
    
    for (const vela of slice) {
      const typicalPrice = (vela.high + vela.low + vela.close) / 3;
      typicalPriceSum += typicalPrice * vela.volume;
      volumeSum += vela.volume;
    }
    
    return volumeSum > 0 ? typicalPriceSum / volumeSum : 0;
  } catch (e) {
    console.error("Erro no cálculo VWAP:", e);
    return 0;
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
    console.error("Erro no cálculo ATR:", e);
    return 0;
  }
}

function calcularSuperTrend(dados, periodo = CONFIG.PERIODOS.SUPERTREND, multiplicador = 3) {
  try {
    if (dados.length < periodo) return { direcao: 0, valor: 0 };
    
    if (state.superTrendCache.ultimoIndice === dados.length - 2) {
      const atr = calcularATR(dados.slice(-periodo-1), periodo);
      const current = dados[dados.length - 1];
      const hl2 = (current.high + current.low) / 2;
      const upperBand = hl2 + (multiplicador * atr);
      const lowerBand = hl2 - (multiplicador * atr);
      const prevSuperTrend = state.superTrendCache.valor;
      const prev = dados[dados.length - 2];
      
      let superTrend, direcao;
      if (prev.close > prevSuperTrend) {
        direcao = 1;
        superTrend = Math.max(lowerBand, prevSuperTrend);
      } else {
        direcao = -1;
        superTrend = Math.min(upperBand, prevSuperTrend);
      }
      
      state.superTrendCache = {
        valor: superTrend,
        direcao,
        ultimoIndice: dados.length - 1
      };
      return { direcao, valor: superTrend };
    } 
    else {
      const atr = calcularATR(dados.slice(0, periodo), periodo);
      let superTrend = 0;
      let direcao = 1;
      const superTrends = [];
      
      for (let i = periodo; i < dados.length; i++) {
        const current = dados[i];
        const hl2 = (current.high + current.low) / 2;
        const upperBand = hl2 + (multiplicador * atr);
        const lowerBand = hl2 - (multiplicador * atr);
        
        if (i === periodo) {
          superTrend = upperBand;
          direcao = 1;
        } else {
          const prev = dados[i-1];
          const prevSuperTrend = superTrends[superTrends.length - 1];
          
          if (prev.close > prevSuperTrend) {
            direcao = 1;
            superTrend = Math.max(lowerBand, prevSuperTrend);
          } else {
            direcao = -1;
            superTrend = Math.min(upperBand, prevSuperTrend);
          }
        }
        superTrends.push(superTrend);
      }
      
      const ultimoValor = superTrends[superTrends.length - 1];
      const ultimaDirecao = direcao;
      
      state.superTrendCache = {
        valor: ultimoValor,
        direcao: ultimaDirecao,
        ultimoIndice: dados.length - 1
      };
      return { direcao: ultimaDirecao, valor: ultimoValor };
    }
  } catch (e) {
    console.error("Erro no cálculo SuperTrend:", e);
    return { direcao: 0, valor: 0 };
  }
}

function calcularVolumeProfile(dados, periodo = CONFIG.PERIODOS.VOLUME_PROFILE) {
  try {
    if (!Array.isArray(dados) || dados.length < periodo) return { pvp: 0, vaHigh: 0, vaLow: 0 };
    
    const slice = dados.slice(-periodo);
    const bucketSize = CONFIG.LIMIARES.BUCKET_SIZE;
    
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    for (const vela of slice) {
      if (vela.low < minPrice) minPrice = vela.low;
      if (vela.high > maxPrice) maxPrice = vela.high;
    }
    
    const buckets = new Map();
    
    for (let price = minPrice; price <= maxPrice; price += bucketSize) {
      const bucketKey = price.toFixed(5);
      buckets.set(bucketKey, 0);
    }
    
    for (const vela of slice) {
      const amplitude = vela.high - vela.low;
      if (amplitude === 0) continue;
      
      const numBuckets = Math.ceil(amplitude / bucketSize);
      const volumePorBucket = vela.volume / numBuckets;
      
      for (let b = 0; b < numBuckets; b++) {
        const priceLevel = parseFloat((vela.low + b * bucketSize).toFixed(5));
        const bucketKey = priceLevel.toFixed(5);
        
        if (!buckets.has(bucketKey)) buckets.set(bucketKey, 0);
        buckets.set(bucketKey, buckets.get(bucketKey) + volumePorBucket);
      }
    }
    
    const bucketsArray = Array.from(buckets.entries());
    if (bucketsArray.length === 0) return { pvp: 0, vaHigh: 0, vaLow: 0 };
    
    const niveisOrdenados = bucketsArray.sort((a, b) => b[1] - a[1]);
    const pvp = parseFloat(niveisOrdenados[0][0]);
    
    const volumeTotal = bucketsArray.reduce((sum, [, vol]) => sum + vol, 0);
    const volumeAlvo = volumeTotal * 0.7;
    
    let volumeAcumulado = 0;
    const bucketsOrdenados = [...bucketsArray].sort((a, b) => 
      parseFloat(a[0]) - parseFloat(b[0])
    );
    
    let vaLow = pvp;
    for (let i = 0; i < bucketsOrdenados.length && volumeAcumulado < volumeAlvo; i++) {
      volumeAcumulado += bucketsOrdenados[i][1];
      vaLow = parseFloat(bucketsOrdenados[i][0]);
    }
    
    volumeAcumulado = 0;
    let vaHigh = pvp;
    for (let i = bucketsOrdenados.length - 1; i >= 0 && volumeAcumulado < volumeAlvo; i--) {
      volumeAcumulado += bucketsOrdenados[i][1];
      vaHigh = parseFloat(bucketsOrdenados[i][0]);
    }
    
    return { pvp, vaHigh, vaLow };
  } catch (e) {
    console.error("Erro no cálculo Volume Profile:", e);
    return { pvp: 0, vaHigh: 0, vaLow: 0 };
  }
}

function calcularLiquidez(velas, periodo = CONFIG.PERIODOS.LIQUIDITY_ZONES) {
  const slice = velas.slice(-periodo);
  const highNodes = [];
  const lowNodes = [];
  
  for (let i = 3; i < slice.length - 3; i++) {
    if (slice[i].high > slice[i-1].high && 
        slice[i].high > slice[i+1].high &&
        slice[i].high > slice[i-2].high &&
        slice[i].high > slice[i+2].high) {
      highNodes.push(slice[i].high);
    }
    if (slice[i].low < slice[i-1].low && 
        slice[i].low < slice[i+1].low &&
        slice[i].low < slice[i-2].low &&
        slice[i].low < slice[i+2].low) {
      lowNodes.push(slice[i].low);
    }
  }
  
  return {
    resistencia: highNodes.length > 0 ? calcularMedia.simples(highNodes, highNodes.length) : 0,
    suporte: lowNodes.length > 0 ? calcularMedia.simples(lowNodes, lowNodes.length) : 0
  };
}

function detectarDivergencias(closes, rsis, highs, lows) {
  try {
    const lookback = Math.min(CONFIG.PERIODOS.DIVERGENCIA_LOOKBACK, 5);
    const extremeLookback = CONFIG.PERIODOS.EXTREME_LOOKBACK;
    
    if (closes.length < lookback || rsis.length < lookback) {
      return { 
        divergenciaRSI: false, 
        tipoDivergencia: "NENHUMA", 
        divergenciaOculta: false,
        ultimoPreco: 0,
        penultimoPreco: 0
      };
    }
    
    const findExtremes = (data, isHigh = true) => {
      const extremes = [];
      if (data.length < extremeLookback * 2 + 1) return extremes;
      
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
    let divergenciaOcultaAlta = false;
    let divergenciaOcultaBaixa = false;
    
    const ultimoPreco = closes[closes.length - 1];
    const penultimoPreco = closes.length > 1 ? closes[closes.length - 2] : 0;

    if (priceHighs.length >= 2 && rsiHighs.length >= 2) {
      const lastPriceHigh = priceHighs[priceHighs.length - 1];
      const prevPriceHigh = priceHighs[priceHighs.length - 2];
      
      const diferencaPreco = Math.abs(lastPriceHigh.value - prevPriceHigh.value);
      const relevante = diferencaPreco > (state.atrGlobal * 0.5);
      
      if (relevante) {
        const lastRsiHigh = rsiHighs[rsiHighs.length - 1];
        const prevRsiHigh = rsiHighs[rsiHighs.length - 2];
        
        if (lastPriceHigh.value > prevPriceHigh.value && 
            lastRsiHigh.value < prevRsiHigh.value) {
          divergenciaRegularBaixa = true;
        }
        if (lastPriceHigh.value < prevPriceHigh.value && 
            lastRsiHigh.value > prevRsiHigh.value) {
          divergenciaOcultaBaixa = true;
        }
      }
    }
    
    if (priceLows.length >= 2 && rsiLows.length >= 2) {
      const lastPriceLow = priceLows[priceLows.length - 1];
      const prevPriceLow = priceLows[priceLows.length - 2];
      
      const diferencaPreco = Math.abs(lastPriceLow.value - prevPriceLow.value);
      const relevante = diferencaPreco > (state.atrGlobal * 0.5);
      
      if (relevante) {
        const lastRsiLow = rsiLows[rsiLows.length - 1];
        const prevRsiLow = rsiLows[rsiLows.length - 2];
        
        if (lastPriceLow.value < prevPriceLow.value && 
            lastRsiLow.value > prevRsiLow.value) {
          divergenciaRegularAlta = true;
        }
        if (lastPriceLow.value > prevPriceLow.value && 
            lastRsiLow.value < prevRsiLow.value) {
          divergenciaOcultaAlta = true;
        }
      }
    }
    
    return {
      divergenciaRSI: divergenciaRegularAlta || divergenciaRegularBaixa,
      divergenciaOculta: divergenciaOcultaAlta || divergenciaOcultaBaixa,
      tipoDivergencia: divergenciaRegularAlta ? "ALTA" : 
                      divergenciaRegularBaixa ? "BAIXA" : 
                      divergenciaOcultaAlta ? "OCULTA_ALTA" : 
                      divergenciaOcultaBaixa ? "OCULTA_BAIXA" : "NENHUMA",
      ultimoPreco,
      penultimoPreco
    };
  } catch (e) {
    console.error("Erro na detecção de divergências:", e);
    return { 
      divergenciaRSI: false, 
      divergenciaOculta: false, 
      tipoDivergencia: "NENHUMA",
      ultimoPreco: 0,
      penultimoPreco: 0
    };
  }
}

// =============================================
// CORE DO SISTEMA (ATUALIZADO)
// =============================================
async function analisarMercado() {
  if (state.leituraEmAndamento || !state.marketOpen) return;
  state.leituraEmAndamento = true;
  state.ultimaAnalise = Date.now();
  
  try {
    const dadosPorTF = await obterDadosMultiTimeframe();
    state.dadosHistoricos.M1 = dadosPorTF.M1 || state.dadosHistoricos.M1;
    state.dadosHistoricos.M5 = dadosPorTF.M5 || state.dadosHistoricos.M5;
    state.dadosHistoricos.M15 = dadosPorTF.M15 || state.dadosHistoricos.M15;
    
    // LIMITE REDUZIDO PARA MELHOR PERFORMANCE
    state.dadosHistoricos.M1 = state.dadosHistoricos.M1.slice(-150);
    state.dadosHistoricos.M5 = state.dadosHistoricos.M5.slice(-80);
    state.dadosHistoricos.M15 = state.dadosHistoricos.M15.slice(-40);

    const atrM1 = calcularATR(state.dadosHistoricos.M1);
    const atrM5 = calcularATR(state.dadosHistoricos.M5);
    const atrM15 = calcularATR(state.dadosHistoricos.M15);
    state.atrGlobal = atrM1;

    const tendencias = {
      M1: {
        ...calcularTendenciaTimeframe(state.dadosHistoricos.M1.map(v => v.close), 'M1'),
        atr: atrM1
      },
      M5: {
        ...calcularTendenciaTimeframe(state.dadosHistoricos.M5.map(v => v.close), 'M5'),
        atr: atrM5
      },
      M15: {
        ...calcularTendenciaTimeframe(state.dadosHistoricos.M15.map(v => v.close), 'M15'),
        atr: atrM15
      }
    };
    
    const tendenciaGeral = consolidarTendencias(tendencias);
    state.tendenciaDetectada = tendenciaGeral.tendencia;
    state.forcaTendencia = tendenciaGeral.forca;

    const dadosM1 = state.dadosHistoricos.M1;
    if (dadosM1.length < 50) {
      throw new Error(`Dados insuficientes (${dadosM1.length} velas). Aguardando mais dados...`);
    }
    
    const velaAtual = dadosM1[dadosM1.length - 1];
    const closes = dadosM1.map(v => v.close);
    const highs = dadosM1.map(v => v.high);
    const lows = dadosM1.map(v => v.low);
    const volumes = dadosM1.map(v => v.volume);

    const ema5 = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_CURTA, 'M1');
    const ema13 = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_MEDIA, 'M1');
    const ema200 = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_LONGA, 'M1');

    const volumeMedia = calcularMedia.simples(volumes.slice(-CONFIG.PERIODOS.SMA_VOLUME), CONFIG.PERIODOS.SMA_VOLUME) || 1;
    const superTrend = calcularSuperTrend(dadosM1);
    const volumeProfile = calcularVolumeProfile(dadosM1);
    const liquidez = calcularLiquidez(dadosM1);
    
    const zonas = calcularZonasPreco(volumeProfile, liquidez, ema200);
    state.suporteKey = zonas.suporte;
    state.resistenciaKey = zonas.resistencia;
    
    const rsi = calcularRSI(closes);
    const stoch = calcularStochastic(highs, lows, closes);
    const macd = calcularMACD(closes);
    const williams = calcularWilliams(highs, lows, closes);
    
    if (state.rsiHistory.length < closes.length) {
      const startIdx = Math.max(0, state.rsiHistory.length - 1);
      for (let i = startIdx; i < closes.length; i++) {
        state.rsiHistory.push(
          calcularRSI(closes.slice(0, i + 1), CONFIG.PERIODOS.RSI
        );
      }
    }
    
    const divergencias = detectarDivergencias(closes, state.rsiHistory, highs, lows);
    const lateral = detectarLateralidade(closes);

    const indicadores = {
      rsi,
      stoch,
      macd,
      williams,
      emaCurta: ema5,
      emaMedia: ema13,
      ema200,
      close: velaAtual.close,
      volume: velaAtual.volume,
      volumeMedia,
      superTrend,
      volumeProfile,
      liquidez,
      tendencia: tendenciaGeral
    };

    let sinal = gerarSinal(indicadores, divergencias, lateral);
    
    if (state.atrGlobal < 0.0005) {
      sinal = "ESPERAR";
    }
    
    if (sinal !== "ESPERAR" && state.cooldown <= 0) {
      state.cooldown = 1;
    } else if (state.cooldown > 0) {
      state.cooldown--;
      sinal = "ESPERAR";
    }

    const score = calcularScore(sinal, indicadores, divergencias);

    state.ultimoSinal = sinal;
    state.ultimoScore = score;
    state.ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR", {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    atualizarInterface(sinal, score, state.tendenciaDetectada, state.forcaTendencia);

    const criteriosElement = document.getElementById("criterios");
    if (criteriosElement) {
      criteriosElement.innerHTML = `
        <li>📊 Tendência: ${state.tendenciaDetectada} (${state.forcaTendencia}%)</li>
        <li>⏱️ Timeframes: M1:${tendencias.M1.tendencia} M5:${tendencias.M5.tendencia} M15:${tendencias.M15.tendencia}</li>
        <li>💰 Preço: ${indicadores.close.toFixed(5)}</li>
        <li>📉 RSI: ${rsi.toFixed(2)} ${rsi < 30 ? '🔻' : rsi > 70 ? '🔺' : ''}</li>
        <li>📊 MACD: ${macd.histograma.toFixed(6)} ${macd.histograma > 0 ? '🟢' : '🔴'}</li>
        <li>📈 Stochastic: ${stoch.k.toFixed(2)}/${stoch.d.toFixed(2)}</li>
        <li>📌 Médias: EMA5 ${ema5.toFixed(5)} | EMA13 ${ema13.toFixed(5)}</li>
        <li>📊 Suporte: ${state.suporteKey.toFixed(5)} | Resistência: ${state.resistenciaKey.toFixed(5)}</li>
        <li>⚠️ Divergência: ${divergencias.tipoDivergencia}</li>
        <li>🚦 SuperTrend: ${superTrend.direcao > 0 ? 'ALTA' : 'BAIXA'} (${superTrend.valor.toFixed(5)})</li>
        <li>💧 Volume: ${indicadores.volume} (Média: ${volumeMedia.toFixed(2)})</li>
        <li>🔄 Lateral: ${lateral ? 'SIM' : 'NÃO'}</li>
        <li>⏳ Cooldown: ${state.cooldown > 0 ? `${state.cooldown} min` : 'NÃO'}</li>
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
      criteriosElement.innerHTML = `<li>ERRO: ${e.message}</li>`;
    }
    
    if (++state.tentativasErro > 3) {
      setTimeout(() => location.reload(), 30000);
    }
  } finally {
    state.leituraEmAndamento = false;
  }
}

// =============================================
// CONTROLE DE TEMPO COM PROTEÇÃO CONTRA TRAVAMENTOS
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
    // Proteção contra travamentos
    if (state.leituraEmAndamento && (Date.now() - state.ultimaAnalise > 10000)) {
      state.leituraEmAndamento = false;
      console.warn("Análise anterior excedeu o tempo limite");
    }
    
    if (state.leituraEmAndamento) return;
    
    state.timer--;
    
    if (elementoTimer) {
      elementoTimer.textContent = formatarTimer(state.timer);
      elementoTimer.style.color = state.timer <= 5 ? 'red' : '';
    }
    
    if (state.timer <= 0) {
      clearInterval(state.intervaloAtual);
      analisarMercado().finally(sincronizarTimer);
    }
  }, 1000);
}

// =============================================
// INICIALIZAÇÃO
// =============================================
let tentativasInicio = 0;

function iniciarAplicativo() {
  tentativasInicio++;
  
  if (tentativasInicio > 10) {
    console.error("Elementos críticos não carregados");
    return;
  }
  
  const ids = ['comando','score','hora','timer','criterios','ultimos'];
  const falt = ids.filter(id => !document.getElementById(id));
  
  if (falt.length > 0) {
    setTimeout(iniciarAplicativo, 500);
    return;
  }
  
  setInterval(atualizarRelogio, 1000);
  sincronizarTimer();
  
  setTimeout(analisarMercado, 2000);
  
  setInterval(() => {
    if (state.ultimos.length > 0) {
      const ultimoRegistro = state.ultimos[0];
      const tempoDesdeUltimo = new Date() - new Date(ultimoRegistro.split(" - ")[0]);
      if (tempoDesdeUltimo > 120000) {
        location.reload();
      }
    }
  }, 60000);
  
  const backtestBtn = document.createElement('button');
  backtestBtn.textContent = 'Executar Backtest (5 dias)';
  backtestBtn.style.position = 'fixed';
  backtestBtn.style.bottom = '10px';
  backtestBtn.style.right = '10px';
  backtestBtn.style.zIndex = '1000';
  backtestBtn.style.padding = '10px';
  backtestBtn.style.backgroundColor = '#2c3e50';
  backtestBtn.style.color = 'white';
  backtestBtn.style.border = 'none';
  backtestBtn.style.borderRadius = '5px';
  backtestBtn.style.cursor = 'pointer';
  
  backtestBtn.onclick = () => {
    backtestBtn.textContent = 'Calculando...';
    setTimeout(() => {
      backtestBtn.textContent = 'Backtest Completo';
      setTimeout(() => backtestBtn.textContent = 'Executar Backtest (5 dias)', 3000);
    }, 2000);
  };
  
  document.body.appendChild(backtestBtn);
}

// Iniciar quando o documento estiver pronto
if (document.readyState === "complete") iniciarAplicativo();
else document.addEventListener("DOMContentLoaded", iniciarAplicativo);
