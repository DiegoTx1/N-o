// =============================================
// CONFIGURAÇÕES GLOBAIS PARA EURUSD M1
// =============================================
const state = {
  ultimosSinais: [],
  timer: 60,
  ultimaAtualizacao: "",
  leituraEmAndamento: false,
  intervaloAtual: null,
  tentativasErro: 0,
  ultimoSinal: null,
  ultimoScore: 0,
  tendenciaAtual: "NEUTRA",
  forcaTendencia: 0,
  ultimaVelaProcessada: null,
  mercadoAberto: true
};

const CONFIG = {
  API_KEY: "9cf795b2a4f14d43a049ca935d174ebb",
  API_ENDPOINT: "https://api.twelvedata.com/time_series",
  PARES: {
    FOREX: "EUR/USD"
  },
  PERIODOS: {
    RSI: 10,
    STOCH: 10,
    EMA_CURTA: 5,
    EMA_MEDIA: 13,
    EMA_LONGA: 50,
    SMA_VOLUME: 20,
    MACD_RAPIDA: 6,
    MACD_LENTA: 13,
    MACD_SINAL: 5,
    ATR: 7,
    SUPERTREND: 7
  },
  LIMIARES: {
    SCORE_ALTO: 85,
    SCORE_MEDIO: 70,
    RSI_OVERBOUGHT: 68,
    RSI_OVERSOLD: 32,
    STOCH_OVERBOUGHT: 80,
    STOCH_OVERSOLD: 20,
    VOLUME_ALTO: 1.5,
    ATR_LIMIAR: 0.005
  }
};

// =============================================
// FUNÇÕES UTILITÁRIAS
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
  document.getElementById("hora").textContent = state.ultimaAtualizacao;
}

function verificarVelaNova(dados) {
  if (!dados || dados.length === 0) return false;
  const ultimaVela = dados[dados.length - 1];
  if (ultimaVela.time !== state.ultimaVelaProcessada) {
    state.ultimaVelaProcessada = ultimaVela.time;
    return true;
  }
  return false;
}

// =============================================
// CÁLCULO DE INDICADORES
// =============================================
const calcularMedia = {
  simples: (dados, periodo) => {
    if (!Array.isArray(dados) return 0;
    const slice = dados.slice(-periodo);
    return slice.reduce((a, b) => a + b, 0) / periodo;
  },
  exponencial: (dados, periodo) => {
    if (!Array.isArray(dados)) return [];
    const k = 2 / (periodo + 1);
    let ema = calcularMedia.simples(dados.slice(0, periodo), periodo);
    return dados.reduce((acc, val) => {
      ema = val * k + ema * (1 - k);
      acc.push(ema);
      return acc;
    }, []);
  }
};

function calcularRSI(closes, periodo = CONFIG.PERIODOS.RSI) {
  if (closes.length < periodo + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = 1; i <= periodo; i++) {
    const diff = closes[i] - closes[i - 1];
    diff > 0 ? gains += diff : losses += Math.abs(diff);
  }
  const avgGain = gains / periodo;
  const avgLoss = Math.max(losses / periodo, 0.000001);
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calcularStochastic(highs, lows, closes, periodo = CONFIG.PERIODOS.STOCH) {
  const kValues = [];
  for (let i = periodo - 1; i < closes.length; i++) {
    const sliceHigh = highs.slice(i - periodo + 1, i + 1);
    const sliceLow = lows.slice(i - periodo + 1, i + 1);
    const highest = Math.max(...sliceHigh);
    const lowest = Math.min(...sliceLow);
    const range = highest - lowest;
    kValues.push(range > 0 ? ((closes[i] - lowest) / range) * 100 : 50);
  }
  return {
    k: kValues[kValues.length - 1] || 50,
    d: calcularMedia.simples(kValues.slice(-3), 3) || 50
  };
}

function calcularMACD(closes, rapida = CONFIG.PERIODOS.MACD_RAPIDA, 
                     lenta = CONFIG.PERIODOS.MACD_LENTA, 
                     sinal = CONFIG.PERIODOS.MACD_SINAL) {
  const emaRapida = calcularMedia.exponencial(closes, rapida);
  const emaLenta = calcularMedia.exponencial(closes, lenta);
  const macdLine = emaRapida.map((val, idx) => val - emaLenta[idx]);
  const signalLine = calcularMedia.exponencial(macdLine.slice(-30), sinal);
  return {
    histograma: macdLine[macdLine.length - 1] - signalLine[signalLine.length - 1],
    macdLinha: macdLine[macdLine.length - 1],
    sinalLinha: signalLine[signalLine.length - 1]
  };
}

function calcularATR(dados, periodo = CONFIG.PERIODOS.ATR) {
  const trValues = [];
  for (let i = 1; i < dados.length; i++) {
    const tr = Math.max(
      dados[i].high - dados[i].low,
      Math.abs(dados[i].high - dados[i - 1].close),
      Math.abs(dados[i].low - dados[i - 1].close)
    );
    trValues.push(tr);
  }
  return calcularMedia.simples(trValues.slice(-periodo), periodo);
}

function calcularSuperTrend(dados, periodo = CONFIG.PERIODOS.SUPERTREND, multiplicador = 3) {
  const atr = calcularATR(dados, periodo);
  const ultimo = dados[dados.length - 1];
  const hl2 = (ultimo.high + ultimo.low) / 2;
  const upper = hl2 + (multiplicador * atr);
  const lower = hl2 - (multiplicador * atr);
  let direcao = 1;
  let valor = upper;
  
  if (dados.length > periodo) {
    const prev = dados[dados.length - 2];
    if (prev.close > valor) {
      direcao = 1;
      valor = Math.min(upper, prev.superTrend || upper);
    } else {
      direcao = -1;
      valor = Math.max(lower, prev.superTrend || lower);
    }
  }
  return { direcao, valor };
}

// =============================================
// SISTEMA DE TENDÊNCIA
// =============================================
function avaliarTendencia(closes, highs, lows, volumes) {
  const ema5 = calcularMedia.exponencial(closes, 5).pop();
  const ema13 = calcularMedia.exponencial(closes, 13).pop();
  const ema50 = calcularMedia.exponencial(closes, 50).pop();
  
  // Direção primária
  let direcao = "NEUTRA";
  if (ema5 > ema13 && ema13 > ema50) direcao = "ALTA";
  if (ema5 < ema13 && ema13 < ema50) direcao = "BAIXA";
  
  // Cálculo de força
  const atr = calcularATR(closes.map((c, i) => ({
    high: highs[i], low: lows[i], close: c
  })), 14);
  
  const distancia = Math.abs(ema5 - ema13);
  let forca = Math.min(100, Math.round((distancia / (atr || 0.0001)) * 50));
  
  // Confirmação de volume
  const volumeAtual = volumes[volumes.length - 1];
  const volumeMedio = calcularMedia.simples(volumes.slice(-20), 20);
  if (volumeAtual > volumeMedio * 1.5) forca = Math.min(100, forca + 20);
  
  // Classificação final
  if (forca >= 70) return { tendencia: `FORTE_${direcao}`, forca };
  if (forca >= 40) return { tendencia: direcao, forca };
  return { tendencia: "NEUTRA", forca: 0 };
}

// =============================================
// GERADOR DE SINAIS
// =============================================
function gerarSinal(indicadores) {
  const { rsi, stoch, macd, close, emaCurta, emaMedia, volume, volumeMedia, superTrend, tendencia } = indicadores;
  
  // Bloqueio durante notícias
  if (state.ultimoScore > 85 && Date.now() - state.ultimaAtualizacao < 30000) {
    return "ESPERAR";
  }
  
  // Sistema de pontuação
  let callScore = 0, putScore = 0;
  
  // Regras para CALL
  if (tendencia.tendencia.includes("ALTA")) callScore += 2;
  if (close > emaCurta) callScore += 1;
  if (macd.histograma > 0) callScore += 1;
  if (rsi < CONFIG.LIMIARES.RSI_OVERSOLD) callScore += 1;
  if (volume > volumeMedia * 1.3) callScore += 1;
  if (superTrend.direcao > 0) callScore += 1;
  
  // Regras para PUT
  if (tendencia.tendencia.includes("BAIXA")) putScore += 2;
  if (close < emaCurta) putScore += 1;
  if (macd.histograma < 0) putScore += 1;
  if (rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT) putScore += 1;
  if (volume > volumeMedia * 1.3) putScore += 1;
  if (superTrend.direcao < 0) putScore += 1;
  
  // Determinar sinal
  if (callScore >= 4 && callScore > putScore) return "CALL";
  if (putScore >= 4 && putScore > callScore) return "PUT";
  
  return "ESPERAR";
}

// =============================================
// CORE DO SISTEMA
// =============================================
async function obterDadosTwelveData() {
  try {
    const response = await fetch(
      `${CONFIG.API_ENDPOINT}?symbol=${CONFIG.PARES.FOREX}&interval=1min&apikey=${CONFIG.API_KEY}&outputsize=100`
    );
    const data = await response.json();
    return data.values?.map(v => ({
      time: v.datetime,
      open: parseFloat(v.open),
      high: parseFloat(v.high),
      low: parseFloat(v.low),
      close: parseFloat(v.close),
      volume: parseFloat(v.volume || 1)
    })).reverse() || [];
  } catch (error) {
    console.error("Erro na API:", error);
    return [];
  }
}

async function analisarMercado() {
  if (state.leituraEmAndamento || !state.mercadoAberto) return;
  state.leituraEmAndamento = true;
  
  try {
    const dados = await obterDadosTwelveData();
    if (!verificarVelaNova(dados)) {
      state.leituraEmAndamento = false;
      return;
    }
    
    const velaAtual = dados[dados.length - 1];
    const closes = dados.map(v => v.close);
    const highs = dados.map(v => v.high);
    const lows = dados.map(v => v.low);
    const volumes = dados.map(v => v.volume);
    
    // Calcular indicadores
    const rsi = calcularRSI(closes);
    const stoch = calcularStochastic(highs, lows, closes);
    const macd = calcularMACD(closes);
    const superTrend = calcularSuperTrend(dados);
    const tendencia = avaliarTendencia(closes, highs, lows, volumes);
    
    // Gerar sinal
    const indicadores = {
      rsi, stoch, macd,
      close: velaAtual.close,
      emaCurta: calcularMedia.exponencial(closes, 5).pop(),
      emaMedia: calcularMedia.exponencial(closes, 13).pop(),
      volume: velaAtual.volume,
      volumeMedia: calcularMedia.simples(volumes.slice(-20), 20),
      superTrend,
      tendencia
    };
    
    const sinal = gerarSinal(indicadores);
    const score = sinal === "ESPERAR" ? 0 : Math.min(100, 60 +
      (tendencia.forca * 0.3) +
      (Math.abs(macd.histograma) * 10000) +
      (volume > volumeMedia * 1.5 ? 15 : 0));
    
    // Atualizar estado
    state.ultimoSinal = sinal;
    state.ultimoScore = score;
    state.tendenciaAtual = tendencia.tendencia;
    state.forcaTendencia = tendencia.forca;
    
    // Atualizar interface
    document.getElementById("comando").textContent = sinal;
    document.getElementById("score").textContent = `Confiança: ${score}%`;
    
  } catch (error) {
    console.error("Erro na análise:", error);
    state.tentativasErro++;
    if (state.tentativasErro > 3) {
      setTimeout(() => location.reload(), 10000);
    }
  } finally {
    state.leituraEmAndamento = false;
  }
}

// =============================================
// CONTROLE DE TEMPO
// =============================================
function sincronizarTimer() {
  clearInterval(state.intervaloAtual);
  const agora = Date.now();
  const delay = 60000 - (agora % 60000);
  state.timer = Math.max(1, Math.floor(delay / 1000));
  
  const timerElement = document.getElementById("timer");
  if (timerElement) {
    timerElement.textContent = formatarTimer(state.timer);
    timerElement.style.color = state.timer <= 5 ? 'red' : '';
  }
  
  state.intervaloAtual = setInterval(() => {
    state.timer--;
    if (timerElement) {
      timerElement.textContent = formatarTimer(state.timer);
      timerElement.style.color = state.timer <= 5 ? 'red' : '';
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
  if (!document.getElementById("comando") || 
      !document.getElementById("score")) {
    console.error("Elementos da interface não encontrados!");
    return;
  }
  
  setInterval(atualizarRelogio, 1000);
  sincronizarTimer();
  setTimeout(analisarMercado, 2000);
  
  console.log("Sistema iniciado com sucesso!");
}

document.addEventListener("DOMContentLoaded", iniciarAplicativo);
