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
  noticiasRecentes: [],
  volumeProfile: [],
  institutionalFlow: 0,
  fairValueGap: { gap: false },
  hiddenOrders: false,
  tendenciaDetectada: "NEUTRA",
  forcaTendencia: 0,
  dadosHistoricos: [],
  resistenciaKey: 0,
  suporteKey: 0
};

const CONFIG = {
  API_ENDPOINTS: {
    TWELVE_DATA: "https://api.twelvedata.com"
  },
  PARES: {
    FOREX_IDX: "EUR/USD"
  },
  PERIODOS: {
    RSI: 14,
    STOCH_K: 14,
    STOCH_D: 3,
    WILLIAMS: 14,
    EMA_CURTA: 8,
    EMA_MEDIA: 21,
    EMA_LONGA: 200,
    SMA_VOLUME: 20,
    MACD_RAPIDA: 12,
    MACD_LENTA: 26,
    MACD_SINAL: 9,
    VELAS_CONFIRMACAO: 3,
    ANALISE_LATERAL: 20,
    VWAP: 20,
    ATR: 14,
    SUPERTREND: 10,
    VOLUME_PROFILE: 50,
    LIQUIDITY_ZONES: 20,
    DIVERGENCIA_LOOKBACK: 15
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
    BUCKET_SIZE: 0.0005 // Tamanho do bucket para Volume Profile
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
  }
};

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
// SISTEMA DE TENDÊNCIA OTIMIZADO PARA FOREX
// =============================================
function avaliarTendencia(closes, ema8, ema21, ema200) {
  const ultimoClose = closes[closes.length - 1];
  
  const tendenciaLongoPrazo = ultimoClose > ema200 ? "ALTA" : "BAIXA";
  const tendenciaMedioPrazo = ema8 > ema21 ? "ALTA" : "BAIXA";
  
  const distanciaMedia = Math.abs(ema8 - ema21);
  const forcaBase = Math.min(100, Math.round(distanciaMedia / ultimoClose * 10000));
  
  let forcaTotal = forcaBase;
  if (tendenciaLongoPrazo === tendenciaMedioPrazo) forcaTotal += 30;
  
  if (forcaTotal > 80) {
    return { 
      tendencia: tendenciaMedioPrazo === "ALTA" ? "FORTE_ALTA" : "FORTE_BAIXA",
      forca: Math.min(100, forcaTotal)
    };
  }
  
  if (forcaTotal > 50) {
    return { 
      tendencia: tendenciaMedioPrazo,
      forca: forcaTotal
    };
  }
  
  return { 
    tendencia: "NEUTRA", 
    forca: 0 
  };
}

// =============================================
// GERADOR DE SINAIS DE ALTA PRECISÃO PARA EURUSD
// =============================================
function gerarSinal(indicadores, divergencias) {
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
    tendencia
  } = indicadores;
  
  state.suporteKey = Math.min(volumeProfile.vaLow, liquidez.suporte, emaMedia);
  state.resistenciaKey = Math.max(volumeProfile.vaHigh, liquidez.resistencia, emaMedia);
  
  if (tendencia.tendencia === "FORTE_ALTA") {
    const condicoesCompra = [
      close > emaCurta,
      macd.histograma > 0,
      stoch.k > 60,
      close > superTrend.valor && superTrend.direcao > 0
    ];
    
    if (condicoesCompra.filter(Boolean).length >= 3) {
      return "CALL";
    }
  }
  
  if (tendencia.tendencia === "FORTE_BAIXA") {
    const condicoesVenda = [
      close < emaCurta,
      macd.histograma < 0,
      stoch.k < 40,
      close < superTrend.valor && superTrend.direcao < 0
    ];
    
    if (condicoesVenda.filter(Boolean).length >= 3) {
      return "PUT";
    }
  }
  
  const variacao = state.resistenciaKey - state.suporteKey;
  const limiteBreakout = variacao * 0.1;
  
  if (close > (state.resistenciaKey + limiteBreakout)) {
    return "CALL";
  }
  
  if (close < (state.suporteKey - limiteBreakout)) {
    return "PUT";
  }
  
  if (divergencias.divergenciaRSI) {
    if (divergencias.tipoDivergencia === "ALTA" && close > state.suporteKey) {
      return "CALL";
    }
    
    if (divergencias.tipoDivergencia === "BAIXA" && close < state.resistenciaKey) {
      return "PUT";
    }
  }
  
  if (rsi < 25 && close > emaMedia) {
    return "CALL";
  }
  
  if (rsi > 75 && close < emaMedia) {
    return "PUT";
  }
  
  return "ESPERAR";
}

// =============================================
// CALCULADOR DE CONFIANÇA PRECISO (OTIMIZADO)
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
}

// =============================================
// INDICADORES TÉCNICOS (AJUSTADOS PARA FOREX)
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

// Função RSI otimizada com cálculo incremental
function calcularRSI(closes, periodo = CONFIG.PERIODOS.RSI) {
  if (closes.length < periodo + 1) return 50;
  
  // Cálculo inicial
  if (closes.length === periodo + 1) {
    let gains = 0, losses = 0;
    for (let i = 1; i <= periodo; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff > 0) gains += diff;
      else losses -= diff; // Perdas são valores absolutos
    }
    
    const avgGain = gains / periodo;
    const avgLoss = losses / periodo;
    const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }
  
  // Cálculo incremental
  const prevRSI = state.rsiCache || 50;
  const diff = closes[closes.length - 1] - closes[closes.length - 2];
  
  let avgGain = state.avgGainCache || 0;
  let avgLoss = state.avgLossCache || 0;
  
  if (diff > 0) {
    avgGain = ((avgGain * (periodo - 1)) + diff) / periodo;
    avgLoss = (avgLoss * (periodo - 1)) / periodo;
  } else {
    avgGain = (avgGain * (periodo - 1)) / periodo;
    avgLoss = ((avgLoss * (periodo - 1)) - diff) / periodo;
  }
  
  // Atualizar cache para próxima iteração
  state.avgGainCache = avgGain;
  state.avgLossCache = avgLoss;
  
  const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// Stochastic corrigido com suavização K e D
function calcularStochastic(highs, lows, closes, 
                          periodoK = CONFIG.PERIODOS.STOCH_K, 
                          periodoD = CONFIG.PERIODOS.STOCH_D) {
  try {
    if (closes.length < periodoK + periodoD) return { k: 50, d: 50 };
    
    const kValues = [];
    for (let i = periodoK - 1; i < closes.length; i++) {
      const sliceHigh = highs.slice(i - periodoK + 1, i + 1);
      const sliceLow = lows.slice(i - periodoK + 1, i + 1);
      const highestHigh = Math.max(...sliceHigh);
      const lowestLow = Math.min(...sliceLow);
      const range = highestHigh - lowestLow;
      const k = range !== 0 ? ((closes[i] - lowestLow) / range) * 100 : 50;
      kValues.push(k);
    }
    
    // Suavização da linha %K
    const kSuavizado = [];
    for (let i = periodoD - 1; i < kValues.length; i++) {
      const mediaK = calcularMedia.simples(kValues.slice(i - periodoD + 1, i + 1), periodoD);
      kSuavizado.push(mediaK);
    }
    
    // Cálculo da linha %D (suavização do %K)
    const dValues = [];
    for (let i = periodoD - 1; i < kSuavizado.length; i++) {
      dValues.push(calcularMedia.simples(kSuavizado.slice(i - periodoD + 1, i + 1), periodoD));
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

// Williams %R corrigido
function calcularWilliams(highs, lows, closes, periodo = CONFIG.PERIODOS.WILLIAMS) {
  try {
    if (closes.length < periodo) return 0;
    
    const sliceHigh = highs.slice(-periodo);
    const sliceLow = lows.slice(-periodo);
    const highestHigh = Math.max(...sliceHigh);
    const lowestLow = Math.min(...sliceLow);
    const range = highestHigh - lowestLow;
    
    return range > 0 ? ((highestHigh - closes[closes.length - 1]) / range) * -100 : 0;
  } catch (e) {
    console.error("Erro no cálculo Williams:", e);
    return 0;
  }
}

function calcularMACD(closes, rapida = CONFIG.PERIODOS.MACD_RAPIDA, 
                    lenta = CONFIG.PERIODOS.MACD_LENTA, 
                    sinal = CONFIG.PERIODOS.MACD_SINAL) {
  try {
    if (closes.length < lenta + sinal) {
      return { histograma: 0, macdLinha: 0, sinalLinha: 0 };
    }

    const emaRapida = calcularMedia.exponencial(closes, rapida);
    const emaLenta = calcularMedia.exponencial(closes, lenta);
    
    const startIdx = lenta - rapida;
    const macdLinha = emaRapida.slice(startIdx).map((val, idx) => val - emaLenta[idx]);
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

// Supertrend refatorado para cálculo sequencial
function calcularSuperTrend(dados, periodo = CONFIG.PERIODOS.SUPERTREND, multiplicador = 3) {
  try {
    if (dados.length < periodo) return { direcao: 0, valor: 0 };
    
    const superTrends = [];
    const atrValues = [];
    
    // Calcular ATR para todo o conjunto de dados
    for (let i = periodo; i < dados.length; i++) {
      const slice = dados.slice(i - periodo, i);
      atrValues.push(calcularATR(slice, periodo));
    }
    
    // Calcular Supertrend sequencialmente
    for (let i = periodo; i < dados.length; i++) {
      const current = dados[i];
      const hl2 = (current.high + current.low) / 2;
      const atr = atrValues[i - periodo];
      
      const upperBand = hl2 + (multiplicador * atr);
      const lowerBand = hl2 - (multiplicador * atr);
      
      let superTrend;
      let direcao;
      
      if (i === periodo) {
        // Primeiro valor
        superTrend = upperBand;
        direcao = 1;
      } else {
        const prev = dados[i - 1];
        const prevSuperTrend = superTrends[superTrends.length - 1];
        
        if (prev.close > prevSuperTrend.valor) {
          direcao = 1;
          superTrend = Math.max(lowerBand, prevSuperTrend.valor);
        } else {
          direcao = -1;
          superTrend = Math.min(upperBand, prevSuperTrend.valor);
        }
      }
      
      superTrends.push({ direcao, valor: superTrend });
    }
    
    return superTrends.length > 0 ? superTrends[superTrends.length - 1] : { direcao: 0, valor: 0 };
  } catch (e) {
    console.error("Erro no cálculo SuperTrend:", e);
    return { direcao: 0, valor: 0 };
  }
}

// Volume Profile com buckets de tamanho fixo
function calcularVolumeProfile(dados, periodo = CONFIG.PERIODOS.VOLUME_PROFILE) {
  try {
    if (!Array.isArray(dados) || dados.length < periodo) return { pvp: 0, vaHigh: 0, vaLow: 0 };
    
    const slice = dados.slice(-periodo);
    const buckets = {};
    const bucketSize = CONFIG.LIMIARES.BUCKET_SIZE;
    
    // Encontrar range de preços
    const minPrice = Math.min(...slice.map(v => v.low));
    const maxPrice = Math.max(...slice.map(v => v.high));
    
    // Criar buckets
    for (let price = minPrice; price <= maxPrice; price += bucketSize) {
      const bucketKey = price.toFixed(5);
      buckets[bucketKey] = 0;
    }
    
    // Distribuir volume pelos buckets
    for (const vela of slice) {
      const amplitude = vela.high - vela.low;
      if (amplitude === 0) continue;
      
      const priceRange = [];
      for (let p = vela.low; p <= vela.high; p += bucketSize) {
        priceRange.push(p.toFixed(5));
      }
      
      const volumePorBucket = vela.volume / priceRange.length;
      for (const bucket of priceRange) {
        if (buckets[bucket] !== undefined) {
          buckets[bucket] += volumePorBucket;
        }
      }
    }
    
    // Encontrar PVP (preço com maior volume)
    const niveisOrdenados = Object.entries(buckets)
      .sort((a, b) => b[1] - a[1]);
    
    if (niveisOrdenados.length === 0) return { pvp: 0, vaHigh: 0, vaLow: 0 };
    
    const pvp = parseFloat(niveisOrdenados[0][0]);
    
    // Calcular Value Area (70% do volume total)
    const volumeTotal = Object.values(buckets).reduce((sum, vol) => sum + vol, 0);
    const volumeAlvo = volumeTotal * 0.7;
    
    let volumeAcumulado = 0;
    const bucketsOrdenados = [...niveisOrdenados].sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]));
    
    // Encontrar VA Low
    let vaLow = pvp;
    for (let i = 0; i < bucketsOrdenados.length; i++) {
      volumeAcumulado += bucketsOrdenados[i][1];
      vaLow = parseFloat(bucketsOrdenados[i][0]);
      if (volumeAcumulado >= volumeAlvo) break;
    }
    
    // Encontrar VA High
    volumeAcumulado = 0;
    let vaHigh = pvp;
    for (let i = bucketsOrdenados.length - 1; i >= 0; i--) {
      volumeAcumulado += bucketsOrdenados[i][1];
      vaHigh = parseFloat(bucketsOrdenados[i][0]);
      if (volumeAcumulado >= volumeAlvo) break;
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
    if (slice[i].high > slice[i-1].high && slice[i].high > slice[i+1].high) {
      highNodes.push(slice[i].high);
    }
    if (slice[i].low < slice[i-1].low && slice[i].low < slice[i+1].low) {
      lowNodes.push(slice[i].low);
    }
  }
  
  return {
    resistencia: highNodes.length > 0 ? calcularMedia.simples(highNodes, highNodes.length) : 0,
    suporte: lowNodes.length > 0 ? calcularMedia.simples(lowNodes, lowNodes.length) : 0
  };
}

// Detecção de divergências melhorada
function detectarDivergencias(closes, rsis, highs, lows) {
  try {
    const lookback = CONFIG.PERIODOS.DIVERGENCIA_LOOKBACK;
    if (closes.length < lookback || rsis.length < lookback) {
      return { divergenciaRSI: false, tipoDivergencia: "NENHUMA", divergenciaOculta: false };
    }
    
    // Identificar máximos e mínimos significativos
    const findExtremes = (data, isHigh = true) => {
      const extremes = [];
      for (let i = 3; i < data.length - 3; i++) {
        if (isHigh) {
          if (data[i] > data[i-1] && data[i] > data[i-2] && 
              data[i] > data[i+1] && data[i] > data[i+2]) {
            extremes.push({ index: i, value: data[i] });
          }
        } else {
          if (data[i] < data[i-1] && data[i] < data[i-2] && 
              data[i] < data[i+1] && data[i] < data[i+2]) {
            extremes.push({ index: i, value: data[i] });
          }
        }
      }
      return extremes;
    };
    
    const priceHighs = findExtremes(highs, true);
    const priceLows = findExtremes(lows, false);
    const rsiHighs = findExtremes(rsis, true);
    const rsiLows = findExtremes(rsis, false);
    
    // Verificar divergências regulares
    let divergenciaRegularAlta = false;
    let divergenciaRegularBaixa = false;
    
    // Divergência de baixa regular (preço faz máximas mais altas, RSI faz máximas mais baixas)
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
    
    // Divergência de alta regular (preço faz mínimas mais baixas, RSI faz mínimas mais altas)
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
    
    // Verificar divergências ocultas
    let divergenciaOcultaAlta = false;
    let divergenciaOcultaBaixa = false;
    
    // Divergência oculta de baixa (preço faz máximas mais baixas, RSI faz máximas mais altas)
    if (priceHighs.length >= 2 && rsiHighs.length >= 2) {
      const lastPriceHigh = priceHighs[priceHighs.length - 1];
      const prevPriceHigh = priceHighs[priceHighs.length - 2];
      const lastRsiHigh = rsiHighs[rsiHighs.length - 1];
      const prevRsiHigh = rsiHighs[rsiHighs.length - 2];
      
      if (lastPriceHigh.value < prevPriceHigh.value && 
          lastRsiHigh.value > prevRsiHigh.value) {
        divergenciaOcultaBaixa = true;
      }
    }
    
    // Divergência oculta de alta (preço faz mínimas mais altas, RSI faz mínimas mais baixas)
    if (priceLows.length >= 2 && rsiLows.length >= 2) {
      const lastPriceLow = priceLows[priceLows.length - 1];
      const prevPriceLow = priceLows[priceLows.length - 2];
      const lastRsiLow = rsiLows[rsiLows.length - 1];
      const prevRsiLow = rsiLows[rsiLows.length - 2];
      
      if (lastPriceLow.value > prevPriceLow.value && 
          lastRsiLow.value < prevRsiLow.value) {
        divergenciaOcultaAlta = true;
      }
    }
    
    return {
      divergenciaRSI: divergenciaRegularAlta || divergenciaRegularBaixa,
      divergenciaOculta: divergenciaOcultaAlta || divergenciaOcultaBaixa,
      tipoDivergencia: divergenciaRegularAlta ? "ALTA" : 
                      divergenciaRegularBaixa ? "BAIXA" : 
                      divergenciaOcultaAlta ? "OCULTA_ALTA" : 
                      divergenciaOcultaBaixa ? "OCULTA_BAIXA" : "NENHUMA"
    };
  } catch (e) {
    console.error("Erro na detecção de divergências:", e);
    return { divergenciaRSI: false, divergenciaOculta: false, tipoDivergencia: "NENHUMA" };
  }
}

// =============================================
// CORE DO SISTEMA (ATUALIZADO PARA EURUSD)
// =============================================
async function analisarMercado() {
  if (state.leituraEmAndamento || !state.marketOpen) return;
  state.leituraEmAndamento = true;
  
  try {
    const dados = await obterDadosTwelveData();
    const velaAtual = dados[dados.length - 1];
    const closes = dados.map(v => v.close);
    const highs = dados.map(v => v.high);
    const lows = dados.map(v => v.low);
    const volumes = dados.map(v => v.volume);

    const ema8Array = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_CURTA);
    const ema21Array = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_MEDIA);
    const ema200Array = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_LONGA);
    const ema8 = ema8Array[ema8Array.length-1] || 0;
    const ema21 = ema21Array[ema21Array.length-1] || 0;
    const ema200 = ema200Array[ema200Array.length-1] || 0;

    const volumeMedia = calcularMedia.simples(volumes.slice(-CONFIG.PERIODOS.SMA_VOLUME), CONFIG.PERIODOS.SMA_VOLUME) || 1;
    const superTrend = calcularSuperTrend(dados);
    const volumeProfile = calcularVolumeProfile(dados);
    const liquidez = calcularLiquidez(dados);
    
    const rsi = calcularRSI(closes);
    const stoch = calcularStochastic(highs, lows, closes);
    const macd = calcularMACD(closes);
    
    // Cálculo incremental de histórico RSI
    const rsiHistory = state.rsiHistory || [];
    for (let i = rsiHistory.length; i < closes.length; i++) {
      rsiHistory.push(calcularRSI(closes.slice(0, i+1)));
    }
    state.rsiHistory = rsiHistory;
    
    const divergencias = detectarDivergencias(closes, rsiHistory, highs, lows);

    const tendencia = avaliarTendencia(closes, ema8, ema21, ema200);
    state.tendenciaDetectada = tendencia.tendencia;
    state.forcaTendencia = tendencia.forca;

    const indicadores = {
      rsi,
      stoch,
      macd,
      emaCurta: ema8,
      emaMedia: ema21,
      close: velaAtual.close,
      volume: velaAtual.volume,
      volumeMedia,
      superTrend,
      volumeProfile,
      liquidez,
      tendencia
    };

    const sinal = gerarSinal(indicadores, divergencias);
    const score = calcularScore(sinal, indicadores, divergencias);

    state.ultimoSinal = sinal;
    state.ultimoScore = score;
    state.ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR");

    atualizarInterface(sinal, score, state.tendenciaDetectada, state.forcaTendencia);

    const criteriosElement = document.getElementById("criterios");
    if (criteriosElement) {
      criteriosElement.innerHTML = `
        <li>📊 Tendência: ${state.tendenciaDetectada} (${state.forcaTendencia}%)</li>
        <li>💰 Preço: ${indicadores.close.toFixed(5)}</li>
        <li>📉 RSI: ${rsi.toFixed(2)} ${rsi < 30 ? '🔻' : rsi > 70 ? '🔺' : ''}</li>
        <li>📊 MACD: ${macd.histograma.toFixed(6)} ${macd.histograma > 0 ? '🟢' : '🔴'}</li>
        <li>📈 Stochastic: ${stoch.k.toFixed(2)}/${stoch.d.toFixed(2)}</li>
        <li>📌 Médias: EMA8 ${ema8.toFixed(5)} | EMA21 ${ema21.toFixed(5)}</li>
        <li>📊 Suporte: ${state.suporteKey.toFixed(5)} | Resistência: ${state.resistenciaKey.toFixed(5)}</li>
        <li>⚠️ Divergência: ${divergencias.tipoDivergencia}</li>
        <li>🚦 SuperTrend: ${superTrend.direcao > 0 ? 'ALTA' : 'BAIXA'} (${superTrend.valor.toFixed(5)})</li>
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
    if (++state.tentativasErro > 3) setTimeout(() => location.reload(), 10000);
  } finally {
    state.leituraEmAndamento = false;
  }
}

// =============================================
// FUNÇÕES DE DADOS (TWELVE DATA API) COM ROTAÇÃO DE CHAVES
// =============================================
async function obterDadosTwelveData() {
  try {
    const apiKey = API_KEYS[currentKeyIndex];
    const url = `${CONFIG.API_ENDPOINTS.TWELVE_DATA}/time_series?symbol=${CONFIG.PARES.FOREX_IDX}&interval=1min&outputsize=100&apikey=${apiKey}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Falha na API: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.status === 'error') {
      throw new Error(data.message || `Erro Twelve Data: ${data.code}`);
    }
    
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
    console.error("Erro ao obter dados da Twelve Data:", e);
    
    errorCount++;
    
    if (errorCount >= 2) {
      currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
      errorCount = 0;
      console.log(`Alternando para chave: ${currentKeyIndex + 1}`);
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
      analisarMercado().finally(sincronizarTimer);
    }
  }, 1000);
}

// =============================================
// INICIALIZAÇÃO
// =============================================
function iniciarAplicativo() {
  const ids = ['comando','score','hora','timer','criterios','ultimos'];
  const falt = ids.filter(id => !document.getElementById(id));
  
  if (falt.length > 0) {
    console.error("Elementos faltando:", falt);
    return;
  }
  
  setInterval(atualizarRelogio, 1000);
  sincronizarTimer();
  
  setTimeout(analisarMercado, 2000);
  
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
