// =============================================
// CONFIGURAÇÕES GLOBAIS (ATUALIZADAS PARA CRYPTO IDX)
// =============================================
const state = {
  timer: 60,
  leituraEmAndamento: false,
  tentativasErro: 0,
  contadorLaterais: 0,
  tendenciaDetectada: "NEUTRA",
  forcaTendencia: 0,
  dadosHistoricos: [],
  resistenciaKey: 0,
  suporteKey: 0,
  rsiCache: { avgGain: 0, avgLoss: 0, initialized: false },
  emaCache: {
    ema5: null,
    ema13: null,
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
  cooldown: 0
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
    EMA_LONGA: 200,
    MACD_RAPIDA: 6,
    MACD_LENTA: 13,
    MACD_SINAL: 9,
    VELAS_CONFIRMACAO: 3,
    ANALISE_LATERAL: 20,
    ATR: 14,
    SUPERTREND: 7,
    DIVERGENCIA_LOOKBACK: 8,
    EXTREME_LOOKBACK: 2
  },
  LIMIARES: {
    SCORE_ALTO: 85,
    SCORE_MEDIO: 70,
    RSI_OVERBOUGHT: 75,
    RSI_OVERSOLD: 25,
    STOCH_OVERBOUGHT: 85,
    STOCH_OVERSOLD: 15,
    VARIACAO_LATERAL: 0.005,
    ATR_LIMIAR: 0.015,
    LATERALIDADE_LIMIAR: 0.005,
    BREAKOUT_THRESHOLD: 0.03
  },
  PESOS: {
    RSI: 1.7,
    MACD: 2.2,
    TENDENCIA: 2.8,
    STOCH: 1.2,
    SUPERTREND: 1.9,
    DIVERGENCIA: 2.0,
    VOLATILIDADE: 1.5
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
// SISTEMA DE TENDÊNCIA OTIMIZADO PARA CRIPTO
// =============================================
function avaliarTendencia(ema5, ema13) {
  if (ema5 === null || ema13 === null) {
    return { tendencia: "NEUTRA", forca: 0 };
  }
  
  const diff = ema5 - ema13;
  const forca = Math.min(100, Math.abs(diff * 10000));
  
  if (forca > 75) {
    return diff > 0 
      ? { tendencia: "FORTE_ALTA", forca }
      : { tendencia: "FORTE_BAIXA", forca };
  }
  
  if (forca > 40) {
    return diff > 0 
      ? { tendencia: "ALTA", forca } 
      : { tendencia: "BAIXA", forca };
  }
  
  return { tendencia: "NEUTRA", forca: 0 };
}

// =============================================
// DETECÇÃO DE LATERALIDADE (AJUSTADO PARA CRIPTO)
// =============================================
function detectarLateralidade(closes, periodo = CONFIG.PERIODOS.ANALISE_LATERAL, limiar = CONFIG.LIMIARES.LATERALIDADE_LIMIAR) {
  if (closes.length < periodo) return false;
  
  const variacoes = [];
  const startIndex = Math.max(0, closes.length - periodo);
  
  for (let i = startIndex + 1; i < closes.length; i++) {
    const variacao = Math.abs((closes[i] - closes[i - 1]) / closes[i - 1]);
    variacoes.push(variacao);
  }
  
  const mediaVariacao = variacoes.reduce((sum, val) => sum + val, 0) / variacoes.length;
  return mediaVariacao < limiar;
}

// =============================================
// CÁLCULO DE SUPORTE/RESISTÊNCIA PARA CRIPTO
// =============================================
function calcularZonasPreco(dados, periodo = 50) {
  if (dados.length < 2) return { resistencia: 0, suporte: 0, pivot: 0 };
  
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
// GERADOR DE SINAIS OTIMIZADO PARA CRIPTO
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
    tendencia,
    atr
  } = indicadores;
  
  // Cálculo de suporte/resistência
  const zonas = calcularZonasPreco(state.dadosHistoricos);
  state.suporteKey = zonas.suporte;
  state.resistenciaKey = zonas.resistencia;
  
  // Priorizar tendência forte em cripto
  if (tendencia.forca > 80) {
    if (tendencia.tendencia.includes("ALTA") && 
        close > emaCurta && 
        macd.histograma > 0 &&
        superTrend.direcao > 0) {
      return "CALL";
    }
    if (tendencia.tendencia.includes("BAIXA") && 
        close < emaCurta && 
        macd.histograma < 0 &&
        superTrend.direcao < 0) {
      return "PUT";
    }
  }

  // Breakout em criptomoedas
  const variacao = state.resistenciaKey - state.suporteKey;
  const limiteBreakout = variacao * CONFIG.LIMIARES.BREAKOUT_THRESHOLD;
  
  if (close > (state.resistenciaKey + limiteBreakout)) {
    return "CALL";
  }
  
  if (close < (state.suporteKey - limiteBreakout)) {
    return "PUT";
  }
  
  // Divergências em RSI (muito importantes em cripto)
  if (divergencias.divergenciaRSI) {
    if (divergencias.tipoDivergencia === "ALTA" && 
        close > state.suporteKey &&
        stoch.k < CONFIG.LIMIARES.STOCH_OVERSOLD) {
      return "CALL";
    }
    
    if (divergencias.tipoDivergencia === "BAIXA" && 
        close < state.resistenciaKey &&
        stoch.k > CONFIG.LIMIARES.STOCH_OVERBOUGHT) {
      return "PUT";
    }
  }
  
  // Condições específicas para cripto
  if (rsi < CONFIG.LIMIARES.RSI_OVERSOLD && 
      close > emaMedia && 
      superTrend.direcao > 0) {
    return "CALL";
  }
  
  if (rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT && 
      close < emaMedia && 
      superTrend.direcao < 0) {
    return "PUT";
  }
  
  return "ESPERAR";
}

// =============================================
// CALCULADOR DE CONFIANÇA PARA CRIPTO
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
                sinal === "PUT" && indicadores.close < indicadores.superTrend.valor ? 10 : 0,
    volatilidade: (indicadores.atr / indicadores.close) > 0.02 ? 15 : 5
  };
  
  score += Object.values(fatores).reduce((sum, val) => sum + val, 0);
  
  // Penalizar lateralidade
  if (state.contadorLaterais > 10) {
    score = Math.max(0, score - 20);
  }
  
  return Math.min(100, Math.max(0, score));
}

// =============================================
// INDICADORES TÉCNICOS (OTIMIZADOS PARA CRIPTO)
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
  if (closes.length < periodo + 1) return 50;
  
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
  }
  
  const diff = closes[closes.length - 1] - closes[closes.length - 2];
  const gain = Math.max(0, diff);
  const loss = Math.max(0, -diff);
  
  state.rsiCache.avgGain = ((state.rsiCache.avgGain * (periodo - 1)) + gain) / periodo;
  state.rsiCache.avgLoss = ((state.rsiCache.avgLoss * (periodo - 1)) + loss) / periodo;
  
  const rs = state.rsiCache.avgLoss === 0 ? 
    (state.rsiCache.avgGain > 0 ? Infinity : 1) : 
    state.rsiCache.avgGain / state.rsiCache.avgLoss;
    
  return 100 - (100 / (1 + rs));
}

function calcularStochastic(highs, lows, closes, 
                          periodoK = CONFIG.PERIODOS.STOCH_K, 
                          periodoD = CONFIG.PERIODOS.STOCH_D) {
  try {
    if (closes.length < periodoK) return { k: 50, d: 50 };
    
    const i = closes.length - 1;
    const startIndex = Math.max(0, i - periodoK + 1);
    const sliceHigh = highs.slice(startIndex, i + 1);
    const sliceLow = lows.slice(startIndex, i + 1);
    
    const highestHigh = Math.max(...sliceHigh);
    const lowestLow = Math.min(...sliceLow);
    const range = highestHigh - lowestLow;
    const k = range !== 0 ? ((closes[i] - lowestLow) / range) * 100 : 50;
    
    // Calcular média móvel simples para %D
    const kValues = state.stochCache?.kValues || [];
    kValues.push(k);
    if (kValues.length > periodoD) kValues.shift();
    
    const d = calcularMedia.simples(kValues, Math.min(kValues.length, periodoD)) || 50;
    
    return { k, d };
  } catch (e) {
    console.error("Erro no cálculo Stochastic:", e);
    return { k: 50, d: 50 };
  }
}

function calcularMACD(closes, rapida = CONFIG.PERIODOS.MACD_RAPIDA, 
                    lenta = CONFIG.PERIODOS.MACD_LENTA, 
                    sinal = CONFIG.PERIODOS.MACD_SINAL) {
  try {
    if (closes.length < lenta) {
      return { histograma: 0, macdLinha: 0, sinalLinha: 0 };
    }

    // Calcular EMAs se necessário
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
    }
    
    // Atualizar EMAs com novo valor
    const novoValor = closes[closes.length - 1];
    const kRapida = 2 / (rapida + 1);
    const kLenta = 2 / (lenta + 1);
    
    state.macdCache.emaRapida = novoValor * kRapida + state.macdCache.emaRapida * (1 - kRapida);
    state.macdCache.emaLenta = novoValor * kLenta + state.macdCache.emaLenta * (1 - kLenta);
    
    // Calcular linha MACD
    const novaMacdLinha = state.macdCache.emaRapida - state.macdCache.emaLenta;
    state.macdCache.macdLine.push(novaMacdLinha);
    
    // Calcular linha de sinal
    if (state.macdCache.signalLine.length === 0) {
      state.macdCache.signalLine.push(novaMacdLinha);
    } else {
      const kSinal = 2 / (sinal + 1);
      const ultimoSinal = state.macdCache.signalLine[state.macdCache.signalLine.length - 1];
      const novoSignal = novaMacdLinha * kSinal + ultimoSinal * (1 - kSinal);
      state.macdCache.signalLine.push(novoSignal);
    }
    
    // Manter tamanhos controlados
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
    console.error("Erro no cálculo MACD:", e);
    return { histograma: 0, macdLinha: 0, sinalLinha: 0 };
  }
}

function calcularATR(dados, periodo = CONFIG.PERIODOS.ATR) {
  try {
    if (!Array.isArray(dados) || dados.length < periodo + 1) return 0;
    
    // Calcular True Ranges
    const trValues = [];
    for (let i = 1; i < dados.length; i++) {
      const tr = Math.max(
        dados[i].high - dados[i].low,
        Math.abs(dados[i].high - dados[i-1].close),
        Math.abs(dados[i].low - dados[i-1].close)
      );
      trValues.push(tr);
    }
    
    // Calcular ATR
    if (state.atrGlobal === 0) {
      state.atrGlobal = calcularMedia.simples(trValues.slice(-periodo), periodo);
    } else {
      // Atualizar com método exponencial para eficiência
      state.atrGlobal = (state.atrGlobal * (periodo - 1) + trValues[trValues.length - 1]) / periodo;
    }
    
    return state.atrGlobal;
  } catch (e) {
    console.error("Erro no cálculo ATR:", e);
    return 0;
  }
}

function calcularSuperTrend(dados, atr, periodo = CONFIG.PERIODOS.SUPERTREND, multiplicador = 3) {
  try {
    if (dados.length < 2) return { direcao: 0, valor: 0 };
    
    const current = dados[dados.length - 1];
    const prev = dados.length > 1 ? dados[dados.length - 2] : current;
    const hl2 = (current.high + current.low) / 2;
    
    const upperBand = hl2 + (multiplicador * atr);
    const lowerBand = hl2 - (multiplicador * atr);
    
    let superTrend;
    let direcao;
    
    if (state.superTrendCache.length === 0) {
      superTrend = upperBand;
      direcao = 1;
    } else {
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
    return { direcao: 0, valor: 0 };
  }
}

function detectarDivergencias(closes, rsis, highs, lows) {
  try {
    const lookback = CONFIG.PERIODOS.DIVERGENCIA_LOOKBACK;
    
    if (closes.length < lookback || rsis.length < lookback) {
      return { divergenciaRSI: false, tipoDivergencia: "NENHUMA" };
    }
    
    // Encontrar máximos e mínimos
    const findExtremes = (data, isHigh) => {
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
    
    const priceHighs = findExtremes(closes, true);
    const priceLows = findExtremes(closes, false);
    const rsiHighs = findExtremes(rsis, true);
    const rsiLows = findExtremes(rsis, false);
    
    // Verificar divergências regulares
    let divergenciaRegularAlta = false;
    let divergenciaRegularBaixa = false;
    
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
    console.error("Erro na detecção de divergências:", e);
    return { divergenciaRSI: false, tipoDivergencia: "NENHUMA" };
  }
}

// =============================================
// CORE DO SISTEMA (ATUALIZADO PARA CRYPTO IDX)
// =============================================
async function analisarMercado() {
  if (state.leituraEmAndamento) return;
  state.leituraEmAndamento = true;
  
  try {
    const dados = await obterDadosTwelveData();
    state.dadosHistoricos = dados;
    
    if (dados.length < 20) {
      throw new Error(`Dados insuficientes (${dados.length} velas)`);
    }
    
    const velaAtual = dados[dados.length - 1];
    const closes = dados.map(v => v.close);
    const highs = dados.map(v => v.high);
    const lows = dados.map(v => v.low);

    // Calcular EMAs
    const calcularEMA = (dados, periodo) => {
      const emaArray = calcularMedia.exponencial(dados, periodo);
      return emaArray[emaArray.length - 1];
    };

    const ema5 = calcularEMA(closes, CONFIG.PERIODOS.EMA_CURTA);
    const ema13 = calcularEMA(closes, CONFIG.PERIODOS.EMA_MEDIA);

    // Calcular ATR primeiro para usar em outros indicadores
    const atr = calcularATR(dados);
    const superTrend = calcularSuperTrend(dados, atr);
    const rsi = calcularRSI(closes);
    const stoch = calcularStochastic(highs, lows, closes);
    const macd = calcularMACD(closes);
    
    // Preencher histórico de RSI
    if (state.rsiHistory.length === 0) {
      state.rsiHistory = Array(CONFIG.PERIODOS.RSI).fill(50);
    }
    state.rsiHistory.push(rsi);
    if (state.rsiHistory.length > 100) state.rsiHistory.shift();
    
    const divergencias = detectarDivergencias(closes, state.rsiHistory, highs, lows);
    const tendencia = avaliarTendencia(ema5, ema13);
    const lateral = detectarLateralidade(closes);

    // Atualizar contador de lateralidade
    if (lateral) state.contadorLaterais++;
    else state.contadorLaterais = Math.max(0, state.contadorLaterais - 1);

    state.tendenciaDetectada = tendencia.tendencia;
    state.forcaTendencia = tendencia.forca;

    const indicadores = {
      rsi,
      stoch,
      macd,
      emaCurta: ema5,
      emaMedia: ema13,
      close: velaAtual.close,
      superTrend,
      tendencia,
      atr
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

    // Log de resultados
    const horaAtual = new Date().toLocaleTimeString("pt-BR");
    console.log(`[${horaAtual}] Sinal: ${sinal}`);
    console.log(`   Confiança: ${score}%`);
    console.log(`   Tendência: ${state.tendenciaDetectada} (${state.forcaTendencia}%)`);
    console.log(`   Preço: ${indicadores.close.toFixed(2)} | RSI: ${rsi.toFixed(2)} | MACD: ${macd.histograma.toFixed(4)} | Stoch: ${stoch.k.toFixed(2)}/${stoch.d.toFixed(2)}`);
    console.log(`   Suporte: ${state.suporteKey.toFixed(2)} | Resistência: ${state.resistenciaKey.toFixed(2)}`);
    console.log('--------------------------------------------');

    state.tentativasErro = 0;
  } catch (e) {
    console.error("Erro na análise:", e);
    if (++state.tentativasErro > 3) {
      console.log("Reiniciando sistema...");
      setTimeout(() => {
        console.clear();
        state.tentativasErro = 0;
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
// INICIALIZAÇÃO E EXECUÇÃO
// =============================================
function iniciarMonitoramento() {
  console.log("Iniciando robô de trading para CRYPTO IDX...");
  console.log(`Par: ${CONFIG.PARES.CRYPTO_IDX}`);
  console.log("--------------------------------------------");
  
  // Primeira análise imediata
  analisarMercado();
  
  // Agendar análises periódicas (a cada minuto)
  setInterval(analisarMercado, 60000);
}

// Iniciar o sistema
iniciarMonitoramento();
