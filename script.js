// =============================================
// CONFIGURAÇÕES OTIMIZADAS PARA SCALP REAL
// =============================================
const state = {
  ultimos: [],
  timer: 60,
  leituraEmAndamento: false,
  intervaloAtual: null,
  ultimoSinal: null,
  ultimoScore: 0,
  tendenciaDetectada: "NEUTRA",
  forcaTendencia: 0,
  dadosHistoricos: [],
  volumeRelativo: 0,
  vwap: 0,
  ultimaAtualizacao: ""
};

const CONFIG = {
  API_ENDPOINTS: {
    TWELVE_DATA: "https://api.twelvedata.com"
  },
  PARES: {
    CRYPTO_IDX: "BCH/USD"
  },
  PERIODOS: {
    EMA: 9,
    VOLUME_LOOKBACK: 20,
    VWAP: 20
  },
  LIMIARES: {
    MIN_VOLUME: 1.0,
    FORCA_VELA: 0.6
  }
};

const API_KEYS = [
  "0105e6681b894e0185704171c53f5075",
  "b9d6a5d8a4a24a8f8d6f7d8c6f8d7a5d"
];

let currentKeyIndex = 0;

// =============================================
// UTILIDADES
// =============================================
function formatarTimer(segundos) {
  return `0:${segundos.toString().padStart(2, '0')}`;
}

function atualizarRelogio() {
  const elementoHora = document.getElementById("hora");
  if (!elementoHora) return;
  const now = new Date();
  state.ultimaAtualizacao = now.toLocaleTimeString("pt-BR");
  elementoHora.textContent = state.ultimaAtualizacao;
}

function calcularMediaSimples(dados, periodo) {
  if (dados.length < periodo) return null;
  const slice = dados.slice(-periodo);
  return slice.reduce((a, b) => a + b, 0) / periodo;
}

function calcularEMA(dados, periodo) {
  if (dados.length < periodo) return null;
  const k = 2 / (periodo + 1);
  let ema = calcularMediaSimples(dados.slice(0, periodo), periodo);
  for (let i = periodo; i < dados.length; i++) {
    ema = dados[i] * k + ema * (1 - k);
  }
  return ema;
}

function calcularVWAP(dados) {
  const periodo = CONFIG.PERIODOS.VWAP;
  if (dados.length < periodo) return dados[dados.length - 1].close;

  let tpTotal = 0;
  let volumeTotal = 0;

  dados.slice(-periodo).forEach(v => {
    const tp = (v.high + v.low + v.close) / 3;
    tpTotal += tp * v.volume;
    volumeTotal += v.volume;
  });

  return tpTotal / volumeTotal;
}

function calcularVolumeRelativo(volumes) {
  const media = calcularMediaSimples(volumes, CONFIG.PERIODOS.VOLUME_LOOKBACK);
  const atual = volumes[volumes.length - 1];
  return atual / media;
}

function analisarForcaVela(vela) {
  const corpo = Math.abs(vela.close - vela.open);
  const range = vela.high - vela.low;
  if (range === 0) return 0;
  return corpo / range;
}

function fechamentoProximoTopo(vela) {
  return (vela.high - vela.close) < (vela.high - vela.low) * 0.25;
}

function fechamentoProximoFundo(vela) {
  return (vela.close - vela.low) < (vela.high - vela.low) * 0.25;
}

// =============================================
// SISTEMA DE SINAL PROFISSIONAL
// =============================================
function gerarSinal(dados) {
  const vela = dados[dados.length - 1];
  const closes = dados.map(v => v.close);
  const volumes = dados.map(v => v.volume);

  const ema = calcularEMA(closes, CONFIG.PERIODOS.EMA);
  const vwap = calcularVWAP(dados);
  const volumeRelativo = calcularVolumeRelativo(volumes);
  const forcaVela = analisarForcaVela(vela);

  state.volumeRelativo = volumeRelativo;
  state.vwap = vwap;

  if (!ema) return { sinal: "ESPERAR", score: 0 };

  let score = 0;

  const tendenciaAlta = vela.close > ema && vela.close > vwap;
  const tendenciaBaixa = vela.close < ema && vela.close < vwap;

  if (volumeRelativo > CONFIG.LIMIARES.MIN_VOLUME) score += 30;
  if (forcaVela > CONFIG.LIMIARES.FORCA_VELA) score += 30;

  if (tendenciaAlta && fechamentoProximoTopo(vela)) {
    score += 40;
    return { sinal: "CALL", score };
  }

  if (tendenciaBaixa && fechamentoProximoFundo(vela)) {
    score += 40;
    return { sinal: "PUT", score };
  }

  return { sinal: "ESPERAR", score };
}

// =============================================
// API
// =============================================
async function obterDadosTwelveData() {
  const apiKey = API_KEYS[currentKeyIndex];

  const url = `${CONFIG.API_ENDPOINTS.TWELVE_DATA}/time_series?symbol=${CONFIG.PARES.CRYPTO_IDX}&interval=1min&outputsize=50&apikey=${apiKey}`;

  const response = await fetch(url);

  if (!response.ok) {
    currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
    throw new Error("Erro API");
  }

  const data = await response.json();

  return data.values.reverse().map(item => ({
    time: item.datetime,
    open: parseFloat(item.open),
    high: parseFloat(item.high),
    low: parseFloat(item.low),
    close: parseFloat(item.close),
    volume: parseFloat(item.volume) || 1
  }));
}

// =============================================
// ANÁLISE PRINCIPAL
// =============================================
async function analisarMercado() {
  if (state.leituraEmAndamento) return;
  state.leituraEmAndamento = true;

  try {
    const dados = await obterDadosTwelveData();
    state.dadosHistoricos = dados;

    const resultado = gerarSinal(dados);

    state.ultimoSinal = resultado.sinal;
    state.ultimoScore = resultado.score;

    atualizarInterface(resultado.sinal, resultado.score);

    state.ultimos.unshift(`${state.ultimaAtualizacao} - ${resultado.sinal} (${resultado.score}%)`);
    if (state.ultimos.length > 6) state.ultimos.pop();

  } catch (e) {
    atualizarInterface("ERRO", 0);
  } finally {
    state.leituraEmAndamento = false;
  }
}

// =============================================
// INTERFACE
// =============================================
function atualizarInterface(sinal, score) {
  const comandoElement = document.getElementById("comando");
  if (!comandoElement) return;

  comandoElement.textContent = sinal;
  comandoElement.className = sinal.toLowerCase();

  const scoreElement = document.getElementById("score");
  if (scoreElement) scoreElement.textContent = `Confiança: ${score}%`;
}

// =============================================
// TIMER
// =============================================
function sincronizarTimer() {
  clearInterval(state.intervaloAtual);
  const agora = new Date();
  state.timer = 60 - agora.getSeconds();

  const elementoTimer = document.getElementById("timer");

  state.intervaloAtual = setInterval(() => {
    state.timer--;

    if (elementoTimer) elementoTimer.textContent = formatarTimer(state.timer);

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
  setTimeout(analisarMercado, 1000);
}

if (document.readyState === "complete") {
  iniciarAplicativo();
} else {
  document.addEventListener("DOMContentLoaded", iniciarAplicativo);
