// =============================================
// CONFIGURAÇÕES PARA SINAIS REAIS - BITCOIN CASH
// =============================================
const state = {
  ultimos: [],
  timer: 60,
  ultimaAtualizacao: "",
  leituraEmAndamento: false,
  intervaloAtual: null,
  ultimoSinal: null,
  ultimoScore: 0,
  tendenciaDetectada: "NEUTRA",
  forcaTendencia: 0,
  dadosHistoricos: [],
  resistenciaKey: 0,
  suporteKey: 0,
  rsiHistory: [],
  volumeRelativo: 0,
  vwap: 0,
  bandasBollinger: { superior: 0, inferior: 0, medio: 0 },
  lastSignalTime: 0,
  consecutiveSignalCount: 0,
  qualidadeSinal: "BAIXA",
  superTrendCache: []
};

const CONFIG = {
  API_ENDPOINTS: {
    TWELVE_DATA: "https://api.twelvedata.com"
  },
  PARES: {
    CRYPTO_IDX: "BCH/USD"
  },
  PERIODOS: {
    RSI: 14,
    STOCH_K: 14,
    STOCH_D: 3,
    EMA_CURTA: 5,
    EMA_MEDIA: 13,
    EMA_50: 50,
    MACD_RAPIDA: 12,
    MACD_LENTA: 26,
    MACD_SINAL: 9,
    ANALISE_LATERAL: 20,
    ATR: 14,
    SUPERTREND: 10,
    BOLLINGER: 20,
    VOLUME_LOOKBACK: 10,
    VWAP: 20
  },
  LIMIARES: {
    SCORE_ALTO: 65,
    SCORE_MEDIO: 55,
    RSI_OVERBOUGHT: 80,
    RSI_OVERSOLD: 20,
    STOCH_OVERBOUGHT: 85,
    STOCH_OVERSOLD: 15,
    VARIACAO_LATERAL: 0.02,
    VOLUME_ALERTA: 1.2,
    MIN_COOLDOWN: 1,
    MAX_CONSECUTIVE_SIGNALS: 3
  }
};

// =============================================
// GERENCIADOR DE CHAVES API
// =============================================
const API_KEYS = [
  "0105e6681b894e0185704171c53f5075",
  "b9d6a5d8a4a24a8f8d6f7d8c6f8d7a5d"
];
let currentKeyIndex = 0;

// =============================================
// FUNÇÕES UTILITÁRIAS
// =============================================
function formatarTimer(segundos) {
  return `0:${segundos.toString().padStart(2, '0')}`;
}

function atualizarRelogio() {
  const elementoHora = document.getElementById("hora");
  if (elementoHora) {
    const now = new Date();
    state.ultimaAtualizacao = now.toLocaleTimeString("pt-BR", {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    elementoHora.textContent = state.ultimaAtualizacao;
  }
}

function determinarQualidadeSinal(score, volume, tendencia) {
  if (score >= 75 && volume > 1.5 && tendencia.forca > 70) return "ALTA";
  if (score >= 65 && volume > 1.2 && tendencia.forca > 50) return "MEDIA";
  return "BAIXA";
}

function atualizarInterface(sinal, score, tendencia, forcaTendencia, qualidade) {
  const comandoElement = document.getElementById("comando");
  if (comandoElement) {
    let texto = "";
    let classe = "";
    
    switch(sinal) {
      case "CALL":
        texto = `CALL 📈 (${qualidade})`;
        classe = "call";
        try { 
          const som = document.getElementById("som-call");
          if (som) som.play().catch(e => console.log("Erro ao tocar som:", e));
        } catch(e) {}
        break;
      case "PUT":
        texto = `PUT 📉 (${qualidade})`;
        classe = "put";
        try { 
          const som = document.getElementById("som-put");
          if (som) som.play().catch(e => console.log("Erro ao tocar som:", e));
        } catch(e) {}
        break;
      default:
        texto = "ESPERAR ✋";
        classe = "esperar";
    }
    
    comandoElement.textContent = texto;
    comandoElement.className = classe;
    
    if (qualidade === "ALTA") {
      comandoElement.style.border = "2px solid #00ff00";
      comandoElement.style.animation = "pulse 1s infinite";
    } else {
      comandoElement.style.border = "";
      comandoElement.style.animation = "";
    }
  }
  
  const scoreElement = document.getElementById("score");
  if (scoreElement) {
    scoreElement.textContent = `Confiança: ${score}%`;
    if (score >= 75) {
      scoreElement.style.color = '#00ff00';
      scoreElement.style.fontWeight = 'bold';
    } else if (score >= 65) {
      scoreElement.style.color = '#ffff00';
    } else {
      scoreElement.style.color = '#ff0000';
    }
  }
  
  const tendenciaElement = document.getElementById("tendencia");
  const forcaElement = document.getElementById("forca-tendencia");
  if (tendenciaElement && forcaElement) {
    tendenciaElement.textContent = tendencia;
    forcaElement.textContent = `${Math.round(forcaTendencia)}%`;
    tendenciaElement.className = `indicator-value ${
      tendencia.includes("ALTA") ? "positive" : 
      tendencia.includes("BAIXA") ? "negative" : "neutral"
    }`;
  }
}

// =============================================
// INDICADORES TÉCNICOS
// =============================================
const calcularMedia = {
  simples: (dados, periodo) => {
    if (!Array.isArray(dados) || dados.length < periodo) return null;
    const slice = dados.slice(-periodo);
    return slice.reduce((a, b) => a + b, 0) / periodo;
  },

  exponencial: (dados, periodo) => {
    if (!Array.isArray(dados) || dados.length < periodo) return [];
    
    const k = 2 / (periodo + 1);
    let ema = calcularMedia.simples(dados.slice(0, periodo), periodo);
    if (ema === null) return [];
    
    const emaArray = [ema];
    for (let i = periodo; i < dados.length; i++) {
      ema = dados[i] * k + ema * (1 - k);
      emaArray.push(ema);
    }
    
    return emaArray;
  }
};

function calcularRSI(closes, periodo = CONFIG.PERIODOS.RSI) {
  if (closes.length < periodo + 1) return 50;
  
  let gains = 0, losses = 0;
  
  for (let i = 1; i <= periodo; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  
  let avgGain = gains / periodo;
  let avgLoss = losses / periodo;
  
  for (let i = periodo + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    
    if (diff > 0) {
      avgGain = ((avgGain * (periodo - 1)) + diff) / periodo;
      avgLoss = (avgLoss * (periodo - 1)) / periodo;
    } else {
      avgGain = (avgGain * (periodo - 1)) / periodo;
      avgLoss = ((avgLoss * (periodo - 1)) - diff) / periodo;
    }
  }
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calcularStochastic(highs, lows, closes) {
  try {
    const periodoK = CONFIG.PERIODOS.STOCH_K;
    if (closes.length < periodoK) return { k: 50, d: 50 };
    
    const kValues = [];
    for (let i = periodoK - 1; i < closes.length; i++) {
      const startIndex = i - periodoK + 1;
      const sliceHigh = highs.slice(startIndex, i + 1);
      const sliceLow = lows.slice(startIndex, i + 1);
      
      const highestHigh = Math.max(...sliceHigh);
      const lowestLow = Math.min(...sliceLow);
      const range = highestHigh - lowestLow;
      const k = range !== 0 ? ((closes[i] - lowestLow) / range) * 100 : 50;
      kValues.push(k);
    }
    
    const periodoD = CONFIG.PERIODOS.STOCH_D;
    const dValues = [];
    for (let i = periodoD - 1; i < kValues.length; i++) {
      const slice = kValues.slice(i - periodoD + 1, i + 1);
      dValues.push(calcularMedia.simples(slice, periodoD) || 50);
    }
    
    return {
      k: kValues[kValues.length - 1] || 50,
      d: dValues[dValues.length - 1] || 50
    };
  } catch (e) {
    console.error("Erro no Stochastic:", e);
    return { k: 50, d: 50 };
  }
}

function calcularMACD(closes) {
  try {
    const rapida = CONFIG.PERIODOS.MACD_RAPIDA;
    const lenta = CONFIG.PERIODOS.MACD_LENTA;
    const sinal = CONFIG.PERIODOS.MACD_SINAL;
    
    if (closes.length < lenta) return { histograma: 0, macdLinha: 0, sinalLinha: 0 };
    
    const emaRapida = calcularMedia.exponencial(closes, rapida);
    const emaLenta = calcularMedia.exponencial(closes, lenta);
    
    if (emaRapida.length === 0 || emaLenta.length === 0) {
      return { histograma: 0, macdLinha: 0, sinalLinha: 0 };
    }
    
    const startIdx = Math.max(0, lenta - rapida);
    const macdLinha = emaRapida.slice(startIdx).map((val, idx) => val - emaLenta[idx]);
    
    if (macdLinha.length < sinal) {
      return { histograma: 0, macdLinha: macdLinha[macdLinha.length-1] || 0, sinalLinha: 0 };
    }
    
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

function calcularATR(dados) {
  try {
    const periodo = CONFIG.PERIODOS.ATR;
    if (!Array.isArray(dados) || dados.length < periodo + 1) return 0.01;
    
    const trValues = [];
    for (let i = 1; i < dados.length; i++) {
      const tr = Math.max(
        dados[i].high - dados[i].low,
        Math.abs(dados[i].high - dados[i-1].close),
        Math.abs(dados[i].low - dados[i-1].close)
      );
      trValues.push(tr);
    }
    
    return calcularMedia.simples(trValues.slice(-periodo), periodo) || 0.01;
  } catch (e) {
    console.error("Erro no ATR:", e);
    return 0.01;
  }
}

function calcularSuperTrend(dados) {
  try {
    const periodo = CONFIG.PERIODOS.SUPERTREND;
    if (dados.length < periodo) return { direcao: 0, valor: dados[dados.length-1]?.close || 0 };
    
    const atr = calcularATR(dados);
    const current = dados[dados.length - 1];
    const hl2 = (current.high + current.low) / 2;
    
    const upperBand = hl2 + (3 * atr);
    const lowerBand = hl2 - (3 * atr);
    
    let superTrend, direcao;
    
    if (!state.superTrendCache || state.superTrendCache.length === 0) {
      superTrend = upperBand;
      direcao = 1;
    } else {
      const prev = dados[dados.length - 2];
      const prevSuperTrend = state.superTrendCache[state.superTrendCache.length - 1];
      
      if (prev.close > prevSuperTrend.valor) {
        direcao = 1;
        superTrend = Math.max(lowerBand, prevSuperTrend.valor);
      } else {
        direcao = -1;
        superTrend = Math.min(upperBand, prevSuperTrend.valor);
      }
    }
    
    state.superTrendCache = state.superTrendCache || [];
    state.superTrendCache.push({ direcao, valor: superTrend });
    if (state.superTrendCache.length > 20) state.superTrendCache.shift();
    
    return { direcao, valor: superTrend };
  } catch (e) {
    console.error("Erro no SuperTrend:", e);
    return { direcao: 0, valor: dados[dados.length-1]?.close || 0 };
  }
}

function calcularVolumeRelativo(volumes) {
  const periodo = CONFIG.PERIODOS.VOLUME_LOOKBACK;
  if (volumes.length < periodo) return 1;
  
  const mediaVolume = calcularMedia.simples(volumes.slice(-periodo), periodo);
  const volumeRecente = calcularMedia.simples(volumes.slice(-3), 3);
  
  return volumeRecente / mediaVolume;
}

function calcularVWAP(dados) {
  const periodo = CONFIG.PERIODOS.VWAP;
  if (dados.length < periodo) return dados[dados.length-1]?.close || 0;
  
  let tpTotal = 0, volumeTotal = 0;
  const slice = dados.slice(-periodo);
  
  slice.forEach(v => {
    const tp = (v.high + v.low + v.close) / 3;
    tpTotal += tp * v.volume;
    volumeTotal += v.volume;
  });
  
  return volumeTotal > 0 ? tpTotal / volumeTotal : (dados[dados.length-1]?.close || 0);
}

function calcularBandasBollinger(closes) {
  const periodo = CONFIG.PERIODOS.BOLLINGER;
  if (closes.length < periodo) {
    const media = closes.length > 0 ? calcularMedia.simples(closes, closes.length) : 0;
    return { superior: media, inferior: media, medio: media };
  }
  
  const slice = closes.slice(-periodo);
  const media = calcularMedia.simples(slice, periodo);
  
  let somaQuadrados = 0;
  slice.forEach(valor => somaQuadrados += Math.pow(valor - media, 2));
  const desvioPadrao = Math.sqrt(somaQuadrados / periodo);
  
  return {
    superior: media + (desvioPadrao * 2),
    inferior: media - (desvioPadrao * 2),
    medio: media
  };
}

// =============================================
// ANÁLISE TÉCNICA
// =============================================
function avaliarTendencia(ema5, ema13, ema50) {
  if (ema5 === null || ema13 === null || ema50 === null) {
    return { tendencia: "NEUTRA", forca: 0 };
  }
  
  const diffCurta = ema5 - ema13;
  const diffLonga = ema13 - ema50;
  const forca = Math.min(100, (Math.abs(diffCurta) * 2000 + Math.abs(diffLonga) * 1000));
  
  if (forca > 70) {
    return diffCurta > 0 && diffLonga > 0 
      ? { tendencia: "FORTE_ALTA", forca }
      : diffCurta < 0 && diffLonga < 0 
        ? { tendencia: "FORTE_BAIXA", forca }
        : { tendencia: "NEUTRA", forca: 0 };
  }
  
  if (forca > 50) {
    return diffCurta > 0 ? { tendencia: "ALTA", forca } : { tendencia: "BAIXA", forca };
  }
  
  return { tendencia: "NEUTRA", forca: 0 };
}

function detectarLateralidade(closes) {
  const periodo = CONFIG.PERIODOS.ANALISE_LATERAL;
  const limiar = CONFIG.LIMIARES.VARIACAO_LATERAL;
  
  if (closes.length < periodo) return false;
  
  let countLaterais = 0;
  for (let i = closes.length - 1; i > closes.length - periodo; i--) {
    if (i === 0) break;
    const variacao = Math.abs((closes[i] - closes[i-1]) / closes[i-1]);
    if (variacao < limiar) countLaterais++;
  }
  
  return countLaterais > periodo * 0.7;
}

function calcularZonasPreco(dados) {
  const periodo = Math.min(50, dados.length);
  const slice = dados.slice(-periodo);
  const highs = slice.map(v => v.high);
  const lows = slice.map(v => v.low);
  
  return {
    resistencia: (Math.max(...highs) * 0.7 + calcularMedia.simples(highs, highs.length) * 0.3),
    suporte: (Math.min(...lows) * 0.7 + calcularMedia.simples(lows, lows.length) * 0.3)
  };
}

// =============================================
// SISTEMA DE SINAIS - MAIS PERMISSIVO
// =============================================
function calcularScoreSinal(indicadores, lateral) {
  const { rsi, stoch, macd, close, tendencia, volumeRelativo, vwap, superTrend, emaCurta, emaMedia } = indicadores;
  
  let score = 50;

  // CONFIRMAÇÃO DE TENDÊNCIA
  if (tendencia.forca > 50) {
    score += 15;
  }

  // INDICADORES PRINCIPAIS (Mais permissivos)
  if (rsi > 30 && rsi < 70) score += 8;
  if (macd.histograma > 0.0005) score += 12;
  if (macd.histograma < -0.0005) score += 12;
  if (stoch.k > 25 && stoch.k < 85) score += 7;

  // CONFIRMAÇÕES DE PREÇO
  if (close > vwap * 0.995) score += 10;
  if (close < vwap * 1.005) score += 10;
  if (close > emaCurta) score += 6;
  if (close > emaMedia) score += 6;
  if (superTrend.direcao > 0) score += 10;
  if (superTrend.direcao < 0) score += 10;

  // VOLUME
  if (volumeRelativo > 1.2) score += 12;
  if (volumeRelativo > 1.5) score += 8;

  // MENOS PENALIDADE POR LATERALIDADE
  if (lateral) score -= 10;

  return Math.min(100, Math.max(0, score));
}

function gerarSinalConfiavel(indicadores, lateral) {
  const { rsi, stoch, macd, close, tendencia, volumeRelativo, vwap, superTrend, bandasBollinger, emaCurta, emaMedia } = indicadores;

  // REGRA 1: TENDÊNCIA + INDICADORES ALINHADOS
  if (tendencia.forca > 50 && volumeRelativo > 1.0) {
    if (tendencia.tendencia.includes("ALTA") && 
        macd.histograma > -0.002 &&
        close > vwap * 0.998 &&
        superTrend.direcao > 0) {
      return "CALL";
    }
    
    if (tendencia.tendencia.includes("BAIXA") && 
        macd.histograma < 0.002 &&
        close < vwap * 1.002 &&
        superTrend.direcao < 0) {
      return "PUT";
    }
  }

  // REGRA 2: SUPERTREND + MÉDIAS
  if (volumeRelativo > 1.1) {
    if (superTrend.direcao > 0 && close > emaCurta && close > emaMedia) {
      return "CALL";
    }
    if (superTrend.direcao < 0 && close < emaCurta && close < emaMedia) {
      return "PUT";
    }
  }

  // REGRA 3: CONDIÇÕES EXTREMAS
  if (volumeRelativo > 1.3) {
    if (rsi < 30 && stoch.k < 25 && !lateral) return "CALL";
    if (rsi > 70 && stoch.k > 75 && !lateral) return "PUT";
  }

  // REGRA 4: MOMENTUM SIMPLES
  if (volumeRelativo > 1.0 && !lateral) {
    const momentum = macd.histograma > 0.001 && close > vwap && stoch.k > 50;
    if (momentum) return "CALL";
    
    const momentumNegativo = macd.histograma < -0.001 && close < vwap && stoch.k < 50;
    if (momentumNegativo) return "PUT";
  }

  return "ESPERAR";
}

function validarSinal(sinal, score, indicadores) {
  const { volumeRelativo, tendencia, lateral } = indicadores;
  
  // FILTROS MAIS PERMISSIVOS
  if (score < 60) return "ESPERAR";
  if (volumeRelativo < 0.8) return "ESPERAR";
  if (lateral && score < 70) return "ESPERAR";
  if (tendencia.forca < 30) return "ESPERAR";
  
  return sinal;
}

// =============================================
// API E ANÁLISE PRINCIPAL
// =============================================
async function obterDadosTwelveData() {
  try {
    const apiKey = API_KEYS[currentKeyIndex];
    const url = `${CONFIG.API_ENDPOINTS.TWELVE_DATA}/time_series?symbol=${CONFIG.PARES.CRYPTO_IDX}&interval=1min&outputsize=100&apikey=${apiKey}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Falha na API: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.status === 'error') {
      throw new Error(data.message || `Erro Twelve Data: ${data.code}`);
    }
    
    if (!data.values || data.values.length === 0) {
      throw new Error("Dados vazios da API");
    }
    
    return data.values.reverse().map(item => ({
      time: item.datetime,
      open: parseFloat(item.open),
      high: parseFloat(item.high),
      low: parseFloat(item.low),
      close: parseFloat(item.close),
      volume: parseFloat(item.volume) || 1
    }));
  } catch (e) {
    console.error("Erro ao obter dados:", e);
    currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
    throw e;
  }
}

async function analisarMercado() {
  if (state.leituraEmAndamento) return;
  
  state.leituraEmAndamento = true;
  
  try {
    const dados = await obterDadosTwelveData();
    
    if (dados.length < 20) {
      throw new Error(`Dados insuficientes (${dados.length} velas)`);
    }
    
    state.dadosHistoricos = dados;
    const velaAtual = dados[dados.length - 1];
    const closes = dados.map(v => v.close);
    const highs = dados.map(v => v.high);
    const lows = dados.map(v => v.low);
    const volumes = dados.map(v => v.volume);

    // CALCULAR INDICADORES PRINCIPAIS
    const zonas = calcularZonasPreco(dados);
    state.resistenciaKey = zonas.resistencia;
    state.suporteKey = zonas.suporte;

    const calcularEMA = (dados, periodo) => {
      const emaArray = calcularMedia.exponencial(dados, periodo);
      return emaArray.length > 0 ? emaArray[emaArray.length - 1] : null;
    };

    const ema5 = calcularEMA(closes, CONFIG.PERIODOS.EMA_CURTA);
    const ema13 = calcularEMA(closes, CONFIG.PERIODOS.EMA_MEDIA);
    const ema50 = calcularEMA(closes, CONFIG.PERIODOS.EMA_50);

    state.volumeRelativo = calcularVolumeRelativo(volumes);
    state.vwap = calcularVWAP(dados);
    state.bandasBollinger = calcularBandasBollinger(closes);

    const superTrend = calcularSuperTrend(dados);
    const rsi = calcularRSI(closes);
    const stoch = calcularStochastic(highs, lows, closes);
    const macd = calcularMACD(closes);

    // MANTER HISTÓRICO RSI
    state.rsiHistory.push(rsi);
    if (state.rsiHistory.length > 30) state.rsiHistory.shift();
    
    const tendencia = avaliarTendencia(ema5, ema13, ema50);
    const lateral = detectarLateralidade(closes);

    state.tendenciaDetectada = tendencia.tendencia;
    state.forcaTendencia = tendencia.forca;

    const indicadores = { 
      rsi, stoch, macd, 
      close: velaAtual.close, 
      superTrend, tendencia, 
      volumeRelativo: state.volumeRelativo, 
      vwap: state.vwap,
      bandasBollinger: state.bandasBollinger,
      emaCurta: ema5,
      emaMedia: ema13,
      lateral
    };

    // GERAR SINAL
    let sinal = gerarSinalConfiavel(indicadores, lateral);
    const score = calcularScoreSinal(indicadores, lateral);
    
    // VALIDAR SINAL
    sinal = validarSinal(sinal, score, indicadores);
    
    // GERENCIAR SINAIS CONSECUTIVOS
    const agora = Date.now();
    const tempoDesdeUltimoSinal = (agora - state.lastSignalTime) / 60000;
    
    if (tempoDesdeUltimoSinal > 10) state.consecutiveSignalCount = 0;
    
    if (sinal !== "ESPERAR" && sinal === state.ultimoSinal) {
      state.consecutiveSignalCount++;
      if (state.consecutiveSignalCount > CONFIG.LIMIARES.MAX_CONSECUTIVE_SIGNALS) {
        sinal = "ESPERAR";
      }
    } else if (sinal !== "ESPERAR") {
      state.consecutiveSignalCount = 1;
    }
    
    state.lastSignalTime = agora;

    // DETERMINAR QUALIDADE DO SINAL
    const qualidade = determinarQualidadeSinal(score, state.volumeRelativo, tendencia);

    // ATUALIZAR ESTADO
    state.ultimoSinal = sinal;
    state.ultimoScore = score;
    state.qualidadeSinal = qualidade;
    state.ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR");

    // ATUALIZAR INTERFACE
    atualizarInterface(sinal, score, state.tendenciaDetectada, state.forcaTendencia, qualidade);

    // ATUALIZAR INFORMAÇÕES DETALHADAS
    const criteriosElement = document.getElementById("criterios");
    if (criteriosElement) {
      criteriosElement.innerHTML = `
        <li>🎯 BITCOIN CASH - $${indicadores.close.toFixed(2)}</li>
        <li>📊 ${state.tendenciaDetectada} (${Math.round(state.forcaTendencia)}%)</li>
        <li>⭐ Qualidade: ${qualidade}</li>
        <li>📉 RSI: ${rsi.toFixed(1)} | MACD: ${macd.histograma > 0 ? '+' : ''}${macd.histograma.toFixed(4)}</li>
        <li>📈 Stochastic: ${stoch.k.toFixed(1)} | SuperTrend: ${superTrend.direcao > 0 ? 'ALTA' : 'BAIXA'}</li>
        <li>💹 Volume: ${(state.volumeRelativo * 100).toFixed(0)}% ${state.volumeRelativo > 1.5 ? '🚀' : ''}</li>
        <li>📊 VWAP: $${state.vwap.toFixed(2)} | Preço: $${indicadores.close.toFixed(2)}</li>
        <li>🎯 Suporte: $${state.suporteKey.toFixed(2)} | Resistência: $${state.resistenciaKey.toFixed(2)}</li>
      `;
    }

    // REGISTRAR SINAL
    state.ultimos.unshift(`${state.ultimaAtualizacao} - ${sinal} (${score}%) [${qualidade}]`);
    if (state.ultimos.length > 6) state.ultimos.pop();
    
    const ultimosElement = document.getElementById("ultimos");
    if (ultimosElement) {
      ultimosElement.innerHTML = state.ultimos.map(i => `<li>${i}</li>`).join("");
    }

  } catch (e) {
    console.error("Erro na análise:", e);
    atualizarInterface("ERRO", 0, "ERRO", 0, "BAIXA");
    
    const criteriosElement = document.getElementById("criterios");
    if (criteriosElement) {
      criteriosElement.innerHTML = `<li>❌ ERRO: ${e.message}</li>`;
    }
  } finally {
    state.leituraEmAndamento = false;
  }
}

// =============================================
// CONTROLE DE TEMPO
// =============================================
function sincronizarTimer() {
  clearInterval(state.intervaloAtual);
  const agora = new Date();
  const segundos = agora.getSeconds();
  state.timer = 60 - segundos;
  
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
      analisarMercado();
      sincronizarTimer();
    }
  }, 1000);
}

function iniciarAplicativo() {
  setInterval(atualizarRelogio, 1000);
  sincronizarTimer();
  
  // Primeira análise imediata
  setTimeout(() => {
    analisarMercado();
  }, 1000);
}

// INICIAR APLICAÇÃO
if (document.readyState === "complete") {
  iniciarAplicativo();
} else {
  document.addEventListener("DOMContentLoaded", iniciarAplicativo);
}

// CSS para animação de pulsação
const style = document.createElement('style');
style.textContent = `
  @keyframes pulse {
    0% { box-shadow: 0 0 0 0 rgba(0, 255, 0, 0.7); }
    70% { box-shadow: 0 0 0 10px rgba(0, 255, 0, 0); }
    100% { box-shadow: 0 0 0 0 rgba(0, 255, 0, 0); }
  }
`;
document.head.appendChild(style);
