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
  usarDadosLocais: false,
  volatilidade: 0,
  timerInterval: null
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
    VOLUME_ALERTA: 1.4,
    RSI_SOBREVENDA: 40,
    RSI_SOBRECOMPRA: 60,
    SCORE_MINIMO: 65
  },
  API_KEY: "9cf795b2a4f14d43a049ca935d174ebb",
  API_TIMEOUT: 3000,
  MAX_TENTATIVAS_API: 2
};

// =============================================
// FUNÇÕES DO NÚCLEO (CORE) - OTIMIZADAS
// =============================================
function calcularEMA(dados, periodo) {
  if (dados.length < periodo) return 0;
  const k = 2 / (periodo + 1);
  let ema = dados[0];
  for (let i = 1; i < dados.length; i++) {
    ema = dados[i] * k + ema * (1 - k);
  }
  return ema;
}

function calcularRSI(closes) {
  if (closes.length < 14) return 50;
  
  let gains = 0;
  let losses = 0;
  
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
  if (velas.length < 20) return { resistencia: 0, suporte: 0 };
  
  const slice = velas.slice(-20);
  const highs = slice.map(v => v.high);
  const lows = slice.map(v => v.low);
  
  return {
    resistencia: Math.max(...highs),
    suporte: Math.min(...lows)
  };
}

function calcularMediaSimples(dados) {
  if (dados.length === 0) return 0;
  return dados.reduce((a, b) => a + b, 0) / dados.length;
}

function gerarSinalCore(velas) {
  if (velas.length < 30) {
    console.log("Aguardando mais dados...");
    return "ESPERAR";
  }
  
  const closes = velas.map(v => v.close);
  const volumes = velas.map(v => v.volume);
  
  const emaCurta = calcularEMA(closes, CONFIG.CORE.EMA_RAPIDA);
  const emaLonga = calcularEMA(closes, CONFIG.CORE.EMA_LENTA);
  const tendenciaAlta = emaCurta > emaLonga;
  
  const rsi = calcularRSI(closes);
  
  const volumeMedio = calcularMediaSimples(volumes.slice(-CONFIG.CORE.VOLUME_PERIODO));
  const volumeAtual = volumes[volumes.length-1];
  const volumeAlto = volumeAtual > (volumeMedio * CONFIG.LIMIARES.VOLUME_ALERTA);
  
  const sr = calcularSuporteResistencia(velas);
  const precoAtual = closes[closes.length-1];
  const intervalo = sr.resistencia - sr.suporte;
  
  let pertoSuporte = false;
  let pertoResistencia = false;
  
  if (intervalo > 0) {
    pertoSuporte = (precoAtual - sr.suporte) < (intervalo * 0.25);
    pertoResistencia = (sr.resistencia - precoAtual) < (intervalo * 0.25);
  }

  // Sistema de pontuação flexível
  let pontosCall = 0;
  let pontosPut = 0;
  
  if (tendenciaAlta) pontosCall += 30;
  if (rsi < CONFIG.LIMIARES.RSI_SOBREVENDA) pontosCall += 25;
  if (volumeAlto) pontosCall += 20;
  if (pertoSuporte) pontosCall += 25;
  
  if (!tendenciaAlta) pontosPut += 30;
  if (rsi > CONFIG.LIMIARES.RSI_SOBRECOMPRA) pontosPut += 25;
  if (volumeAlto) pontosPut += 20;
  if (pertoResistencia) pontosPut += 25;
  
  console.log(`Pontuação CALL: ${pontosCall} | PUT: ${pontosPut}`);
  console.log(`Tendência: ${tendenciaAlta ? 'Alta' : 'Baixa'} | RSI: ${rsi.toFixed(2)} | Volume: ${volumeAlto ? 'Alto' : 'Normal'}`);
  console.log(`Suporte: ${sr.suporte.toFixed(5)} | Resistência: ${sr.resistencia.toFixed(5)} | Preço: ${precoAtual.toFixed(5)}`);
  
  if (pontosCall >= CONFIG.LIMIARES.SCORE_MINIMO) {
    return "CALL";
  }
  
  if (pontosPut >= CONFIG.LIMIARES.SCORE_MINIMO) {
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
  for (let i = 1; i < velas.length; i++) {
    variacoes.push(Math.abs(velas[i].close - velas[i-1].close));
  }
  
  return calcularMediaSimples(variacoes);
}

async function carregarDados() {
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
    
    // Aumentado para 200 velas para melhor precisão
    const response = await fetch(
      `https://api.twelvedata.com/time_series?symbol=${CONFIG.PARES.FOREX_IDX}&interval=1min&outputsize=200&apikey=${CONFIG.API_KEY}`,
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
    
    state.tentativasAPI = 0;
  } catch (error) {
    console.error("Erro ao carregar dados:", error);
    state.tentativasAPI++;
    state.dadosHistoricos.M1 = gerarDadosExemplo();
  }
}

function gerarDadosExemplo() {
  const dados = [];
  let preco = 1.0800;
  
  // Gerar 200 velas de exemplo
  for (let i = 0; i < 200; i++) {
    const variacao = (Math.random() - 0.5) * 0.002;
    preco += variacao;
    
    dados.push({
      time: new Date(Date.now() - i * 60000).toISOString(),
      open: preco - variacao,
      high: preco + Math.abs(variacao) * 1.2,
      low: preco - Math.abs(variacao) * 1.2,
      close: preco,
      volume: 10000 + Math.random() * 10000
    });
  }
  
  return dados;
}

// =============================================
// SISTEMA PRINCIPAL (À PROVA DE TRAVAMENTOS)
// =============================================
function determinarModo() {
  return "core";
}

function atualizarInterface(sinal) {
  try {
    const comandoElement = document.getElementById("comando");
    if (!comandoElement) return;
    
    comandoElement.textContent = sinal;
    comandoElement.className = sinal.toLowerCase();
    
    // Adicionar ícones visuais
    if (sinal === "CALL") {
      comandoElement.textContent = "CALL 📈";
      comandoElement.style.color = '#00ff00';
    } else if (sinal === "PUT") {
      comandoElement.textContent = "PUT 📉";
      comandoElement.style.color = '#ff0000';
    } else {
      comandoElement.textContent = "ESPERAR ✋";
      comandoElement.style.color = '#ffff00';
    }
    
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
  
  try {
    await carregarDados();
    state.volatilidade = calcularVolatilidade(state.dadosHistoricos.M1);
    state.modo = determinarModo();
    let sinal = gerarSinalCore(state.dadosHistoricos.M1);
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
// SISTEMA DE TIMER SINCRONIZADO (CORREÇÃO DEFINITIVA)
// =============================================
function sincronizarTimer() {
  clearInterval(state.timerInterval);
  
  // Sincronizar com o relógio real
  const agora = new Date();
  const segundos = agora.getSeconds();
  state.timer = 60 - segundos;
  
  const timerElement = document.getElementById("timer");
  if (timerElement) {
    timerElement.textContent = `0:${state.timer.toString().padStart(2, '0')}`;
    timerElement.style.color = state.timer <= 5 ? 'red' : '';
  }
  
  state.timerInterval = setInterval(() => {
    state.timer--;
    
    if (timerElement) {
      timerElement.textContent = `0:${state.timer.toString().padStart(2, '0')}`;
      timerElement.style.color = state.timer <= 5 ? 'red' : '';
    }
    
    if (state.timer <= 0) {
      clearInterval(state.timerInterval);
      analisarMercado().finally(sincronizarTimer);
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
  let tentativas = 0;
  const maxTentativas = 5;
  
  const checkElements = () => {
    tentativas++;
    if (document.getElementById("comando") && document.getElementById("timer")) {
      // Usar timer sincronizado
      sincronizarTimer();
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

document.addEventListener("DOMContentLoaded", iniciarAplicativo);
