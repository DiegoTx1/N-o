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
  mercadoAberto: true,
  ultimoMinutoProcessado: -1
};

const CONFIG = {
  API_KEY: "0105e6681b894e0185704171c53f5075",
  API_ENDPOINT: "https://twelvedata.p.rapidapi.com",
  HEADERS: {
    "X-RapidAPI-Key": "0105e6681b894e0185704171c53f5075",
    "X-RapidAPI-Host": "twelvedata.p.rapidapi.com"
  },
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
  const horaElement = document.getElementById("hora");
  if (horaElement) horaElement.textContent = state.ultimaAtualizacao;
}

function verificarVelaNova(dados) {
  if (!dados || dados.length === 0) return false;
  const agora = new Date();
  const minutoAtual = agora.getUTCMinutes();
  const ultimaVela = dados[dados.length - 1];
  const velaTime = new Date(ultimaVela.time + " UTC");
  const minutoVela = velaTime.getUTCMinutes();
  return minutoVela === minutoAtual || minutoVela === (minutoAtual - 1 + 60) % 60;
}

const calcularMedia = {
  simples: (dados, periodo) => {
    const slice = dados.slice(-periodo);
    return slice.reduce((a, b) => a + b, 0) / slice.length || 0;
  },
  exponencial: (dados, periodo) => {
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
  let gains = 0, losses = 0;
  for (let i = closes.length - periodo - 1; i < closes.length - 1; i++) {
    const diff = closes[i + 1] - closes[i];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / periodo;
  const avgLoss = losses / periodo || 0.0001;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calcularStochastic(highs, lows, closes, periodo = CONFIG.PERIODOS.STOCH) {
  const kValues = [];
  for (let i = periodo - 1; i < closes.length; i++) {
    const high = Math.max(...highs.slice(i - periodo + 1, i + 1));
    const low = Math.min(...lows.slice(i - periodo + 1, i + 1));
    const close = closes[i];
    const range = high - low || 1;
    kValues.push(((close - low) / range) * 100);
  }
  const d = calcularMedia.simples(kValues.slice(-3), 3);
  return { k: kValues[kValues.length - 1], d };
}

function calcularMACD(closes) {
  const emaRapida = calcularMedia.exponencial(closes, CONFIG.PERIODOS.MACD_RAPIDA);
  const emaLenta = calcularMedia.exponencial(closes, CONFIG.PERIODOS.MACD_LENTA);
  const macdLine = emaRapida.map((v, i) => v - emaLenta[i] || 0);
  const signalLine = calcularMedia.exponencial(macdLine, CONFIG.PERIODOS.MACD_SINAL);
  const histograma = macdLine[macdLine.length - 1] - signalLine[signalLine.length - 1];
  return {
    histograma,
    macdLinha: macdLine[macdLine.length - 1],
    sinalLinha: signalLine[signalLine.length - 1]
  };
}

function calcularATR(dados, periodo = CONFIG.PERIODOS.ATR) {
  const trs = [];
  for (let i = 1; i < dados.length; i++) {
    const atual = dados[i];
    const anterior = dados[i - 1];
    const tr = Math.max(
      atual.high - atual.low,
      Math.abs(atual.high - anterior.close),
      Math.abs(atual.low - anterior.close)
    );
    trs.push(tr);
  }
  return calcularMedia.simples(trs.slice(-periodo), periodo);
}

function calcularSuperTrend(dados, periodo = CONFIG.PERIODOS.SUPERTREND, multiplicador = 3) {
  const atr = calcularATR(dados, periodo);
  const ultimo = dados[dados.length - 1];
  const hl2 = (ultimo.high + ultimo.low) / 2;
  const upper = hl2 + (multiplicador * atr);
  const lower = hl2 - (multiplicador * atr);
  const direcao = ultimo.close > upper ? 1 : (ultimo.close < lower ? -1 : 0);
  return { direcao, valor: direcao === 0 ? hl2 : (direcao > 0 ? upper : lower) };
}

function avaliarTendencia(closes, highs, lows, volumes) {
  const ema5 = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_CURTA).pop();
  const ema13 = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_MEDIA).pop();
  const ema50 = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_LONGA).pop();
  let direcao = "NEUTRA";
  if (ema5 > ema13 && ema13 > ema50) direcao = "ALTA";
  else if (ema5 < ema13 && ema13 < ema50) direcao = "BAIXA";
  const atr = calcularATR(closes.map((v, i) => ({
    high: highs[i], low: lows[i], close: closes[i]
  })), 14);
  const distancia = Math.abs(ema5 - ema13);
  let forca = Math.min(100, Math.round((distancia / atr) * 50));
  const volumeAtual = volumes[volumes.length - 1];
  const volumeMedio = calcularMedia.simples(volumes, CONFIG.PERIODOS.SMA_VOLUME);
  if (volumeAtual > volumeMedio * CONFIG.LIMIARES.VOLUME_ALTO) forca += 20;
  return { tendencia: direcao, forca };
}

function gerarSinal(indicadores) {
  const { rsi, macd, close, emaCurta, emaMedia, volume, volumeMedia, superTrend, tendencia } = indicadores;
  let callScore = 0, putScore = 0;
  if (tendencia.tendencia.includes("ALTA")) callScore++;
  if (close > emaCurta && close > emaMedia) callScore += 2;
  if (macd.histograma > 0 && macd.macdLinha > 0) callScore++;
  if (rsi < 40) callScore++;
  if (volume > volumeMedia) callScore++;
  if (superTrend.direcao > 0) callScore++;

  if (tendencia.tendencia.includes("BAIXA")) putScore++;
  if (close < emaCurta && close < emaMedia) putScore += 2;
  if (macd.histograma < 0 && macd.macdLinha < 0) putScore++;
  if (rsi > 60) putScore++;
  if (volume > volumeMedia) putScore++;
  if (superTrend.direcao < 0) putScore++;

  if (callScore >= 1 && callScore >= putScore) return "CALL";
  if (putScore >= 1 && putScore >= callScore) return "PUT";
  return "ESPERAR";
}

async function obterDadosTwelveData() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${CONFIG.API_ENDPOINT}/time_series?symbol=${CONFIG.PARES.FOREX}&interval=1min&outputsize=100`, {
      headers: CONFIG.HEADERS,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    const data = await response.json();
    if (!data.values || !Array.isArray(data.values)) return [];
    return data.values.map(item => ({
      time: item.datetime,
      open: parseFloat(item.open),
      high: parseFloat(item.high),
      low: parseFloat(item.low),
      close: parseFloat(item.close),
      volume: parseFloat(item.volume || 1)
    })).reverse();
  } catch (error) {
    clearTimeout(timeoutId);
    console.error("Erro na API:", error);
    state.tentativasErro++;
    if (state.tentativasErro > 3) setTimeout(() => location.reload(), 10000);
    return [];
  }
}

async function analisarMercado() {
  if (!state.mercadoAberto || state.leituraEmAndamento) return;
  state.leituraEmAndamento = true;
  try {
    const dados = await obterDadosTwelveData();
    if (!dados.length || !verificarVelaNova(dados)) {
      state.leituraEmAndamento = false;
      return;
    }

    const velaAtual = dados[dados.length - 1];
    const closes = dados.map(v => v.close);
    const highs = dados.map(v => v.high);
    const lows = dados.map(v => v.low);
    const volumes = dados.map(v => v.volume);

    const rsi = calcularRSI(closes);
    const macd = calcularMACD(closes);
    const superTrend = calcularSuperTrend(dados);
    const tendencia = avaliarTendencia(closes, highs, lows, volumes);
    const emaCurta = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_CURTA).pop();
    const emaMedia = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_MEDIA).pop();
    const volumeMedia = calcularMedia.simples(volumes, CONFIG.PERIODOS.SMA_VOLUME);

    const indicadores = { rsi, macd, close: velaAtual.close, emaCurta, emaMedia, volume: velaAtual.volume, volumeMedia, superTrend, tendencia };
    const sinal = gerarSinal(indicadores);
    const score = sinal === "ESPERAR" ? 0 : Math.min(100, 60 + (tendencia.forca * 0.3) + (Math.abs(macd.histograma) * 10000) + (velaAtual.volume > volumeMedia * CONFIG.LIMIARES.VOLUME_ALTO ? 15 : 0));

    state.ultimoMinutoProcessado = new Date().getMinutes();
    state.ultimoSinal = sinal;
    state.ultimoScore = score;

    const comandoElement = document.getElementById("comando");
    const scoreElement = document.getElementById("score");
    const timerElement = document.getElementById("timer");
    const horaElement = document.getElementById("hora");

    if (comandoElement) {
      comandoElement.textContent = sinal;
      comandoElement.className = sinal.toLowerCase();
    }
    if (scoreElement) {
      scoreElement.textContent = `Confiança: ${score}%`;
      scoreElement.style.color = score >= CONFIG.LIMIARES.SCORE_ALTO ? '#00FF00' :
                                  score >= CONFIG.LIMIARES.SCORE_MEDIO ? '#FFFF00' : '#FF0000';
    }
    if (timerElement) {
      timerElement.textContent = formatarTimer(state.timer);
    }
    if (horaElement) {
      horaElement.textContent = state.ultimaAtualizacao;
    }
  } catch (error) {
    console.error("Erro na análise:", error);
  } finally {
    state.leituraEmAndamento = false;
  }
}

function gerenciarTimer() {
  const agora = new Date();
  const segundos = agora.getSeconds();
  state.timer = 60 - segundos;
  if (state.timer <= 0) state.timer = 60;
  const timerElement = document.getElementById("timer");
  if (timerElement) {
    timerElement.textContent = formatarTimer(state.timer);
    timerElement.style.color = state.timer <= 10 ? '#FF0000' : '#00FF00';
  }
  if (state.timer >= 58 && !state.leituraEmAndamento) {
    analisarMercado();
  }
}

function verificarDependencias() {
  const elementos = ['comando', 'score', 'hora', 'timer'];
  const faltando = elementos.filter(id => !document.getElementById(id));
  if (faltando.length > 0) {
    console.error("Elementos faltando:", faltando);
    return false;
  }
  return true;
}

function iniciarAplicativo() {
  if (!verificarDependencias()) return;
  setInterval(atualizarRelogio, 1000);
  setInterval(gerenciarTimer, 1000);
  setTimeout(() => analisarMercado(), 1500);
  setInterval(() => {
    console.log("Status:", {
      sinal: state.ultimoSinal,
      score: state.ultimoScore,
      erros: state.tentativasErro
    });
  }, 30000);
}

if (document.readyState === "complete") iniciarAplicativo();
else document.addEventListener("DOMContentLoaded", iniciarAplicativo);
