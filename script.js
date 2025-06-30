// =============================================
// CONFIGURAÇÕES GLOBAIS (ATUALIZADAS)
// =============================================
const state = {
  timer: 60,
  ultimaAtualizacao: "",
  leituraEmAndamento: false,
  dadosHistoricos: { M1: [] },
  modo: "core",
  ultimoSinal: "ESPERAR",
  tentativasAPI: 0,
  usarDadosLocais: false
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
  API_KEY: "9cf795b2a4f14d43a049ca935d174ebb",
  API_TIMEOUT: 3000, // 3 segundos timeout
  MAX_TENTATIVAS_API: 2
};

// =============================================
// FUNÇÕES DO NÚCLEO (CORE) - OTIMIZADAS
// =============================================
function calcularEMA(dados, periodo) {
  if (dados.length === 0) return 0;
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
  
  // Calcular apenas últimos 14 períodos para performance
  const start = Math.max(0, closes.length - 14);
  for (let i = start + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i-1];
    diff > 0 ? gains += diff : losses -= diff;
  }
  
  const periods = closes.length - start - 1;
  const avgGain = gains / periods;
  const avgLoss = losses / periods;
  
  return avgLoss === 0 ? 100 : 100 - (100 / (1 + (avgGain / avgLoss)));
}

function calcularSuporteResistencia(velas) {
  if (velas.length === 0) return { resistencia: 0, suporte: 0 };
  
  // Calcular apenas últimos 20 velas
  const slice = velas.slice(-20);
  const highs = slice.map(v => v.high);
  const lows = slice.map(v => v.low);
  
  const maxHigh = Math.max(...highs);
  const minLow = Math.min(...lows);
  const pivot = (maxHigh + minLow + slice[slice.length-1].close) / 3;
  
  return {
    resistencia: pivot + (maxHigh - minLow),
    suporte: pivot - (maxHigh - minLow)
  };
}

function calcularMediaSimples(dados) {
  if (dados.length === 0) return 0;
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
  const rsi = calcularRSI(closes);
  
  // 3. Volume
  const volumeMedio = calcularMediaSimples(volumes.slice(-CONFIG.CORE.VOLUME_PERIODO));
  const volumeAtual = volumes[volumes.length-1];
  const volumeAlto = volumeAtual > (volumeMedio * CONFIG.LIMIARES.VOLUME_ALERTA);
  
  // 4. Suporte/Resistência
  const sr = calcularSuporteResistencia(velas);
  const precoAtual = closes[closes.length-1];
  const distanciaSuporte = Math.abs(precoAtual - sr.suporte);
  const distanciaResistencia = Math.abs(precoAtual - sr.resistencia);
  const intervalo = sr.resistencia - sr.suporte;
  
  const pertoSuporte = intervalo !== 0 && distanciaSuporte < intervalo * 0.1;
  const pertoResistencia = intervalo !== 0 && distanciaResistencia < intervalo * 0.1;

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
// FUNÇÕES AUXILIARES (PROTEGIDAS CONTRA TRAVAMENTO)
// =============================================
function calcularVolatilidade(velas) {
  if (velas.length < 2) return 0;
  
  const variacoes = [];
  const start = Math.max(0, velas.length - 20); // Últimas 20 velas
  
  for (let i = start + 1; i < velas.length; i++) {
    variacoes.push(Math.abs(velas[i].close - velas[i-1].close));
  }
  
  return calcularMediaSimples(variacoes);
}

async function carregarDados() {
  if (state.dadosHistoricos.M1.length > 0) return;
  
  // Usar dados locais se exceder tentativas
  if (state.tentativasAPI >= CONFIG.MAX_TENTATIVAS_API) {
    state.usarDadosLocais = true;
  }
  
  if (state.usarDadosLocais) {
    state.dadosHistoricos.M1 = gerarDadosExemplo();
    return;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONFIG.API_TIMEOUT);
    
    const response = await fetch(
      `https://api.twelvedata.com/time_series?symbol=${CONFIG.PARES.FOREX_IDX}&interval=1min&outputsize=50&apikey=${CONFIG.API_KEY}`,
      { signal: controller.signal }
    );
    
    clearTimeout(timeout);
    
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
    
    state.tentativasAPI = 0; // Resetar contador
  } catch (error) {
    console.error("Erro ao carregar dados:", error);
    state.tentativasAPI++;
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
  
  return dados;
}

// =============================================
// SISTEMA PRINCIPAL (À PROVA DE TRAVAMENTOS)
// =============================================
function determinarModo() {
  return "core"; // Por enquanto só modo core
}

function atualizarInterface(sinal) {
  try {
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
  } catch (e) {
    console.error("Erro na atualização da interface:", e);
  }
}

async function analisarMercado() {
  if (state.leituraEmAndamento) return;
  
  state.leituraEmAndamento = true;
  const startTime = Date.now();
  
  try {
    // 1. Carregar dados (com timeout protegido)
    await carregarDados();
    
    // 2. Calcular volatilidade
    state.volatilidade = calcularVolatilidade(state.dadosHistoricos.M1);
    
    // 3. Determinar modo
    state.modo = determinarModo();
    
    // 4. Gerar sinal
    let sinal = gerarSinalCore(state.dadosHistoricos.M1);
    
    // 5. Atualizar estado
    state.ultimoSinal = sinal;
    state.ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR");
    
    // 6. Atualizar interface
    atualizarInterface(sinal);
    
  } catch (error) {
    console.error("Erro na análise:", error);
    atualizarInterface("ERRO");
  } finally {
    state.leituraEmAndamento = false;
    const duration = Date.now() - startTime;
    console.log(`Análise concluída em ${duration}ms`);
  }
}

// =============================================
// SISTEMA DE TIMER ROBUSTO
// =============================================
function iniciarTimer() {
  // Executar primeira análise imediatamente
  analisarMercado().catch(console.error);
  
  // Configurar timer periódico
  const timerInterval = setInterval(() => {
    if (state.leituraEmAndamento) {
      return; // Não sobrepor análises
    }
    
    state.timer--;
    
    const timerElement = document.getElementById("timer");
    if (timerElement) {
      timerElement.textContent = `0:${state.timer.toString().padStart(2, '0')}`;
    }
    
    if (state.timer <= 0) {
      state.timer = 60;
      analisarMercado().catch(console.error);
    }
  }, 1000);
}

function atualizarRelogio() {
  try {
    const horaElement = document.getElementById("hora");
    if (horaElement) {
      horaElement.textContent = new Date().toLocaleTimeString("pt-BR");
    }
  } catch (e) {
    console.error("Erro ao atualizar relógio:", e);
  }
}

function iniciarAplicativo() {
  // Tentar até 5 vezes encontrar elementos
  let tentativas = 0;
  const maxTentativas = 5;
  
  const checkElements = () => {
    tentativas++;
    if (document.getElementById("comando") && document.getElementById("timer")) {
      // Elementos prontos, iniciar sistemas
      iniciarTimer();
      setInterval(atualizarRelogio, 1000);
      return;
    }
    
    if (tentativas < maxTentativas) {
      setTimeout(checkElements, 500);
    } else {
      console.error("Elementos críticos não encontrados após 5 tentativas");
    }
  };
  
  checkElements();
}

// Iniciar quando o documento estiver pronto
document.addEventListener("DOMContentLoaded", iniciarAplicativo);
