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
  if (!dados || dados.length === 0) return false;
  
  const ultimaVela = dados[dados.length - 1];
  const timestamp = new Date(ultimaVela.time).getTime();
  
  if (!state.ultimaVelaProcessada || timestamp > state.ultimaVelaProcessada) {
    state.ultimaVelaProcessada = timestamp;
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
    
    const startIndex = emaRapida.length - emaLenta.length;
    const macdLine = emaRapida.slice(startIndex).map((val, idx) => val - emaLenta[idx]);
    const signalLine = calcularMedia.exponencial(macdLine, sinal);
    
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
    
    // Versão simplificada sem dependência de estado anterior
    const upper = hl2 + (multiplicador * atr);
    const lower = hl2 - (multiplicador * atr);
    
    return {
      direcao: ultimo.close > upper ? 1 : ultimo.close < lower ? -1 : 0,
      valor: ultimo.close > upper ? upper : ultimo.close < lower ? lower : hl2
    };
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
    
    // Usar apenas os últimos dados necessários
    const sliceSize = Math.max(50, CONFIG.PERIODOS.EMA_LONGA);
    const slicedCloses = closes.slice(-sliceSize);
    
    const ema5 = calcularMedia.exponencial(slicedCloses, CONFIG.PERIODOS.EMA_CURTA).pop() || slicedCloses[slicedCloses.length - 1];
    const ema13 = calcularMedia.exponencial(slicedCloses, CONFIG.PERIODOS.EMA_MEDIA).pop() || slicedCloses[slicedCloses.length - 1];
    const ema50 = calcularMedia.exponencial(slicedCloses, CONFIG.PERIODOS.EMA_LONGA).pop() || slicedCloses[slicedCloses.length - 1];
    
    // Direção primária
    let direcao = "NEUTRA";
    if (ema5 > ema13 && ema13 > ema50) direcao = "ALTA";
    else if (ema5 < ema13 && ema13 < ema50) direcao = "BAIXA";
    
    // Cálculo de força
    const dadosParaATR = [];
    for (let i = closes.length - sliceSize; i < closes.length; i++) {
      dadosParaATR.push({
        high: highs[i],
        low: lows[i],
        close: closes[i]
      });
    }
    const atr = calcularATR(dadosParaATR, 14) || 0.0001;
    
    const distancia = Math.abs(ema5 - ema13);
    let forca = Math.min(100, Math.round((distancia / atr) * 50));
    
    // Confirmação de volume
    const volumeAtual = volumes[volumes.length - 1];
    const volumeMedio = calcularMedia.simples(volumes.slice(-CONFIG.PERIODOS.SMA_VOLUME), CONFIG.PERIODOS.SMA_VOLUME);
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
    
    // Regra especial para tendências fortes
    if (tendencia.forca > 80) {
      if (tendencia.tendencia.includes("ALTA") && callScore >= 2) return "CALL";
      if (tendencia.tendencia.includes("BAIXA") && putScore >= 2) return "PUT";
    }
    
    // Determinar sinal (limite reduzido para 3 pontos)
    if (callScore >= 3 && callScore > putScore) return "CALL";
    if (putScore >= 3 && putScore > callScore) return "PUT";
    
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
    state.tentativasErro++;
    if (state.tentativasErro > 3) {
      console.error("Muitas tentativas falhas - recarregando aplicativo");
      setTimeout(() => location.reload(), 10000);
    }
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
    
    // Atualizar interface
    const comandoElement = document.getElementById("comando");
    const scoreElement = document.getElementById("score");
    
    if (comandoElement && scoreElement) {
      comandoElement.textContent = sinal;
      comandoElement.className = sinal.toLowerCase();
      
      scoreElement.textContent = `Confiança: ${score}%`;
      scoreElement.style.color = score >= CONFIG.LIMIARES.SCORE_ALTO ? '#00FF00' : 
                                score >= CONFIG.LIMIARES.SCORE_MEDIO ? '#FFFF00' : '#FF0000';
    }
    
    // Log detalhado para depuração
    console.log("Análise concluída:", {
      time: new Date().toISOString(),
      signal: sinal,
      score,
      trend: tendencia.tendencia,
      trendStrength: tendencia.forca,
      rsi,
      stochK: stoch.k,
      stochD: stoch.d,
      macdHist: macd.histograma,
      ema5: indicadores.emaCurta,
      ema13: indicadores.emaMedia,
      volumeRatio: (indicadores.volume / indicadores.volumeMedia).toFixed(2),
      superTrendDir: superTrend.direcao,
      callScore: indicadores.callScore,
      putScore: indicadores.putScore
    });
    
  } catch (error) {
    console.error("Erro na análise:", error);
  } finally {
    state.leituraEmAndamento = false;
  }
}

// =============================================
// CONTROLE DE TEMPO (OTIMIZADO)
// =============================================
function sincronizarTimer() {
  clearTimeout(state.intervaloAtual);
  
  // Disparar análise a cada minuto
  const agora = new Date();
  const msAteProximoMinuto = 60000 - (agora.getSeconds() * 1000 + agora.getMilliseconds());
  
  state.intervaloAtual = setTimeout(() => {
    analisarMercado();
    sincronizarTimer(); // Reagendar para o próximo minuto
  }, msAteProximoMinuto);
  
  // Atualizar contador visual
  state.timer = Math.floor(msAteProximoMinuto / 1000);
  const timerElement = document.getElementById("timer");
  if (timerElement) {
    timerElement.textContent = formatarTimer(state.timer);
    timerElement.style.color = state.timer <= 10 ? '#FF0000' : '#00FF00';
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
  state.ultimaVelaProcessada = null;
  
  // Configurações iniciais
  setInterval(atualizarRelogio, 1000);
  sincronizarTimer();
  
  // Primeira análise
  setTimeout(() => analisarMercado(), 2000);
  
  // Monitoramento de saúde
  setInterval(() => {
    console.log("Status do sistema:", {
      ultimoSinal: state.ultimoSinal,
      ultimoScore: state.ultimoScore,
      tentativasErro: state.tentativasErro,
      memoria: window.performance?.memory?.usedJSHeapSize || 'N/A'
    });
  }, 60000);
}

// Iniciar quando o DOM estiver pronto
if (document.readyState === "complete") {
  iniciarAplicativo();
} else {
  document.addEventListener("DOMContentLoaded", iniciarAplicativo);
}
