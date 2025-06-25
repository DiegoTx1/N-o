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
  historico: { win: 0, loss: 0 },
  criteriosAtivos: [],
  dadosVelas: []
};

const CONFIG = {
  API_KEY: "0105e6681b894e0185704171c53f5075", // SUA NOVA CHAVE AQUI
  SYMBOL: "EUR/USD",
  INTERVAL: "1min",
  API_URL: "https://api.twelvedata.com/time_series",
  TIMEOUT: 8000, // Aumentado para 8 segundos

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
  MAX_TENTATIVAS_ERRO: 3
};

// =============================================
// FUNÇÕES PRINCIPAIS (OTIMIZADAS)
// =============================================
async function obterDados() {
  if (state.tentativasErro >= CONFIG.MAX_TENTATIVAS_ERRO) {
    console.error("Bloqueado: muitas tentativas falhas");
    return null;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT);
    
    const url = new URL(CONFIG.API_URL);
    url.searchParams.append('symbol', CONFIG.SYMBOL);
    url.searchParams.append('interval', CONFIG.INTERVAL);
    url.searchParams.append('outputsize', '100');
    url.searchParams.append('apikey', CONFIG.API_KEY);

    const res = await fetch(url, { 
      signal: controller.signal,
      headers: { 'Authorization': `Bearer ${CONFIG.API_KEY}` } // Header adicional
    });
    
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Erro HTTP ${res.status}: ${await res.text()}`);
    }
    
    const json = await res.json();
    
    if (!json?.values?.length) {
      throw new Error("Resposta vazia da API");
    }

    state.tentativasErro = 0; // Resetar contador
    return json.values.reverse().map(v => ({
      open: parseFloat(v.open),
      high: parseFloat(v.high),
      low: parseFloat(v.low),
      close: parseFloat(v.close),
      datetime: v.datetime
    }));

  } catch (e) {
    state.tentativasErro++;
    console.error(`Tentativa ${state.tentativasErro} falhou:`, e.name, e.message);
    
    // Atualizar UI em caso de erro
    if (state.tentativasErro >= CONFIG.MAX_TENTATIVAS_ERRO) {
      document.getElementById("comando").textContent = "ERRO API";
      document.getElementById("score").textContent = "OFFLINE";
    }
    
    return null;
  }
}

// =============================================
// LÓGICA DE ANÁLISE (MELHORADA)
// =============================================
async function analisarMercado() {
  // Verificar se já está em execução
  if (state.leituraEmAndamento) {
    console.warn("Bloqueado: análise já em andamento");
    return;
  }

  // Configurar estado
  state.leituraEmAndamento = true;
  document.getElementById("comando").textContent = "ANALISANDO...";
  document.getElementById("comando").className = "analisando";

  try {
    // Obter dados
    const velas = await obterDados();
    if (!velas?.length) {
      throw new Error("Dados não disponíveis");
    }

    // Preparar dados
    state.dadosVelas = velas;
    const closes = velas.map(v => v.close);
    const closeAtual = closes[closes.length - 1];

    // Verificar dados mínimos
    if (closes.length < 50) { // Aumentado o mínimo para segurança
      throw new Error(`Dados insuficientes (${closes.length}/50 candles)`);
    }

    // Calcular indicadores em paralelo
    const indicadores = await Promise.all([
      calcularRSI(closes),
      calcularMACD(closes),
      calcularEMAs(closes),
      calcularBollinger(closes)
    ]);

    // Gerar sinal
    const { sinal, score } = gerarSinal({
      rsi: indicadores[0],
      macd: indicadores[1],
      close: closeAtual,
      ema9: indicadores[2].ema9,
      ema20: indicadores[2].ema20,
      ema45: indicadores[2].ema45,
      boll: indicadores[3]
    });

    // Atualizar estado
    state.ultimoSinal = sinal;
    state.ultimoScore = score;
    state.ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR");
    state.criteriosAtivos = gerarCritérios(indicadores, closeAtual);

    // Atualizar interface
    atualizarInterface(sinal, score);
    salvarHistorico(sinal, score);

  } catch (e) {
    console.error("Falha na análise:", e.name, e.message);
    atualizarInterface("ERRO", 0);
  } finally {
    state.leituraEmAndamento = false;
    state.timer = 60; // Resetar contador
  }
}

// =============================================
// FUNÇÕES AUXILIARES (ATUALIZADAS)
// =============================================
function calcularEMAs(closes) {
  return {
    ema9: mediaExponencial(closes, CONFIG.PERIODOS.EMA9),
    ema20: mediaExponencial(closes, CONFIG.PERIODOS.EMA20),
    ema45: mediaExponencial(closes, CONFIG.PERIODOS.EMA45)
  };
}

function gerarCritérios(indicadores, closeAtual) {
  const [rsi, macd, _, boll] = indicadores;
  return [
    `RSI: ${rsi.toFixed(2)} ${rsi > 70 ? '↑' : rsi < 30 ? '↓' : '•'}`,
    `MACD: ${macd.histograma > 0 ? '↑' : '↓'} (${macd.histograma.toFixed(5)})`,
    `Bollinger: ${closeAtual > boll.superior ? 'TOPO' : closeAtual < boll.inferior ? 'FUNDO' : 'MEIO'}`,
    `Volume: ${state.dadosVelas.slice(-1)[0].volume || 'N/A'}`
  ];
}

// =============================================
// CONTROLE DE TEMPO (REVISADO)
// =============================================
function gerenciarTimer() {
  clearInterval(state.intervaloAtual);
  
  state.intervaloAtual = setInterval(() => {
    // Atualizar timer
    state.timer--;
    const timerEl = document.getElementById("timer");
    if (timerEl) timerEl.textContent = state.timer;
    
    // Atualizar relógio
    const horaEl = document.getElementById("hora");
    if (horaEl) horaEl.textContent = new Date().toLocaleTimeString("pt-BR");
    
    // Disparar análise
    if (state.timer <= 0 && !state.leituraEmAndamento) {
      analisarMercado();
    }
  }, 1000);
}

// =============================================
// INICIALIZAÇÃO (SEGURA)
// =============================================
function verificarDependencias() {
  const elementosNecessarios = [
    'comando', 'score', 'timer', 'hora', 
    'ultimos', 'criterios', 'historico'
  ];
  
  return elementosNecessarios.every(id => {
    const existe = !!document.getElementById(id);
    if (!existe) console.error(`Elemento #${id} não encontrado`);
    return existe;
  });
}

function iniciar() {
  // Verificar dependências
  if (!verificarDependencias()) {
    console.error("Aplicação não pode iniciar - elementos faltando");
    document.getElementById("comando").textContent = "ERRO DE CONFIG";
    return;
  }

  // Configuração inicial
  document.getElementById("historico").textContent = "0 WIN / 0 LOSS";
  gerenciarTimer();
  analisarMercado(); // Primeira análise imediata
}

// Inicialização segura
if (document.readyState === "complete") {
  iniciar();
} else {
  document.addEventListener("DOMContentLoaded", iniciar);
}

// =============================================
// FUNÇÕES DE INTERFACE (COMPATÍVEIS COM SEU HTML)
// =============================================
function atualizarInterface(sinal, score) {
  const comandoEl = document.getElementById("comando");
  if (comandoEl) {
    comandoEl.textContent = sinal;
    comandoEl.className = sinal.toLowerCase();
  }

  const scoreEl = document.getElementById("score");
  if (scoreEl) {
    scoreEl.textContent = `${score}%`;
    scoreEl.style.color = 
      score >= CONFIG.LIMITES.SCORE_FORTE ? "#4CAF50" :
      score >= CONFIG.LIMITES.SCORE_MEDIO ? "#FFC107" : "#F44336";
  }

  const criteriosEl = document.getElementById("criterios");
  if (criteriosEl) {
    criteriosEl.innerHTML = state.criteriosAtivos.map(c => `<li>${c}</li>`).join("");
  }

  // Tocar som de alerta
  if (score >= CONFIG.LIMITES.SCORE_FORTE) {
    const som = document.getElementById(sinal === "CALL" ? "som-call" : "som-put");
    if (som) som.play().catch(e => console.warn("Erro no áudio:", e));
  }
}

function salvarHistorico(sinal, score) {
  const log = `${state.ultimaAtualizacao} - ${sinal} (${score}%)`;
  state.ultimos.unshift(log);
  if (state.ultimos.length > 5) state.ultimos.pop();
  
  const ultimosEl = document.getElementById("ultimos");
  if (ultimosEl) {
    ultimosEl.innerHTML = state.ultimos.map(t => `<li>${t}</li>`).join("");
  }
}

// Sua função original mantida
function registrar(resultado) {
  if (resultado === "WIN") state.historico.win++;
  if (resultado === "LOSS") state.historico.loss++;
  
  const historicoEl = document.getElementById("historico");
  if (historicoEl) {
    historicoEl.textContent = `${state.historico.win} WIN / ${state.historico.loss} LOSS`;
  }
}
