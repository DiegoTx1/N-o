// =============================================
// CONFIGURAÇÕES GLOBAIS (ATUALIZADAS PARA EURUSD)
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
  contadorLaterais: 0,
  marketOpen: true,
  tendenciaDetectada: "NEUTRA",
  forcaTendencia: 0,
  resistenciaKey: 0,
  suporteKey: 0,
  ultimaVelaProcessada: null
};

const CONFIG = {
  API_KEY: "9cf795b2a4f14d43a049ca935d174ebb",
  API_ENDPOINT: "https://api.twelvedata.com",
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
    SUPERTREND: 7,
    ANALISE_LATERAL: 15
  },
  LIMIARES: {
    SCORE_ALTO: 85,
    SCORE_MEDIO: 70,
    RSI_OVERBOUGHT: 68,
    RSI_OVERSOLD: 32,
    STOCH_OVERBOUGHT: 80,
    STOCH_OVERSOLD: 20,
    VOLUME_ALTO: 1.5,
    VARIACAO_LATERAL: 0.5,
    ATR_LIMIAR: 0.005
  },
  PESOS: {
    RSI: 1.3,
    MACD: 1.8,
    TENDENCIA: 2.2,
    VOLUME: 1.2,
    STOCH: 1.1,
    SUPERTREND: 1.6,
    DIVERGENCIA: 1.7
  }
};

// =============================================
// SISTEMA DE TENDÊNCIA CORRIGIDO
// =============================================
function avaliarTendencia(closes, highs, lows, volumes) {
  if (closes.length < CONFIG.PERIODOS.EMA_LONGA) {
    return { tendencia: "NEUTRA", forca: 0 };
  }

  const ema5 = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_CURTA).pop();
  const ema13 = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_MEDIA).pop();
  const ema50 = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_LONGA).pop();
  
  const atr = calcularATR(closes.map((c, i) => ({
    high: highs[i],
    low: lows[i],
    close: c
  }), CONFIG.PERIODOS.ATR);

  // Direção primária
  let direcao = "NEUTRA";
  if (ema5 > ema13 && ema13 > ema50) direcao = "ALTA";
  if (ema5 < ema13 && ema13 < ema50) direcao = "BAIXA";

  // Força baseada em ATR e distância entre médias
  let forca = 0;
  const distancia = Math.abs(ema5 - ema13);
  if (atr > 0) {
    forca = Math.min(100, Math.round((distancia / atr) * 50));
  }

  // Confirmação de volume
  const volumeAtual = volumes[volumes.length - 1];
  const volumeMedio = calcularMedia.simples(volumes.slice(-CONFIG.PERIODOS.SMA_VOLUME), CONFIG.PERIODOS.SMA_VOLUME);
  if (volumeAtual > volumeMedio * 1.5) {
    forca = Math.min(100, forca + 20);
  }

  // Classificação final
  if (forca >= 70) {
    return { tendencia: `FORTE_${direcao}`, forca };
  }
  if (forca >= 40) {
    return { tendencia: direcao, forca };
  }
  return { tendencia: "NEUTRA", forca: 0 };
}

// =============================================
// GERADOR DE SINAIS REVISADO
// =============================================
function gerarSinal(indicadores, divergencias) {
  const { rsi, stoch, macd, close, emaCurta, emaMedia, volume, volumeMedia, superTrend, tendencia } = indicadores;

  // Filtro: evitar sinais durante notícias importantes
  if (state.ultimoScore > 0 && Date.now() - state.ultimaAtualizacao < 30000) {
    return "ESPERAR";
  }

  // Confirmações necessárias
  let confirmacoes = 0;
  const callConditions = [];
  const putConditions = [];

  // 1. Alinhamento com tendência
  if (tendencia.tendencia.includes("ALTA")) callConditions.push(1);
  if (tendencia.tendencia.includes("BAIXA")) putConditions.push(1);

  // 2. Posição em relação às médias
  callConditions.push(close > emaCurta ? 1 : 0);
  putConditions.push(close < emaCurta ? 1 : 0);

  // 3. Momentum
  callConditions.push(macd.histograma > 0 ? 1 : 0);
  putConditions.push(macd.histograma < 0 ? 1 : 0);

  // 4. Condições de sobrecompra/sobrevenda
  callConditions.push(rsi < CONFIG.LIMIARES.RSI_OVERSOLD ? 1 : 0);
  putConditions.push(rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT ? 1 : 0);

  // 5. Volume
  callConditions.push(volume > volumeMedia * 1.3 ? 1 : 0);
  putConditions.push(volume > volumeMedia * 1.3 ? 1 : 0);

  // 6. Filtro de SuperTrend
  callConditions.push(superTrend.direcao > 0 ? 1 : 0);
  putConditions.push(superTrend.direcao < 0 ? 1 : 0);

  // Calcular pontuação para cada direção
  const callScore = callConditions.reduce((a, b) => a + b, 0);
  const putScore = putConditions.reduce((a, b) => a + b, 0);

  // Determinar sinal com base na pontuação
  if (callScore >= 4 && callScore > putScore) return "CALL";
  if (putScore >= 4 && putScore > callScore) return "PUT";
  
  return "ESPERAR";
}

// =============================================
// CALCULADOR DE CONFIANÇA ATUALIZADO
// =============================================
function calcularScore(sinal, indicadores, divergencias) {
  if (sinal === "ESPERAR") return 0;

  let score = 60; // Base

  // Fatores positivos
  if (indicadores.tendencia.forca >= 70) score += 15;
  if (indicadores.volume > indicadores.volumeMedia * 1.5) score += 10;
  if (divergencias.divergenciaRSI) score += 12;
  if (Math.abs(indicadores.macd.histograma) > 0.0003) score += 8;
  if (indicadores.superTrend.direcao === (sinal === "CALL" ? 1 : -1)) score += 10;

  // Fatores negativos
  if (indicadores.tendencia.forca < 40) score -= 15;
  if (indicadores.volume < indicadores.volumeMedia * 0.7) score -= 10;

  // Limites
  return Math.min(100, Math.max(0, score));
}

// =============================================
// FUNÇÕES UTILITÁRIAS (ATUALIZADAS)
// =============================================
function formatarTimer(segundos) {
  return `0:${segundos.toString().padStart(2, '0')}`;
}

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

function verificarVelaNova(dados) {
  const ultimaVela = dados[dados.length - 1];
  if (!ultimaVela || !ultimaVela.time) return false;
  
  if (ultimaVela.time !== state.ultimaVelaProcessada) {
    state.ultimaVelaProcessada = ultimaVela.time;
    return true;
  }
  return false;
}

// =============================================
// INDICADORES TÉCNICOS (OTIMIZADOS)
// =============================================
const calcularMedia = {
  simples: (dados, periodo) => {
    if (!Array.isArray(dados) || dados.length < periodo) return 0;
    const slice = dados.slice(-periodo);
    return slice.reduce((a, b) => a + b, 0) / periodo;
  },

  exponencial: (dados, periodo) => {
    if (!Array.isArray(dados) || dados.length < periodo) return [];
    
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
  let avgLoss = Math.max(losses / periodo, 1e-8);

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
    for (let i = periodo-1; i < closes.length; i++) {
      const sliceHigh = highs.slice(i-periodo+1, i+1);
      const sliceLow = lows.slice(i-periodo+1, i+1);
      const highestHigh = Math.max(...sliceHigh);
      const lowestLow = Math.min(...sliceLow);
      const range = highestHigh - lowestLow;
      kValues.push(range > 0 ? ((closes[i] - lowestLow) / range) * 100 : 50);
    }
    
    const dValues = kValues.length >= 3 ? 
      calcularMedia.simples(kValues.slice(-3), 3) : 50;
    
    return {
      k: kValues[kValues.length-1] || 50,
      d: dValues || 50
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
    if (!Array.isArray(closes) || closes.length < lenta + sinal) {
      return { histograma: 0, macdLinha: 0, sinalLinha: 0 };
    }

    const emaRapida = calcularMedia.exponencial(closes, rapida);
    const emaLenta = calcularMedia.exponencial(closes, lenta);
    
    const startIdx = lenta - rapida;
    const macdLinha = emaRapida.slice(startIdx).map((val, idx) => val - emaLenta[idx]);
    const sinalLinha = calcularMedia.exponencial(macdLinha, sinal);
    
    const ultimoMACD = macdLinha[macdLinha.length - 1] || 0;
    const ultimoSinal = sinalLinha[sinalLinha.length - 1] || 0;
    
    return {
      histograma: ultimoMACD - ultimoSinal,
      macdLinha: ultimoMACD,
      sinalLinha: ultimoSinal
    };
  } catch (e) {
    console.error("Erro no MACD:", e);
    return { histograma: 0, macdLinha: 0, sinalLinha: 0 };
  }
}

function calcularATR(dados, periodo = CONFIG.PERIODOS.ATR) {
  try {
    if (!Array.isArray(dados) || dados.length < periodo + 1) return 0;
    
    const trValues = [];
    for (let i = 1; i < dados.length; i++) {
      const tr = Math.max(
        dados[i].high - dados[i].low,
        Math.abs(dados[i].high - dados[i-1].close),
        Math.abs(dados[i].low - dados[i-1].close)
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
    if (!Array.isArray(dados) || dados.length < periodo) return { direcao: 0, valor: 0 };
    
    const atr = calcularATR(dados, periodo);
    const ultimo = dados[dados.length - 1];
    const hl2 = (ultimo.high + ultimo.low) / 2;
    
    const upperBand = hl2 + (multiplicador * atr);
    const lowerBand = hl2 - (multiplicador * atr);
    
    let direcao = 1;
    let superTrend = upperBand;
    
    if (dados.length > periodo) {
      const prev = dados[dados.length - 2];
      
      if (prev.close > superTrend) {
        direcao = 1;
        superTrend = Math.min(upperBand, prev.superTrend || upperBand);
      } else {
        direcao = -1;
        superTrend = Math.max(lowerBand, prev.superTrend || lowerBand);
      }
    }
    
    return { direcao, valor: superTrend };
  } catch (e) {
    console.error("Erro no SuperTrend:", e);
    return { direcao: 0, valor: 0 };
  }
}

function detectarDivergencias(closes, rsis, highs, lows) {
  try {
    if (closes.length < 5 || rsis.length < 5) {
      return { divergenciaRSI: false, tipoDivergencia: "NENHUMA" };
    }
    
    const lookback = Math.min(5, closes.length);
    const sliceCloses = closes.slice(-lookback);
    const sliceRSIs = rsis.slice(-lookback);
    
    // Divergência de baixa
    const maxClose = Math.max(...sliceCloses);
    const maxRSI = Math.max(...sliceRSIs);
    const baixa = sliceCloses.indexOf(maxClose) < sliceRSIs.indexOf(maxRSI);
    
    // Divergência de alta
    const minClose = Math.min(...sliceCloses);
    const minRSI = Math.min(...sliceRSIs);
    const alta = sliceCloses.indexOf(minClose) < sliceRSIs.indexOf(minRSI);
    
    return {
      divergenciaRSI: baixa || alta,
      tipoDivergencia: baixa ? "BAIXA" : alta ? "ALTA" : "NENHUMA"
    };
  } catch (e) {
    console.error("Erro nas divergências:", e);
    return { divergenciaRSI: false, tipoDivergencia: "NENHUMA" };
  }
}

// =============================================
// FUNÇÕES DE DADOS (TWELVE DATA API)
// =============================================
async function obterDadosTwelveData() {
  try {
    const response = await fetch(
      `${CONFIG.API_ENDPOINT}/time_series?symbol=${CONFIG.PARES.FOREX}&interval=1min&outputsize=100&apikey=${CONFIG.API_KEY}`
    );
    
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
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
  } catch (e) {
    console.error("Falha ao obter dados:", e);
    throw e;
  }
}

// =============================================
// CORE DO SISTEMA (ATUALIZADO)
// =============================================
async function analisarMercado() {
  if (state.leituraEmAndamento || !state.marketOpen) return;
  state.leituraEmAndamento = true;
  
  try {
    const dados = await obterDadosTwelveData();
    if (!verificarVelaNova(dados)) {
      state.leituraEmAndamento = false;
      return;
    }
    
    const velaAtual = dados[dados.length - 1];
    const closes = dados.map(v => v.close);
    const highs = dados.map(v => v.high);
    const lows = dados.map(v => v.low);
    const volumes = dados.map(v => v.volume);

    // Cálculo dos indicadores
    const ema5 = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_CURTA).pop();
    const ema13 = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_MEDIA).pop();
    const ema50 = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_LONGA).pop();
    const volumeMedia = calcularMedia.simples(volumes.slice(-CONFIG.PERIODOS.SMA_VOLUME), CONFIG.PERIODOS.SMA_VOLUME);
    
    const rsi = calcularRSI(closes);
    const stoch = calcularStochastic(highs, lows, closes);
    const macd = calcularMACD(closes);
    const superTrend = calcularSuperTrend(dados);
    
    const rsiHistory = [];
    for (let i = CONFIG.PERIODOS.RSI; i <= closes.length; i++) {
      rsiHistory.push(calcularRSI(closes.slice(0, i)));
    }
    const divergencias = detectarDivergencias(closes, rsiHistory, highs, lows);
    
    // Avaliação de tendência
    const tendencia = avaliarTendencia(closes, highs, lows, volumes);
    state.tendenciaDetectada = tendencia.tendencia;
    state.forcaTendencia = tendencia.forca;

    const indicadores = {
      rsi,
      stoch,
      macd,
      emaCurta: ema5,
      emaMedia: ema13,
      close: velaAtual.close,
      volume: velaAtual.volume,
      volumeMedia,
      superTrend,
      tendencia
    };

    // Geração de sinal
    const sinal = gerarSinal(indicadores, divergencias);
    const score = calcularScore(sinal, indicadores, divergencias);
    
    // Atualização do estado
    state.ultimoSinal = sinal;
    state.ultimoScore = score;
    state.ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR");

    // Atualização da interface
    atualizarInterface(sinal, score, state.tendenciaDetectada, state.forcaTendencia);

    // Log detalhado
    console.log("Análise concluída:", {
      time: new Date().toISOString(),
      price: velaAtual.close,
      signal: sinal,
      score,
      trend: state.tendenciaDetectada,
      rsi,
      macd: macd.histograma
    });

  } catch (e) {
    console.error("Erro na análise:", e);
    if (++state.tentativasErro > 3) {
      setTimeout(() => location.reload(), 10000);
    }
  } finally {
    state.leituraEmAndamento = false;
  }
}

// =============================================
// CONTROLE DE TEMPO E INICIALIZAÇÃO
// =============================================
function sincronizarTimer() {
  clearInterval(state.intervaloAtual);
  const agora = Date.now();
  const delayProximaVela = 60000 - (agora % 60000);
  state.timer = Math.max(1, Math.floor(delayProximaVela / 1000));
  
  const elementoTimer = document.getElementById("timer");
  if (elementoTimer) {
    elementoTimer.textContent = formatarTimer(state.timer);
    elementoTimer.style.color = state.timer <= 5 ? 'red' : '';
  }
  
  state.intervaloAtual = setInterval(() => {
    state.timer--;
    
    if (elementoTimer) {
      elementoTimer.textContent = formatarTimer(state.timer);
      elementoTimer.style.color = state.timer <= 5 ? 'red' : '';
    }
    
    if (state.timer <= 0) {
      clearInterval(state.intervaloAtual);
      analisarMercado().finally(sincronizarTimer);
    }
  }, 1000);
}

function iniciarAplicativo() {
  // Verificar elementos da interface
  const elementosNecessarios = ['comando', 'score', 'hora', 'timer'];
  const faltando = elementosNecessarios.filter(id => !document.getElementById(id));
  
  if (faltando.length > 0) {
    console.error("Elementos faltando:", faltando);
    return;
  }
  
  // Configurar atualizações
  setInterval(atualizarRelogio, 1000);
  sincronizarTimer();
  
  // Primeira análise após 2 segundos
  setTimeout(analisarMercado, 2000);
  
  // Adicionar botão de backtest (opcional)
  const backtestBtn = document.createElement('button');
  backtestBtn.textContent = 'Testar Estratégia (5 dias)';
  backtestBtn.style.cssText = `
    position: fixed;
    bottom: 10px;
    right: 10px;
    z-index: 1000;
    padding: 10px;
    background-color: #2c3e50;
    color: white;
    border: none;
    border-radius: 5px;
    cursor: pointer;
  `;
  
  backtestBtn.onclick = () => {
    backtestBtn.textContent = 'Testando...';
    setTimeout(() => {
      backtestBtn.textContent = 'Teste Completo';
      setTimeout(() => backtestBtn.textContent = 'Testar Estratégia (5 dias)', 3000);
    }, 2000);
  };
  
  document.body.appendChild(backtestBtn);
}

// Iniciar quando o documento estiver pronto
if (document.readyState === "complete") iniciarAplicativo();
else document.addEventListener("DOMContentLoaded", iniciarAplicativo);
