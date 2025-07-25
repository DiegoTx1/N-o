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
  rsiCache: { avgGain: 0, avgLoss: 0, initialized: false },
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
  superTrendCache: {
    values: [],
    atr: 0
  },
  bollingerCache: {
    superior: 0,
    inferior: 0,
    medio: 0,
    timestamp: 0
  },
  rsiHistory: [],
  cooldown: 0,
  volumeRelativo: 0,
  obv: 0,
  vwap: 0,
  lastClose: 0
};

const CONFIG = {
  API_ENDPOINTS: {
    TWELVE_DATA: "https://api.twelvedata.com",
    ALPHA_VANTAGE: "https://www.alphavantage.co/query",
    COINGECKO: "https://api.coingecko.com/api/v3"
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
    VWAP: 20,
    MULTI_TIMEFRAME: 5
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
    VOLATILIDADE_MINIMA: 0.01
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
    BOLLINGER: 1.4,
    MULTI_TIMEFRAME: 1.8
  }
};

// =============================================
// GERENCIADOR DE CHAVES API (MULTIPLAS FONTES)
// =============================================
const API_KEYS = {
  TWELVE_DATA: [
    "0105e6681b894e0185704171c53f5075",
    "backup_key_here"
  ],
  ALPHA_VANTAGE: ["demo"],
  COINGECKO: []
};

let currentProvider = 'TWELVE_DATA';
let currentKeyIndex = 0;
let errorCount = 0;
let lastRequestTime = 0;

// =============================================
// SISTEMA DE TENDÊNCIA OTIMIZADO (COM EMA50)
// =============================================
function avaliarTendencia(ema5, ema13, ema50) {
  if (!ema5 || !ema13 || !ema50) return { tendencia: "NEUTRA", forca: 0 };
  
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
  
  let maxHigh = -Infinity;
  let minLow = Infinity;
  
  for (let i = closes.length - periodo; i < closes.length; i++) {
    if (closes[i] > maxHigh) maxHigh = closes[i];
    if (closes[i] < minLow) minLow = closes[i];
  }
  
  const rangePercent = (maxHigh - minLow) / minLow;
  state.contadorLaterais = rangePercent < limiar ? state.contadorLaterais + 1 : 0;
  
  return rangePercent < limiar;
}

// =============================================
// CÁLCULO DE SUPORTE/RESISTÊNCIA (OTIMIZADO)
// =============================================
function calcularZonasPreco(dados, periodo = 50) {
  if (dados.length < periodo) periodo = dados.length;
  
  const slice = dados.slice(-periodo);
  let maxHigh = slice[0].high;
  let minLow = slice[0].low;
  
  for (let i = 1; i < slice.length; i++) {
    if (slice[i].high > maxHigh) maxHigh = slice[i].high;
    if (slice[i].low < minLow) minLow = slice[i].low;
  }
  
  return {
    resistencia: maxHigh,
    suporte: minLow,
    pivot: (maxHigh + minLow + dados[dados.length-1].close) / 3
  };
}

// =============================================
// INDICADORES TÉCNICOS (OTIMIZADOS)
// =============================================
const calcularMedia = {
  simples: (dados, periodo) => {
    if (!Array.isArray(dados) || dados.length < periodo) return null;
    let sum = 0;
    for (let i = dados.length - periodo; i < dados.length; i++) {
      sum += dados[i];
    }
    return sum / periodo;
  },

  exponencial: (dados, periodo, prevEMA = null) => {
    if (dados.length < periodo) return null;
    
    if (prevEMA === null) {
      let sum = 0;
      for (let i = 0; i < periodo; i++) {
        sum += dados[i];
      }
      return sum / periodo;
    }
    
    const k = 2 / (periodo + 1);
    const lastValue = dados[dados.length - 1];
    return lastValue * k + prevEMA * (1 - k);
  }
};

function calcularRSI(closes, periodo = CONFIG.PERIODOS.RSI) {
  if (closes.length < periodo + 1) return 50;
  
  const lastClose = closes[closes.length - 1];
  const prevClose = closes[closes.length - 2];
  const diff = lastClose - prevClose;

  if (!state.rsiCache.initialized) {
    let gains = 0, losses = 0;
    for (let i = 1; i <= periodo; i++) {
      const change = closes[i] - closes[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }
    
    state.rsiCache.avgGain = gains / periodo;
    state.rsiCache.avgLoss = losses / periodo;
    state.rsiCache.initialized = true;
  } else {
    if (diff > 0) {
      state.rsiCache.avgGain = ((state.rsiCache.avgGain * (periodo - 1)) + diff) / periodo;
      state.rsiCache.avgLoss = (state.rsiCache.avgLoss * (periodo - 1)) / periodo;
    } else {
      state.rsiCache.avgGain = (state.rsiCache.avgGain * (periodo - 1)) / periodo;
      state.rsiCache.avgLoss = ((state.rsiCache.avgLoss * (periodo - 1)) - diff) / periodo;
    }
  }
  
  if (state.rsiCache.avgLoss === 0) return 100;
  const rs = state.rsiCache.avgGain / state.rsiCache.avgLoss;
  return 100 - (100 / (1 + rs));
}

function calcularOBV(closes, volumes, prevOBV = 0) {
  if (closes.length < 2) return 0;
  
  const lastClose = closes[closes.length - 1];
  const prevClose = closes[closes.length - 2];
  const lastVolume = volumes[volumes.length - 1];
  
  if (lastClose > prevClose) return prevOBV + lastVolume;
  if (lastClose < prevClose) return prevOBV - lastVolume;
  return prevOBV;
}

// =============================================
// GERADOR DE SINAIS OTIMIZADO (COM MULTI-TIMEFRAME)
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
    atr
  } = indicadores;

  // 0. Filtro de volatilidade
  const volatilidade = atr / close;
  if (volatilidade < CONFIG.LIMIARES.VOLATILIDADE_MINIMA) {
    return "ESPERAR";
  }

  // 1. Tendência forte com volume e confirmação multi-timeframe
  if (tendencia.forca > 80 && volumeRelativo > CONFIG.LIMIARES.VOLUME_ALERTA) {
    const multiTimeframe = close > state.lastClose * 1.005;
    
    if (tendencia.tendencia === "FORTE_ALTA" && 
        close > vwap && 
        close > bandasBollinger.superior * 0.98 &&
        multiTimeframe) {
      return "CALL";
    }
    
    if (tendencia.tendencia === "FORTE_BAIXA" && 
        close < vwap && 
        close < bandasBollinger.inferior * 1.02 &&
        !multiTimeframe) {
      return "PUT";
    }
  }

  // 2. Breakout com volume e Bollinger
  const limiteBreakout = (bandasBollinger.superior - bandasBollinger.inferior) * 0.05;
  
  if (close > (bandasBollinger.superior + limiteBreakout) && 
      volumeRelativo > 1.8 &&
      volumeRelativo > state.volumeRelativo) {
    return "CALL";
  }
  
  if (close < (bandasBollinger.inferior - limiteBreakout) && 
      volumeRelativo > 1.8 &&
      volumeRelativo > state.volumeRelativo) {
    return "PUT";
  }

  // 3. Divergências com confirmação de volume
  if (divergencias.divergenciaRSI) {
    if (divergencias.tipoDivergencia === "ALTA" && 
        state.obv > 0 && 
        volumeRelativo > 1.2) {
      return "CALL";
    }
    
    if (divergencias.tipoDivergencia === "BAIXA" && 
        state.obv < 0 && 
        volumeRelativo > 1.2) {
      return "PUT";
    }
  }

  // 4. Reversão com múltiplos indicadores
  if (rsi < CONFIG.LIMIARES.RSI_OVERSOLD && 
      stoch.k < CONFIG.LIMIARES.STOCH_OVERSOLD && 
      close > vwap && 
      macd.histograma > 0 &&
      superTrend.direcao > 0) {
    return "CALL";
  }
  
  if (rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT && 
      stoch.k > CONFIG.LIMIARES.STOCH_OVERBOUGHT && 
      close < vwap && 
      macd.histograma < 0 &&
      superTrend.direcao < 0) {
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
    multiTimeframe: Math.abs(indicadores.close - state.lastClose) > (indicadores.atr * 0.5) ? 10 : 0
  };
  
  score += Object.values(fatores).reduce((sum, val) => sum + val, 0);
  
  // Penalizar lateralidade prolongada
  if (state.contadorLaterais > 5) score = Math.max(0, score - 15);
  
  // Bonus para alta volatilidade
  const volatilidade = indicadores.atr / indicadores.close;
  if (volatilidade > CONFIG.LIMIARES.ATR_LIMIAR) {
    score = Math.min(100, score + 8);
  }
  
  return Math.min(100, Math.max(0, score));
}

// =============================================
// FUNÇÕES UTILITÁRIAS (OTIMIZADAS)
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
    
    // Atualizar gradiente de acordo com a tendência
    if (tendencia.includes("ALTA")) {
      forcaElement.style.background = 'linear-gradient(90deg, #00b894, #00684a)';
      forcaElement.style.color = 'white';
    } else if (tendencia.includes("BAIXA")) {
      forcaElement.style.background = 'linear-gradient(90deg, #ff7675, #b33939)';
      forcaElement.style.color = 'white';
    } else {
      forcaElement.style.background = 'linear-gradient(90deg, #636e72, #2d3436)';
      forcaElement.style.color = 'white';
    }
  }
}

// =============================================
// SISTEMA DE RECUPERAÇÃO DE ERROS
// =============================================
function reiniciarEstado() {
  console.warn("Reiniciando estado após falhas consecutivas");
  state.rsiCache = { avgGain: 0, avgLoss: 0, initialized: false };
  state.macdCache = {
    emaRapida: null,
    emaLenta: null,
    macdLine: [],
    signalLine: []
  };
  state.superTrendCache = { values: [], atr: 0 };
  state.tentativasErro = 0;
  state.cooldown = 5;
}

// =============================================
// FUNÇÕES DE DADOS (MULTIPLAS FONTES)
// =============================================
async function obterDadosMercado() {
  const agora = Date.now();
  
  // Limitar requisições para 1 por segundo
  if (agora - lastRequestTime < 1000) {
    await new Promise(resolve => setTimeout(resolve, 1000 - (agora - lastRequestTime)));
  }
  
  lastRequestTime = Date.now();
  
  try {
    return await obterDadosTwelveData();
  } catch (e) {
    console.error("Falha no provedor principal, tentando fallback...");
    try {
      return await obterDadosAlphaVantage();
    } catch (e2) {
      console.error("Falha no fallback, tentando último recurso...");
      return await obterDadosCoinGecko();
    }
  }
}

async function obterDadosTwelveData() {
  try {
    const apiKey = API_KEYS.TWELVE_DATA[currentKeyIndex];
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
    
    if (valores.length === 0) {
      throw new Error("Dados vazios da API");
    }
    
    return valores.map(item => ({
      time: item.datetime,
      open: parseFloat(item.open),
      high: parseFloat(item.high),
      low: parseFloat(item.low),
      close: parseFloat(item.close),
      volume: parseFloat(item.volume) || 1
    }));
  } catch (e) {
    console.error("Erro ao obter dados Twelve Data:", e);
    
    // Rotacionar chaves
    currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.TWELVE_DATA.length;
    throw e;
  }
}

// =============================================
// CONTROLE DE TEMPO (OTIMIZADO)
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
// CORE DO SISTEMA (COM RECUPERAÇÃO DE ERROS)
// =============================================
async function analisarMercado() {
  if (state.leituraEmAndamento) return;
  
  state.leituraEmAndamento = true;
  state.lastClose = state.dadosHistoricos.length > 0 
    ? state.dadosHistoricos[state.dadosHistoricos.length - 1].close 
    : 0;
  
  try {
    const dados = await obterDadosMercado();
    state.dadosHistoricos = dados;
    
    if (dados.length < 20) {
      throw new Error(`Dados insuficientes (${dados.length} velas)`);
    }
    
    const velaAtual = dados[dados.length - 1];
    const closes = dados.map(v => v.close);
    const highs = dados.map(v => v.high);
    const lows = dados.map(v => v.low);
    const volumes = dados.map(v => v.volume);

    // Calcular EMAs incrementalmente
    state.emaCache.ema5 = calcularMedia.exponencial(
      closes, 
      CONFIG.PERIODOS.EMA_CURTA, 
      state.emaCache.ema5
    );
    
    state.emaCache.ema13 = calcularMedia.exponencial(
      closes, 
      CONFIG.PERIODOS.EMA_MEDIA, 
      state.emaCache.ema13
    );
    
    state.emaCache.ema50 = calcularMedia.exponencial(
      closes, 
      CONFIG.PERIODOS.EMA_50, 
      state.emaCache.ema50
    );
    
    const ema5 = state.emaCache.ema5;
    const ema13 = state.emaCache.ema13;
    const ema50 = state.emaCache.ema50;

    // Calcular novos indicadores
    state.volumeRelativo = calcularVolumeRelativo(volumes);
    state.obv = calcularOBV(closes, volumes, state.obv);
    state.vwap = calcularVWAP(dados);
    
    // Usar cache para Bollinger Bands (atualizar a cada 5 min)
    if (Date.now() - state.bollingerCache.timestamp > 300000) {
      state.bollingerCache = calcularBandasBollinger(closes);
      state.bollingerCache.timestamp = Date.now();
    }

    const superTrend = calcularSuperTrend(dados);
    const rsi = calcularRSI(closes);
    const stoch = calcularStochastic(highs, lows, closes);
    const macd = calcularMACD(closes);
    const atr = calcularATR(dados);
    
    // Preencher histórico de RSI
    if (state.rsiHistory.length >= 100) {
      state.rsiHistory.shift();
    }
    state.rsiHistory.push(rsi);
    
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
      bandasBollinger: state.bollingerCache
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
        <li>📊 <b>Tendência</b>: ${state.tendenciaDetectada} (${state.forcaTendencia}%)</li>
        <li>💰 <b>Preço</b>: ${indicadores.close.toFixed(2)}</li>
        <li>📉 <b>RSI</b>: ${rsi.toFixed(2)} ${rsi < CONFIG.LIMIARES.RSI_OVERSOLD ? '🔻' : rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT ? '🔺' : ''}</li>
        <li>📊 <b>MACD</b>: ${macd.histograma > 0 ? '+' : ''}${macd.histograma.toFixed(4)} ${macd.histograma > 0 ? '🟢' : '🔴'}</li>
        <li>📈 <b>Stochastic</b>: ${stoch.k.toFixed(2)}/${stoch.d.toFixed(2)}</li>
        <li>📌 <b>Médias</b>: EMA5 ${ema5.toFixed(2)} | EMA13 ${ema13.toFixed(2)} | EMA50 ${ema50.toFixed(2)}</li>
        <li>📊 <b>Suporte/Resistência</b>: ${state.suporteKey.toFixed(2)} | ${state.resistenciaKey.toFixed(2)}</li>
        <li>⚠️ <b>Divergência</b>: ${divergencias.tipoDivergencia}</li>
        <li>⚡ <b>Volatilidade (ATR)</b>: ${atr.toFixed(4)}</li>
        <li>💹 <b>Volume</b>: ${(state.volumeRelativo * 100).toFixed(0)}% ${state.volumeRelativo > CONFIG.LIMIARES.VOLUME_ALERTA ? '🚀' : ''}</li>
        <li>📊 <b>Bollinger</b>: ${state.bollingerCache.superior.toFixed(2)} | ${state.bollingerCache.inferior.toFixed(2)}</li>
        <li>📦 <b>OBV</b>: ${state.obv > 0 ? '↑' : '↓'} ${Math.abs(state.obv).toFixed(0)}</li>
      `;
    }

    state.ultimos.unshift(`${state.ultimaAtualizacao} - ${sinal} (${score}%)`);
    if (state.ultimos.length > 8) state.ultimos.pop();
    
    const ultimosElement = document.getElementById("ultimos");
    if (ultimosElement) {
      ultimosElement.innerHTML = state.ultimos.map(i => {
        const [time, signal] = i.split(" - ");
        const signalType = signal.includes("CALL") ? "call" : signal.includes("PUT") ? "put" : "esperar";
        return `<li class="${signalType}">${time} - ${signal}</li>`;
      }).join("");
    }

    state.tentativasErro = 0;
  } catch (e) {
    console.error("Erro na análise:", e);
    
    if (++state.tentativasErro > 3) {
      reiniciarEstado();
    }
    
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
// INICIALIZAÇÃO (COM UI RESPONSIVA)
// =============================================
function iniciarAplicativo() {
  // Criar interface com design responsivo
  const container = document.createElement('div');
  container.style = `
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
    max-width: 800px; 
    margin: 20px auto; 
    padding: 25px; 
    background: #1e1f29; 
    border-radius: 15px; 
    color: #f5f6fa; 
    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    transition: all 0.3s ease;
  `;
  
  container.innerHTML = `
    <h1 style="text-align: center; color: #6c5ce7; margin-bottom: 30px; font-size: 28px;">
      <i class="fab fa-bitcoin"></i> Robô de Trading CRYPTO IDX
    </h1>
    
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 25px; margin-bottom: 30px;">
      <div id="comando" style="font-size: 32px; font-weight: 700; padding: 25px; border-radius: 12px; text-align: center; background: #2c2d3a; display: flex; align-items: center; justify-content: center; min-height: 120px; transition: all 0.5s cubic-bezier(0.68, -0.55, 0.27, 1.55);">
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
        <i class="fas fa-chart-line"></i> Tendência: 
        <span id="tendencia" style="margin-left: 8px;">--</span> 
        <span id="forca-tendencia" style="margin-left: 5px; padding: 2px 8px; border-radius: 4px;">--</span>%
      </h3>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
        <div style="background: #3a3b4a; padding: 15px; border-radius: 8px; max-height: 300px; overflow-y: auto;">
          <h4 style="margin-top: 0; margin-bottom: 10px; color: #a29bfe;">Últimos Sinais</h4>
          <ul id="ultimos" style="list-style: none; padding: 0; margin: 0;"></ul>
        </div>
        
        <div style="background: #3a3b4a; padding: 15px; border-radius: 8px; max-height: 300px; overflow-y: auto;">
          <h4 style="margin-top: 0; margin-bottom: 10px; color: #a29bfe;">Indicadores</h4>
          <ul id="criterios" style="list-style: none; padding: 0; margin: 0;"></ul>
        </div>
      </div>
    </div>
    
    <div style="text-align: center; font-size: 14px; opacity: 0.7; padding-top: 15px; border-top: 1px solid #3a3b4a;">
      CRYPTO IDX - Análise em tempo real | Atualizado: <span id="ultima-atualizacao">${new Date().toLocaleTimeString()}</span>
    </div>
  `;
  
  document.body.appendChild(container);
  document.body.style.backgroundColor = "#13141a";
  document.body.style.margin = "0";
  document.body.style.padding = "20px";
  document.body.style.transition = "background 0.5s ease";
  
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
      animation: pulseCall 1.5s infinite;
    }
    .put { 
      background: linear-gradient(135deg, #ff7675, #d63031) !important; 
      color: white !important;
      box-shadow: 0 4px 20px rgba(255, 118, 117, 0.3);
      animation: pulsePut 1.5s infinite;
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
    
    #ultimos li.call {
      color: #00b894;
      font-weight: bold;
    }
    
    #ultimos li.put {
      color: #ff7675;
      font-weight: bold;
    }
    
    #ultimos li.esperar {
      color: #636e72;
    }
    
    @keyframes pulseCall {
      0% { box-shadow: 0 0 0 0 rgba(0, 184, 148, 0.6); }
      70% { box-shadow: 0 0 0 10px rgba(0, 184, 148, 0); }
      100% { box-shadow: 0 0 0 0 rgba(0, 184, 148, 0); }
    }
    
    @keyframes pulsePut {
      0% { box-shadow: 0 0 0 0 rgba(255, 118, 117, 0.6); }
      70% { box-shadow: 0 0 0 10px rgba(255, 118, 117, 0); }
      100% { box-shadow: 0 0 0 0 rgba(255, 118, 117, 0); }
    }
    
    @media (max-width: 768px) {
      div[style*="grid-template-columns: 1fr 1fr"] {
        grid-template-columns: 1fr !important;
      }
      
      #comando {
        min-height: 100px !important;
        font-size: 28px !important;
      }
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
