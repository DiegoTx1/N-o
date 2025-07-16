// =============================================
// CONFIGURAÇÕES GLOBAIS (ESTRATÉGIA 2025)
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
  marketOpen: true,
  tendenciaDetectada: "NEUTRA",
  forcaTendencia: 0,
  dadosHistoricosM1: [],
  dadosHistoricosM5: [],
  resistenciaKey: 0,
  suporteKey: 0,
  cache: {
    lastDataLengthM1: 0,
    lastDataLengthM5: 0,
    rsiM1: null,
    rsiM5: null,
    ema8M1: null,
    ema21M1: null,
    ema50M1: null,
    ema8M5: null,
    ema21M5: null,
    ema50M5: null,
    superTrendM1: null,
    superTrendM5: null,
    atrM1: null,
    atrM5: null,
    adxM1: null,
    adxM5: null,
    bollingerM1: null,
    bollingerM5: null,
    entropiaM1: null,
    entropiaM5: null
  },
  cooldown: 0,
  previsaoNeural: { direcao: "NEUTRA", confianca: 0 },
  sentimento: 0,
  indicadoresM1: null // Armazenar para usar na interface
};

const CONFIG = {
  API_ENDPOINTS: {
    TWELVE_DATA: "https://api.twelvedata.com",
    NEURAL_API: "https://api-neural-trading.com/v3/predict",
    SENTIMENT_API: "https://api-marketsentiment.com/eurusd"
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
    ANALISE_LATERAL: 20,
    ATR: 14,
    SUPERTREND: 10,
    DIVERGENCIA_LOOKBACK: 8,
    EXTREME_LOOKBACK: 2,
    ADX: 14,
    BOLLINGER: 20,
    ENTROPIA: 14
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
    BOLLINGER_LARGURA: 0.0008,
    ENTROPIA_ALTA: 0.5,
    SENTIMENTO_ALTO: 0.4,
    SENTIMENTO_BAIXO: -0.4
  },
  PESOS: {
    RSI: 1.5,
    MACD: 2.0,
    TENDENCIA: 2.5,
    SUPERTREND: 1.8,
    DIVERGENCIA: 1.7,
    ADX: 2.2,
    BOLLINGER: 1.9,
    ENTROPIA: 2.0,
    NEURAL: 3.0,
    SENTIMENTO: 2.5
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
// SISTEMA DE TENDÊNCIA AVANÇADO 2025
// =============================================
function avaliarTendencia(ema8, ema21, ema50, close, atr) {
  const diffCurta = ema8 - ema21;
  const diffLonga = close - ema50;
  
  // Fator de convergência ponderado
  const forcaCurta = Math.min(100, Math.abs(diffCurta) / (atr * 10) * 100);
  const forcaLonga = Math.min(100, Math.abs(diffLonga) / (atr * 5) * 100);
  
  // Tendência hierárquica com peso maior para longo prazo
  if (forcaLonga > 60) {
    return diffLonga > 0 
      ? { tendencia: "TENDÊNCIA_ALTA", forca: forcaLonga }
      : { tendencia: "TENDÊNCIA_BAIXA", forca: forcaLonga };
  }
  
  // Tendência de curto prazo
  if (forcaCurta > 70) {
    return diffCurta > 0 
      ? { tendencia: "FORTE_ALTA", forca: forcaCurta }
      : { tendencia: "FORTE_BAIXA", forca: forcaCurta };
  }
  
  if (forcaCurta > 45) {
    return diffCurta > 0 
      ? { tendencia: "ALTA", forca: forcaCurta } 
      : { tendencia: "BAIXA", forca: forcaCurta };
  }
  
  return { tendencia: "NEUTRA", forca: 0 };
}

// =============================================
// INDICADORES QUÂNTICOS 2025
// =============================================

// 1. OSCILADOR DE ENTROPIA DE MERCADO
function calcularEntropiaMercado(dados, periodo = CONFIG.PERIODOS.ENTROPIA) {
  try {
    if (dados.length < periodo * 2) return 0.5;
    
    const entropias = [];
    for (let i = periodo; i < dados.length; i++) {
      const slice = dados.slice(i - periodo, i);
      const retornos = [];
      
      for (let j = 1; j < slice.length; j++) {
        retornos.push(Math.log(slice[j].close / slice[j-1].close));
      }
      
      const media = calcularMedia.simples(retornos);
      const variancia = retornos.reduce((sum, r) => sum + Math.pow(r - media, 2), 0) / periodo;
      const entropia = Math.sqrt(2 * Math.PI * Math.E * variancia);
      entropias.push(entropia);
    }
    
    // Normalizar entre 0-1
    const maxEntropia = Math.max(...entropias);
    const minEntropia = Math.min(...entropias);
    const range = maxEntropia - minEntropia;
    
    return range > 0 
      ? (entropias[entropias.length - 1] - minEntropia) / range
      : 0.5;
  } catch (e) {
    console.error("Erro no cálculo de entropia:", e);
    return 0.5;
  }
}

// 2. PREVISÃO POR REDE NEURAL
async function previsaoRedeNeural(closes) {
  try {
    const response = await fetch(CONFIG.API_ENDPOINTS.NEURAL_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        symbol: CONFIG.PARES.FOREX,
        series: closes.slice(-100) 
      })
    });
    
    if (!response.ok) throw new Error("Erro na API neural");
    
    const data = await response.json();
    return {
      direcao: data.prediction > 0.7 ? "ALTA" : data.prediction < 0.3 ? "BAIXA" : "NEUTRA",
      confianca: Math.round(Math.abs(data.prediction - 0.5) * 200)
    };
  } catch (e) {
    console.error("Falha na previsão neural:", e);
    return { direcao: "NEUTRA", confianca: 0 };
  }
}

// 3. ANÁLISE DE SENTIMENTO EM TEMPO REAL
async function analisarSentimento() {
  try {
    const response = await fetch(CONFIG.API_ENDPOINTS.SENTIMENT_API);
    if (!response.ok) throw new Error("Erro na API de sentimento");
    
    const data = await response.json();
    return parseFloat(data.sentimentIndex) || 0;
  } catch (e) {
    console.error("Falha na análise de sentimento:", e);
    return 0;
  }
}

// =============================================
// SISTEMA DE CONFIRMAÇÃO MULTI TIMEFRAME
// =============================================
function confirmarSinalMultiTimeframe(sinalM1, indicadoresM1, indicadoresM5) {
  // Filtro 1: Tendência
  const tendenciaAlinhada = 
    (sinalM1 === "CALL" && 
     (indicadoresM5.tendencia.tendencia.includes("ALTA") || 
      indicadoresM1.tendencia.tendencia.includes("ALTA"))) ||
    (sinalM1 === "PUT" && 
     (indicadoresM5.tendencia.tendencia.includes("BAIXA") || 
      indicadoresM1.tendencia.tendencia.includes("BAIXA")));
  
  // Filtro 2: SuperTrend
  const superTrendAlinhado = 
    (sinalM1 === "CALL" && 
     indicadoresM1.superTrend.direcao > 0 && 
     indicadoresM5.superTrend.direcao > 0) ||
    (sinalM1 === "PUT" && 
     indicadoresM1.superTrend.direcao < 0 && 
     indicadoresM5.superTrend.direcao < 0);
  
  // Filtro 3: Neural e Sentimento
  const neuralAlinhada = 
    (sinalM1 === "CALL" && state.previsaoNeural.direcao === "ALTA") ||
    (sinalM1 === "PUT" && state.previsaoNeural.direcao === "BAIXA");
  
  const sentimentoAlinhado = 
    (sinalM1 === "CALL" && state.sentimento > CONFIG.LIMIARES.SENTIMENTO_ALTO) ||
    (sinalM1 === "PUT" && state.sentimento < CONFIG.LIMIARES.SENTIMENTO_BAIXO);
  
  // Requer pelo menos 2 confirmações
  const confirmacoes = [
    tendenciaAlinhada,
    superTrendAlinhado,
    neuralAlinhada,
    sentimentoAlinhado
  ].filter(Boolean).length;
  
  return confirmacoes >= 2;
}

// =============================================
// GERADOR DE SINAIS 2025 (M1 + M5)
// =============================================
async function gerarSinalAvancado(indicadoresM1, indicadoresM5) {
  // 1. Sinal primário no M1
  let sinalM1 = "ESPERAR";
  const { rsi, stoch, close, bollinger, adx } = indicadoresM1;
  
  // Estratégia Bollinger Reversão
  if (close < bollinger.inferior && 
      rsi < CONFIG.LIMIARES.RSI_OVERSOLD && 
      stoch.k < CONFIG.LIMIARES.STOCH_OVERSOLD) {
    sinalM1 = "CALL";
  } else if (close > bollinger.superior && 
             rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT && 
             stoch.k > CONFIG.LIMIARES.STOCH_OVERBOUGHT) {
    sinalM1 = "PUT";
  }
  
  // Estratégia Trend Following
  if (adx > CONFIG.LIMIARES.ADX_TENDENCIA) {
    if (indicadoresM1.tendencia.tendencia.includes("ALTA") && 
        close > indicadoresM1.emaCurta && 
        close > bollinger.media) {
      sinalM1 = "CALL";
    } else if (indicadoresM1.tendencia.tendencia.includes("BAIXA") && 
               close < indicadoresM1.emaCurta && 
               close < bollinger.media) {
      sinalM1 = "PUT";
    }
  }
  
  // 2. Confirmação com M5 e fatores quânticos
  if (sinalM1 !== "ESPERAR") {
    const confirmado = confirmarSinalMultiTimeframe(
      sinalM1, 
      indicadoresM1, 
      indicadoresM5
    );
    
    if (!confirmado) sinalM1 = "ESPERAR";
  }
  
  // 3. Filtro de entropia (evitar mercados caóticos)
  if (indicadoresM1.entropia > CONFIG.LIMIARES.ENTROPIA_ALTA) {
    sinalM1 = "ESPERAR";
  }
  
  return sinalM1;
}

// =============================================
// CALCULADOR DE CONFIANÇA 2025
// =============================================
function calcularScore(sinal, indicadoresM1) {
  if (sinal === "ESPERAR") return 0;
  
  const fatores = {
    tendencia: indicadoresM1.tendencia.forca * 0.25,
    rsi: sinal === "CALL" 
      ? (CONFIG.LIMIARES.RSI_OVERSOLD - indicadoresM1.rsi) / 10 
      : (indicadoresM1.rsi - CONFIG.LIMIARES.RSI_OVERBOUGHT) / 10,
    bollinger: sinal === "CALL"
      ? (indicadoresM1.bollinger.media - indicadoresM1.close) / 
        (indicadoresM1.bollinger.media - indicadoresM1.bollinger.inferior) * 20
      : (indicadoresM1.close - indicadoresM1.bollinger.media) / 
        (indicadoresM1.bollinger.superior - indicadoresM1.bollinger.media) * 20,
    adx: indicadoresM1.adx * 0.3,
    neural: state.previsaoNeural.confianca * 0.3,
    sentimento: Math.abs(state.sentimento) * 25,
    entropia: (1 - indicadoresM1.entropia) * 15
  };
  
  // Limitar valores
  Object.keys(fatores).forEach(key => {
    fatores[key] = Math.min(30, Math.max(0, fatores[key]));
  });
  
  // Cálculo do score
  let score = 40; // Base
  score += fatores.tendencia + fatores.rsi + fatores.bollinger + 
           fatores.adx + fatores.neural + fatores.sentimento + fatores.entropia;
  
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
  
  // Atualizar informações avançadas
  const neuralElement = document.getElementById("neural");
  const sentimentElement = document.getElementById("sentimento");
  const entropyElement = document.getElementById("entropia");
  
  if (neuralElement) {
    neuralElement.textContent = `${state.previsaoNeural.direcao} (${state.previsaoNeural.confianca}%)`;
  }
  
  if (sentimentElement) {
    const sentimentIcon = state.sentimento > 0.2 ? '📈' : state.sentimento < -0.2 ? '📉' : '↔️';
    sentimentElement.textContent = `${(state.sentimento * 100).toFixed(1)}% ${sentimentIcon}`;
  }
  
  if (entropyElement && state.indicadoresM1) {
    entropyElement.textContent = `${(state.indicadoresM1.entropia * 100).toFixed(1)}%`;
  }
}

// =============================================
// INDICADORES TÉCNICOS (ATUALIZADOS 2025)
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
// CORE DO SISTEMA (ESTRATÉGIA 2025)
// =============================================
async function analisarMercado() {
  if (state.leituraEmAndamento) return;
  state.leituraEmAndamento = true;
  
  try {
    // Obter dados em paralelo para M1 e M5
    const [dadosM1, dadosM5] = await Promise.all([
      obterDadosTwelveData("1min"),
      obterDadosTwelveData("5min")
    ]);
    
    state.dadosHistoricosM1 = dadosM1;
    state.dadosHistoricosM5 = dadosM5;
    
    if (dadosM1.length < 100 || dadosM5.length < 100) {
      throw new Error(`Dados insuficientes (M1:${dadosM1.length} M5:${dadosM5.length})`);
    }
    
    const velaAtualM1 = dadosM1[dadosM1.length - 1];
    const closesM1 = dadosM1.map(v => v.close);
    const highsM1 = dadosM1.map(v => v.high);
    const lowsM1 = dadosM1.map(v => v.low);
    
    const velaAtualM5 = dadosM5[dadosM5.length - 1];
    const closesM5 = dadosM5.map(v => v.close);
    const highsM5 = dadosM5.map(v => v.high);
    const lowsM5 = dadosM5.map(v => v.low);

    // Verificar se os dados mudaram
    const dadosMudaramM1 = state.dadosHistoricosM1.length !== state.cache.lastDataLengthM1;
    const dadosMudaramM5 = state.dadosHistoricosM5.length !== state.cache.lastDataLengthM5;
    
    if (dadosMudaramM1 || dadosMudaramM5) {
      state.cache.lastDataLengthM1 = dadosM1.length;
      state.cache.lastDataLengthM5 = dadosM5.length;
      
      // Resetar cache somente para os timeframe modificados
      if (dadosMudaramM1) {
        state.cache.rsiM1 = null;
        state.cache.ema8M1 = null;
        state.cache.ema21M1 = null;
        state.cache.ema50M1 = null;
        state.cache.superTrendM1 = null;
        state.cache.atrM1 = null;
        state.cache.adxM1 = null;
        state.cache.bollingerM1 = null;
        state.cache.entropiaM1 = null;
      }
      
      if (dadosMudaramM5) {
        state.cache.rsiM5 = null;
        state.cache.ema8M5 = null;
        state.cache.ema21M5 = null;
        state.cache.ema50M5 = null;
        state.cache.superTrendM5 = null;
        state.cache.atrM5 = null;
        state.cache.adxM5 = null;
        state.cache.bollingerM5 = null;
        state.cache.entropiaM5 = null;
      }
    }

    // Função para calcular EMA com cache
    const calcularEMA = (dados, periodo, cacheKey) => {
      if (!state.cache[cacheKey] || (cacheKey.includes("M1") && dadosMudaramM1) || (cacheKey.includes("M5") && dadosMudaramM5)) {
        const emaArray = calcularMedia.exponencial(dados, periodo);
        state.cache[cacheKey] = emaArray[emaArray.length - 1];
      }
      return state.cache[cacheKey];
    };

    // Calcular indicadores para M1
    const ema8M1 = calcularEMA(closesM1, 8, "ema8M1");
    const ema21M1 = calcularEMA(closesM1, 21, "ema21M1");
    const ema50M1 = calcularEMA(closesM1, 50, "ema50M1");
    
    const rsiM1 = state.cache.rsiM1 || calcularRSI(closesM1.slice(-100));
    state.cache.rsiM1 = rsiM1;
    
    const stochM1 = state.cache.stochM1 || calcularStochastic(highsM1, lowsM1, closesM1);
    state.cache.stochM1 = stochM1;
    
    const atrM1 = state.cache.atrM1 || calcularATR(dadosM1);
    state.cache.atrM1 = atrM1;
    
    const tendenciaM1 = avaliarTendencia(ema8M1, ema21M1, ema50M1, velaAtualM1.close, atrM1);
    const superTrendM1 = state.cache.superTrendM1 || calcularSuperTrend(dadosM1);
    state.cache.superTrendM1 = superTrendM1;
    
    const adxM1 = state.cache.adxM1 || calcularADX(dadosM1);
    state.cache.adxM1 = adxM1;
    
    const bollingerM1 = state.cache.bollingerM1 || calcularBollingerBands(closesM1);
    state.cache.bollingerM1 = bollingerM1;
    
    const entropiaM1 = state.cache.entropiaM1 || calcularEntropiaMercado(dadosM1);
    state.cache.entropiaM1 = entropiaM1;
    
    // Calcular indicadores para M5
    const ema8M5 = calcularEMA(closesM5, 8, "ema8M5");
    const ema21M5 = calcularEMA(closesM5, 21, "ema21M5");
    const ema50M5 = calcularEMA(closesM5, 50, "ema50M5");
    
    const atrM5 = state.cache.atrM5 || calcularATR(dadosM5);
    state.cache.atrM5 = atrM5;
    
    const tendenciaM5 = avaliarTendencia(ema8M5, ema21M5, ema50M5, velaAtualM5.close, atrM5);
    const superTrendM5 = state.cache.superTrendM5 || calcularSuperTrend(dadosM5);
    state.cache.superTrendM5 = superTrendM5;
    
    // Obter dados de inteligência artificial
    state.previsaoNeural = await previsaoRedeNeural(closesM1);
    state.sentimento = await analisarSentimento();

    // Preparar dados para geração de sinal
    const indicadoresM1 = {
      rsi: rsiM1,
      stoch: stochM1,
      emaCurta: ema8M1,
      emaMedia: ema21M1,
      emaLonga: ema50M1,
      close: velaAtualM1.close,
      superTrend: superTrendM1,
      tendencia: tendenciaM1,
      atr: atrM1,
      adx: adxM1,
      bollinger: bollingerM1,
      entropia: entropiaM1
    };

    const indicadoresM5 = {
      tendencia: tendenciaM5,
      superTrend: superTrendM5
    };

    // Armazenar para uso na interface
    state.indicadoresM1 = indicadoresM1;

    state.tendenciaDetectada = tendenciaM1.tendencia;
    state.forcaTendencia = Math.round(tendenciaM1.forca);

    // Gerar sinal com estratégia 2025
    let sinal = await gerarSinalAvancado(indicadoresM1, indicadoresM5);
    const score = calcularScore(sinal, indicadoresM1);

    // Cooldown adaptativo
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
        <li>💰 Preço: ${indicadoresM1.close.toFixed(5)}</li>
        <li>📉 RSI: ${rsiM1.toFixed(2)} ${rsiM1 < 30 ? '🔻' : rsiM1 > 70 ? '🔺' : ''}</li>
        <li>📈 Stochastic: ${stochM1.k.toFixed(2)}/${stochM1.d.toFixed(2)}</li>
        <li>📌 Médias: EMA8 ${ema8M1.toFixed(5)} | EMA21 ${ema21M1.toFixed(5)}</li>
        <li>🎯 Bollinger: ${bollingerM1.inferior.toFixed(5)}-${bollingerM1.superior.toFixed(5)}</li>
        <li>🚦 SuperTrend: ${superTrendM1.direcao > 0 ? 'ALTA' : 'BAIXA'}</li>
        <li>📏 ADX: ${adxM1.toFixed(2)} ${adxM1 > 25 ? '📈' : ''}</li>
        <li>🧠 Neural: ${state.previsaoNeural.direcao} (${state.previsaoNeural.confianca}%)</li>
        <li>😃 Sentimento: ${(state.sentimento * 100).toFixed(1)}%</li>
        <li>🌀 Entropia: ${(entropiaM1 * 100).toFixed(1)}%</li>
        <li>⚡ ATR: ${atrM1.toFixed(5)}</li>
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
                                   <li>Dados M1: ${state.dadosHistoricosM1?.length || 0}</li>
                                   <li>Dados M5: ${state.dadosHistoricosM5?.length || 0}</li>`;
    }
    
    if (++state.tentativasErro > 3) setTimeout(() => location.reload(), 10000);
  } finally {
    state.leituraEmAndamento = false;
  }
}

// =============================================
// FUNÇÕES DE DADOS (TWELVE DATA API)
// =============================================
async function obterDadosTwelveData(interval = "1min") {
  try {
    const apiKey = API_KEYS[currentKeyIndex];
    const url = `${CONFIG.API_ENDPOINTS.TWELVE_DATA}/time_series?symbol=${CONFIG.PARES.FOREX}&interval=${interval}&outputsize=200&apikey=${apiKey}`;
    
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
      <i class="fas fa-chart-line"></i> EUR/USD - Estratégia 2025
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
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 20px;">
        <div style="background: #3a3b4a; padding: 15px; border-radius: 8px; text-align: center;">
          <div style="font-size: 14px; opacity: 0.8; margin-bottom: 8px;">Tendência</div>
          <div><span id="tendencia">--</span> <span id="forca-tendencia">--</span>%</div>
        </div>
        
        <div style="background: #3a3b4a; padding: 15px; border-radius: 8px; text-align: center;">
          <div style="font-size: 14px; opacity: 0.8; margin-bottom: 8px;">IA Neural</div>
          <div id="neural">--</div>
        </div>
        
        <div style="background: #3a3b4a; padding: 15px; border-radius: 8px; text-align: center;">
          <div style="font-size: 14px; opacity: 0.8; margin-bottom: 8px;">Sentimento</div>
          <div id="sentimento">--</div>
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
        <div style="background: #3a3b4a; padding: 15px; border-radius: 8px;">
          <h4 style="margin-top: 0; margin-bottom: 10px; color: #a29bfe;">Últimos Sinais</h4>
          <ul id="ultimos" style="list-style: none; padding: 0; margin: 0;"></ul>
        </div>
        
        <div style="background: #3a3b4a; padding: 15px; border-radius: 8px;">
          <h4 style="margin-top: 0; margin-bottom: 10px; color: #a29bfe;">Indicadores Avançados</h4>
          <ul id="criterios" style="list-style: none; padding: 0; margin: 0;"></ul>
        </div>
      </div>
    </div>
    
    <div style="text-align: center; font-size: 14px; opacity: 0.7; padding-top: 15px; border-top: 1px solid #3a3b4a;">
      Sistema de Trading 2025 | Confirmação M1+M5 | Atualizado: <span id="ultima-atualizacao">${new Date().toLocaleTimeString()}</span>
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
