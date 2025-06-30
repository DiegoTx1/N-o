// =============================================
// CONFIGURAÇÕES GLOBAIS (OTIMIZADA PARA EURUSD)
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
  marketOpen: true,
  tendenciaDetectada: "NEUTRA",
  forcaTendencia: 0,
  dadosHistoricos: [],
  resistenciaKey: 0,
  suporteKey: 0,
  cooldown: 0
};

const CONFIG = {
  PARES: {
    FOREX_IDX: "EUR/USD"
  },
  PERIODOS: {
    RSI: 9,
    STOCH_K: 14,
    STOCH_D: 3,
    EMA_CURTA: 5,
    EMA_MEDIA: 13,
    EMA_LONGA: 200,
    MACD_RAPIDA: 6,
    MACD_LENTA: 13,
    MACD_SINAL: 9,
    ANALISE_LATERAL: 20,
    ATR: 14,
    SUPERTREND: 7
  },
  LIMIARES: {
    SCORE_ALTO: 85,
    RSI_OVERBOUGHT: 70,
    RSI_OVERSOLD: 30,
    STOCH_OVERBOUGHT: 85,
    STOCH_OVERSOLD: 15,
    VARIACAO_LATERAL: 0.005,
    LATERALIDADE_LIMIAR: 0.0003
  },
  HORARIOS_OPERACAO: [
    { inicio: 7, fim: 17 } // Horário de Londres (UTC)
  ]
};

// =============================================
// GERENCIADOR DE CHAVES API
// =============================================
const API_KEYS = [
  "9cf795b2a4f14d43a049ca935d174ebb",
  "0105e6681b894e0185704171c53f5075"
];
let currentKeyIndex = 0;

// =============================================
// VERIFICAÇÃO DE HORÁRIO DE OPERAÇÃO
// =============================================
function verificarHorarioOperacao() {
  const horaUTC = new Date().getUTCHours();
  return CONFIG.HORARIOS_OPERACAO.some(
    horario => horaUTC >= horario.inicio && horaUTC < horario.fim
  );
}

// =============================================
// SISTEMA DE TENDÊNCIA SIMPLIFICADO
// =============================================
function avaliarTendencia(ema5, ema13) {
  const gradiente = (ema5 - ema13) / ema13;
  const forca = Math.min(100, Math.abs(gradiente * 10000));
  
  if (forca > 75) {
    return gradiente > 0 
      ? { tendencia: "FORTE_ALTA", forca }
      : { tendencia: "FORTE_BAIXA", forca };
  }
  
  return gradiente > 0 
    ? { tendencia: "ALTA", forca } 
    : { tendencia: "BAIXA", forca };
}

// =============================================
// DETECÇÃO DE LATERALIDADE
// =============================================
function detectarLateralidade(closes) {
  const periodo = CONFIG.PERIODOS.ANALISE_LATERAL;
  const variacoes = [];
  
  for (let i = closes.length - periodo; i < closes.length - 1; i++) {
    variacoes.push(Math.abs(closes[i + 1] - closes[i]));
  }
  
  const mediaVariacao = variacoes.reduce((a, b) => a + b, 0) / variacoes.length;
  return mediaVariacao < CONFIG.LIMIARES.LATERALIDADE_LIMIAR;
}

// =============================================
// SUPORTE/RESISTÊNCIA DINÂMICO
// =============================================
function calcularZonasPreco(dados) {
  const highs = dados.map(v => v.high);
  const lows = dados.map(v => v.low);
  return {
    resistencia: Math.max(...highs),
    suporte: Math.min(...lows)
  };
}

// =============================================
// GERADOR DE SINAIS OTIMIZADO
// =============================================
function gerarSinal(indicadores, lateral) {
  const { rsi, stoch, macd, close, emaCurta, tendencia } = indicadores;
  
  // Atualizar zonas de preço
  const zonas = calcularZonasPreco(state.dadosHistoricos.slice(-50));
  state.suporteKey = zonas.suporte;
  state.resistenciaKey = zonas.resistencia;

  // Evitar operações em lateralidade
  if (lateral) return "ESPERAR";

  // Sinais baseados em tendência forte
  if (tendencia.forca > 80) {
    if (tendencia.tendencia.includes("ALTA") && close > emaCurta && macd.histograma > 0) 
      return "CALL";
    
    if (tendencia.tendencia.includes("BAIXA") && close < emaCurta && macd.histograma < 0) 
      return "PUT";
  }

  // Breakout de suporte/resistência
  const margemBreakout = (state.resistenciaKey - state.suporteKey) * 0.1;
  if (close > state.resistenciaKey + margemBreakout) return "CALL";
  if (close < state.suporteKey - margemBreakout) return "PUT";

  // Sinais de reversão
  if (rsi < 25 && close > emaCurta) return "CALL";
  if (rsi > 75 && close < emaCurta) return "PUT";

  return "ESPERAR";
}

// =============================================
// CALCULADOR DE CONFIANÇA
// =============================================
function calcularScore(sinal, indicadores) {
  let score = 65;
  
  if (sinal === "CALL" && indicadores.tendencia.tendencia.includes("ALTA")) score += 25;
  if (sinal === "PUT" && indicadores.tendencia.tendencia.includes("BAIXA")) score += 25;
  
  if (sinal === "CALL" && indicadores.close > indicadores.emaMedia) score += 15;
  if (sinal === "PUT" && indicadores.close < indicadores.emaMedia) score += 15;
  
  return Math.min(100, score);
}

// =============================================
// FUNÇÕES UTILITÁRIAS
// =============================================
function formatarTimer(segundos) {
  return `0:${segundos.toString().padStart(2, '0')}`;
}

function atualizarRelogio() {
  const now = new Date();
  state.ultimaAtualizacao = now.toLocaleTimeString("pt-BR", {
    hour: '2-digit',
    minute: '2-digit'
  });
  
  const elementoHora = document.getElementById("hora");
  if (elementoHora) elementoHora.textContent = state.ultimaAtualizacao;
  
  state.marketOpen = verificarHorarioOperacao();
}

function atualizarInterface(sinal, score) {
  const comandoElement = document.getElementById("comando");
  if (!comandoElement) return;
  
  if (!state.marketOpen) {
    comandoElement.textContent = "Mercado Fechado";
    comandoElement.className = "esperar";
    return;
  }
  
  comandoElement.textContent = sinal;
  comandoElement.className = sinal.toLowerCase();
  
  if (sinal === "CALL") comandoElement.textContent += " 📈";
  else if (sinal === "PUT") comandoElement.textContent += " 📉";
  else comandoElement.textContent += " ✋";
  
  const scoreElement = document.getElementById("score");
  if (scoreElement) {
    scoreElement.textContent = `Confiança: ${score}%`;
    scoreElement.style.color = score >= 85 ? '#00ff00' : score >= 70 ? '#ffff00' : '#ff0000';
  }
}

// =============================================
// INDICADORES TÉCNICOS (OTIMIZADOS)
// =============================================
const calcularMedia = {
  exponencial: (dados, periodo) => {
    if (dados.length < periodo) return 0;
    
    const k = 2 / (periodo + 1);
    let ema = dados.slice(0, periodo).reduce((a, b) => a + b, 0) / periodo;
    
    for (let i = periodo; i < dados.length; i++) {
      ema = dados[i] * k + ema * (1 - k);
    }
    
    return ema;
  }
};

function calcularRSI(closes) {
  if (closes.length < 10) return 50;
  
  let gains = 0;
  let losses = 0;
  
  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    diff > 0 ? gains += diff : losses -= diff;
  }
  
  const avgGain = gains / (closes.length - 1);
  const avgLoss = losses / (closes.length - 1);
  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  
  return 100 - (100 / (1 + rs));
}

function calcularStochastic(highs, lows, closes) {
  const periodoK = CONFIG.PERIODOS.STOCH_K;
  if (closes.length < periodoK) return { k: 50, d: 50 };
  
  const currentClose = closes[closes.length - 1];
  const highSlice = highs.slice(-periodoK);
  const lowSlice = lows.slice(-periodoK);
  
  const highestHigh = Math.max(...highSlice);
  const lowestLow = Math.min(...lowSlice);
  const range = highestHigh - lowestLow;
  
  const k = range !== 0 ? ((currentClose - lowestLow) / range) * 100 : 50;
  return { k, d: k }; // Simplificado para EURUSD
}

function calcularMACD(closes) {
  const emaRapida = calcularMedia.exponencial(closes, CONFIG.PERIODOS.MACD_RAPIDA);
  const emaLenta = calcularMedia.exponencial(closes, CONFIG.PERIODOS.MACD_LENTA);
  const macdLinha = emaRapida - emaLenta;
  
  return {
    histograma: macdLinha,
    macdLinha,
    sinalLinha: 0 // Simplificado para performance
  };
}

function calcularSuperTrend(dados) {
  if (dados.length < 14) return { direcao: 0, valor: 0 };
  
  const current = dados[dados.length - 1];
  const hl2 = (current.high + current.low) / 2;
  const atr = 0.0005; // Valor fixo para EURUSD
  
  const upperBand = hl2 + (3 * atr);
  const lowerBand = hl2 - (3 * atr);
  
  return current.close > upperBand 
    ? { direcao: 1, valor: upperBand } 
    : { direcao: -1, valor: lowerBand };
}

// =============================================
// CORE DO SISTEMA (OTIMIZADO)
// =============================================
async function analisarMercado() {
  if (state.leituraEmAndamento || !state.marketOpen) return;
  state.leituraEmAndamento = true;
  
  try {
    const dados = await obterDadosTwelveData();
    if (dados.length < 50) throw new Error("Dados insuficientes");
    state.dadosHistoricos = dados;
    
    const velaAtual = dados[dados.length - 1];
    const closes = dados.map(v => v.close);
    const highs = dados.map(v => v.high);
    const lows = dados.map(v => v.low);

    // Calcular indicadores
    const ema5 = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_CURTA);
    const ema13 = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_MEDIA);
    const tendencia = avaliarTendencia(ema5, ema13);
    const lateral = detectarLateralidade(closes);
    const rsi = calcularRSI(closes);
    const stoch = calcularStochastic(highs, lows, closes);
    const macd = calcularMACD(closes);
    const superTrend = calcularSuperTrend(dados);

    const indicadores = {
      rsi,
      stoch,
      macd,
      emaCurta: ema5,
      emaMedia: ema13,
      close: velaAtual.close,
      tendencia
    };

    // Gerar sinal
    let sinal = gerarSinal(indicadores, lateral);
    const score = calcularScore(sinal, indicadores);
    
    // Atualizar estado e interface
    state.ultimoSinal = sinal;
    state.ultimoScore = score;
    state.ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR");
    state.ultimos.unshift(`${state.ultimaAtualizacao} - ${sinal} (${score}%)`);
    if (state.ultimos.length > 5) state.ultimos.pop();
    
    atualizarInterface(sinal, score);
    
  } catch (e) {
    console.error("Erro na análise:", e);
    atualizarInterface("ERRO", 0);
  } finally {
    state.leituraEmAndamento = false;
  }
}

// =============================================
// API DE DADOS (SIMPLIFICADA)
// =============================================
async function obterDadosTwelveData() {
  try {
    const apiKey = API_KEYS[currentKeyIndex];
    const response = await fetch(
      `https://api.twelvedata.com/time_series?symbol=EUR/USD&interval=1min&apikey=${apiKey}&outputsize=100`
    );
    
    if (!response.ok) throw new Error("Falha na API");
    
    const data = await response.json();
    return data.values.map(item => ({
      open: parseFloat(item.open),
      high: parseFloat(item.high),
      low: parseFloat(item.low),
      close: parseFloat(item.close),
      volume: parseFloat(item.volume)
    })).reverse();
    
  } catch (e) {
    console.error("Erro API:", e);
    currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
    return [];
  }
}

// =============================================
// CONTROLE DE TEMPO
// =============================================
function sincronizarTimer() {
  clearInterval(state.intervaloAtual);
  state.timer = 60;
  
  state.intervaloAtual = setInterval(() => {
    const timerElement = document.getElementById("timer");
    state.timer--;
    
    if (timerElement) {
      timerElement.textContent = formatarTimer(state.timer);
      timerElement.style.color = state.timer <= 5 ? 'red' : '';
    }
    
    if (state.timer <= 0) {
      clearInterval(state.intervaloAtual);
      analisarMercado().finally(sincronizarTimer);
    }
  }, 1000);
}

// =============================================
// INICIALIZAÇÃO
// =============================================
function iniciarAplicativo() {
  setInterval(atualizarRelogio, 30000);
  sincronizarTimer();
  
  // Criar elementos mínimos da interface
  const container = document.createElement('div');
  container.innerHTML = `
    <div id="painel">
      <div id="hora">00:00</div>
      <div id="timer">1:00</div>
      <div id="comando">--</div>
      <div id="score">--</div>
      <ul id="ultimos"></ul>
    </div>
  `;
  document.body.appendChild(container);
  
  // Estilos básicos
  const style = document.createElement('style');
  style.textContent = `
    #painel {
      font-family: Arial, sans-serif;
      padding: 15px;
      background: #1e2a38;
      color: white;
      border-radius: 8px;
      width: 250px;
    }
    #comando {
      font-size: 24px;
      font-weight: bold;
      margin: 10px 0;
      text-align: center;
    }
    .call { color: #00ff00; }
    .put { color: #ff0000; }
    .esperar { color: #ffff00; }
  `;
  document.head.appendChild(style);
}

document.addEventListener("DOMContentLoaded", iniciarAplicativo);
