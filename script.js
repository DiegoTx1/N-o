// =============================================
// CONFIGURAÇÕES GLOBAIS (ATUALIZADAS PARA FOREX EUR/USD)
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
  cache: {
    lastDataLength: 0,
    rsi: null,
    macd: null,
    ema8: null,
    ema21: null,
    ema50: null,
    stoch: null,
    superTrend: null,
    atr: null,
    adx: null,
    bollinger: null
  },
  cooldown: 0
};

const CONFIG = {
  API_ENDPOINTS: {
    TWELVE_DATA: "https://api.twelvedata.com"
  },
  PARES: {
    FOREX: "EUR/USD"
  },
  PERIODOS: {
    RSI: 14,
    STOCH_K: 14,
    STOCH_D: 3,
    EMA_CURTA: 8,
    EMA_MEDIA: 21,
    EMA_LONGA: 50,
    MACD_RAPIDA: 12,
    MACD_LENTA: 26,
    MACD_SINAL: 9,
    VELAS_CONFIRMACAO: 3,
    ANALISE_LATERAL: 20,
    ATR: 14,
    SUPERTREND: 10,
    DIVERGENCIA_LOOKBACK: 8,
    EXTREME_LOOKBACK: 2,
    ADX: 14,
    BOLLINGER: 20
  },
  LIMIARES: {
    SCORE_ALTO: 85,
    SCORE_MEDIO: 70,
    RSI_OVERBOUGHT: 70,
    RSI_OVERSOLD: 30,
    STOCH_OVERBOUGHT: 80,
    STOCH_OVERSOLD: 20,
    VARIACAO_LATERAL: 0.0005,
    ATR_LIMIAR: 0.0008,
    LATERALIDADE_LIMIAR: 0.0005,
    ADX_TENDENCIA: 25,
    BOLLINGER_LARGURA: 0.0008
  },
  PESOS: {
    RSI: 1.5,
    MACD: 2.0,
    TENDENCIA: 2.5,
    STOCH: 1.3,
    SUPERTREND: 1.8,
    DIVERGENCIA: 1.7,
    ADX: 2.2,
    BOLLINGER: 1.9
  }
};

// =============================================
// GERENCIADOR DE CHAVES API
// =============================================
const API_KEYS = [
  "0105e6681b894e0185704171c53f5075",
  "sua_chave_reserva_1",
  "sua_chave_reserva_2"
];
let currentKeyIndex = 0;
let errorCount = 0;

// =============================================
// SISTEMA DE TENDÊNCIA OTIMIZADO PARA FOREX
// =============================================
function avaliarTendencia(ema8, ema21, ema50, close) {
  const diffCurta = ema8 - ema21;
  const diffLonga = close - ema50;
  const atr = calcularATR(state.dadosHistoricos) || 0.0001;
  
  // Força baseada na convergência de EMAs
  const forcaCurta = Math.min(100, Math.abs(diffCurta) / (atr * 10) * 100);
  const forcaLonga = diffLonga > 0 ? Math.min(100, diffLonga / (close * 0.0001)) : 0;
  
  // Tendência hierárquica
  if (forcaLonga > 60) {
    return { tendencia: "TENDÊNCIA_ALTA", forca: forcaLonga };
  }
  if (forcaLonga < 40) {
    return { tendencia: "TENDÊNCIA_BAIXA", forca: 100 - forcaLonga };
  }
  
  // Tendência de curto prazo
  if (forcaCurta > 75) {
    return diffCurta > 0 
      ? { tendencia: "FORTE_ALTA", forca: forcaCurta }
      : { tendencia: "FORTE_BAIXA", forca: forcaCurta };
  }
  
  if (forcaCurta > 40) {
    return diffCurta > 0 
      ? { tendencia: "ALTA", forca: forcaCurta } 
      : { tendencia: "BAIXA", forca: forcaCurta };
  }
  
  return { tendencia: "NEUTRA", forca: 0 };
}

// =============================================
// DETECÇÃO DE LATERALIDADE (AJUSTADO PARA FOREX)
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
// CÁLCULO DE SUPORTE/RESISTÊNCIA PARA FOREX
// =============================================
function calcularZonasPreco(dados, periodo = 50) {
  if (dados.length < periodo) periodo = dados.length;
  const slice = dados.slice(-periodo);
  const highs = slice.map(v => v.high);
  const lows = slice.map(v => v.low);
  
  const resistencia = calcularMedia.simples(
    highs.sort((a,b) => b-a).slice(0, Math.floor(periodo/10)), 
    Math.floor(periodo/10)
  );
  
  const suporte = calcularMedia.simples(
    lows.sort((a,b) => a-b).slice(0, Math.floor(periodo/10)), 
    Math.floor(periodo/10)
  );
  
  return {
    resistencia,
    suporte,
    pivot: (resistencia + suporte + dados[dados.length-1].close) / 3
  };
}

// =============================================
// GERADOR DE SINAIS OTIMIZADO PARA FOREX EUR/USD
// =============================================
function gerarSinal(indicadores, divergencias, lateral) {
  const {
    rsi,
    stoch,
    macd,
    close,
    emaCurta,
    emaMedia,
    emaLonga,
    superTrend,
    tendencia,
    adx,
    bollinger
  } = indicadores;
  
  // Calcular suporte/resistência
  const zonas = calcularZonasPreco(state.dadosHistoricos);
  state.suporteKey = zonas.suporte;
  state.resistenciaKey = zonas.resistencia;
  
  // Priorizar tendência forte com confirmação ADX
  if (tendencia.forca > 80 && adx > CONFIG.LIMIARES.ADX_TENDENCIA) {
    if (tendencia.tendencia.includes("ALTA") && 
        close > emaCurta && 
        macd.histograma > 0 &&
        close > bollinger.media) {
      return "CALL";
    }
    if (tendencia.tendencia.includes("BAIXA") && 
        close < emaCurta && 
        macd.histograma < 0 &&
        close < bollinger.media) {
      return "PUT";
    }
  }

  // Estratégia de reversão com Bollinger Bands
  if (close < bollinger.inferior && 
      rsi < CONFIG.LIMIARES.RSI_OVERSOLD && 
      stoch.k < CONFIG.LIMIARES.STOCH_OVERSOLD) {
    return "CALL";
  }
  
  if (close > bollinger.superior && 
      rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT && 
      stoch.k > CONFIG.LIMIARES.STOCH_OVERBOUGHT) {
    return "PUT";
  }
  
  // Breakout com confirmação de múltiplos indicadores
  const variacao = state.resistenciaKey - state.suporteKey;
  const limiteBreakout = variacao * 0.05;
  
  if (close > (state.resistenciaKey + limiteBreakout)) {
    if (macd.histograma > 0 && close > emaLonga && adx > 20) {
      return "CALL";
    }
  }
  
  if (close < (state.suporteKey - limiteBreakout)) {
    if (macd.histograma < 0 && close < emaLonga && adx > 20) {
      return "PUT";
    }
  }
  
  // Divergências com confirmação de volume
  if (divergencias.divergenciaRSI) {
    if (divergencias.tipoDivergencia === "ALTA" && 
        close > state.suporteKey &&
        macd.histograma > 0) {
      return "CALL";
    }
    
    if (divergencias.tipoDivergencia === "BAIXA" && 
        close < state.resistenciaKey &&
        macd.histograma < 0) {
      return "PUT";
    }
  }
  
  return "ESPERAR";
}

// =============================================
// CALCULADOR DE CONFIANÇA PARA FOREX
// =============================================
function calcularScore(sinal, indicadores, divergencias) {
  let score = 60;

  const fatores = {
    alinhamentoTendencia: sinal === "CALL" && indicadores.tendencia.tendencia.includes("ALTA") ||
                          sinal === "PUT" && indicadores.tendencia.tendencia.includes("BAIXA") ? 25 : 0,
    divergencia: divergencias.divergenciaRSI ? 15 : 0,
    posicaoMedia: sinal === "CALL" && indicadores.close > indicadores.emaMedia ? 10 : 
                  sinal === "PUT" && indicadores.close < indicadores.emaMedia ? 10 : 0,
    superTrend: sinal === "CALL" && indicadores.close > indicadores.superTrend.valor ? 8 :
                sinal === "PUT" && indicadores.close < indicadores.superTrend.valor ? 8 : 0,
    adx: indicadores.adx > CONFIG.LIMIARES.ADX_TENDENCIA ? 12 : 0,
    bollinger: sinal === "CALL" && indicadores.close < indicadores.bollinger.inferior ? 10 :
               sinal === "PUT" && indicadores.close > indicadores.bollinger.superior ? 10 : 0,
    volatilidade: (indicadores.atr / indicadores.close) > CONFIG.LIMIARES.ATR_LIMIAR ? 10 : 0
  };
  
  score += Object.values(fatores).reduce((sum, val) => sum + val, 0);
  
  // Penalizar durante lateralidade
  if (detectarLateralidade(indicadores.closes)) {
    score *= 0.8;
  }
  
  return Math.min(100, Math.max(0, Math.round(score)));
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
    
    // Verificar se o mercado está aberto (Forex 24/5)
    const day = now.getDay();
    const hour = now.getHours();
    state.marketOpen = (day >= 1 && day <= 5) || (day === 0 && hour >= 17) || (day === 6 && hour < 17);
  }
}

function atualizarInterface(sinal, score, tendencia, forcaTendencia) {
  if (!document.getElementById("comando")) return;
  if (!state.marketOpen) {
    document.getElementById("comando").textContent = "Mercado Fechado";
    document.getElementById("comando").className = "esperar";
    return;
  }
  
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
// INDICADORES TÉCNICOS (ATUALIZADOS PARA FOREX)
// =============================================
const calcularMedia = {
  simples: (dados, periodo) => {
    if (!Array.isArray(dados) || dados.length < periodo) return null;
    const slice = dados.slice(-periodo);
    return slice.reduce((a, b) => a + b, 0) / periodo;
  },

  exponencial: (dados, periodo) => {
    if (!Array.isArray(dados) || dados.length < periodo) return Array(dados.length).fill(null);
    
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
  if (closes.length < periodo + 1) return 50;
  
  let gains = 0;
  let losses = 0;
  
  for (let i = 1; i <= periodo; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  
  const avgGain = gains / periodo;
  const avgLoss = losses / periodo;
  
  const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
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
    console.error("Erro no cálculo Stochastic:", e);
    return { k: 50, d: 50 };
  }
}

function calcularMACD(closes, rapida = CONFIG.PERIODOS.MACD_RAPIDA, 
                    lenta = CONFIG.PERIODOS.MACD_LENTA, 
                    sinal = CONFIG.PERIODOS.MACD_SINAL) {
  const emaRapida = calcularMedia.exponencial(closes, rapida);
  const emaLenta = calcularMedia.exponencial(closes, lenta);
  
  const startIdx = Math.max(0, emaLenta.length - emaRapida.length);
  const macdLine = emaRapida.slice(-emaLenta.length).map((val, idx) => 
    val - emaLenta[startIdx + idx]
  );
  
  const signalLine = calcularMedia.exponencial(macdLine, sinal);
  
  return {
    histograma: macdLine[macdLine.length-1] - signalLine[signalLine.length-1],
    macdLinha: macdLine[macdLine.length-1],
    sinalLinha: signalLine[signalLine.length-1]
  };
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

function calcularSuperTrend(dados, periodo = CONFIG.PERIODOS.SUPERTREND, multiplicador = 3.0) {
  try {
    if (dados.length < periodo) return { direcao: 0, valor: 0 };
    
    const superTrends = [];
    const atr = calcularATR(dados, periodo);
    
    for (let i = periodo; i < dados.length; i++) {
      const hl2 = (dados[i].high + dados[i].low) / 2;
      const upperBand = hl2 + (multiplicador * atr);
      const lowerBand = hl2 - (multiplicador * atr);
      
      let superTrend;
      let direcao;
      
      if (i === periodo) {
        superTrend = upperBand;
        direcao = 1;
      } else {
        const prevSuperTrend = superTrends[superTrends.length - 1].valor;
        
        if (dados[i-1].close > prevSuperTrend) {
          direcao = 1;
          superTrend = Math.max(lowerBand, prevSuperTrend);
        } else {
          direcao = -1;
          superTrend = Math.min(upperBand, prevSuperTrend);
        }
      }
      
      superTrends.push({ direcao, valor: superTrend });
    }
    
    return superTrends[superTrends.length - 1];
    
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
        
        // Verificar apenas os pontos vizinhos imediatos
        if (isHigh) {
          if (data[i] < data[i-1] || data[i] < data[i+1]) isExtreme = false;
        } else {
          if (data[i] > data[i-1] || data[i] > data[i+1]) isExtreme = false;
        }
        
        if (isExtreme) extremes.push({ index: i, value: data[i] });
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
    
    // Divergência regular
    if (priceHighs.length >= 2 && rsiHighs.length >= 2) {
      const lastPriceHigh = priceHighs[priceHighs.length - 1];
      const prevPriceHigh = priceHighs[priceHighs.length - 2];
      const lastRsiHigh = rsiHighs[rsiHighs.length - 1];
      const prevRsiHigh = rsiHighs[rsiHighs.length - 2];
      
      // Divergência de baixa: Preço mais alto, RSI mais baixo
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
      
      // Divergência de alta: Preço mais baixo, RSI mais alto
      if (lastPriceLow.value < prevPriceLow.value && 
          lastRsiLow.value > prevRsiLow.value) {
        divergenciaRegularAlta = true;
      }
    }
    
    // Divergência oculta
    if (priceHighs.length >= 2 && rsiHighs.length >= 2) {
      const lastPriceHigh = priceHighs[priceHighs.length - 1];
      const prevPriceHigh = priceHighs[priceHighs.length - 2];
      const lastRsiHigh = rsiHighs[rsiHighs.length - 1];
      const prevRsiHigh = rsiHighs[rsiHighs.length - 2];
      
      // Divergência oculta de alta: Preço mais baixo, RSI mais alto
      if (lastPriceHigh.value < prevPriceHigh.value && 
          lastRsiHigh.value > prevRsiHigh.value) {
        divergenciaOcultaAlta = true;
      }
    }
    
    if (priceLows.length >= 2 && rsiLows.length >= 2) {
      const lastPriceLow = priceLows[priceLows.length - 1];
      const prevPriceLow = priceLows[priceLows.length - 2];
      const lastRsiLow = rsiLows[rsiLows.length - 1];
      const prevRsiLow = rsiLows[rsiLows.length - 2];
      
      // Divergência oculta de baixa: Preço mais alto, RSI mais baixo
      if (lastPriceLow.value > prevPriceLow.value && 
          lastRsiLow.value < prevRsiLow.value) {
        divergenciaOcultaBaixa = true;
      }
    }
    
    return {
      divergenciaRSI: divergenciaRegularAlta || divergenciaRegularBaixa || divergenciaOcultaAlta || divergenciaOcultaBaixa,
      tipoDivergencia: divergenciaRegularAlta ? "ALTA" : 
                      divergenciaRegularBaixa ? "BAIXA" :
                      divergenciaOcultaAlta ? "OCULTA_ALTA" :
                      divergenciaOcultaBaixa ? "OCULTA_BAIXA" : "NENHUMA"
    };
  } catch (e) {
    console.error("Erro na detecção de divergências:", e);
    return { divergenciaRSI: false, tipoDivergencia: "NENHUMA" };
  }
}

// =============================================
// NOVOS INDICADORES PARA FOREX
// =============================================

// Cálculo do ADX (Average Directional Index)
function calcularADX(dados, periodo = CONFIG.PERIODOS.ADX) {
  try {
    if (dados.length < periodo * 2) return 0;
    
    // Calcular +DM e -DM
    const plusDM = [];
    const minusDM = [];
    
    for (let i = 1; i < dados.length; i++) {
      const upMove = dados[i].high - dados[i-1].high;
      const downMove = dados[i-1].low - dados[i].low;
      
      if (upMove > downMove && upMove > 0) {
        plusDM.push(upMove);
        minusDM.push(0);
      } else if (downMove > upMove && downMove > 0) {
        plusDM.push(0);
        minusDM.push(downMove);
      } else {
        plusDM.push(0);
        minusDM.push(0);
      }
    }
    
    // Calcular True Range
    const tr = [];
    for (let i = 1; i < dados.length; i++) {
      tr.push(Math.max(
        dados[i].high - dados[i].low,
        Math.abs(dados[i].high - dados[i-1].close),
        Math.abs(dados[i].low - dados[i-1].close)
      ));
    }
    
    // Suavizar valores
    const smoothPlusDM = [calcularMedia.simples(plusDM.slice(0, periodo), periodo)];
    const smoothMinusDM = [calcularMedia.simples(minusDM.slice(0, periodo), periodo)];
    const smoothTR = [calcularMedia.simples(tr.slice(0, periodo), periodo)];
    
    for (let i = periodo; i < plusDM.length; i++) {
      smoothPlusDM.push(smoothPlusDM[smoothPlusDM.length - 1] * (periodo - 1)/periodo + plusDM[i]);
      smoothMinusDM.push(smoothMinusDM[smoothMinusDM.length - 1] * (periodo - 1)/periodo + minusDM[i]);
      smoothTR.push(smoothTR[smoothTR.length - 1] * (periodo - 1)/periodo + tr[i]);
    }
    
    // Calcular DI+ e DI-
    const plusDI = smoothPlusDM.map((dm, i) => (dm / smoothTR[i]) * 100);
    const minusDI = smoothMinusDM.map((dm, i) => (dm / smoothTR[i]) * 100);
    
    // Calcular DX
    const dx = plusDI.map((pdi, i) => {
      const mdi = minusDI[i];
      return (Math.abs(pdi - mdi) / (pdi + mdi)) * 100;
    });
    
    // Calcular ADX
    const adx = [calcularMedia.simples(dx.slice(0, periodo), periodo)];
    for (let i = periodo; i < dx.length; i++) {
      adx.push((adx[adx.length - 1] * (periodo - 1) + dx[i]) / periodo);
    }
    
    return adx[adx.length - 1] || 0;
  } catch (e) {
    console.error("Erro no cálculo ADX:", e);
    return 0;
  }
}

// Cálculo de Bollinger Bands
function calcularBollingerBands(closes, periodo = CONFIG.PERIODOS.BOLLINGER, desvios = 2) {
  try {
    if (closes.length < periodo) return { superior: 0, inferior: 0, media: 0 };
    
    const media = calcularMedia.simples(closes.slice(-periodo), periodo);
    const desvioPadrao = Math.sqrt(
      closes.slice(-periodo)
        .map(val => Math.pow(val - media, 2))
        .reduce((sum, val) => sum + val, 0) / periodo
    );
    
    return {
      superior: media + (desvioPadrao * desvios),
      inferior: media - (desvioPadrao * desvios),
      media: media
    };
  } catch (e) {
    console.error("Erro no cálculo Bollinger Bands:", e);
    return { superior: 0, inferior: 0, media: 0 };
  }
}

// =============================================
// CORE DO SISTEMA (ATUALIZADO PARA FOREX EUR/USD)
// =============================================
async function analisarMercado() {
  if (state.leituraEmAndamento) return;
  state.leituraEmAndamento = true;
  
  try {
    const dados = await obterDadosTwelveData();
    state.dadosHistoricos = dados;
    
    if (dados.length < 100) {
      throw new Error(`Dados insuficientes (${dados.length} velas)`);
    }
    
    const velaAtual = dados[dados.length - 1];
    const closes = dados.map(v => v.close);
    const highs = dados.map(v => v.high);
    const lows = dados.map(v => v.low);

    // Verificar se os dados mudaram
    const dadosMudaram = state.dadosHistoricos.length !== state.cache.lastDataLength;
    if (dadosMudaram) {
      state.cache = {
        lastDataLength: dados.length,
        rsi: null,
        macd: null,
        ema8: null,
        ema21: null,
        ema50: null,
        stoch: null,
        superTrend: null,
        atr: null,
        adx: null,
        bollinger: null
      };
    }

    // Calcular indicadores (usar cache se disponível)
    const calcularEMA = (dados, periodo) => {
      const cacheKey = `ema${periodo}`;
      if (!state.cache[cacheKey] || dadosMudaram) {
        const emaArray = calcularMedia.exponencial(dados, periodo);
        state.cache[cacheKey] = emaArray[emaArray.length - 1];
      }
      return state.cache[cacheKey];
    };

    const ema8 = calcularEMA(closes, 8);
    const ema21 = calcularEMA(closes, 21);
    const ema50 = calcularEMA(closes, 50);
    
    const rsi = state.cache.rsi || calcularRSI(closes.slice(-100));
    state.cache.rsi = rsi;
    
    const stoch = state.cache.stoch || calcularStochastic(highs, lows, closes);
    state.cache.stoch = stoch;
    
    const macd = state.cache.macd || calcularMACD(closes);
    state.cache.macd = macd;
    
    const superTrend = state.cache.superTrend || calcularSuperTrend(dados);
    state.cache.superTrend = superTrend;
    
    const atr = state.cache.atr || calcularATR(dados);
    state.cache.atr = atr;
    
    const adx = state.cache.adx || calcularADX(dados);
    state.cache.adx = adx;
    
    const bollinger = state.cache.bollinger || calcularBollingerBands(closes);
    state.cache.bollinger = bollinger;
    
    // Manter histórico de RSI
    state.rsiHistory = state.rsiHistory || [];
    state.rsiHistory.push(rsi);
    if (state.rsiHistory.length > 100) state.rsiHistory.shift();
    
    const divergencias = detectarDivergencias(closes, state.rsiHistory, highs, lows);
    const tendencia = avaliarTendencia(ema8, ema21, ema50, velaAtual.close);
    const lateral = detectarLateralidade(closes);

    state.tendenciaDetectada = tendencia.tendencia;
    state.forcaTendencia = Math.round(tendencia.forca);

    const indicadores = {
      rsi,
      stoch,
      macd,
      emaCurta: ema8,
      emaMedia: ema21,
      emaLonga: ema50,
      close: velaAtual.close,
      superTrend,
      tendencia,
      atr,
      adx,
      bollinger,
      closes // Para detecção de lateralidade
    };

    let sinal = gerarSinal(indicadores, divergencias, lateral);
    
    const score = calcularScore(sinal, indicadores, divergencias);

    // Cooldown otimizado
    if (sinal !== "ESPERAR" && state.cooldown <= 0 && score > CONFIG.LIMIARES.SCORE_MEDIO) {
      state.cooldown = (score > CONFIG.LIMIARES.SCORE_ALTO) ? 4 : 3;
      sinal = "ESPERAR";
    } 
    
    if (state.cooldown > 0) {
      state.cooldown--;
    }

    state.ultimoSinal = sinal;
    state.ultimoScore = score;
    state.ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR");

    atualizarInterface(sinal, score, state.tendenciaDetectada, state.forcaTendencia);

    const criteriosElement = document.getElementById("criterios");
    if (criteriosElement) {
      criteriosElement.innerHTML = `
        <li>📊 Tendência: ${state.tendenciaDetectada} (${state.forcaTendencia}%)</li>
        <li>💰 Preço: ${indicadores.close.toFixed(5)}</li>
        <li>📉 RSI: ${rsi.toFixed(2)} ${rsi < CONFIG.LIMIARES.RSI_OVERSOLD ? '🔻' : rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT ? '🔺' : ''}</li>
        <li>📊 MACD: ${macd.histograma > 0 ? '+' : ''}${macd.histograma.toFixed(5)} ${macd.histograma > 0 ? '🟢' : '🔴'}</li>
        <li>📈 Stochastic: ${stoch.k.toFixed(2)}/${stoch.d.toFixed(2)}</li>
        <li>📌 Médias: EMA8 ${ema8.toFixed(5)} | EMA21 ${ema21.toFixed(5)} | EMA50 ${ema50.toFixed(5)}</li>
        <li>📊 Suporte: ${state.suporteKey.toFixed(5)} | Resistência: ${state.resistenciaKey.toFixed(5)}</li>
        <li>⚠️ Divergência: ${divergencias.tipoDivergencia}</li>
        <li>🚦 SuperTrend: ${superTrend.direcao > 0 ? 'ALTA' : 'BAIXA'} (${superTrend.valor.toFixed(5)})</li>
        <li>📏 ADX: ${adx.toFixed(2)} ${adx > CONFIG.LIMIARES.ADX_TENDENCIA ? '📈' : ''}</li>
        <li>🎯 Bollinger: ${bollinger.inferior.toFixed(5)}-${bollinger.superior.toFixed(5)}</li>
        <li>⚡ Volatilidade (ATR): ${atr.toFixed(5)}</li>
        <li>🔄 Lateral: ${lateral ? 'SIM' : 'NÃO'}</li>
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
      criteriosElement.innerHTML = `<li>ERRO: ${e.message}</li>
                                   <li>Dados: ${state.dadosHistoricos?.length || 0} velas</li>
                                   <li>API: ${API_KEYS[currentKeyIndex]}</li>`;
    }
    
    if (++state.tentativasErro > 3) setTimeout(() => location.reload(), 10000);
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
    const url = `${CONFIG.API_ENDPOINTS.TWELVE_DATA}/time_series?symbol=${CONFIG.PARES.FOREX}&interval=1min&outputsize=200&apikey=${apiKey}`;
    
    // Timeout para evitar bloqueios
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    const response = await fetch(url, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
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
      volume: 1 // Forex não tem volume confiável
    }));
  } catch (e) {
    console.error("Erro ao obter dados:", e);
    
    errorCount++;
    if (errorCount >= 2) {
      currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
      errorCount = 0;
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
  // Criar interface
  const container = document.createElement('div');
  container.style = "font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 800px; margin: 20px auto; padding: 25px; background: #1e1f29; border-radius: 15px; color: #f5f6fa; box-shadow: 0 8px 32px rgba(0,0,0,0.3);";
  container.innerHTML = `
    <h1 style="text-align: center; color: #6c5ce7; margin-bottom: 30px; font-size: 28px;">
      <i class="fas fa-chart-line"></i> Robô de Trading Forex EUR/USD
    </h1>
    
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 25px; margin-bottom: 30px;">
      <div id="comando" style="font-size: 32px; font-weight: 700; padding: 25px; border-radius: 12px; text-align: center; background: #2c2d3a; display: flex; align-items: center; justify-content: center; min-height: 120px;">
        --
      </div>
      
      <div style="display: flex; flex-direction: column; justify-content: center; background: #2c2d3a; padding: 20px; border-radius: 12px;">
        <div id="score" style="font-size: 22px; font-weight: 600; margin-bottom: 15px; text-align: center;">--</div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
          <div style="text-align: center;">
            <div style="font-size: 14px; opacity: 0.8;">Atualização</div>
            <div id="hora" style="font-size: 18px; font-weight: 600;">--:--:--</div>
          </div>
          
          <div style="text-align: center;">
            <div style="font-size: 14px; opacity: 0.8;">Próxima Análise</div>
            <div id="timer" style="font-size: 18px; font-weight: 600;">0:60</div>
          </div>
        </div>
      </div>
    </div>
    
    <div style="background: #2c2d3a; padding: 20px; border-radius: 12px; margin-bottom: 25px;">
      <h3 style="margin-top: 0; margin-bottom: 15px; color: #6c5ce7; display: flex; align-items: center;">
        <i class="fas fa-wind"></i> Tendência: 
        <span id="tendencia" style="margin-left: 8px;">--</span> 
        <span id="forca-tendencia" style="margin-left: 5px;">--</span>%
      </h3>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
        <div style="background: #3a3b4a; padding: 15px; border-radius: 8px;">
          <h4 style="margin-top: 0; margin-bottom: 10px; color: #a29bfe;">Últimos Sinais</h4>
          <ul id="ultimos" style="list-style: none; padding: 0; margin: 0;"></ul>
        </div>
        
        <div style="background: #3a3b4a; padding: 15px; border-radius: 8px;">
          <h4 style="margin-top: 0; margin-bottom: 10px; color: #a29bfe;">Indicadores</h4>
          <ul id="criterios" style="list-style: none; padding: 0; margin: 0;"></ul>
        </div>
      </div>
    </div>
    
    <div style="text-align: center; font-size: 14px; opacity: 0.7; padding-top: 15px; border-top: 1px solid #3a3b4a;">
      EUR/USD - Análise em tempo real | Atualizado: <span id="ultima-atualizacao">${new Date().toLocaleTimeString()}</span>
    </div>
  `;
  document.body.appendChild(container);
  document.body.style.backgroundColor = "#13141a";
  document.body.style.margin = "0";
  document.body.style.padding = "20px";
  
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
    }
    .put { 
      background: linear-gradient(135deg, #ff7675, #d63031) !important; 
      color: white !important;
      box-shadow: 0 4px 20px rgba(255, 118, 117, 0.3);
    }
    .esperar { 
      background: linear-gradient(135deg, #0984e3, #6c5ce7) !important; 
      color: white !important;
      box-shadow: 0 4px 20px rgba(108, 92, 231, 0.3);
    }
    .erro { 
      background: #fdcb6e !important; 
      color: #2d3436 !important;
    }
    body {
      transition: background 0.5s ease;
    }
    #comando {
      transition: all 0.5s cubic-bezier(0.68, -0.55, 0.27, 1.55);
    }
  `;
  document.head.appendChild(style);

  // Iniciar processos
  setInterval(atualizarRelogio, 1000);
  sincronizarTimer();
  
  // Primeira análise
  setTimeout(analisarMercado, 1000);
}

// Iniciar quando o documento estiver pronto
if (document.readyState === "complete") iniciarAplicativo();
else document.addEventListener("DOMContentLoaded", iniciarAplicativo);
