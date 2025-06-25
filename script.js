// =============================================
// CONFIGURAÇÕES GLOBAIS PARA EURUSD M1 (REVISADO E CORRIGIDO)
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
  mercadoAberto: true,
  ultimoMinutoProcessado: -1
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
// FUNÇÕES UTILITÁRIAS (REVISADAS E CORRIGIDAS)
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
  
  const ultimaVela = dados[dados.length - 1];
  const velaTime = new Date(ultimaVela.time + " UTC");
  const minutoVela = velaTime.getUTCMinutes();
  
  return minutoVela === minutoAtual;
}

// =============================================
// CÁLCULO DE INDICADORES (REVISADO E CORRIGIDO)
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
    
    const startIndex = Math.max(0, emaRapida.length - emaLenta.length);
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
// SISTEMA DE TENDÊNCIA (REVISADO E CORRIGIDO)
// =============================================
function avaliarTendencia(closes, highs, lows, volumes) {
  try {
    if (!Array.isArray(closes) || closes.length < 50) return { tendencia: "NEUTRA", forca: 0 };
    
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
// GERADOR DE SINAIS (REVISADO E CORRIGIDO)
// =============================================
function gerarSinal(indicadores) {
  try {
    const { rsi, stoch, macd, close, emaCurta, emaMedia, volume, volumeMedia, superTrend, tendencia } = indicadores;
    
    // Sistema de pontuação
    let callScore = 0, putScore = 0;
    
    // Regras para CALL (limiar reduzido)
    if (tendencia.tendencia.includes("ALTA")) callScore += 1;
    if (close > emaCurta && close > emaMedia) callScore += 2;
    if (macd.histograma > 0 && macd.macdLinha > 0) callScore += 1;
    if (rsi < 40) callScore += 1;
    if (volume > volumeMedia) callScore += 1;
    if (superTrend.direcao > 0) callScore += 1;
    
    // Regras para PUT
    if (tendencia.tendencia.includes("BAIXA")) putScore += 1;
    if (close < emaCurta && close < emaMedia) putScore += 2;
    if (macd.histograma < 0 && macd.macdLinha < 0) putScore += 1;
    if (rsi > 60) putScore += 1;
    if (volume > volumeMedia) putScore += 1;
    if (superTrend.direcao < 0) putScore += 1;
    
    console.log("Pontuações:", {callScore, putScore});
    console.log("Regras CALL:", {
      tendencia: tendencia.tendencia.includes("ALTA"),
      emas: close > emaCurta && close > emaMedia,
      macd: macd.histograma > 0 && macd.macdLinha > 0,
      rsi: rsi < 40,
      volume: volume > volumeMedia,
      supertrend: superTrend.direcao > 0
    });
    
    // Determinar sinal (limiar reduzido)
    if (callScore >= 1 && callScore >= putScore) return "CALL";
    if (putScore >= 1 && putScore >= callScore) return "PUT";
    
    return "ESPERAR";
    
  } catch (e) {
    console.error("Erro na geração de sinal:", e);
    return "ESPERAR";
  }
}

// =============================================
// CORE DO SISTEMA (REVISADO E CORRIGIDO)
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
    return dados;
    
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
  console.log(`Iniciando análise para minuto: ${minutoAtual}`);
  
  try {
    const dados = await obterDadosTwelveData();
    if (!dados || dados.length === 0) {
      console.log("Nenhum dado recebido da API");
      state.leituraEmAndamento = false;
      return;
    }
    
    if (!verificarVelaNova(dados)) {
      console.log("Nenhuma vela nova detectada");
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
    
    console.log("Detalhes da Análise:", {
      rsi, 
      stochK: stoch.k, 
      stochD: stoch.d,
      macdHist: macd.histograma,
      macdLinha: macd.macdLinha,
      sinalLinha: macd.sinalLinha,
      superTrend: superTrend.direcao,
      tendencia: tendencia.tendencia,
      forca: tendencia.forca,
      close: velaAtual.close,
      emaCurta: calcularMedia.exponencial(closes.slice(-30), CONFIG.PERIODOS.EMA_CURTA).pop() || velaAtual.close,
      emaMedia: calcularMedia.exponencial(closes.slice(-30), CONFIG.PERIODOS.EMA_MEDIA).pop() || velaAtual.close,
      volume: velaAtual.volume,
      volumeMedia: calcularMedia.simples(volumes.slice(-CONFIG.PERIODOS.SMA_VOLUME), CONFIG.PERIODOS.SMA_VOLUME)
    });
    
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
    state.ultimaAtualizacao = agora.toLocaleTimeString("pt-BR");
    state.ultimaVelaProcessada = velaAtual.time;
    
    // Atualizar interface
    const comandoElement = document.getElementById("comando");
    const scoreElement = document.getElementById("score");
    const timerElement = document.getElementById("timer");
    const horaElement = document.getElementById("hora");
    
    if (comandoElement) {
      comandoElement.textContent = sinal;
      comandoElement.className = sinal.toLowerCase();
    }
    
    if (scoreElement) {
      scoreElement.textContent = `Confiança: ${score}%`;
      scoreElement.style.color = score >= CONFIG.LIMIARES.SCORE_ALTO ? '#00FF00' : 
                                score >= CONFIG.LIMIARES.SCORE_MEDIO ? '#FFFF00' : '#FF0000';
    }
    
    if (timerElement) {
      timerElement.textContent = formatarTimer(state.timer);
    }
    
    if (horaElement) {
      horaElement.textContent = state.ultimaAtualizacao;
    }
    
    console.log(`Sinal gerado: ${sinal} (${score}%)`);
    
  } catch (error) {
    console.error("Erro na análise:", error);
    state.tentativasErro++;
    if (state.tentativasErro > 2) {
      console.warn("Reiniciando sistema...");
      setTimeout(() => location.reload(), 5000);
    }
  } finally {
    state.leituraEmAndamento = false;
  }
}

// =============================================
// CONTROLE DE TEMPO (REVISADO E CORRIGIDO)
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
  
  if (state.timer >= 58 && !state.leituraEmAndamento) {
    analisarMercado();
  }
  
  if (state.timer === 59 && state.ultimoMinutoProcessado !== agora.getMinutes()) {
    console.log("Recuperando minuto perdido...");
    analisarMercado();
  }
}

// =============================================
// INICIALIZAÇÃO (REVISADA E CORRIGIDA)
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
  
  console.log("Iniciando aplicativo EURUSD M1 (versão corrigida)...");
  state.mercadoAberto = true;
  state.ultimaVelaProcessada = null;
  state.ultimoMinutoProcessado = -1;
  
  // Configurações iniciais
  setInterval(atualizarRelogio, 1000);
  setInterval(gerenciarTimer, 1000);
  
  // Primeira análise
  setTimeout(() => {
    state.ultimoMinutoProcessado = -1;
    analisarMercado();
    console.log("Primeira análise concluída");
  }, 1000);
  
  // Monitoramento de saúde
  setInterval(() => {
    console.log("Status do sistema:", {
      ultimoSinal: state.ultimoSinal,
      ultimoScore: state.ultimoScore,
      tentativasErro: state.tentativasErro,
      memoria: window.performance?.memory?.usedJSHeapSize || 'N/A'
    });
  }, 30000);
}

// Iniciar quando o DOM estiver pronto
if (document.readyState === "complete") {
  iniciarAplicativo();
} else {
  document.addEventListener("DOMContentLoaded", iniciarAplicativo);
}
