// =============================================
// CONFIGURAÇÕES GLOBAIS – EUR/USD + TWELVE DATA
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
  tendenciaDetectada: "NEUTRA",
  forcaTendencia: 0,
  macdValues: [] // Adicionado para armazenar histórico do MACD
};

const CONFIG = {
  API_KEY: process.env.API_KEY || "9cf795b2a4f14d43a049ca935d174ebb", // Modificado para suportar env
  SYMBOL: "EUR/USD",
  INTERVAL: "1min",
  API_URL: "https://api.twelvedata.com/time_series",

  PERIODOS: {
    EMA9: 9,
    EMA20: 20,
    EMA45: 45,
    RSI: 14,
    MACD_RAPIDA: 12,
    MACD_LENTA: 26,
    MACD_SINAL: 9,
    BOLLINGER: 20,
  },

  LIMITES: {
    RSI_OVERBOUGHT: 70,
    RSI_OVERSOLD: 30,
    SCORE_FORTE: 85,
    SCORE_MEDIO: 70,
  },
  MAX_TENTATIVAS_ERRO: 5 // Adicionado limite de tentativas
};

// =============================================
// UTILITÁRIOS
// =============================================
function mediaSimples(dados, periodo) {
  if (!dados || dados.length < periodo) return 0;
  return dados.slice(-periodo).reduce((a, b) => a + b, 0) / periodo;
}

function mediaExponencial(dados, periodo) {
  if (!dados || dados.length < periodo) return 0;
  
  const k = 2 / (periodo + 1);
  let ema = mediaSimples(dados.slice(0, periodo), periodo);
  
  for (let i = periodo; i < dados.length; i++) {
    ema = dados[i] * k + ema * (1 - k);
  }
  return ema;
}

function calcularRSI(closes, periodo = CONFIG.PERIODOS.RSI) {
  if (!closes || closes.length < periodo + 1) return 50;
  
  let gains = 0, losses = 0;
  for (let i = 1; i <= periodo; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }
  
  const avgGain = gains / periodo;
  const avgLoss = losses / periodo || 1e-8;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calcularMACD(closes) {
  if (closes.length < CONFIG.PERIODOS.MACD_LENTA) {
    return { histograma: 0, linha: 0, sinal: 0 };
  }

  const ema12 = mediaExponencial(closes, CONFIG.PERIODOS.MACD_RAPIDA);
  const ema26 = mediaExponencial(closes, CONFIG.PERIODOS.MACD_LENTA);
  const macdLine = ema12 - ema26;
  
  // Atualiza histórico do MACD
  state.macdValues.push(macdLine);
  if (state.macdValues.length > 50) state.macdValues.shift();
  
  // Calcula EMA do MACD (sinal)
  const signalLine = state.macdValues.length >= CONFIG.PERIODOS.MACD_SINAL 
    ? mediaExponencial(state.macdValues, CONFIG.PERIODOS.MACD_SINAL)
    : 0;

  return {
    histograma: macdLine - signalLine,
    linha: macdLine,
    sinal: signalLine
  };
}

function calcularBollinger(closes, periodo = CONFIG.PERIODOS.BOLLINGER) {
  if (closes.length < periodo) {
    return { media: 0, superior: 0, inferior: 0 };
  }
  
  const media = mediaSimples(closes, periodo);
  const variancia = closes.slice(-periodo).reduce((sum, v) => sum + Math.pow(v - media, 2), 0) / periodo;
  const desvio = Math.sqrt(variancia);
  
  return {
    media,
    superior: media + 2 * desvio,
    inferior: media - 2 * desvio
  };
}

function calcularTripleEMA(closes) {
  return {
    ema9: mediaExponencial(closes, CONFIG.PERIODOS.EMA9),
    ema20: mediaExponencial(closes, CONFIG.PERIODOS.EMA20),
    ema45: mediaExponencial(closes, CONFIG.PERIODOS.EMA45)
  };
}

function gerarSinal({ rsi, macd, close, ema9, ema20, ema45, boll }) {
  const condicoesCall = [
    rsi < CONFIG.LIMITES.RSI_OVERSOLD,
    macd.histograma > 0,
    close > ema9 && ema9 > ema20 && ema20 > ema45,
    close < boll.inferior
  ];

  const condicoesPut = [
    rsi > CONFIG.LIMITES.RSI_OVERBOUGHT,
    macd.histograma < 0,
    close < ema9 && ema9 < ema20 && ema20 < ema45,
    close > boll.superior
  ];

  const scoreCall = condicoesCall.filter(Boolean).length * 25;
  const scorePut = condicoesPut.filter(Boolean).length * 25;

  if (scoreCall >= CONFIG.LIMITES.SCORE_FORTE) return { sinal: "CALL", score: scoreCall };
  if (scorePut >= CONFIG.LIMITES.SCORE_FORTE) return { sinal: "PUT", score: scorePut };
  if (scoreCall >= CONFIG.LIMITES.SCORE_MEDIO) return { sinal: "CALL", score: scoreCall };
  if (scorePut >= CONFIG.LIMITES.SCORE_MEDIO) return { sinal: "PUT", score: scorePut };

  return { sinal: "ESPERAR", score: Math.max(scoreCall, scorePut) };
}

// =============================================
// DADOS DA API TWELVE DATA
// =============================================
async function obterDados() {
  if (state.tentativasErro >= CONFIG.MAX_TENTATIVAS_ERRO) {
    console.error("Número máximo de tentativas excedido");
    return [];
  }

  try {
    const url = `${CONFIG.API_URL}?symbol=${CONFIG.SYMBOL}&interval=${CONFIG.INTERVAL}&outputsize=100&apikey=${CONFIG.API_KEY}`;
    const res = await fetch(url);
    
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    
    const json = await res.json();
    
    if (!json?.values?.length) throw new Error("Dados vazios da API");
    
    state.tentativasErro = 0; // Resetar contador de erros
    return json.values.reverse().map(v => ({
      open: parseFloat(v.open),
      high: parseFloat(v.high),
      low: parseFloat(v.low),
      close: parseFloat(v.close),
      datetime: v.datetime
    }));
  } catch (e) {
    state.tentativasErro++;
    console.error("Erro ao obter dados (tentativa", state.tentativasErro, "):", e);
    return [];
  }
}

// =============================================
// ANÁLISE PRINCIPAL
// =============================================
async function analisarMercado() {
  if (state.leituraEmAndamento || state.tentativasErro >= CONFIG.MAX_TENTATIVAS_ERRO) return;
  state.leituraEmAndamento = true;

  try {
    const velas = await obterDados();
    if (velas.length === 0) throw new Error("Sem dados para análise");

    const closes = velas.map(v => v.close);
    const closeAtual = closes[closes.length - 1];

    // Verificação mínima de dados
    if (closes.length < CONFIG.PERIODOS.MACD_LENTA) {
      throw new Error(`Dados insuficientes (${closes.length} candles). Mínimo requerido: ${CONFIG.PERIODOS.MACD_LENTA}`);
    }

    const rsi = calcularRSI(closes);
    const macd = calcularMACD(closes);
    const { ema9, ema20, ema45 } = calcularTripleEMA(closes);
    const boll = calcularBollinger(closes);

    const { sinal, score } = gerarSinal({ 
      rsi, 
      macd, 
      close: closeAtual, 
      ema9, 
      ema20, 
      ema45, 
      boll 
    });

    state.ultimoSinal = sinal;
    state.ultimoScore = score;
    state.ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR");

    atualizarInterface(sinal, score);
    salvarHistorico(sinal, score);
    
    // Atualizar tendência
    if (score >= CONFIG.LIMITES.SCORE_FORTE) {
      state.tendenciaDetectada = sinal;
      state.forcaTendencia = score;
    }

  } catch (e) {
    console.error("Erro na análise:", e);
    atualizarInterface("ERRO", 0);
  } finally {
    state.leituraEmAndamento = false;
  }
}

// =============================================
// INTERFACE E TIMER
// =============================================
function atualizarInterface(sinal, score) {
  const comando = document.getElementById("comando");
  const scoreEl = document.getElementById("score");
  const tendenciaEl = document.getElementById("tendencia");

  if (comando) {
    comando.textContent = sinal === "CALL" ? "CALL 📈" :
                          sinal === "PUT" ? "PUT 📉" :
                          sinal === "ESPERAR" ? "ESPERAR ✋" : "ERRO ❌";
    comando.className = sinal.toLowerCase();
  }

  if (scoreEl) {
    scoreEl.textContent = `Confiança: ${score}%`;
    scoreEl.style.color = score >= CONFIG.LIMITES.SCORE_FORTE ? "lime" :
                          score >= CONFIG.LIMITES.SCORE_MEDIO ? "gold" : "red";
  }

  if (tendenciaEl) {
    tendenciaEl.textContent = `Tendência: ${state.tendenciaDetectada} (${state.forcaTendencia}%)`;
  }
}

function salvarHistorico(sinal, score) {
  const log = `${state.ultimaAtualizacao} - ${sinal} (${score}%)`;
  state.ultimos.unshift(log);
  if (state.ultimos.length > 8) state.ultimos.pop();

  const ultimos = document.getElementById("ultimos");
  if (ultimos) ultimos.innerHTML = state.ultimos.map(t => `<li>${t}</li>`).join("");
}

function sincronizarTimer() {
  clearInterval(state.intervaloAtual);
  const agora = Date.now();
  const delay = 60000 - (agora % 60000);
  state.timer = Math.floor(delay / 1000);

  const timer = document.getElementById("timer");
  if (timer) timer.textContent = `0:${state.timer.toString().padStart(2, '0')}`;

  state.intervaloAtual = setInterval(() => {
    state.timer--;
    if (timer) timer.textContent = `0:${state.timer.toString().padStart(2, '0')}`;
    if (state.timer <= 0) {
      clearInterval(state.intervaloAtual);
      analisarMercado().then(sincronizarTimer);
    }
  }, 1000);
}

// =============================================
// INICIAR APLICAÇÃO
// =============================================
function verificarElementos() {
  const ids = ['comando', 'score', 'hora', 'timer', 'ultimos'];
  const faltando = ids.filter(id => !document.getElementById(id));
  if (faltando.length) {
    console.error("Elementos críticos faltando no HTML:", faltando.join(", "));
    return false;
  }
  return true;
}

function iniciarRelogio() {
  setInterval(() => {
    const hora = document.getElementById("hora");
    if (hora) hora.textContent = new Date().toLocaleTimeString("pt-BR");
  }, 1000);
}

function iniciar() {
  if (!verificarElementos()) return;
  
  iniciarRelogio();
  sincronizarTimer();
  analisarMercado();
  
  // Adicionar tratamento para recarregar após muitos erros
  setInterval(() => {
    if (state.tentativasErro >= CONFIG.MAX_TENTATIVAS_ERRO) {
      console.warn("Recarregando após múltiplos erros...");
      window.location.reload();
    }
  }, 300000); // 5 minutos
}

// Inicialização segura
if (typeof document !== 'undefined') {
  if (document.readyState === "complete") iniciar();
  else document.addEventListener("DOMContentLoaded", iniciar);
}
