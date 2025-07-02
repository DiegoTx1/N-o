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
  intervaloTimer: null
};

// =============================================
// FUNÇÕES DE CÁLCULO TÉCNICO
// =============================================
function calcularMediaSimples(dados, periodo) {
  if (!dados || !dados.length || dados.length < periodo) return null;
  const slice = dados.slice(-periodo);
  return slice.reduce((a, b) => a + b, 0) / periodo;
}

function calcularEMA(dados, periodo) {
  if (!dados || dados.length < periodo) return null;
  
  const janela = dados.slice(-Math.min(periodo * 3, dados.length));
  let ema = calcularMediaSimples(janela.slice(0, periodo), periodo);
  
  if (ema === null || isNaN(ema)) return null;
  
  for (let i = periodo; i < janela.length; i++) {
    const k = 2 / (periodo + 1);
    ema = (janela[i] * k) + (ema * (1 - k));
  }
  
  return ema;
}

function calcularRSI(closes, periodo = CONFIG.PERIODOS.RSI) {
  if (!closes || closes.length < periodo + 1) return 50;
  
  let gains = 0;
  let losses = 0;
  
  for (let i = closes.length - periodo; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else if (diff < 0) losses -= diff;
  }
  
  const avgGain = gains / periodo;
  const avgLoss = losses / periodo;
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calcularVolumeRelativo(volumes, lookback = CONFIG.PERIODOS.VOLUME_LOOKBACK) {
  if (!volumes || volumes.length < lookback + 1) return 1.0;
  
  const volumeAtual = volumes[volumes.length - 1];
  const volumesAnteriores = volumes.slice(-lookback - 1, -1);
  const somaVolumes = volumesAnteriores.reduce((sum, vol) => sum + vol, 0);
  
  if (somaVolumes <= 0) return 1.0;
  return volumeAtual / (somaVolumes / lookback);
}

// =============================================
// GERADOR DE SINAIS
// =============================================
function gerarSinal() {
  const dados = state.dadosHistoricos;
  if (!dados || dados.length < 90) return { sinal: "ESPERAR", score: 0, criterios: ["Aguardando mais dados"] };
  
  const closes = dados.map(c => c.close);
  const volumes = dados.map(c => c.volume);
  const current = dados[dados.length - 1];
  
  const ema5 = calcularEMA(closes, CONFIG.PERIODOS.EMA_RAPIDA);
  const ema21 = calcularEMA(closes, CONFIG.PERIODOS.EMA_MEDIA);
  const ema89 = calcularEMA(closes, CONFIG.PERIODOS.EMA_LONGA);
  const rsi = calcularRSI(closes);
  const volumeRel = calcularVolumeRelativo(volumes);
  
  // Verificação crítica de valores
  if ([ema5, ema21, ema89, rsi, volumeRel].some(val => val === null || isNaN(val))) {
    return { sinal: "ERRO", score: 0, criterios: ["Erro no cálculo de indicadores"] };
  }
  
  const acimaEma21 = current.close > ema21;
  const acimaEma89 = current.close > ema89;
  const ema5AcimaEma21 = ema5 > ema21;
  const rsiAlto = rsi > CONFIG.LIMITES.RSI_ALTO;
  const rsiBaixo = rsi < CONFIG.LIMITES.RSI_BAIXO;
  const volumeAlto = volumeRel > CONFIG.LIMITES.VOLUME_THRESHOLD;
  
  let score = 0;
  const criterios = [];
  
  // Sistema completo de tendência
  const tendenciaAltaForte = acimaEma89 && acimaEma21 && ema5AcimaEma21;
  const tendenciaBaixaForte = !acimaEma89 && !acimaEma21 && !ema5AcimaEma21;
  
  if (tendenciaAltaForte) {
    score += CONFIG.PESOS.TENDENCIA;
    criterios.push(`✅ Tendência de Alta Forte (${CONFIG.PESOS.TENDENCIA}%)`);
  }
  else if (tendenciaBaixaForte) {
    score += CONFIG.PESOS.TENDENCIA;
    criterios.push(`✅ Tendência de Baixa Forte (${CONFIG.PESOS.TENDENCIA}%)`);
  }
  
  if (acimaEma21 && !rsiAlto) {
    score += CONFIG.PESOS.RSI;
    criterios.push(`✅ RSI Neutro (${CONFIG.PESOS.RSI}%)`);
  } 
  else if (!acimaEma21 && rsiBaixo) {
    score += CONFIG.PESOS.RSI;
    criterios.push(`✅ RSI Oversold (${CONFIG.PESOS.RSI}%)`);
  }
  
  if (volumeAlto) {
    score += CONFIG.PESOS.VOLUME;
    criterios.push(`✅ Volume Alto (${CONFIG.PESOS.VOLUME}%)`);
  }
  
  let sinal = "ESPERAR";
  
  // Sinal de CALL (Alta)
  if (score >= 70 && acimaEma21 && !rsiAlto) {
    sinal = "CALL";
  } 
  // Sinal de PUT (Baixa)
  else if (score >= 70 && !acimaEma21 && rsiAlto) {
    sinal = "PUT";
  }
  
  return { sinal, score, criterios };
}

// =============================================
// FUNÇÕES DE INTERFACE
// =============================================
function atualizarRelogio() {
  const now = new Date();
  state.ultimaAtualizacao = now.toLocaleTimeString("pt-BR", {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  document.getElementById("hora").textContent = state.ultimaAtualizacao;
}

function atualizarInterface(sinal, score, criterios = []) {
  const comandoElement = document.getElementById("comando");
  
  // Reset completo de estado visual
  comandoElement.className = "";
  comandoElement.classList.add(sinal.toLowerCase());
  
  if (sinal === "CALL") {
    comandoElement.textContent = "CALL 📈";
    comandoElement.classList.add("sinal-alerta");
    document.getElementById("som-call").play().catch(e => console.log("Audio error:", e));
  } 
  else if (sinal === "PUT") {
    comandoElement.textContent = "PUT 📉";
    comandoElement.classList.add("sinal-alerta");
    document.getElementById("som-put").play().catch(e => console.log("Audio error:", e));
  } 
  else if (sinal === "ERRO") {
    comandoElement.textContent = "ERRO ❌";
  } 
  else {
    comandoElement.textContent = "ESPERAR ✋";
  }
  
  document.getElementById("score").textContent = `${score}%`;
  
  const criteriosHTML = criterios.length 
    ? criterios.map(c => `<li>${c}</li>`).join("") 
    : "<li>Sem dados suficientes para análise</li>";
  document.getElementById("criterios").innerHTML = criteriosHTML;
  
  // Atualizar estado global
  state.ultimoSinal = sinal;
  state.ultimoScore = score;
}

function registrar(resultado) {
  if (state.ultimoSinal === "CALL" || state.ultimoSinal === "PUT") {
    if (resultado === "WIN") state.historicoOperacoes.win++;
    else if (resultado === "LOSS") state.historicoOperacoes.loss++;
    
    document.getElementById("historico").textContent = 
      `${state.historicoOperacoes.win} WIN / ${state.historicoOperacoes.loss} LOSS`;
    
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
    
    if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
    
    const data = await response.json();
    
    if (data.status === "error" || !data.values) {
      throw new Error(data.message || "Resposta inválida da API");
    }
    
    return data.values.map(item => ({
      time: item.datetime,
      open: parseFloat(item.open),
      high: parseFloat(item.high),
      low: parseFloat(item.low),
      close: parseFloat(item.close),
      volume: parseFloat(item.volume) || 0
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
  if (state.leituraEmAndamento) {
    console.log("Análise já em andamento. Ignorando chamada duplicada.");
    return;
  }
  
  state.leituraEmAndamento = true;
  
  try {
    // Atualização em tempo real
    atualizarRelogio();
    
    // Obter e processar dados
    state.dadosHistoricos = await obterDadosMercado();
    
    // Gerar sinal com estratégia
    const { sinal, score, criterios } = gerarSinal();
    
    // Atualizar interface
    atualizarInterface(sinal, score, criterios);
    
    // Registrar sinal importante
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
    atualizarInterface("ERRO", 0, [`Falha: ${error.message || error}`]);
  } finally {
    state.leituraEmAndamento = false;
  }
}

// =============================================
// CONTROLE DE TEMPO (PRECISÃO MILIMÉTRICA)
// =============================================
function sincronizarTimer() {
  // Limpar timer existente
  if (state.intervaloTimer) {
    clearInterval(state.intervaloTimer);
    state.intervaloTimer = null;
  }
  
  // Sincronizar com relógio atômico
  const agora = new Date();
  state.timer = 60 - agora.getSeconds();
  document.getElementById("timer").textContent = state.timer;
  
  // Atualização em tempo real
  state.intervaloTimer = setInterval(() => {
    state.timer = Math.max(0, state.timer - 1);
    document.getElementById("timer").textContent = state.timer;
    
    // Quando chegar a zero, disparar análise
    if (state.timer <= 0) {
      clearInterval(state.intervaloTimer);
      state.intervaloTimer = null;
      
      // Executar análise e depois reiniciar timer
      analisarMercado().finally(() => {
        sincronizarTimer(); // Reinicia APÓS a análise
      });
    }
  }, 1000);
}

// =============================================
// INICIALIZAÇÃO ROBUSTA
// =============================================
function iniciar() {
  // Sincronizar processos
  sincronizarTimer();
  
  // Atualizar relógio a cada segundo
  setInterval(atualizarRelogio, 1000);
  atualizarRelogio();
  
  // Primeira análise após estabilização
  setTimeout(() => {
    if (!state.leituraEmAndamento) {
      analisarMercado();
    }
  }, 1000);
}

// Iniciar quando documento estiver pronto
document.addEventListener("DOMContentLoaded", iniciar);
