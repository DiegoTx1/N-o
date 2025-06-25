// =============================================
// CONFIGURAÇÕES GLOBAIS PARA EURUSD M1 (ATUALIZADO)
// =============================================
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
  mercadoAberto: true
};

const CONFIG = {
  API_KEY: "9cf795b2a4f14d43a049ca935d174ebb",
  API_ENDPOINT: "https://twelvedata.p.rapidapi.com",
  HEADERS: {
    "X-RapidAPI-Key": "9cf795b2a4f14d43a049ca935d174ebb",
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
// FUNÇÕES UTILITÁRIAS (CORRIGIDAS)
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
  if (!dados || dados.length === 0 || !dados[dados.length - 1]) return false;
  const ultimaVela = dados[dados.length - 1];
  if (ultimaVela.time !== state.ultimaVelaProcessada) {
    state.ultimaVelaProcessada = ultimaVela.time;
    return true;
  }
  return false;
}

// =============================================
// CÁLCULO DE INDICADORES (OTIMIZADO)
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
  for (let i = 1; i <= periodo; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / periodo;
  let avgLoss = Math.max(losses / periodo, 0.000001);

  for (let i = periodo + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    
    avgGain = (avgGain * (periodo - 1) + gain) / periodo;
    avgLoss = (avgLoss * (periodo - 1) + loss) / periodo;
  }

  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calcularStochastic(highs, lows, closes, periodo = CONFIG.PERIODOS.STOCH) {
  try {
    if (!Array.isArray(closes) || closes.length < periodo) return { k: 50, d: 50 };
    
    const kValues = [];
    for (let i = periodo - 1; i < closes.length; i++) {
      const sliceHigh = highs.slice(i - periodo + 1, i + 1);
      const sliceLow = lows.slice(i - periodo + 1, i + 1);
      const highest = Math.max(...sliceHigh);
      const lowest = Math.min(...sliceLow);
      const range = highest - lowest;
      kValues.push(range > 0 ? ((closes[i] - lowest) / range) * 100 : 50);
    }
    
    const dValue = kValues.length >= 3 ? 
      calcularMedia.simples(kValues.slice(-3), 3) : 50;
    
    return {
      k: kValues[kValues.length - 1] || 50,
      d: dValue || 50
    };
  } catch (e) {
    console.error("Erro no Stochastic:", e);
    return { k: 50, d: 50 };
  }
}

function calcularMACD(closes, rapida = CONFIG.PERIODOS.MACD_RAPIDA, 
                     lenta = CONFIG.PERIODOS.MACD_LENTA, 
                     sinal = CONFIG.PERIODOS.MACD_SINAL) {
  try {
    const emaRapida = calcularMedia.exponencial(closes, rapida);
    const emaLenta = calcularMedia.exponencial(closes, lenta);
    
    if (emaRapida.length < lenta || emaLenta.length < lenta) {
      return { histograma: 0, macdLinha: 0, sinalLinha: 0 };
    }
    
    const macdLine = emaRapida.slice(-emaLenta.length).map((val, idx) => val - emaLenta[idx]);
    const signalLine = calcularMedia.exponencial(macdLine.slice(-30), sinal);
    
    return {
      histograma: macdLine[macdLine.length - 1] - signalLine[signalLine.length - 1],
      macdLinha: macdLine[macdLine.length - 1],
      sinalLinha: signalLine[signalLine.length - 1]
    };
  } catch (e) {
    console.error("Erro no MACD:", e);
    return { histograma: 0, macdLinha: 0, sinalLinha: 0 };
  }
}

function calcularATR(dados, periodo = CONFIG.PERIODOS.ATR) {
  try {
    if (!Array.isArray(dados) || dados.length < 2) return 0;
    
    const trValues = [];
    for (let i = 1; i < dados.length; i++) {
      const tr = Math.max(
        dados[i].high - dados[i].low,
        Math.abs(dados[i].high - dados[i - 1].close),
        Math.abs(dados[i].low - dados[i - 1].close)
      );
      trValues.push(tr);
    }
    
    return calcularMedia.simples(trValues.slice(-periodo), periodo);
  } catch (e) {
    console.error("Erro no ATR:", e);
    return 0;
  }
}

function calcularSuperTrend(dados, periodo = CONFIG.PERIODOS.SUPERTREND, multiplicador = 3) {
  try {
    if (!Array.isArray(dados) || dados.length === 0) return { direcao: 0, valor: 0 };
    
    const atr = calcularATR(dados, periodo) || 0.0001;
    const ultimo = dados[dados.length - 1];
    const hl2 = (ultimo.high + ultimo.low) / 2;
    const upper = hl2 + (multiplicador * atr);
    const lower = hl2 - (multiplicador * atr);
    
    let direcao = 1;
    let valor = upper;
    
    if (dados.length > periodo) {
      const prev = dados[dados.length - 2];
      if (prev.close > valor) {
        direcao = 1;
        valor = Math.min(upper, prev.superTrend || upper);
      } else {
        direcao = -1;
        valor = Math.max(lower, prev.superTrend || lower);
      }
    }
    
    return { direcao, valor };
  } catch (e) {
    console.error("Erro no SuperTrend:", e);
    return { direcao: 0, valor: 0 };
  }
}

// =============================================
// SISTEMA DE TENDÊNCIA (CORRIGIDO)
// =============================================
function avaliarTendencia(closes, highs, lows, volumes) {
  try {
    if (!Array.isArray(closes) || closes.length < 50) return { tendencia: "NEUTRA", forca: 0 };
    
    const ema5 = calcularMedia.exponencial(closes, 5).pop();
    const ema13 = calcularMedia.exponencial(closes, 13).pop();
    const ema50 = calcularMedia.exponencial(closes, 50).pop();
    
    // Direção primária
    let direcao = "NEUTRA";
    if (ema5 > ema13 && ema13 > ema50) direcao = "ALTA";
    if (ema5 < ema13 && ema13 < ema50) direcao = "BAIXA";
    
    // Cálculo de força
    const atr = calcularATR(closes.map((c, i) => ({
      high: highs[i], low: lows[i], close: c
    })), 14);
    
    const distancia = Math.abs(ema5 - ema13);
    let forca = Math.min(100, Math.round((distancia / (atr || 0.0001)) * 50));
    
    // Confirmação de volume
    const volumeAtual = volumes[volumes.length - 1];
    const volumeMedio = calcularMedia.simples(volumes.slice(-20), 20);
    if (volumeAtual > volumeMedio * CONFIG.LIMIARES.VOLUME_ALTO) {
      forca = Math.min(100, forca + 20);
    }
    
    // Classificação final
    if (forca >= 70) return { tendencia: `FORTE_${direcao}`, forca };
    if (forca >= 40) return { tendencia: direcao, forca };
    return { tendencia: "NEUTRA", forca: 0 };
    
  } catch (e) {
    console.error("Erro na avaliação de tendência:", e);
    return { tendencia: "NEUTRA", forca: 0 };
  }
}

// =============================================
// GERADOR DE SINAIS (ATUALIZADO)
// =============================================
function gerarSinal(indicadores) {
  try {
    const { rsi, stoch, macd, close, emaCurta, emaMedia, volume, volumeMedia, superTrend, tendencia } = indicadores;
    
    // Bloqueio durante notícias
    if (state.ultimoScore > 85 && Date.now() - state.ultimaAtualizacao < 30000) {
      return "ESPERAR";
    }
    
    // Sistema de pontuação
    let callScore = 0, putScore = 0;
    
    // Regras para CALL
    if (tendencia.tendencia.includes("ALTA")) callScore += 2;
    if (close > emaCurta) callScore += 1;
    if (macd.histograma > 0) callScore += 1;
    if (rsi < CONFIG.LIMIARES.RSI_OVERSOLD) callScore += 1;
    if (volume > volumeMedia * CONFIG.LIMIARES.VOLUME_ALTO) callScore += 1;
    if (superTrend.direcao > 0) callScore += 1;
    
    // Regras para PUT
    if (tendencia.tendencia.includes("BAIXA")) putScore += 2;
    if (close < emaCurta) putScore += 1;
    if (macd.histograma < 0) putScore += 1;
    if (rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT) putScore += 1;
    if (volume > volumeMedia * CONFIG.LIMIARES.VOLUME_ALTO) putScore += 1;
    if (superTrend.direcao < 0) putScore += 1;
    
    // Determinar sinal
    if (callScore >= 4 && callScore > putScore) return "CALL";
    if (putScore >= 4 && putScore > callScore) return "PUT";
    
    return "ESPERAR";
    
  } catch (e) {
    console.error("Erro na geração de sinal:", e);
    return "ESPERAR";
  }
}

// =============================================
// CORE DO SISTEMA (COM VALIDAÇÕES)
// =============================================
async function obterDadosTwelveData() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  
  try {
    const response = await fetch(`${CONFIG.API_ENDPOINT}/time_series?symbol=${CONFIG.PARES.FOREX}&interval=1min&outputsize=100`, {
      headers: CONFIG.HEADERS,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.values || !Array.isArray(data.values)) {
      throw new Error("Formato de dados inválido");
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
    clearTimeout(timeoutId);
    console.error("Erro na API:", error);
    return [];
  }
}

async function analisarMercado() {
  if (state.leituraEmAndamento || !state.mercadoAberto) return;
  state.leituraEmAndamento = true;
  
  try {
    const dados = await obterDadosTwelveData();
    if (!dados || dados.length === 0) {
      state.leituraEmAndamento = false;
      return;
    }
    
    if (!verificarVelaNova(dados)) {
      state.leituraEmAndamento = false;
      return;
    }
    
    const velaAtual = dados[dados.length - 1];
    const closes = dados.map(v => v.close);
    const highs = dados.map(v => v.high);
    const lows = dados.map(v => v.low);
    const volumes = dados.map(v => v.volume);
    
    // Calcular indicadores
    const rsi = calcularRSI(closes);
    const stoch = calcularStochastic(highs, lows, closes);
    const macd = calcularMACD(closes);
    const superTrend = calcularSuperTrend(dados);
    const tendencia = avaliarTendencia(closes, highs, lows, volumes);
    
    // Gerar sinal
    const indicadores = {
      rsi, stoch, macd,
      close: velaAtual.close,
      emaCurta: calcularMedia.exponencial(closes, 5).pop(),
      emaMedia: calcularMedia.exponencial(closes, 13).pop(),
      volume: velaAtual.volume,
      volumeMedia: calcularMedia.simples(volumes.slice(-20), 20),
      superTrend,
      tendencia
    };
    
    const sinal = gerarSinal(indicadores);
    const score = sinal === "ESPERAR" ? 0 : Math.min(100, 60 +
      (tendencia.forca * 0.3) +
      (Math.abs(macd.histograma) * 10000) +
      (indicadores.volume > indicadores.volumeMedia * CONFIG.LIMIARES.VOLUME_ALTO ? 15 : 0));
    
    // Atualizar estado
    state.ultimoSinal = sinal;
    state.ultimoScore = score;
    state.tendenciaAtual = tendencia.tendencia;
    state.forcaTendencia = tendencia.forca;
    state.ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR");
    
    // Atualizar interface com verificações
    const comandoElement = document.getElementById("comando");
    const scoreElement = document.getElementById("score");
    
    if (comandoElement && scoreElement) {
      comandoElement.textContent = sinal;
      comandoElement.className = sinal.toLowerCase();
      
      scoreElement.textContent = `Confiança: ${score}%`;
      scoreElement.style.color = score >= 85 ? '#00FF00' : 
                                score >= 70 ? '#FFFF00' : '#FF0000';
    } else {
      console.error("Elementos da interface não encontrados!");
    }
    
    console.log("Análise concluída:", {
      time: new Date().toISOString(),
      signal: sinal,
      score,
      trend: tendencia.tendencia,
      rsi,
      macd: macd.histograma
    });
    
  } catch (error) {
    console.error("Erro na análise:", error);
    state.tentativasErro++;
    if (state.tentativasErro > 3) {
      setTimeout(() => location.reload(), 15000);
    }
  } finally {
    state.leituraEmAndamento = false;
  }
}

// =============================================
// CONTROLE DE TEMPO (OTIMIZADO)
// =============================================
function sincronizarTimer() {
  clearTimeout(state.intervaloAtual);
  
  // Evitar sobreposição de análises
  if (state.leituraEmAndamento) {
    state.intervaloAtual = setTimeout(sincronizarTimer, 1000);
    return;
  }
  
  const agora = new Date();
  const segundos = agora.getSeconds();
  state.timer = 60 - segundos;
  
  const timerElement = document.getElementById("timer");
  if (timerElement) {
    timerElement.textContent = formatarTimer(state.timer);
    timerElement.style.color = state.timer <= 10 ? '#FF0000' : '#00FF00';
  }
  
  if (state.timer <= 1) {
    setTimeout(() => {
      analisarMercado().finally(sincronizarTimer);
    }, 1000 - agora.getMilliseconds());
  } else {
    state.intervaloAtual = setTimeout(sincronizarTimer, 1000);
  }
}

// =============================================
// INICIALIZAÇÃO (COM VERIFICAÇÕES)
// =============================================
function verificarDependencias() {
  const elementosNecessarios = ['comando', 'score', 'hora', 'timer'];
  const faltando = elementosNecessarios.filter(id => !document.getElementById(id));
  
  if (faltando.length > 0) {
    console.error("Elementos HTML faltando:", faltando);
    return false;
  }
  return true;
}

function iniciarAplicativo() {
  if (!verificarDependencias()) {
    console.error("Não foi possível iniciar - elementos faltando");
    return;
  }
  
  console.log("Iniciando aplicativo EURUSD M1...");
  state.mercadoAberto = true;
  
  // Configurações iniciais
  setInterval(atualizarRelogio, 1000);
  sincronizarTimer();
  
  // Primeira análise com delay seguro
  setTimeout(() => {
    analisarMercado()
      .then(() => console.log("Primeira análise concluída"))
      .catch(e => console.error("Falha na primeira análise:", e));
  }, 2000);
}

// Iniciar quando o DOM estiver pronto
if (document.readyState === "complete") {
  iniciarAplicativo();
} else {
  document.addEventListener("DOMContentLoaded", iniciarAplicativo);
}

// Monitoramento de saúde
setInterval(() => {
  console.log("Status do sistema:", {
    ultimoSinal: state.ultimoSinal,
    ultimoScore: state.ultimoScore,
    tentativasErro: state.tentativasErro,
    memoria: window.performance?.memory?.usedJSHeapSize || 'N/A'
  });
}, 60000);
