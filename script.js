// =============================================
// CONFIGURAÇÕES GLOBAIS (EUR/USD - M1 - TWELVE DATA)
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
  websocket: null,
  marketOpen: true,
  tendenciaDetectada: "NEUTRA",
  forcaTendencia: 0,
  suporteKey: 0,
  resistenciaKey: 0
};

const CONFIG = {
  API_KEY: "9cf795b2a4f14d43a049ca935d174ebb",
  API_ENDPOINT: "https://api.twelvedata.com/time_series",
  PAR: "EUR/USD",
  INTERVALO: "1min",
  LIMIT: 100,
  PERIODOS: {
    RSI: 14,
    EMA_CURTA: 8,
    EMA_MEDIA: 21,
    EMA_LONGA: 200,
    STOCH: 14,
    WILLIAMS: 14,
    SMA_VOLUME: 20,
    MACD_RAPIDA: 15,
    MACD_LENTA: 30,
    MACD_SINAL: 9
  },
  LIMIARES: {
    SCORE_ALTO: 85,
    SCORE_MEDIO: 65,
    RSI_OVERBOUGHT: 68,
    RSI_OVERSOLD: 32
  }
};

// =============================================
// UTILITÁRIOS
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
  }
}

// =============================================
// INDICADORES
// =============================================
function mediaSimples(dados, periodo) {
  if (!dados || dados.length < periodo) return 0;
  return dados.slice(-periodo).reduce((a, b) => a + b, 0) / periodo;
}

function mediaExponencial(dados, periodo) {
  const k = 2 / (periodo + 1);
  let ema = mediaSimples(dados.slice(0, periodo), periodo);
  const resultado = [ema];
  for (let i = periodo; i < dados.length; i++) {
    ema = dados[i] * k + ema * (1 - k);
    resultado.push(ema);
  }
  return resultado;
}

function calcularRSI(closes, periodo = CONFIG.PERIODOS.RSI) {
  let gains = 0, losses = 0;
  for (let i = 1; i <= periodo; i++) {
    const diff = closes[i] - closes[i - 1];
    diff >= 0 ? gains += diff : losses -= diff;
  }
  let avgGain = gains / periodo;
  let avgLoss = losses / periodo;
  for (let i = periodo + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (periodo - 1) + gain) / periodo;
    avgLoss = (avgLoss * (periodo - 1) + loss) / periodo;
  }
  const rs = avgGain / Math.max(avgLoss, 0.0001);
  return 100 - 100 / (1 + rs);
}

function calcularMACD(closes) {
  const emaRapida = mediaExponencial(closes, CONFIG.PERIODOS.MACD_RAPIDA);
  const emaLenta = mediaExponencial(closes, CONFIG.PERIODOS.MACD_LENTA);
  const macd = emaRapida.slice(-emaLenta.length).map((val, i) => val - emaLenta[i]);
  const sinal = mediaExponencial(macd, CONFIG.PERIODOS.MACD_SINAL);
  const histograma = macd[macd.length - 1] - sinal[sinal.length - 1];
  return { histograma };
}

// =============================================
// LÓGICA DE ANÁLISE
// =============================================
function avaliarTendencia(close, ema8, ema21, ema200) {
  if (close > ema8 && ema8 > ema21 && close > ema200) return { tendencia: "ALTA", forca: 80 };
  if (close < ema8 && ema8 < ema21 && close < ema200) return { tendencia: "BAIXA", forca: 80 };
  return { tendencia: "NEUTRA", forca: 0 };
}

function gerarSinal(rsi, macd, tendencia) {
  if (tendencia.tendencia === "ALTA" && rsi < CONFIG.LIMIARES.RSI_OVERBOUGHT && macd.histograma > 0) return "CALL";
  if (tendencia.tendencia === "BAIXA" && rsi > CONFIG.LIMIARES.RSI_OVERSOLD && macd.histograma < 0) return "PUT";
  return "ESPERAR";
}

function calcularScore(sinal, tendencia, rsi, macd) {
  let score = 50;
  if (sinal === "CALL" && tendencia.tendencia === "ALTA") score += 20;
  if (sinal === "PUT" && tendencia.tendencia === "BAIXA") score += 20;
  if (Math.abs(macd.histograma) > 0.001) score += 10;
  if ((sinal === "CALL" && rsi > 40) || (sinal === "PUT" && rsi < 60)) score += 5;
  return Math.min(100, score);
}

// =============================================
// OBTENÇÃO DE DADOS (TWELVE DATA)
// =============================================
async function obterDadosEURUSD() {
  const url = `${CONFIG.API_ENDPOINT}?symbol=EUR/USD&interval=${CONFIG.INTERVALO}&outputsize=${CONFIG.LIMIT}&apikey=${CONFIG.API_KEY}&format=JSON`;
  const resp = await fetch(url);
  const json = await resp.json();
  if (!json || !json.values) throw new Error("Erro ao obter dados.");
  return json.values.reverse().map(v => ({
    time: v.datetime,
    close: parseFloat(v.close)
  }));
}

// =============================================
// ANÁLISE PRINCIPAL
// =============================================
async function analisarMercado() {
  if (state.leituraEmAndamento) return;
  state.leituraEmAndamento = true;
  try {
    const dados = await obterDadosEURUSD();
    const closes = dados.map(d => d.close);
    const velaAtual = closes[closes.length - 1];
    const ema8 = mediaExponencial(closes, CONFIG.PERIODOS.EMA_CURTA).pop();
    const ema21 = mediaExponencial(closes, CONFIG.PERIODOS.EMA_MEDIA).pop();
    const ema200 = mediaExponencial(closes, CONFIG.PERIODOS.EMA_LONGA).pop();
    const rsi = calcularRSI(closes);
    const macd = calcularMACD(closes);
    const tendencia = avaliarTendencia(velaAtual, ema8, ema21, ema200);
    const sinal = gerarSinal(rsi, macd, tendencia);
    const score = calcularScore(sinal, tendencia, rsi, macd);
    state.ultimoSinal = sinal;
    state.ultimoScore = score;
    state.tendenciaDetectada = tendencia.tendencia;
    state.forcaTendencia = tendencia.forca;
    atualizarInterface(sinal, score, tendencia.tendencia, tendencia.forca);
  } catch (e) {
    console.error("Erro na análise:", e);
  } finally {
    state.leituraEmAndamento = false;
  }
}

// =============================================
// INTERFACE
// =============================================
function atualizarInterface(sinal, score, tendencia, forca) {
  const c = document.getElementById("comando");
  const s = document.getElementById("score");
  const t = document.getElementById("tendencia");
  const f = document.getElementById("forca-tendencia");
  if (c) {
    c.textContent = sinal;
    c.className = sinal.toLowerCase();
    if (sinal === "CALL") c.textContent += " 📈";
    else if (sinal === "PUT") c.textContent += " 📉";
    else c.textContent += " ✋";
  }
  if (s) {
    s.textContent = `Confiança: ${score}%`;
    s.style.color = score >= CONFIG.LIMIARES.SCORE_ALTO ? 'lime' :
                    score >= CONFIG.LIMIARES.SCORE_MEDIO ? 'yellow' : 'red';
  }
  if (t) t.textContent = tendencia;
  if (f) f.textContent = `${forca}%`;
}

// =============================================
// TIMER SINCRONIZADO COM M1
// =============================================
function sincronizarTimer() {
  clearInterval(state.intervaloAtual);
  const agora = Date.now();
  const delayProximaVela = 60000 - (agora % 60000);
  state.timer = Math.floor(delayProximaVela / 1000);
  const timerEl = document.getElementById("timer");
  if (timerEl) timerEl.textContent = formatarTimer(state.timer);
  setTimeout(() => {
    analisarMercado();
    state.intervaloAtual = setInterval(() => {
      analisarMercado();
      state.timer = 60;
    }, 60000);
  }, delayProximaVela);
}

// =============================================
// INICIALIZAÇÃO
// =============================================
function iniciarAplicativo() {
  atualizarRelogio();
  setInterval(atualizarRelogio, 1000);
  sincronizarTimer();
  analisarMercado();
}

if (document.readyState === "complete") iniciarAplicativo();
else document.addEventListener("DOMContentLoaded", iniciarAplicativo);
