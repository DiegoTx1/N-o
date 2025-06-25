// =============================================
// CONFIGURAÇÕES GLOBAIS (ATUALIZADAS)
// =============================================
const state = {
  ultimosSinais: [],
  timer: 60,
  ultimaAtualizacao: "",
  leituraEmAndamento: false,
  tentativasErro: 0,
  ultimoSinal: null,
  ultimoScore: 0,
  tendenciaAtual: "NEUTRA",
  forcaTendencia: 0,
  ultimaVelaProcessada: null,
  mercadoAberto: true,
  ultimoMinutoProcessado: -1,
  debugMode: true  // Modo depuração ativado
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

// =============================================
// FUNÇÕES UTILITÁRIAS (MELHORADAS)
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
  const horaElement = document.getElementById("hora");
  if (horaElement) horaElement.textContent = state.ultimaAtualizacao;
}

function verificarVelaNova(dados) {
  if (!dados || dados.length === 0) return false;
  
  const agora = new Date();
  const minutoAtual = agora.getMinutes();
  const horaAtual = agora.getHours();
  
  const ultimaVela = dados[dados.length - 1];
  
  // Converter para formato compatível com Date
  let velaTimeStr = ultimaVela.time;
  if (velaTimeStr.includes(" ")) {
    velaTimeStr = velaTimeStr.replace(" ", "T") + "Z";
  }
  
  const velaTime = new Date(velaTimeStr);
  const minutoVela = velaTime.getMinutes();
  const horaVela = velaTime.getHours();
  
  // Debug: Verificar correspondência de tempo
  if (state.debugMode) {
    console.log(`Verificando vela nova: 
      Hora atual: ${horaAtual}:${minutoAtual}
      Hora vela: ${horaVela}:${minutoVela}
      Dados vela: ${ultimaVela.time}`);
  }
  
  return horaAtual === horaVela && minutoVela === minutoAtual;
}

// =============================================
// CÁLCULO DE INDICADORES (OTIMIZADOS)
// =============================================
const calcularMedia = {
  simples: (dados, periodo) => {
    if (!Array.isArray(dados) || dados.length === 0) return 0;
    const slice = dados.slice(-periodo);
    if (slice.length === 0) return 0;
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  },

  exponencial: (dados, periodo) => {
    if (!Array.isArray(dados) || dados.length === 0) return [];
    if (dados.length < periodo) return Array(dados.length).fill(0);
    
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
  if (!Array.isArray(closes) || closes.length < periodo + 1) return 50;
  
  let gains = 0, losses = 0;
  for (let i = closes.length - periodo; i < closes.length - 1; i++) {
    const diff = closes[i + 1] - closes[i];
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }

  const avgGain = gains / periodo;
  const avgLoss = Math.max(losses / periodo, 0.000001);
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// =============================================
// SISTEMA DE SINAIS (REFATORADO)
// =============================================
function gerarSinal(indicadores) {
  try {
    const { rsi, stoch, macd, close, emaCurta, emaMedia, volume, volumeMedia, superTrend, tendencia } = indicadores;
    
    // Debug: Exibir todos os valores
    if (state.debugMode) {
      console.log("Valores para decisão:", {
        tendencia: tendencia.tendencia,
        close,
        emaCurta,
        emaMedia,
        macdHistograma: macd.histograma,
        macdLinha: macd.macdLinha,
        rsi,
        volume,
        volumeMedia,
        superTrend: superTrend.direcao
      });
    }
    
    // Sistema de pontuação mais sensível
    let callScore = 0, putScore = 0;
    
    // Regras para CALL
    if (tendencia.tendencia.includes("ALTA")) callScore += 2;
    if (close > emaCurta && close > emaMedia) callScore += 3;
    if (macd.histograma > 0 && macd.macdLinha > 0) callScore += 2;
    if (rsi < CONFIG.LIMIARES.RSI_OVERSOLD) callScore += 2;
    if (volume > volumeMedia * CONFIG.LIMIARES.VOLUME_ALTO) callScore += 2;
    if (superTrend.direcao > 0) callScore += 2;
    
    // Regras para PUT
    if (tendencia.tendencia.includes("BAIXA")) putScore += 2;
    if (close < emaCurta && close < emaMedia) putScore += 3;
    if (macd.histograma < 0 && macd.macdLinha < 0) putScore += 2;
    if (rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT) putScore += 2;
    if (volume > volumeMedia * CONFIG.LIMIARES.VOLUME_ALTO) putScore += 2;
    if (superTrend.direcao < 0) putScore += 2;
    
    // Debug: Exibir pontuações
    if (state.debugMode) {
      console.log("Pontuações detalhadas:", {
        callScore, 
        putScore,
        callFactors: {
          tendencia: tendencia.tendencia.includes("ALTA") ? 2 : 0,
          acimaEMAs: (close > emaCurta && close > emaMedia) ? 3 : 0,
          macdPositivo: (macd.histograma > 0 && macd.macdLinha > 0) ? 2 : 0,
          rsiBaixo: rsi < CONFIG.LIMIARES.RSI_OVERSOLD ? 2 : 0,
          volumeAlto: volume > volumeMedia * CONFIG.LIMIARES.VOLUME_ALTO ? 2 : 0,
          superTrendAlto: superTrend.direcao > 0 ? 2 : 0
        },
        putFactors: {
          tendencia: tendencia.tendencia.includes("BAIXA") ? 2 : 0,
          abaixoEMAs: (close < emaCurta && close < emaMedia) ? 3 : 0,
          macdNegativo: (macd.histograma < 0 && macd.macdLinha < 0) ? 2 : 0,
          rsiAlto: rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT ? 2 : 0,
          volumeAlto: volume > volumeMedia * CONFIG.LIMIARES.VOLUME_ALTO ? 2 : 0,
          superTrendBaixo: superTrend.direcao < 0 ? 2 : 0
        }
      });
    }
    
    // Determinar sinal com limiares mais baixos
    if (callScore >= 5 && callScore > putScore) return "CALL";
    if (putScore >= 5 && putScore > callScore) return "PUT";
    
    return "ESPERAR";
    
  } catch (e) {
    console.error("Erro na geração de sinal:", e);
    return "ESPERAR";
  }
}

// =============================================
// CORE DO SISTEMA (REFATORADO)
// =============================================
async function obterDadosTwelveData() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  
  try {
    const response = await fetch(`${CONFIG.API_ENDPOINT}/time_series?symbol=${CONFIG.PARES.FOREX}&interval=1min&outputsize=120`, {
      headers: CONFIG.HEADERS,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.values || !Array.isArray(data.values) {
      throw new Error("Formato de dados inválido");
    }
    
    if (data.values.length === 0) {
      console.error("Dados vazios da API");
      return [];
    }
    
    const dados = data.values.map(item => ({
      time: item.datetime,
      open: parseFloat(item.open),
      high: parseFloat(item.high),
      low: parseFloat(item.low),
      close: parseFloat(item.close),
      volume: parseFloat(item.volume || 1)
    })).reverse();
    
    console.log(`Dados recebidos: ${dados.length} velas | Última vela: ${dados[dados.length-1]?.time}`);
    
    // Debug: Exibir últimas 3 velas
    if (state.debugMode && dados.length >= 3) {
      console.log("Últimas 3 velas:", dados.slice(-3));
    }
    
    return dados;
    
  } catch (error) {
    clearTimeout(timeoutId);
    console.error("Erro na API:", error);
    state.tentativasErro++;
    
    // Tentar API alternativa em caso de falha
    if (state.tentativasErro > 2) {
      console.log("Tentando API alternativa...");
      return await obterDadosAlternativos();
    }
    
    return [];
  }
}

async function obterDadosAlternativos() {
  try {
    // API alternativa para backup
    const response = await fetch(`https://api.twelvedata.com/time_series?symbol=EUR/USD&interval=1min&apikey=demo&outputsize=120`);
    const data = await response.json();
    
    if (!data.values || !Array.isArray(data.values)) {
      throw new Error("Formato de dados inválido na API alternativa");
    }
    
    return data.values.map(item => ({
      time: item.datetime,
      open: parseFloat(item.open),
      high: parseFloat(item.high),
      low: parseFloat(item.low),
      close: parseFloat(item.close),
      volume: parseFloat(item.volume || 1)
    })).reverse();
    
  } catch (error) {
    console.error("Erro na API alternativa:", error);
    return [];
  }
}

async function analisarMercado() {
  if (!state.mercadoAberto) {
    console.log("Mercado fechado. Análise interrompida.");
    return;
  }
  
  if (state.leituraEmAndamento) {
    console.log("Análise já em andamento. Ignorando chamada.");
    return;
  }
  
  const agora = new Date();
  const minutoAtual = agora.getMinutes();
  
  if (minutoAtual === state.ultimoMinutoProcessado) {
    console.log("Minuto já processado. Ignorando análise.");
    return;
  }
  
  state.leituraEmAndamento = true;
  state.ultimoMinutoProcessado = minutoAtual;
  console.log(`[${agora.toLocaleTimeString()}] Iniciando análise para minuto: ${minutoAtual}`);
  
  try {
    const dados = await obterDadosTwelveData();
    if (!dados || dados.length < 50) {
      console.log("Dados insuficientes para análise");
      state.leituraEmAndamento = false;
      return;
    }
    
    const velaNova = verificarVelaNova(dados);
    
    if (!velaNova) {
      console.log("Nenhuma vela nova detectada. Última vela:", dados[dados.length-1]?.time);
      state.leituraEmAndamento = false;
      return;
    }
    
    const velaAtual = dados[dados.length - 1];
    const closes = dados.map(v => v.close);
    const highs = dados.map(v => v.high);
    const lows = dados.map(v => v.low);
    const volumes = dados.map(v => v.volume);
    
    // Calcular indicadores com fallbacks
    const rsi = calcularRSI(closes) || 50;
    const stoch = calcularStochastic(highs, lows, closes) || { k: 50, d: 50 };
    const macd = calcularMACD(closes) || { histograma: 0, macdLinha: 0, sinalLinha: 0 };
    const superTrend = calcularSuperTrend(dados) || { direcao: 0, valor: 0 };
    const tendencia = avaliarTendencia(closes, highs, lows, volumes) || { tendencia: "NEUTRA", forca: 0 };
    
    // Debug: Exibir todos os indicadores
    if (state.debugMode) {
      console.log("Indicadores calculados:", {
        rsi, 
        stoch, 
        macd,
        superTrend,
        tendencia,
        close: velaAtual.close,
        emaCurta: calcularMedia.exponencial(closes.slice(-30), CONFIG.PERIODOS.EMA_CURTA).pop(),
        emaMedia: calcularMedia.exponencial(closes.slice(-30), CONFIG.PERIODOS.EMA_MEDIA).pop(),
        volume: velaAtual.volume,
        volumeMedia: calcularMedia.simples(volumes.slice(-CONFIG.PERIODOS.SMA_VOLUME), CONFIG.PERIODOS.SMA_VOLUME)
      });
    }
    
    // Gerar sinal
    const indicadores = {
      rsi, 
      stoch, 
      macd,
      close: velaAtual.close,
      emaCurta: calcularMedia.exponencial(closes.slice(-30), CONFIG.PERIODOS.EMA_CURTA).pop() || velaAtual.close,
      emaMedia: calcularMedia.exponencial(closes.slice(-30), CONFIG.PERIODOS.EMA_MEDIA).pop() || velaAtual.close,
      volume: velaAtual.volume,
      volumeMedia: calcularMedia.simples(volumes.slice(-CONFIG.PERIODOS.SMA_VOLUME), CONFIG.PERIODOS.SMA_VOLUME),
      superTrend,
      tendencia
    };
    
    const sinal = gerarSinal(indicadores);
    const score = sinal === "ESPERAR" ? 0 : Math.min(100, 70 +
      (tendencia.forca * 0.4) +
      (Math.abs(macd.histograma) * 15000) +
      (indicadores.volume > indicadores.volumeMedia * CONFIG.LIMIARES.VOLUME_ALTO ? 20 : 0));
    
    // Atualizar estado
    state.ultimoSinal = sinal;
    state.ultimoScore = score;
    state.tendenciaAtual = tendencia.tendencia;
    state.forcaTendencia = tendencia.forca;
    state.ultimaAtualizacao = agora.toLocaleTimeString("pt-BR");
    state.ultimaVelaProcessada = velaAtual.time;
    
    // Atualizar interface mesmo para ESPERAR
    const comandoElement = document.getElementById("comando");
    const scoreElement = document.getElementById("score");
    const timerElement = document.getElementById("timer");
    const horaElement = document.getElementById("hora");
    
    if (comandoElement) {
      comandoElement.textContent = sinal;
      comandoElement.className = sinal.toLowerCase();
    }
    
    if (scoreElement) {
      scoreElement.textContent = sinal === "ESPERAR" 
        ? "Analisando..." 
        : `Confiança: ${score}%`;
      scoreElement.style.color = sinal === "ESPERAR" ? '#FFFFFF' :
        score >= CONFIG.LIMIARES.SCORE_ALTO ? '#00FF00' : 
        score >= CONFIG.LIMIARES.SCORE_MEDIO ? '#FFFF00' : '#FF0000';
    }
    
    if (timerElement) {
      timerElement.textContent = formatarTimer(state.timer);
    }
    
    if (horaElement) {
      horaElement.textContent = state.ultimaAtualizacao;
    }
    
    // Forçar atualização visual
    if (sinal !== "ESPERAR") {
      document.body.classList.add('novo-sinal');
      setTimeout(() => document.body.classList.remove('novo-sinal'), 1000);
    }
    
    console.log(`Resultado: ${sinal} (${score}%)`);
    
  } catch (error) {
    console.error("Erro crítico na análise:", error, error.stack);
    state.tentativasErro++;
    if (state.tentativasErro > 2) {
      console.warn("Reiniciando sistema...");
      setTimeout(() => location.reload(), 3000);
    }
  } finally {
    state.leituraEmAndamento = false;
  }
}

// =============================================
// CONTROLE DE TEMPO (MELHORADO)
// =============================================
function gerenciarTimer() {
  const agora = new Date();
  const segundos = agora.getSeconds();
  state.timer = 60 - segundos;
  
  if (state.timer <= 0) {
    state.timer = 60;
  }
  
  const timerElement = document.getElementById("timer");
  if (timerElement) {
    timerElement.textContent = formatarTimer(state.timer);
    timerElement.style.color = state.timer <= 10 ? '#FF0000' : '#00FF00';
  }
  
  // Disparar análise nos últimos 5 segundos do minuto
  if (state.timer <= 5 && !state.leituraEmAndamento) {
    analisarMercado();
  }
}

// =============================================
// INICIALIZAÇÃO (MELHORADA)
// =============================================
function iniciarAplicativo() {
  console.log("Iniciando sistema com depuração ativada...");
  state.mercadoAberto = true;
  state.ultimaVelaProcessada = null;
  state.ultimoMinutoProcessado = -1;
  
  // Configurações iniciais
  setInterval(atualizarRelogio, 1000);
  setInterval(gerenciarTimer, 1000);
  
  // Forçar primeira análise imediata
  setTimeout(() => {
    state.ultimoMinutoProcessado = -1;
    analisarMercado();
    console.log("Análise inicial concluída");
  }, 1500);
  
  // Monitoramento de saúde
  setInterval(() => {
    console.log("Status do sistema:", {
      ultimoSinal: state.ultimoSinal,
      ultimoScore: state.ultimoScore,
      tentativasErro: state.tentativasErro,
      memoria: window.performance?.memory?.usedJSHeapSize || 'N/A',
      ultimaVela: state.ultimaVelaProcessada
    });
  }, 15000);
  
  // Adicionar CSS dinâmico para sinais
  const style = document.createElement('style');
  style.textContent = `
    .call { color: #00ff00; font-weight: bold; }
    .put { color: #ff0000; font-weight: bold; }
    .esperar { color: #cccccc; }
    .novo-sinal { animation: pulse 0.5s; }
    
    @keyframes pulse {
      0% { opacity: 1; }
      50% { opacity: 0.5; }
      100% { opacity: 1; }
    }
  `;
  document.head.appendChild(style);
}

// Iniciar quando o DOM estiver pronto
if (document.readyState === "complete") {
  iniciarAplicativo();
} else {
  document.addEventListener("DOMContentLoaded", iniciarAplicativo);
}

// Funções auxiliares omitidas por brevidade (manter as mesmas)
// calcularStochastic, calcularMACD, calcularATR, calcularSuperTrend, avaliarTendencia
