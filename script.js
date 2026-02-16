// =============================================
// CONFIGURAÇÃO ESTÁVEL - SCALP BCH 1MIN
// =============================================
const state = {
  timer: 60,
  leituraEmAndamento: false,
  intervaloAtual: null,
  ultimoSinal: "ESPERAR",
  ultimoScore: 0,
  ultimos: [],
  ultimaAtualizacao: ""
};

const CONFIG = {
  API: "https://api.twelvedata.com",
  PAR: "BCH/USD",
  EMA: 9,
  VWAP: 20,
  VOLUME: 20,
  ROMPIMENTO_LOOKBACK: 6
};

const API_KEYS = [
  "0105e6681b894e0185704171c53f5075",
  "b9d6a5d8a4a24a8f8d6f7d8c6f8d7a5d"
];

let currentKeyIndex = 0;

// =============================================
// UTILIDADES
// =============================================
function media(arr, p) {
  if (arr.length < p) return null;
  const s = arr.slice(-p);
  return s.reduce((a, b) => a + b, 0) / p;
}

function calcularEMA(dados, periodo) {
  if (dados.length < periodo) return null;
  const k = 2 / (periodo + 1);
  let ema = media(dados.slice(0, periodo), periodo);
  for (let i = periodo; i < dados.length; i++) {
    ema = dados[i] * k + ema * (1 - k);
  }
  return ema;
}

function calcularVWAP(dados) {
  const slice = dados.slice(-CONFIG.VWAP);
  let tpv = 0, vol = 0;
  slice.forEach(v => {
    const tp = (v.high + v.low + v.close) / 3;
    tpv += tp * v.volume;
    vol += v.volume;
  });
  return tpv / vol;
}

function volumeRelativo(volumes) {
  const m = media(volumes, CONFIG.VOLUME);
  return volumes[volumes.length - 1] / m;
}

function forcaVela(v) {
  const corpo = Math.abs(v.close - v.open);
  const range = v.high - v.low;
  return range === 0 ? 0 : corpo / range;
}

function rompeMaxima(dados) {
  const slice = dados.slice(-CONFIG.ROMPIMENTO_LOOKBACK - 1, -1);
  const max = Math.max(...slice.map(v => v.high));
  return dados[dados.length - 1].close > max;
}

function rompeMinima(dados) {
  const slice = dados.slice(-CONFIG.ROMPIMENTO_LOOKBACK - 1, -1);
  const min = Math.min(...slice.map(v => v.low));
  return dados[dados.length - 1].close < min;
}

// =============================================
// GERADOR DE SINAL CONFIÁVEL
// =============================================
function gerarSinal(dados) {
  const vela = dados[dados.length - 1];
  const closes = dados.map(v => v.close);
  const volumes = dados.map(v => v.volume);

  const ema = calcularEMA(closes, CONFIG.EMA);
  const vwap = calcularVWAP(dados);
  const volRel = volumeRelativo(volumes);
  const força = forcaVela(vela);

  let score = 0;

  const tendenciaAlta = vela.close > ema && vela.close > vwap;
  const tendenciaBaixa = vela.close < ema && vela.close < vwap;

  if (volRel > 1) score += 25;
  if (força > 0.55) score += 25;

  // ROMPIMENTO REAL
  if (rompeMaxima(dados) && tendenciaAlta) {
    score += 50;
    return { sinal: "CALL", score };
  }

  if (rompeMinima(dados) && tendenciaBaixa) {
    score += 50;
    return { sinal: "PUT", score };
  }

  // MOMENTUM SEM ROMPIMENTO
  if (tendenciaAlta && força > 0.7 && volRel > 1.1) {
    return { sinal: "CALL", score: 70 };
  }

  if (tendenciaBaixa && força > 0.7 && volRel > 1.1) {
    return { sinal: "PUT", score: 70 };
  }

  return { sinal: "ESPERAR", score: score };
}

// =============================================
// API
// =============================================
async function obterDados() {
  const apiKey = API_KEYS[currentKeyIndex];

  const url = `${CONFIG.API}/time_series?symbol=${CONFIG.PAR}&interval=1min&outputsize=50&apikey=${apiKey}`;

  const res = await fetch(url);

  if (!res.ok) {
    currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
    throw new Error("API falhou");
  }

  const data = await res.json();

  return data.values.reverse().map(v => ({
    open: +v.open,
    high: +v.high,
    low: +v.low,
    close: +v.close,
    volume: +v.volume || 1
  }));
}

// =============================================
// ANÁLISE
// =============================================
async function analisarMercado() {
  if (state.leituraEmAndamento) return;
  state.leituraEmAndamento = true;

  try {
    const dados = await obterDados();
    const r = gerarSinal(dados);

    state.ultimoSinal = r.sinal;
    state.ultimoScore = r.score;
    state.ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR");

    atualizarInterface(r.sinal, r.score);

    state.ultimos.unshift(`${state.ultimaAtualizacao} - ${r.sinal} (${r.score}%)`);
    if (state.ultimos.length > 6) state.ultimos.pop();

  } catch (e) {
    atualizarInterface("ERRO", 0);
  } finally {
    state.leituraEmAndamento = false;
  }
}

// =============================================
// UI
// =============================================
function atualizarInterface(sinal, score) {
  const cmd = document.getElementById("comando");
  if (cmd) {
    cmd.textContent = sinal;
    cmd.className = sinal.toLowerCase();
  }

  const sc = document.getElementById("score");
  if (sc) sc.textContent = `Confiança: ${score}%`;
}

// =============================================
// TIMER
// =============================================
function sincronizarTimer() {
  clearInterval(state.intervaloAtual);
  const agora = new Date();
  state.timer = 60 - agora.getSeconds();

  const el = document.getElementById("timer");

  state.intervaloAtual = setInterval(() => {
    state.timer--;
    if (el) el.textContent = `0:${String(state.timer).padStart(2,'0')}`;

    if (state.timer <= 0) {
      clearInterval(state.intervaloAtual);
      analisarMercado();
      sincronizarTimer();
    }
  }, 1000);
}

function iniciar() {
  setInterval(() => {
    const el = document.getElementById("hora");
    if (el) el.textContent = new Date().toLocaleTimeString("pt-BR");
  }, 1000);

  sincronizarTimer();
  setTimeout(analisarMercado, 1500);
}

if (document.readyState === "complete") iniciar();
else document.addEventListener("DOMContentLoaded", iniciar);
