// =============================================
// CONFIGURAÇÕES ESTRATÉGIA TREND IMPULSE (2025)
// =============================================
const CONFIG = {
  API_KEY: "9cf795b2a4f14d43a049ca935d174ebb",
  PAR: "EUR/USD",
  INTERVALO: "1min",
  PERIODOS: {
    EMA_RAPIDA: 5,
    EMA_MEDIA: 21,
    EMA_LONGA: 89,
    RSI: 11,
    VOLUME_LOOKBACK: 3
  },
  LIMITES: {
    RSI_ALTO: 68,
    RSI_BAIXO: 32,
    VOLUME_THRESHOLD: 1.8
  },
  PESOS: {
    TENDENCIA: 40,
    RSI: 30,
    VOLUME: 30
  }
};

// =============================================
// ESTADO DO SISTEMA
// =============================================
const state = {
  timer: 60,
  ultimos: [],
  ultimaAtualizacao: "",
  leituraEmAndamento: false,
  dadosHistoricos: [],
  ultimoSinal: "ESPERAR",
  ultimoScore: 0,
  historicoOperacoes: { win: 0, loss: 0 },
  emaCache: {
    ema5: null,
    ema21: null,
    ema89: null
  }
};

// =============================================
// FUNÇÕES DE CÁLCULO TÉCNICO
// =============================================
function calcularMediaSimples(dados, periodo) {
  if (dados.length < periodo) return null;
  const slice = dados.slice(-periodo);
  return slice.reduce((a, b) => a + b, 0) / periodo;
}

function calcularEMA(dados, periodo, cacheKey) {
  if (dados.length < periodo) return null;
  
  // Se cache existe, calcula incremental
  if (state.emaCache[cacheKey] !== null) {
    const k = 2 / (periodo + 1);
    const ultimoValor = dados[dados.length - 1];
    state.emaCache[cacheKey] = (ultimoValor * k) + (state.emaCache[cacheKey] * (1 - k));
    return state.emaCache[cacheKey];
  }
  
  // Primeiro cálculo
  const mediaInicial = calcularMediaSimples(dados.slice(0, periodo), periodo);
  state.emaCache[cacheKey] = mediaInicial;
  
  // Calcula EMA para os dados restantes
  for (let i = periodo; i < dados.length; i++) {
    const k = 2 / (periodo + 1);
    state.emaCache[cacheKey] = (dados[i] * k) + (state.emaCache[cacheKey] * (1 - k));
  }
  
  return state.emaCache[cacheKey];
}

function calcularRSI(closes, periodo = CONFIG.PERIODOS.RSI) {
  if (closes.length < periodo + 1) return 50;
  
  let gains = 0;
  let losses = 0;
  
  for (let i = 1; i <= periodo; i++) {
    const diff = closes[closes.length - i] - closes[closes.length - i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  
  const avgGain = gains / periodo;
  const avgLoss = losses / periodo;
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calcularVolumeRelativo(volumes, lookback = CONFIG.PERIODOS.VOLUME_LOOKBACK) {
  if (volumes.length < lookback) return 1.0;
  
  const volumeAtual = volumes[volumes.length - 1];
  const volumesAnteriores = volumes.slice(-lookback - 1, -1);
  const mediaVolumes = calcularMediaSimples(volumesAnteriores, lookback);
  
  return volumeAtual / mediaVolumes;
}

// =============================================
// GERADOR DE SINAIS - ESTRATÉGIA TREND IMPULSE
// =============================================
function gerarSinal() {
  const dados = state.dadosHistoricos;
  if (dados.length < 90) return { sinal: "AGUARDANDO", score: 0, criterios: [] };
  
  const closes = dados.map(c => c.close);
  const volumes = dados.map(c => c.volume);
  const current = dados[dados.length - 1];
  
  // 1. Calcular EMAs
  const ema5 = calcularEMA(closes, CONFIG.PERIODOS.EMA_RAPIDA, 'ema5');
  const ema21 = calcularEMA(closes, CONFIG.PERIODOS.EMA_MEDIA, 'ema21');
  const ema89 = calcularEMA(closes, CONFIG.PERIODOS.EMA_LONGA, 'ema89');
  
  // 2. Calcular RSI
  const rsi = calcularRSI(closes);
  
  // 3. Calcular Volume Relativo
  const volumeRel = calcularVolumeRelativo(volumes);
  
  // Critérios de Tendência
  const acimaEma21 = current.close > ema21;
  const acimaEma89 = current.close > ema89;
  const ema5AcimaEma21 = ema5 > ema21;
  
  // Critérios de Momentum
  const rsiAlto = rsi > CONFIG.LIMITES.RSI_ALTO;
  const rsiBaixo = rsi < CONFIG.LIMITES.RSI_BAIXO;
  const volumeAlto = volumeRel > CONFIG.LIMITES.VOLUME_THRESHOLD;
  
  // Pontuação (0-100)
  let score = 0;
  const criterios = [];
  
  // Regra 1: Tendência de Alta Forte
  if (acimaEma89 && acimaEma21 && ema5AcimaEma21) {
    score += CONFIG.PESOS.TENDENCIA;
    criterios.push(`✅ Tendência de Alta Forte (${CONFIG.PESOS.TENDENCIA}%)`);
  }
  
  // Regra 2: RSI Confirmando
  if (acimaEma21 && !rsiAlto) {
    score += CONFIG.PESOS.RSI;
    criterios.push(`✅ RSI em Zona Neutra (${CONFIG.PESOS.RSI}%)`);
  } else if (!acimaEma21 && rsiBaixo) {
    score += CONFIG.PESOS.RSI;
    criterios.push(`✅ RSI em Zona de Reversão (${CONFIG.PESOS.RSI}%)`);
  }
  
  // Regra 3: Volume Confirmando
  if (volumeAlto) {
    score += CONFIG.PESOS.VOLUME;
    criterios.push(`✅ Volume Acima da Média (${CONFIG.PESOS.VOLUME}%)`);
  }
  
  // Sinalização
  let sinal = "AGUARDANDO";
  
  // Sinal de CALL (Alta)
  if (score >= 70) {
    if (acimaEma21 && !rsiAlto) {
      sinal = "CALL";
    } else if (!acimaEma21 && rsiBaixo) {
      sinal = "CALL";
    }
  }
  
  // Sinal de PUT (Baixa)
  if (score >= 70) {
    if (!acimaEma21 && !rsiBaixo) {
      sinal = "PUT";
    } else if (acimaEma21 && rsiAlto) {
      sinal = "PUT";
    }
  }
  
  return { sinal, score, criterios };
}

// =============================================
// FUNÇÕES DE INTERFACE
// =============================================
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

function atualizarInterface(sinal, score, criterios = []) {
  const comandoElement = document.getElementById("comando");
  if (comandoElement) {
    comandoElement.textContent = sinal;
    comandoElement.className = sinal.toLowerCase();
    
    if (sinal === "CALL") {
      comandoElement.textContent += " 📈";
      document.getElementById("som-call").play();
      comandoElement.classList.add("sinal-alerta");
    } else if (sinal === "PUT") {
      comandoElement.textContent += " 📉";
      document.getElementById("som-put").play();
      comandoElement.classList.add("sinal-alerta");
    } else if (sinal === "ERRO") {
      comandoElement.textContent += " ❌";
    } else {
      comandoElement.classList.remove("sinal-alerta");
    }
  }
  
  const scoreElement = document.getElementById("score");
  if (scoreElement) {
    scoreElement.textContent = `${score}%`;
  }
  
  const criteriosElement = document.getElementById("criterios");
  if (criteriosElement) {
    criteriosElement.innerHTML = criterios.map(c => `<li>${c}</li>`).join("") || "<li>Sem dados suficientes</li>";
  }
}

function registrar(resultado) {
  if (state.ultimoSinal && (state.ultimoSinal === "CALL" || state.ultimoSinal === "PUT")) {
    if (resultado === "WIN") state.historicoOperacoes.win++;
    else if (resultado === "LOSS") state.historicoOperacoes.loss++;
    
    const historicoElement = document.getElementById("historico");
    if (historicoElement) {
      historicoElement.textContent = `${state.historicoOperacoes.win} WIN / ${state.historicoOperacoes.loss} LOSS`;
    }
    
    // Adicionar ao histórico de sinais com resultado
    state.ultimos.unshift(`${state.ultimaAtualizacao} - ${state.ultimoSinal} (${resultado})`);
    if (state.ultimos.length > 8) state.ultimos.pop();
    
    const ultimosElement = document.getElementById("ultimos");
    if (ultimosElement) {
      ultimosElement.innerHTML = state.ultimos.map(i => `<li>${i}</li>`).join("");
    }
  }
}

// =============================================
// INTEGRAÇÃO COM API
// =============================================
async function obterDadosMercado() {
  try {
    const url = `https://api.twelvedata.com/time_series?symbol=${CONFIG.PAR}&interval=${CONFIG.INTERVALO}&outputsize=100&apikey=${CONFIG.API_KEY}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Erro na API: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.status === "error") {
      throw new Error(data.message);
    }
    
    return data.values.map(item => ({
      time: item.datetime,
      open: parseFloat(item.open),
      high: parseFloat(item.high),
      low: parseFloat(item.low),
      close: parseFloat(item.close),
      volume: parseFloat(item.volume)
    })).reverse();
  } catch (error) {
    console.error("Falha ao obter dados:", error);
    throw error;
  }
}

// =============================================
// CICLO PRINCIPAL
// =============================================
async function analisarMercado() {
  if (state.leituraEmAndamento) return;
  state.leituraEmAndamento = true;
  
  try {
    // Atualizar relógio
    atualizarRelogio();
    
    // Obter dados
    state.dadosHistoricos = await obterDadosMercado();
    
    // Gerar sinal
    const { sinal, score, criterios } = gerarSinal();
    state.ultimoSinal = sinal;
    state.ultimoScore = score;
    
    // Atualizar interface
    atualizarInterface(sinal, score, criterios);
    
    // Registrar no histórico de sinais
    if (sinal === "CALL" || sinal === "PUT") {
      state.ultimos.unshift(`${state.ultimaAtualizacao} - ${sinal} (${score}%)`);
      if (state.ultimos.length > 8) state.ultimos.pop();
      
      const ultimosElement = document.getElementById("ultimos");
      if (ultimosElement) {
        ultimosElement.innerHTML = state.ultimos.map(i => `<li>${i}</li>`).join("");
      }
    }
  } catch (error) {
    console.error("Erro na análise:", error);
    atualizarInterface("ERRO", 0, [`Falha: ${error.message}`]);
  } finally {
    state.leituraEmAndamento = false;
  }
}

// =============================================
// CONTROLE DE TEMPO
// =============================================
function sincronizarTimer() {
  const agora = new Date();
  const segundos = agora.getSeconds();
  state.timer = 60 - segundos;
  
  const timerElement = document.getElementById("timer");
  if (timerElement) timerElement.textContent = state.timer;
  
  // Atualizar timer a cada segundo
  state.intervaloTimer = setInterval(() => {
    state.timer--;
    if (timerElement) timerElement.textContent = state.timer;
    
    if (state.timer <= 0) {
      clearInterval(state.intervaloTimer);
      analisarMercado();
      sincronizarTimer(); // Reinicia o timer
    }
  }, 1000);
}

// =============================================
// INICIALIZAÇÃO
// =============================================
function iniciar() {
  sincronizarTimer();
  setInterval(atualizarRelogio, 1000);
  analisarMercado(); // Primeira análise imediata
}

// Iniciar quando o documento estiver pronto
document.addEventListener("DOMContentLoaded", iniciar);
