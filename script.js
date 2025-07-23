// =============================================
// CONFIGURAÇÕES GLOBAIS (OTIMIZADAS PARA CRYPTO)
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
  emaCache: { ema5: null, ema13: null },
  macdCache: { emaRapida: null, emaLenta: null, macdLine: [], signalLine: [] },
  superTrendCache: [],
  atrGlobal: 0,
  rsiHistory: [],
  cooldown: 0,
  lastCandleTime: null
};

const CONFIG = {
  API_ENDPOINTS: { TWELVE_DATA: "https://api.twelvedata.com" },
  PARES: { CRYPTO_IDX: "BTC/USD" },
  PERIODOS: {
    RSI: 9,
    STOCH_K: 14,
    STOCH_D: 3,
    EMA_CURTA: 5,
    EMA_MEDIA: 13,
    MACD_RAPIDA: 6,
    MACD_LENTA: 13,
    MACD_SINAL: 9,
    ANALISE_LATERAL: 20,
    ATR: 14,
    SUPERTREND: 7,
    DIVERGENCIA_LOOKBACK: 8
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
// GERENCIADOR DE CHAVES API (ROBUSTO)
// =============================================
const API_KEYS = [
  "0105e6681b894e0185704171c53f5075",
  "backup_key_2",
  "backup_key_3"
];
let currentKeyIndex = 0;
let errorCount = 0;

// =============================================
// SISTEMA DE TENDÊNCIA (OTIMIZADO)
// =============================================
function avaliarTendencia(ema5, ema13) {
  if (ema5 === null || ema13 === null) return { tendencia: "NEUTRA", forca: 0 };
  
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
// DETECÇÃO DE LATERALIDADE (EFICIENTE)
// =============================================
function detectarLateralidade(closes, periodo = CONFIG.PERIODOS.ANALISE_LATERAL) {
  if (closes.length < periodo) return false;
  
  let sumVariacao = 0;
  const startIndex = closes.length - periodo;
  
  for (let i = startIndex + 1; i < closes.length; i++) {
    const variacao = Math.abs((closes[i] - closes[i - 1]) / closes[i - 1]);
    sumVariacao += variacao;
  }
  
  const mediaVariacao = sumVariacao / (periodo - 1);
  return mediaVariacao < CONFIG.LIMIARES.LATERALIDADE_LIMIAR;
}

// =============================================
// SUPORTE/RESISTÊNCIA (DINÂMICO)
// =============================================
function calcularZonasPreco(dados, periodo = 50) {
  if (dados.length < periodo) return { resistencia: 0, suporte: 0 };
  
  const slice = dados.slice(-periodo);
  let maxHigh = -Infinity;
  let minLow = Infinity;
  
  for (const v of slice) {
    if (v.high > maxHigh) maxHigh = v.high;
    if (v.low < minLow) minLow = v.low;
  }
  
  return {
    resistencia: maxHigh,
    suporte: minLow,
    pivot: (maxHigh + minLow + dados[dados.length-1].close) / 3
  };
}

// =============================================
// GERADOR DE SINAIS (APRIMORADO)
// =============================================
function gerarSinal(indicadores, divergencias) {
  const { rsi, stoch, macd, close, emaCurta, emaMedia, superTrend, tendencia, atr } = indicadores;
  const zonas = calcularZonasPreco(state.dadosHistoricos);
  
  state.suporteKey = zonas.suporte;
  state.resistenciaKey = zonas.resistencia;
  
  // Filtro de confirmação de sinal
  const confirmacaoAlta = 
    close > emaCurta && 
    macd.histograma > 0 &&
    superTrend.direcao > 0;
    
  const confirmacaoBaixa = 
    close < emaCurta && 
    macd.histograma < 0 &&
    superTrend.direcao < 0;

  // Sinal baseado em tendência forte
  if (tendencia.forca > 80) {
    if (tendencia.tendencia.includes("ALTA") && confirmacaoAlta) return "CALL";
    if (tendencia.tendencia.includes("BAIXA") && confirmacaoBaixa) return "PUT";
  }

  // Breakout com confirmação de volume
  const variacao = state.resistenciaKey - state.suporteKey;
  const limiteBreakout = variacao * CONFIG.LIMIARES.BREAKOUT_THRESHOLD;
  
  if (close > (state.resistenciaKey + limiteBreakout) && confirmacaoAlta) return "CALL";
  if (close < (state.suporteKey - limiteBreakout) && confirmacaoBaixa) return "PUT";
  
  // Divergências com confirmação
  if (divergencias.divergenciaRSI) {
    if (divergencias.tipoDivergencia === "ALTA" && 
        close > state.suporteKey &&
        stoch.k < CONFIG.LIMIARES.STOCH_OVERSOLD) return "CALL";
    
    if (divergencias.tipoDivergencia === "BAIXA" && 
        close < state.resistenciaKey &&
        stoch.k > CONFIG.LIMIARES.STOCH_OVERBOUGHT) return "PUT";
  }
  
  // Condições de reversão
  if (rsi < CONFIG.LIMIARES.RSI_OVERSOLD && confirmacaoAlta) return "CALL";
  if (rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT && confirmacaoBaixa) return "PUT";
  
  return "ESPERAR";
}

// =============================================
// CALCULADOR DE CONFIANÇA (APRIMORADO)
// =============================================
function calcularScore(sinal, indicadores, divergencias) {
  let score = 65;
  const { tendencia, close, emaMedia, superTrend, atr } = indicadores;

  // Fatores positivos
  if (sinal === "CALL") {
    if (tendencia.tendencia.includes("ALTA")) score += 25;
    if (close > emaMedia) score += 15;
    if (superTrend.direcao > 0) score += 10;
  } 
  else if (sinal === "PUT") {
    if (tendencia.tendencia.includes("BAIXA")) score += 25;
    if (close < emaMedia) score += 15;
    if (superTrend.direcao < 0) score += 10;
  }
  
  // Bônus por divergência
  if (divergencias.divergenciaRSI) score += 20;
  
  // Ajuste por volatilidade
  score += (atr / close) > 0.02 ? 15 : 5;
  
  // Penalidade por lateralidade
  if (state.contadorLaterais > 10) score = Math.max(0, score - 20);
  
  return Math.min(100, Math.max(0, score));
}

// =============================================
// FUNÇÕES UTILITÁRIAS (OTIMIZADAS)
// =============================================
function formatarTimer(segundos) {
  return `0:${segundos.toString().padStart(2, '0')}`;
}

function atualizarRelogio() {
  const now = new Date();
  state.ultimaAtualizacao = now.toLocaleTimeString("pt-BR", {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  
  const elementoHora = document.getElementById("hora");
  if (elementoHora) elementoHora.textContent = state.ultimaAtualizacao;
}

// =============================================
// CORE DE INDICADORES (PERFORMÁTICO)
// =============================================
const calcularMedia = {
  simples: (dados, periodo) => {
    if (dados.length < periodo) return null;
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
    return dados[dados.length - 1] * k + prevEMA * (1 - k);
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
    state.rsiCache.prevClose = closes[periodo];
  }
  
  const diff = closes[closes.length - 1] - state.rsiCache.prevClose;
  state.rsiCache.prevClose = closes[closes.length - 1];
  
  const gain = Math.max(0, diff);
  const loss = Math.max(0, -diff);
  
  state.rsiCache.avgGain = ((state.rsiCache.avgGain * (periodo - 1)) + gain) / periodo;
  state.rsiCache.avgLoss = ((state.rsiCache.avgLoss * (periodo - 1)) + loss) / periodo;
  
  const rs = state.rsiCache.avgLoss === 0 ? 
    (state.rsiCache.avgGain > 0 ? Infinity : 1) : 
    state.rsiCache.avgGain / state.rsiCache.avgLoss;
    
  return 100 - (100 / (1 + rs));
}

function calcularStochastic(highs, lows, closes) {
  const periodoK = CONFIG.PERIODOS.STOCH_K;
  const periodoD = CONFIG.PERIODOS.STOCH_D;
  
  if (closes.length < periodoK) return { k: 50, d: 50 };
  
  const i = closes.length - 1;
  const startIndex = Math.max(0, i - periodoK + 1);
  
  let highestHigh = -Infinity;
  let lowestLow = Infinity;
  
  for (let j = startIndex; j <= i; j++) {
    if (highs[j] > highestHigh) highestHigh = highs[j];
    if (lows[j] < lowestLow) lowestLow = lows[j];
  }
  
  const range = highestHigh - lowestLow;
  const k = range !== 0 ? ((closes[i] - lowestLow) / range) * 100 : 50;
  
  // Calcular %D
  const kValues = state.stochCache?.kValues || [];
  kValues.push(k);
  if (kValues.length > periodoD) kValues.shift();
  
  const d = calcularMedia.simples(kValues, Math.min(kValues.length, periodoD)) || 50;
  state.stochCache = { kValues };
  
  return { k, d };
}

function calcularMACD(closes) {
  const rapida = CONFIG.PERIODOS.MACD_RAPIDA;
  const lenta = CONFIG.PERIODOS.MACD_LENTA;
  const sinal = CONFIG.PERIODOS.MACD_SINAL;
  
  if (closes.length < lenta) return { histograma: 0, macdLinha: 0, sinalLinha: 0 };

  // Atualizar EMAs
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
  
  const macdLinha = state.emaCache.ema5 - state.emaCache.ema13;
  
  // Calcular linha de sinal
  if (state.macdCache.macdLine.length === 0) {
    state.macdCache.macdLine = Array(sinal).fill(macdLinha);
  }
  
  state.macdCache.macdLine.push(macdLinha);
  if (state.macdCache.macdLine.length > 50) state.macdCache.macdLine.shift();
  
  const signalLine = calcularMedia.simples(
    state.macdCache.macdLine.slice(-sinal), 
    sinal
  ) || macdLinha;
  
  state.macdCache.signalLine.push(signalLine);
  if (state.macdCache.signalLine.length > 50) state.macdCache.signalLine.shift();
  
  return {
    histograma: macdLinha - signalLine,
    macdLinha,
    sinalLinha: signalLine
  };
}

function calcularATR(dados) {
  const periodo = CONFIG.PERIODOS.ATR;
  if (dados.length < periodo + 1) return 0;
  
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
    let sum = 0;
    for (let i = 0; i < periodo; i++) {
      sum += trValues[i];
    }
    state.atrGlobal = sum / periodo;
  } else {
    state.atrGlobal = (state.atrGlobal * (periodo - 1) + trValues[trValues.length - 1]) / periodo;
  }
  
  return state.atrGlobal;
}

function calcularSuperTrend(dados, atr) {
  if (dados.length < 2) return { direcao: 0, valor: 0 };
  
  const current = dados[dados.length - 1];
  const prev = dados[dados.length - 2];
  const hl2 = (current.high + current.low) / 2;
  
  const upperBand = hl2 + (3 * atr);
  const lowerBand = hl2 - (3 * atr);
  
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
}

function detectarDivergencias(closes, rsis) {
  const lookback = CONFIG.PERIODOS.DIVERGENCIA_LOOKBACK;
  if (closes.length < lookback || rsis.length < lookback) {
    return { divergenciaRSI: false, tipoDivergencia: "NENHUMA" };
  }
  
  // Encontrar máximos e mínimos recentes
  let maxPrice = -Infinity, minPrice = Infinity;
  let maxRsi = -Infinity, minRsi = Infinity;
  
  for (let i = rsis.length - lookback; i < rsis.length; i++) {
    if (closes[i] > maxPrice) maxPrice = closes[i];
    if (closes[i] < minPrice) minPrice = closes[i];
    if (rsis[i] > maxRsi) maxRsi = rsis[i];
    if (rsis[i] < minRsi) minRsi = rsis[i];
  }
  
  // Verificar divergências
  const currentClose = closes[closes.length - 1];
  const currentRsi = rsis[rsis.length - 1];
  
  const divergenciaBaixa = 
    currentClose > maxPrice && 
    currentRsi < maxRsi;
  
  const divergenciaAlta = 
    currentClose < minPrice && 
    currentRsi > minRsi;
  
  return {
    divergenciaRSI: divergenciaAlta || divergenciaBaixa,
    tipoDivergencia: divergenciaAlta ? "ALTA" : 
                     divergenciaBaixa ? "BAIXA" : "NENHUMA"
  };
}

// =============================================
// NÚCLEO DO SISTEMA (EFICIENTE)
// =============================================
async function analisarMercado() {
  if (state.leituraEmAndamento) return;
  state.leituraEmAndamento = true;
  
  try {
    const dados = await obterDadosTwelveData();
    if (dados.length === 0) throw new Error("Sem dados da API");
    
    // Verificar se temos novo candle
    const ultimoCandle = dados[dados.length - 1];
    if (state.lastCandleTime === ultimoCandle.time) {
      return;
    }
    state.lastCandleTime = ultimoCandle.time;
    state.dadosHistoricos = dados;
    
    const closes = dados.map(v => v.close);
    const highs = dados.map(v => v.high);
    const lows = dados.map(v => v.low);

    // Calcular indicadores em paralelo
    const [atr, rsi, stoch, macd, superTrend] = await Promise.all([
      calcularATR(dados),
      calcularRSI(closes),
      calcularStochastic(highs, lows, closes),
      calcularMACD(closes),
      calcularSuperTrend(dados, state.atrGlobal)
    ]);
    
    // Preencher histórico de RSI
    state.rsiHistory.push(rsi);
    if (state.rsiHistory.length > 100) state.rsiHistory.shift();
    
    const divergencias = detectarDivergencias(closes, state.rsiHistory);
    const tendencia = avaliarTendencia(state.emaCache.ema5, state.emaCache.ema13);
    const lateral = detectarLateralidade(closes);

    // Atualizar contador de lateralidade
    state.contadorLaterais = lateral ? state.contadorLaterais + 1 : Math.max(0, state.contadorLaterais - 1);

    const indicadores = {
      rsi,
      stoch,
      macd,
      emaCurta: state.emaCache.ema5,
      emaMedia: state.emaCache.ema13,
      close: ultimoCandle.close,
      superTrend,
      tendencia,
      atr
    };

    let sinal = "ESPERAR";
    
    // Gerar sinal apenas se não estiver em cooldown
    if (state.cooldown <= 0) {
      sinal = gerarSinal(indicadores, divergencias);
      if (sinal !== "ESPERAR") state.cooldown = 3;
    } else {
      state.cooldown--;
    }

    const score = calcularScore(sinal, indicadores, divergencias);
    state.ultimoSinal = sinal;
    state.ultimoScore = score;
    state.ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR");

    atualizarInterface(sinal, score, state.tendenciaDetectada, state.forcaTendencia, indicadores, divergencias);

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
      criteriosElement.innerHTML = `<li>ERRO: ${e.message || 'Falha na análise'}</li>`;
    }
    
    if (++state.tentativasErro > 3) {
      setTimeout(() => {
        currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
        location.reload();
      }, 10000);
    }
  } finally {
    state.leituraEmAndamento = false;
  }
}

// =============================================
// ATUALIZAÇÃO DE INTERFACE (MODERNIZADA)
// =============================================
function atualizarInterface(sinal, score, tendencia, forca, indicadores, divergencias) {
  if (!state.marketOpen) return;
  
  // Atualizar elementos principais
  const comandoElement = document.getElementById("comando");
  if (comandoElement) {
    comandoElement.textContent = sinal;
    comandoElement.className = sinal.toLowerCase();
    
    if (sinal === "CALL") comandoElement.innerHTML = "CALL 📈";
    else if (sinal === "PUT") comandoElement.innerHTML = "PUT 📉";
    else if (sinal === "ESPERAR") comandoElement.innerHTML = "ESPERAR ✋";
    else comandoElement.innerHTML = "ERRO ⚠️";
  }
  
  const scoreElement = document.getElementById("score");
  if (scoreElement) {
    scoreElement.textContent = `Confiança: ${score}%`;
    scoreElement.style.color = score >= CONFIG.LIMIARES.SCORE_ALTO ? '#00ff00' :
                              score >= CONFIG.LIMIARES.SCORE_MEDIO ? '#ffff00' : '#ff0000';
  }
  
  // Atualizar seção de critérios
  const criteriosElement = document.getElementById("criterios");
  if (criteriosElement && indicadores) {
    criteriosElement.innerHTML = `
      <li>📊 Tendência: ${tendencia} (${forca}%)</li>
      <li>💰 Preço: ${indicadores.close.toFixed(2)}</li>
      <li>📉 RSI: ${indicadores.rsi.toFixed(2)} ${indicadores.rsi < 30 ? '🔻' : indicadores.rsi > 70 ? '🔺' : ''}</li>
      <li>📈 MACD: ${indicadores.macd.histograma > 0 ? '+' : ''}${indicadores.macd.histograma.toFixed(4)}</li>
      <li>📊 Stochastic: ${indicadores.stoch.k.toFixed(2)}/${indicadores.stoch.d.toFixed(2)}</li>
      <li>📌 Médias: EMA5 ${indicadores.emaCurta?.toFixed(2) || '--'} | EMA13 ${indicadores.emaMedia?.toFixed(2) || '--'}</li>
      <li>📊 Suporte: ${state.suporteKey.toFixed(2)} | Resistência: ${state.resistenciaKey.toFixed(2)}</li>
      <li>⚠️ Divergência: ${divergencias?.tipoDivergencia || 'NENHUMA'}</li>
      <li>🚦 SuperTrend: ${indicadores.superTrend.direcao > 0 ? 'ALTA' : 'BAIXA'} (${indicadores.superTrend.valor.toFixed(2)})</li>
      <li>⚡ Volatilidade (ATR): ${indicadores.atr.toFixed(4)}</li>
      <li>🔄 Lateral: ${state.contadorLaterais > 10 ? 'SIM' : 'NÃO'}</li>
    `;
  }
}

// =============================================
// INTEGRAÇÃO COM API (ROBUSTA)
// =============================================
async function obterDadosTwelveData() {
  try {
    const apiKey = API_KEYS[currentKeyIndex];
    const url = `${CONFIG.API_ENDPOINTS.TWELVE_DATA}/time_series?symbol=${CONFIG.PARES.CRYPTO_IDX}&interval=1min&outputsize=100&apikey=${apiKey}`;
    
    const response = await fetch(url, { timeout: 5000 });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data = await response.json();
    if (data.status === 'error') throw new Error(data.message || 'Erro na API');
    
    return data.values?.reverse().map(item => ({
      time: item.datetime,
      open: parseFloat(item.open),
      high: parseFloat(item.high),
      low: parseFloat(item.low),
      close: parseFloat(item.close),
      volume: parseFloat(item.volume) || 0
    })) || [];
    
  } catch (e) {
    console.error("Erro na API:", e);
    
    // Alternar para próxima chave após 2 erros
    if (++errorCount >= 2) {
      currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
      errorCount = 0;
      console.warn(`Alternando para API key: ${currentKeyIndex}`);
    }
    
    throw new Error("Falha na conexão com dados de mercado");
  }
}

// =============================================
// CONTROLE DE TEMPO (PRECISO)
// =============================================
function sincronizarTimer() {
  clearInterval(state.intervaloAtual);
  
  const agora = new Date();
  state.timer = 60 - agora.getSeconds();
  
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
// INICIALIZAÇÃO DO APLICATIVO
// =============================================
function iniciarAplicativo() {
  // Configurar interface do usuário
  document.body.innerHTML = `
    <div id="trading-bot" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 800px; margin: 20px auto; padding: 25px; background: #1e1f29; border-radius: 15px; color: #f5f6fa; box-shadow: 0 8px 32px rgba(0,0,0,0.3);">
      <h1 style="text-align: center; color: #6c5ce7; margin-bottom: 30px; font-size: 28px;">
        <i class="fab fa-bitcoin"></i> Robô de Trading CRYPTO
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
          <i class="fas fa-chart-line"></i> Indicadores Técnicos
        </h3>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
          <div style="background: #3a3b4a; padding: 15px; border-radius: 8px;">
            <h4 style="margin-top: 0; margin-bottom: 10px; color: #a29bfe;">Últimos Sinais</h4>
            <ul id="ultimos" style="list-style: none; padding: 0; margin: 0;"></ul>
          </div>
          
          <div style="background: #3a3b4a; padding: 15px; border-radius: 8px;">
            <h4 style="margin-top: 0; margin-bottom: 10px; color: #a29bfe;">Critérios</h4>
            <ul id="criterios" style="list-style: none; padding: 0; margin: 0;"></ul>
          </div>
        </div>
      </div>
      
      <div style="text-align: center; font-size: 14px; opacity: 0.7; padding-top: 15px; border-top: 1px solid #3a3b4a;">
        Sistema de Trading Automatizado | Atualizado: <span id="ultima-atualizacao">${new Date().toLocaleTimeString()}</span>
      </div>
    </div>
  `;
  
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
      animation: pulseCall 2s infinite;
    }
    .put { 
      background: linear-gradient(135deg, #ff7675, #d63031) !important; 
      color: white !important;
      box-shadow: 0 4px 20px rgba(255, 118, 117, 0.3);
      animation: pulsePut 2s infinite;
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
    @keyframes pulseCall {
      0% { box-shadow: 0 0 0 0 rgba(0, 184, 148, 0.5); }
      70% { box-shadow: 0 0 0 10px rgba(0, 184, 148, 0); }
      100% { box-shadow: 0 0 0 0 rgba(0, 184, 148, 0); }
    }
    @keyframes pulsePut {
      0% { box-shadow: 0 0 0 0 rgba(255, 118, 117, 0.5); }
      70% { box-shadow: 0 0 0 10px rgba(255, 118, 117, 0); }
      100% { box-shadow: 0 0 0 0 rgba(255, 118, 117, 0); }
    }
  `;
  document.head.appendChild(style);

  // Iniciar processos
  atualizarRelogio();
  setInterval(atualizarRelogio, 1000);
  sincronizarTimer();
  
  // Primeira análise
  setTimeout(analisarMercado, 1500);
}

// Inicialização
if (document.readyState === "complete") iniciarAplicativo();
else document.addEventListener("DOMContentLoaded", iniciarAplicativo);
