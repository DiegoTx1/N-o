// =============================================
// CONFIGURAÇÕES GLOBAIS
// =============================================
const state = {
  timer: 60,
  ultimaAtualizacao: "",
  leituraEmAndamento: false,
  dadosHistoricos: { M1: [] },
  tendenciaDetectada: "NEUTRA",
  forcaTendencia: 0,
  volatilidade: 0,
  modo: "core",
  ultimoSinal: "ESPERAR"
};

const CONFIG = {
  PARES: { FOREX_IDX: "EUR/USD" },
  CORE: {
    EMA_RAPIDA: 5,
    EMA_LENTA: 20,
    RSI_PERIODO: 9,
    VOLUME_PERIODO: 10,
    SR_LOOKBACK: 20
  },
  LIMIARES: {
    VOLATILIDADE_ALTA: 0.005,
    VOLUME_ALERTA: 1.8,
    RSI_SOBREVENDA: 30,
    RSI_SOBRECOMPRA: 70
  },
  API_KEY: "9cf795b2a4f14d43a049ca935d174ebb"
};

// =============================================
// FUNÇÕES DO NÚCLEO (CORE)
// =============================================
function calcularEMA(dados, periodo) {
  const k = 2 / (periodo + 1);
  let ema = dados[0];
  for (let i = 1; i < dados.length; i++) {
    ema = dados[i] * k + ema * (1 - k);
  }
  return ema;
}

function calcularRSI(closes) {
  if (closes.length < 2) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i-1];
    diff > 0 ? gains += diff : losses -= diff;
  }
  const avgGain = gains / (closes.length - 1);
  const avgLoss = losses / (closes.length - 1);
  return avgLoss === 0 ? 100 : 100 - (100 / (1 + (avgGain / avgLoss)));
}

function calcularSuporteResistencia(velas) {
  const highs = velas.map(v => v.high);
  const lows = velas.map(v => v.low);
  const maxHigh = Math.max(...highs);
  const minLow = Math.min(...lows);
  const pivot = (maxHigh + minLow + velas[velas.length-1].close) / 3;
  return {
    resistencia: pivot + (maxHigh - minLow),
    suporte: pivot - (maxHigh - minLow)
  };
}

function calcularMediaSimples(dados) {
  return dados.reduce((a, b) => a + b, 0) / dados.length;
}

function gerarSinalCore(velas) {
  if (velas.length < 20) return "ESPERAR";
  
  const closes = velas.map(v => v.close);
  const volumes = velas.map(v => v.volume);
  
  // 1. Tendência (EMAs)
  const emaCurta = calcularEMA(closes, CONFIG.CORE.EMA_RAPIDA);
  const emaLonga = calcularEMA(closes, CONFIG.CORE.EMA_LENTA);
  const tendenciaAlta = emaCurta > emaLonga;
  
  // 2. Momentum (RSI)
  const rsi = calcularRSI(closes.slice(-CONFIG.CORE.RSI_PERIODO));
  
  // 3. Volume
  const volumeMedio = calcularMediaSimples(volumes.slice(-CONFIG.CORE.VOLUME_PERIODO));
  const volumeAtual = volumes[volumes.length-1];
  const volumeAlto = volumeAtual > (volumeMedio * CONFIG.LIMIARES.VOLUME_ALERTA);
  
  // 4. Suporte/Resistência
  const sr = calcularSuporteResistencia(velas.slice(-CONFIG.CORE.SR_LOOKBACK));
  const precoAtual = closes[closes.length-1];
  const pertoSuporte = Math.abs(precoAtual - sr.suporte) < (sr.resistencia - sr.suporte) * 0.1;
  const pertoResistencia = Math.abs(precoAtual - sr.resistencia) < (sr.resistencia - sr.suporte) * 0.1;

  // Lógica de decisão
  if (tendenciaAlta && rsi < CONFIG.LIMIARES.RSI_SOBREVENDA && volumeAlto && pertoSuporte) {
    return "CALL";
  }
  
  if (!tendenciaAlta && rsi > CONFIG.LIMIARES.RSI_SOBRECOMPRA && volumeAlto && pertoResistencia) {
    return "PUT";
  }
  
  return "ESPERAR";
}

// =============================================
// FUNÇÕES AUXILIARES E DE MERCADO
// =============================================
function calcularVolatilidade(velas) {
  if (velas.length < 2) return 0;
  const variacoes = [];
  for (let i = 1; i < velas.length; i++) {
    variacoes.push(Math.abs(velas[i].close - velas[i-1].close));
  }
  return calcularMediaSimples(variacoes);
}

async function carregarDados() {
  if (state.dadosHistoricos.M1.length > 0) return;
  
  try {
    const response = await fetch(
      `https://api.twelvedata.com/time_series?symbol=${CONFIG.PARES.FOREX_IDX}&interval=1min&outputsize=50&apikey=${CONFIG.API_KEY}`
    );
    
    if (!response.ok) throw new Error("Falha na API");
    
    const data = await response.json();
    
    if (!data.values || !Array.isArray(data.values)) {
      throw new Error("Formato de dados inválido");
    }
    
    state.dadosHistoricos.M1 = data.values.reverse().map(item => ({
      time: item.datetime,
      open: parseFloat(item.open),
      high: parseFloat(item.high),
      low: parseFloat(item.low),
      close: parseFloat(item.close),
      volume: parseFloat(item.volume) || 1
    }));
  } catch (error) {
    console.error("Erro ao carregar dados:", error);
    // Usar dados de exemplo em caso de falha
    state.dadosHistoricos.M1 = gerarDadosExemplo();
  }
}

function gerarDadosExemplo() {
  const dados = [];
  let preco = 1.0800;
  
  for (let i = 0; i < 50; i++) {
    const variacao = (Math.random() - 0.5) * 0.001;
    preco += variacao;
    
    dados.push({
      time: new Date(Date.now() - i * 60000).toISOString(),
      open: preco - variacao,
      high: preco + Math.abs(variacao),
      low: preco - Math.abs(variacao),
      close: preco,
      volume: 10000 + Math.random() * 5000
    });
  }
  
  return dados.reverse();
}

// =============================================
// SISTEMA HÍBRIDO PRINCIPAL
// =============================================
function determinarModo() {
  return state.volatilidade > CONFIG.LIMIARES.VOLATILIDADE_ALTA
    ? "complex"
    : "core";
}

function atualizarInterface(sinal) {
  const comandoElement = document.getElementById("comando");
  if (!comandoElement) return;
  
  comandoElement.textContent = sinal;
  comandoElement.className = sinal.toLowerCase();
  
  const modoElement = document.getElementById("modo");
  if (modoElement) {
    modoElement.textContent = state.modo === "core" ? "NÚCLEO" : "COMPLEXO";
    modoElement.className = state.modo === "core" ? "mode-core" : "mode-complex";
  }
  
  const volatilidadeElement = document.getElementById("volatilidade");
  if (volatilidadeElement) {
    volatilidadeElement.textContent = `Volatilidade: ${state.volatilidade.toFixed(5)}`;
  }
  
  const atualizacaoElement = document.getElementById("ultima-atualizacao");
  if (atualizacaoElement) {
    atualizacaoElement.textContent = state.ultimaAtualizacao;
  }
}

async function analisarMercado() {
  if (state.leituraEmAndamento) return;
  state.leituraEmAndamento = true;
  
  try {
    // 1. Carregar dados
    await carregarDados();
    
    // 2. Calcular volatilidade
    state.volatilidade = calcularVolatilidade(state.dadosHistoricos.M1);
    
    // 3. Determinar modo de operação
    state.modo = determinarModo();
    
    // 4. Gerar sinal conforme modo
    let sinal;
    if (state.modo === "core") {
      sinal = gerarSinalCore(state.dadosHistoricos.M1);
    } else {
      // Modo complexo (será implementado posteriormente)
      sinal = state.ultimoSinal; // Mantém último sinal válido
    }
    
    // 5. Atualizar estado e interface
    state.ultimoSinal = sinal;
    state.ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR");
    atualizarInterface(sinal);
    
  } catch (error) {
    console.error("Erro na análise:", error);
    atualizarInterface("ERRO");
  } finally {
    state.leituraEmAndamento = false;
  }
}

// =============================================
// CONTROLE DE TEMPO E INICIALIZAÇÃO
// =============================================
function iniciarTimer() {
  setInterval(() => {
    if (state.leituraEmAndamento) return;
    
    // Atualizar timer
    state.timer--;
    const timerElement = document.getElementById("timer");
    if (timerElement) {
      timerElement.textContent = `0:${state.timer.toString().padStart(2, '0')}`;
    }
    
    // Reiniciar ciclo a cada minuto
    if (state.timer <= 0) {
      state.timer = 60;
      analisarMercado();
    }
  }, 1000);
}

function atualizarRelogio() {
  const horaElement = document.getElementById("hora");
  if (horaElement) {
    horaElement.textContent = new Date().toLocaleTimeString("pt-BR");
  }
}

function iniciarAplicativo() {
  // Verificar se elementos essenciais existem
  if (!document.getElementById("comando") || 
      !document.getElementById("timer")) {
    return setTimeout(iniciarAplicativo, 100);
  }
  
  // Iniciar sistemas
  iniciarTimer();
  setInterval(atualizarRelogio, 1000);
  analisarMercado();
}

// Iniciar quando o documento estiver pronto
if (document.readyState === "complete") iniciarAplicativo();
else document.addEventListener("DOMContentLoaded", iniciarAplicativo);
