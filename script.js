// =============================================
// CONFIGURAÇÕES GLOBAIS (OTIMIZADAS PARA EURUSD)
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
  // Caches otimizados
  rsiCache: { avgGain: 0, avgLoss: 0, initialized: false },
  emaCache: { ema5: null, ema13: null, ema200: null },
  macdCache: { emaRapida: null, emaLenta: null, macdLine: [], signalLine: [] },
  superTrendCache: [],
  atrGlobal: 0,
  rsiHistory: [],
  cooldown: 0
};

const CONFIG = {
  API_ENDPOINTS: { TWELVE_DATA: "https://api.twelvedata.com" },
  PARES: { FOREX_IDX: "EUR/USD" },
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
    ANALISE_LATERAL: 20,
    ATR: 14,
    SUPERTREND: 7,
    VOLUME_PROFILE: 50,
    DIVERGENCIA_LOOKBACK: 8,
    EXTREME_LOOKBACK: 2
  },
  LIMIARES: {
    SCORE_ALTO: 85,
    SCORE_MEDIO: 70,
    RSI_OVERBOUGHT: 70,
    RSI_OVERSOLD: 30,
    STOCH_OVERBOUGHT: 85,
    STOCH_OVERSOLD: 15,
    VARIACAO_LATERAL: 0.0003, // Reduzido para EURUSD (0.03%)
    ATR_LIMIAR: 0.0005,
    BUCKET_SIZE: 0.0005,
    LATERALIDADE_LIMIAR: 0.0003 // 0.03% para EURUSD
  },
  PESOS: {
    RSI: 1.7,
    MACD: 2.2,
    TENDENCIA: 2.8,
    STOCH: 1.2,
    SUPERTREND: 1.9,
    DIVERGENCIA: 2.0
  },
  HORARIOS_OPERACAO: [
    { inicio: 7, fim: 17 }, // Londres
    { inicio: 12, fim: 20 } // Nova York (UTC)
  ]
};

// =============================================
// GERENCIADOR DE CHAVES API (SIMPLIFICADO)
// =============================================
const API_KEYS = ["9cf795b2a4f14d43a049ca935d174ebb", "0105e6681b894e0185704171c53f5075"];
let currentKeyIndex = 0;

// =============================================
// VERIFICAÇÃO DE HORÁRIO DE OPERAÇÃO (MELHORADA)
// =============================================
function verificarHorarioOperacao() {
  const horaUTC = new Date().getUTCHours();
  return CONFIG.HORARIOS_OPERACAO.some(horario => 
    horaUTC >= horario.inicio && horaUTC < horario.fim
  );
}

// =============================================
// SISTEMA DE TENDÊNCIA OTIMIZADO PARA EURUSD
// =============================================
function avaliarTendencia(ema5, ema13) {
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

// =============================================
// DETECÇÃO DE LATERALIDADE (OTIMIZADA)
// =============================================
function detectarLateralidade(closes) {
  if (closes.length < 20) return false;
  const variacoes = closes.slice(-20).map((c, i, arr) => 
    i > 0 ? Math.abs(c - arr[i-1]) : 0
  ).slice(1);
  return calcularMedia.simples(variacoes) < CONFIG.LIMIARES.LATERALIDADE_LIMIAR;
}

// =============================================
// SUPORTE/RESISTÊNCIA DINÂMICO (SIMPLIFICADO)
// =============================================
function calcularZonasPreco(dados) {
  const periodo = Math.min(50, dados.length);
  const slice = dados.slice(-periodo);
  const highs = slice.map(v => v.high);
  const lows = slice.map(v => v.low);
  return {
    resistencia: Math.max(...highs),
    suporte: Math.min(...lows)
  };
}

// =============================================
// GERADOR DE SINAIS PARA EURUSD (OTIMIZADO)
// =============================================
function gerarSinal(indicadores, divergencias, lateral) {
  const { close, emaCurta, macd, tendencia } = indicadores;
  
  if (lateral) return "ESPERAR";

  // Priorizar tendência forte
  if (tendencia.forca > 80) {
    if (tendencia.tendencia.includes("ALTA") && close > emaCurta && macd.histograma > 0) 
      return "CALL";
    if (tendencia.tendencia.includes("BAIXA") && close < emaCurta && macd.histograma < 0) 
      return "PUT";
  }

  // Breakout com buffer de 0.1%
  const buffer = (state.resistenciaKey - state.suporteKey) * 0.001;
  if (close > state.resistenciaKey + buffer) return "CALL";
  if (close < state.suporteKey - buffer) return "PUT";

  // Divergências somente em tendências moderadas
  if (divergencias.divergenciaRSI && tendencia.forca < 80) {
    if (divergencias.tipoDivergencia === "ALTA" && close > state.suporteKey) 
      return "CALL";
    if (divergencias.tipoDivergencia === "BAIXA" && close < state.resistenciaKey) 
      return "PUT";
  }

  return "ESPERAR";
}

// =============================================
// CALCULADOR DE CONFIANÇA (MAIS PRECISO)
// =============================================
function calcularScore(sinal, indicadores, divergencias) {
  let score = 65;
  const { tendencia, close, emaMedia, superTrend } = indicadores;

  // Fatores principais
  if (sinal === "CALL") {
    if (tendencia.tendencia.includes("ALTA")) score += 25;
    if (close > emaMedia) score += 15;
    if (close > superTrend.valor) score += 10;
  } 
  else if (sinal === "PUT") {
    if (tendencia.tendencia.includes("BAIXA")) score += 25;
    if (close < emaMedia) score += 15;
    if (close < superTrend.valor) score += 10;
  }
  
  if (divergencias.divergenciaRSI) score += 20;
  
  return Math.min(100, Math.max(0, score));
}

// =============================================
// FUNÇÕES UTILITÁRIAS (MANTIDAS)
// =============================================
function formatarTimer(segundos) {
  return `0:${segundos.toString().padStart(2, '0')}`;
}

function atualizarRelogio() {
  const elementoHora = document.getElementById("hora");
  if (elementoHora) {
    state.ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR");
    elementoHora.textContent = state.ultimaAtualizacao;
    state.marketOpen = verificarHorarioOperacao();
  }
}

// =============================================
// INDICADORES TÉCNICOS (OTIMIZADOS)
// =============================================
const calcularMedia = {
  simples: (dados, periodo = dados.length) => {
    const slice = dados.slice(-periodo);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  },
  exponencial: (dados, periodo) => {
    const k = 2 / (periodo + 1);
    let ema = calcularMedia.simples(dados.slice(0, periodo));
    return dados.slice(periodo).reduce((acc, val) => {
      ema = val * k + ema * (1 - k);
      acc.push(ema);
      return acc;
    }, [ema]);
  }
};

// RSI com cálculo incremental
function calcularRSI(closes) {
  if (!state.rsiCache.initialized || closes.length < CONFIG.PERIODOS.RSI + 1) {
    // Inicialização padrão
    return 50;
  }
  
  const diff = closes[closes.length - 1] - closes[closes.length - 2];
  const periodo = CONFIG.PERIODOS.RSI;

  if (diff > 0) {
    state.rsiCache.avgGain = (state.rsiCache.avgGain * (periodo - 1) + diff) / periodo;
    state.rsiCache.avgLoss = (state.rsiCache.avgLoss * (periodo - 1)) / periodo;
  } else {
    state.rsiCache.avgGain = (state.rsiCache.avgGain * (periodo - 1)) / periodo;
    state.rsiCache.avgLoss = (state.rsiCache.avgLoss * (periodo - 1) - diff) / periodo;
  }
  
  const rs = state.rsiCache.avgLoss === 0 ? 100 : state.rsiCache.avgGain / state.rsiCache.avgLoss;
  return 100 - (100 / (1 + rs));
}

// =============================================
// CORE DO SISTEMA (OTIMIZADO PARA PERFORMANCE)
// =============================================
async function analisarMercado() {
  if (state.leituraEmAndamento || !state.marketOpen) return;
  state.leituraEmAndamento = true;
  
  try {
    const dados = await obterDadosTwelveData();
    state.dadosHistoricos = dados;
    if (dados.length < 50) return;

    const velaAtual = dados[dados.length - 1];
    const closes = dados.map(v => v.close);
    const highs = dados.map(v => v.high);
    const lows = dados.map(v => v.low);

    // Cálculos paralelizados
    const [ema5, ema13] = await Promise.all([
      calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_CURTA).pop(),
      calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_MEDIA).pop()
    ]);
    
    const superTrend = calcularSuperTrend(dados);
    const rsi = calcularRSI(closes);
    const stoch = calcularStochastic(highs, lows, closes);
    const macd = calcularMACD(closes);
    
    // Atualizar histórico RSI
    if (state.rsiHistory.length < closes.length) {
      state.rsiHistory.push(rsi);
    }

    const divergencias = detectarDivergencias(closes, state.rsiHistory, highs, lows);
    const tendencia = avaliarTendencia(ema5, ema13);
    const lateral = detectarLateralidade(closes);
    const zonas = calcularZonasPreco(dados);
    
    state.tendenciaDetectada = tendencia.tendencia;
    state.forcaTendencia = tendencia.forca;
    state.resistenciaKey = zonas.resistencia;
    state.suporteKey = zonas.suporte;

    const indicadores = {
      rsi, stoch, macd, emaCurta: ema5, emaMedia: ema13,
      close: velaAtual.close, tendencia, superTrend
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

    atualizarInterface(sinal, score, state.tendenciaDetectada, state.forcaTendencia);

    // Atualizar histórico de sinais
    state.ultimos.unshift(`${state.ultimaAtualizacao} - ${sinal} (${score}%)`);
    if (state.ultimos.length > 8) state.ultimos.pop();

  } catch (e) {
    console.error("Erro na análise:", e);
  } finally {
    state.leituraEmAndamento = false;
  }
}

// =============================================
// OBTER DADOS (COM FALHA DE REDE TRATADA)
// =============================================
async function obterDadosTwelveData() {
  for (let i = 0; i < API_KEYS.length; i++) {
    try {
      const apiKey = API_KEYS[currentKeyIndex];
      const response = await fetch(`${CONFIG.API_ENDPOINTS.TWELVE_DATA}/time_series?symbol=EUR/USD&interval=1min&outputsize=100&apikey=${apiKey}`);
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      if (data.status === 'error') throw new Error(data.message);
      
      return data.values.reverse().map(item => ({
        time: item.datetime,
        open: parseFloat(item.open),
        high: parseFloat(item.high),
        low: parseFloat(item.low),
        close: parseFloat(item.close),
        volume: parseFloat(item.volume) || 1
      }));
      
    } catch (e) {
      console.error(`Chave ${currentKeyIndex} falhou:`, e);
      currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
    }
  }
  throw new Error("Todas as chaves falharam");
}

// =============================================
// CONTROLE DE TEMPO (MANTIDO)
// =============================================
function sincronizarTimer() {
  clearInterval(state.intervaloAtual);
  state.timer = 60 - new Date().getSeconds();
  
  state.intervaloAtual = setInterval(() => {
    if (--state.timer <= 0) {
      clearInterval(state.intervaloAtual);
      analisarMercado().finally(sincronizarTimer);
    }
  }, 1000);
}

// =============================================
// INICIALIZAÇÃO (SIMPLIFICADA)
// =============================================
function iniciarAplicativo() {
  setInterval(atualizarRelogio, 1000);
  sincronizarTimer();
  setTimeout(analisarMercado, 2000);
}

if (document.readyState === "complete") iniciarAplicativo();
else document.addEventListener("DOMContentLoaded", iniciarAplicativo);
