// =============================================
// CONFIGURAÇÕES GLOBAIS PARA BITCOIN CASH (BCH/USD)
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
  dadosHistoricos: [],
  resistenciaKey: 0,
  suporteKey: 0,
  rsiCache: { avgGain: 0, avgLoss: 0, initialized: false, lastLength: 0 },
  emaCache: {
    ema5: null,
    ema13: null,
    ema50: null,
    ema200: null,
    lastLength: 0
  },
  macdCache: {
    emaRapida: null,
    emaLenta: null,
    macdLine: [],
    signalLine: [],
    lastLength: 0
  },
  superTrendCache: [],
  atrGlobal: 0,
  rsiHistory: [],
  cooldown: 0,
  volumeRelativo: 0,
  obv: 0,
  vwap: 0,
  bandasBollinger: {
    superior: 0,
    inferior: 0,
    medio: 0
  },
  lastSignalTime: 0,
  consecutiveSignalCount: 0,
  logs: [],
  startTime: Date.now()
};

const CONFIG = {
  API_ENDPOINTS: {
    TWELVE_DATA: "https://api.twelvedata.com"
  },
  PARES: {
    // MUDADO PARA BITCOIN CASH - que está disponível na Binomo
    CRYPTO_IDX: "BCH/USD"
  },
  PERIODOS: {
    RSI: 9,
    STOCH_K: 14,
    STOCH_D: 3,
    EMA_CURTA: 5,
    EMA_MEDIA: 13,
    EMA_50: 50,
    EMA_LONGA: 200,
    MACD_RAPIDA: 6,
    MACD_LENTA: 13,
    MACD_SINAL: 9,
    VELAS_CONFIRMACAO: 3,
    ANALISE_LATERAL: 20,
    ATR: 14,
    SUPERTREND: 7,
    DIVERGENCIA_LOOKBACK: 8,
    EXTREME_LOOKBACK: 2,
    BOLLINGER: 20,
    VOLUME_LOOKBACK: 10,
    VWAP: 20
  },
  LIMIARES: {
    // AJUSTADOS PARA BITCOIN CASH (mais volátil)
    SCORE_ALTO: 70,
    SCORE_MEDIO: 55,
    RSI_OVERBOUGHT: 80,
    RSI_OVERSOLD: 20,
    STOCH_OVERBOUGHT: 85,
    STOCH_OVERSOLD: 15,
    VARIACAO_LATERAL: 0.012,
    ATR_LIMIAR: 0.035,
    LATERALIDADE_LIMIAR: 0.012,
    VOLUME_ALERTA: 1.6,
    MIN_COOLDOWN: 2,
    MAX_CONSECUTIVE_SIGNALS: 2
  },
  PESOS: {
    // AJUSTADOS PARA BCH
    RSI: 1.6,
    MACD: 2.1,
    TENDENCIA: 2.6,
    STOCH: 1.1,
    SUPERTREND: 1.8,
    DIVERGENCIA: 1.9,
    VOLUME: 1.6,
    VWAP: 1.2,
    BOLLINGER: 1.3
  }
};

// =============================================
// SISTEMA DE LOGS
// =============================================
const LOG_LEVEL = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

function log(message, level = LOG_LEVEL.INFO) {
  const timestamp = new Date().toLocaleTimeString("pt-BR");
  const levelStr = ['ERROR', 'WARN', 'INFO', 'DEBUG'][level];
  
  console.log(`[${timestamp}] ${levelStr}: ${message}`);
  
  if (state.logs.length > 20) state.logs.shift();
  state.logs.push({timestamp, message, level});
}

// =============================================
// VALIDAÇÃO DE DADOS ESPECÍFICA PARA BCH
// =============================================
function validarDadosBCH(dados) {
  if (!Array.isArray(dados) || dados.length === 0) {
    throw new Error("Dados inválidos ou vazios");
  }
  
  const ultimo = dados[dados.length - 1];
  const precoAtual = ultimo.close;
  
  // Bitcoin Cash normalmente está entre $200 - $800
  if (precoAtual < 100 || precoAtual > 1000) {
    log(`⚠️ PREÇO SUSPEITO DO BCH: $${precoAtual} - Verifique se está correto!`, LOG_LEVEL.WARN);
  }
  
  return true;
}

// =============================================
// INDICADORES OTIMIZADOS PARA BITCOIN CASH
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
  
  if (closes.length !== state.rsiCache.lastLength) {
    state.rsiCache = { avgGain: 0, avgLoss: 0, initialized: false, lastLength: closes.length };
  }
  
  if (!state.rsiCache.initialized) {
    let gains = 0, losses = 0;
    for (let i = 1; i <= periodo; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff > 0) gains += diff;
      else losses -= diff;
    }
    
    state.rsiCache.avgGain = gains / periodo;
    state.rsiCache.avgLoss = losses / periodo;
    state.rsiCache.initialized = true;
    
    const rs = state.rsiCache.avgLoss === 0 ? 100 : state.rsiCache.avgGain / state.rsiCache.avgLoss;
    return 100 - (100 / (1 + rs));
  }
  
  const diff = closes[closes.length - 1] - closes[closes.length - 2];
  
  if (diff > 0) {
    state.rsiCache.avgGain = ((state.rsiCache.avgGain * (periodo - 1)) + diff) / periodo;
    state.rsiCache.avgLoss = (state.rsiCache.avgLoss * (periodo - 1)) / periodo;
  } else {
    state.rsiCache.avgGain = (state.rsiCache.avgGain * (periodo - 1)) / periodo;
    state.rsiCache.avgLoss = ((state.rsiCache.avgLoss * (periodo - 1)) - diff) / periodo;
  }
  
  const rs = state.rsiCache.avgLoss === 0 ? 100 : state.rsiCache.avgGain / state.rsiCache.avgLoss;
  const rsi = 100 - (100 / (1 + rs));
  
  state.rsiHistory.push(rsi);
  if (state.rsiHistory.length > 50) state.rsiHistory.shift();
  
  return rsi;
}

// =============================================
// SISTEMA DE TENDÊNCIA AJUSTADO PARA BCH
// =============================================
function avaliarTendencia(ema5, ema13, ema50) {
  if (ema5 === null || ema13 === null || ema50 === null) {
    return { tendencia: "NEUTRA", forca: 0 };
  }
  
  const diffCurta = ema5 - ema13;
  const diffLonga = ema13 - ema50;
  // Ajustado para a volatilidade do Bitcoin Cash
  const forca = Math.min(100, (Math.abs(diffCurta) * 2000 + Math.abs(diffLonga) * 1000));
  
  if (forca > 75) {
    return diffCurta > 0 && diffLonga > 0 
      ? { tendencia: "FORTE_ALTA", forca }
      : diffCurta < 0 && diffLonga < 0 
        ? { tendencia: "FORTE_BAIXA", forca }
        : { tendencia: "NEUTRA", forca: 0 };
  }
  
  if (forca > 45) {
    return diffCurta > 0 
      ? { tendencia: "ALTA", forca } 
      : { tendencia: "BAIXA", forca };
  }
  
  return { tendencia: "NEUTRA", forca: 0 };
}

// =============================================
// DETECÇÃO DE LATERALIDADE PARA BCH
// =============================================
function detectarLateralidade(closes, periodo = CONFIG.PERIODOS.ANALISE_LATERAL, limiar = CONFIG.LIMIARES.LATERALIDADE_LIMIAR) {
  if (closes.length < periodo) return false;
  
  let countLaterais = 0;
  const volatilidades = [];
  
  for (let i = closes.length - 1; i > closes.length - periodo; i--) {
    if (i === 0) break;
    const variacao = Math.abs((closes[i] - closes[i-1]) / closes[i-1]);
    volatilidades.push(variacao);
    if (variacao < limiar) countLaterais++;
  }
  
  const mediaVol = volatilidades.reduce((a, b) => a + b, 0) / volatilidades.length;
  const desvios = volatilidades.map(v => Math.pow(v - mediaVol, 2));
  const desvioPadrao = Math.sqrt(desvios.reduce((a, b) => a + b, 0) / desvios.length);
  
  state.contadorLaterais = countLaterais;
  
  return countLaterais > periodo * 0.65 && desvioPadrao < limiar * 0.6;
}

// =============================================
// GERADOR DE SINAIS OTIMIZADO PARA BCH
// =============================================
function gerarSinal(indicadores, divergencias, lateral) {
  const scoreAlta = calcularScoreDirecional('ALTA', indicadores, divergencias);
  const scoreBaixa = calcularScoreDirecional('BAIXA', indicadores, divergencias);
  
  const { rsi, stoch, macd, close, volumeRelativo, bandasBollinger, tendencia, superTrend } = indicadores;

  log(`BCH - Scores: ALTA ${scoreAlta}%, BAIXA ${scoreBaixa}%`, LOG_LEVEL.DEBUG);

  // Bitcoin Cash é mais volátil - condições mais flexíveis
  const condicoesBaseAlta = 
    close > indicadores.vwap &&
    macd.histograma > 0 &&
    volumeRelativo > 1.0;

  const condicoesBaseBaixa = 
    close < indicadores.vwap &&
    macd.histograma < 0 &&
    volumeRelativo > 1.0;

  // Estratégia 1: Tendência forte (BCH tem trends mais curtas)
  if (tendencia.forca > 65) {
    if (tendencia.tendencia.includes("ALTA") && scoreAlta >= 60 && condicoesBaseAlta) {
      log("BCH CALL - Tendência forte de alta", LOG_LEVEL.INFO);
      return "CALL";
    }
    if (tendencia.tendencia.includes("BAIXA") && scoreBaixa >= 60 && condicoesBaseBaixa) {
      log("BCH PUT - Tendência forte de baixa", LOG_LEVEL.INFO);
      return "PUT";
    }
  }

  // Estratégia 2: Divergências (BCH responde bem a divergências)
  if (divergencias.divergenciaRSI) {
    if (divergencias.tipoDivergencia === "ALTA" && scoreAlta >= 65 && condicoesBaseAlta) {
      log("BCH CALL - Divergência de alta", LOG_LEVEL.INFO);
      return "CALL";
    }
    if (divergencias.tipoDivergencia === "BAIXA" && scoreBaixa >= 65 && condicoesBaseBaixa) {
      log("BCH PUT - Divergência de baixa", LOG_LEVEL.INFO);
      return "PUT";
    }
  }

  // Estratégia 3: Reversão (BCH tem reversões mais frequentes)
  const rsiOversold = rsi < CONFIG.LIMIARES.RSI_OVERSOLD;
  const rsiOverbought = rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT;
  const stochOversold = stoch.k < CONFIG.LIMIARES.STOCH_OVERSOLD;
  const stochOverbought = stoch.k > CONFIG.LIMIARES.STOCH_OVERBOUGHT;

  if (rsiOversold && stochOversold && scoreAlta >= 63 && !lateral) {
    log("BCH CALL - Reversão de oversold", LOG_LEVEL.INFO);
    return "CALL";
  }
  
  if (rsiOverbought && stochOverbought && scoreBaixa >= 63 && !lateral) {
    log("BCH PUT - Reversão de overbought", LOG_LEVEL.INFO);
    return "PUT";
  }

  // Estratégia 4: Breakout de lateralidade (BCH tem breakouts fortes)
  if (lateral && volumeRelativo > 1.8) {
    const bandaWidth = (bandasBollinger.superior - bandasBollinger.inferior) / bandasBollinger.medio;
    if (bandaWidth < 0.05) {
      if (close > bandasBollinger.superior * 0.995 && scoreAlta >= 60) {
        log("BCH CALL - Breakout de lateralidade", LOG_LEVEL.INFO);
        return "CALL";
      }
      if (close < bandasBollinger.inferior * 1.005 && scoreBaixa >= 60) {
        log("BCH PUT - Breakout de lateralidade", LOG_LEVEL.INFO);
        return "PUT";
      }
    }
  }

  log("BCH - Nenhum sinal forte", LOG_LEVEL.DEBUG);
  return "ESPERAR";
}

// =============================================
// CALCULADOR DE SCORE PARA BCH
// =============================================
function calcularScoreDirecional(direcao, indicadores, divergencias) {
  let score = 50;

  const { rsi, stoch, macd, close, emaCurta, emaMedia, tendencia, volumeRelativo, vwap, bandasBollinger } = indicadores;

  // Alinhamento com tendência
  if ((direcao === 'ALTA' && tendencia.tendencia.includes('ALTA')) ||
      (direcao === 'BAIXA' && tendencia.tendencia.includes('BAIXA'))) {
    score += Math.min(20, tendencia.forca / 5);
  }

  // Confirmação de indicadores
  if (direcao === 'ALTA') {
    if (rsi > 25 && rsi < 75) score += 8;
    if (stoch.k > 20 && stoch.k < 85) score += 7;
    if (macd.histograma > 0) score += 12;
    if (close > emaCurta) score += 6;
    if (close > vwap) score += 8;
    if (close > bandasBollinger.medio) score += 6;
  } else {
    if (rsi < 75 && rsi > 25) score += 8;
    if (stoch.k < 80 && stoch.k > 15) score += 7;
    if (macd.histograma < 0) score += 12;
    if (close < emaCurta) score += 6;
    if (close < vwap) score += 8;
    if (close < bandasBollinger.medio) score += 6;
  }

  // Volume (BCH responde bem a volume)
  if (volumeRelativo > CONFIG.LIMIARES.VOLUME_ALERTA) score += 12;

  // Divergências
  if (divergencias.divergenciaRSI) {
    if ((direcao === 'ALTA' && divergencias.tipoDivergencia === 'ALTA') ||
        (direcao === 'BAIXA' && divergencias.tipoDivergencia === 'BAIXA')) {
      score += 15;
    }
  }

  // Bônus para BCH
  if (tendencia.forca > 70) score += 8;
  if (volumeRelativo > 2) score += 8;

  return Math.min(100, Math.max(0, score));
}

// =============================================
// FUNÇÃO PRINCIPAL COM VALIDAÇÃO BCH
// =============================================
async function analisarMercado() {
  if (state.leituraEmAndamento) return;
  
  state.leituraEmAndamento = true;
  
  try {
    const dados = await obterDadosTwelveData();
    validarDadosBCH(dados); // Validação específica para BCH
    state.dadosHistoricos = dados;
    
    if (dados.length < 15) {
      throw new Error(`Dados insuficientes (${dados.length} velas)`);
    }
    
    const velaAtual = dados[dados.length - 1];
    const closes = dados.map(v => v.close);
    const highs = dados.map(v => v.high);
    const lows = dados.map(v => v.low);
    const volumes = dados.map(v => v.volume);

    // Calcular todos os indicadores...
    const zonas = calcularZonasPreco(dados);
    state.resistenciaKey = zonas.resistencia;
    state.suporteKey = zonas.suporte;

    const calcularEMA = (dados, periodo) => {
      if (dados.length < periodo) return null;
      const emaArray = calcularMedia.exponencial(dados, periodo);
      return emaArray.length > 0 ? emaArray[emaArray.length - 1] : null;
    };

    const ema5 = calcularEMA(closes, CONFIG.PERIODOS.EMA_CURTA);
    const ema13 = calcularEMA(closes, CONFIG.PERIODOS.EMA_MEDIA);
    const ema50 = calcularEMA(closes, CONFIG.PERIODOS.EMA_50);

    state.volumeRelativo = calcularVolumeRelativo(volumes);
    state.obv = calcularOBV(closes, volumes);
    state.vwap = calcularVWAP(dados);
    state.bandasBollinger = calcularBandasBollinger(closes);

    const superTrend = calcularSuperTrend(dados);
    const rsi = calcularRSI(closes);
    const stoch = calcularStochastic(highs, lows, closes);
    const macd = calcularMACD(closes);
    const atr = calcularATR(dados);
    
    if (state.rsiHistory.length === 0) {
      for (let i = CONFIG.PERIODOS.RSI; i < closes.length; i++) {
        state.rsiHistory.push(calcularRSI(closes.slice(0, i+1)));
      }
    } else {
      state.rsiHistory.push(rsi);
      if (state.rsiHistory.length > 50) state.rsiHistory.shift();
    }
    
    const divergencias = detectarDivergencias(closes, state.rsiHistory, highs, lows);
    const tendencia = avaliarTendencia(ema5, ema13, ema50);
    const lateral = detectarLateralidade(closes);

    state.tendenciaDetectada = tendencia.tendencia;
    state.forcaTendencia = tendencia.forca;

    const indicadores = {
      rsi,
      stoch,
      macd,
      emaCurta: ema5,
      emaMedia: ema13,
      ema50,
      close: velaAtual.close,
      superTrend,
      tendencia,
      atr,
      volumeRelativo: state.volumeRelativo,
      vwap: state.vwap,
      bandasBollinger: state.bandasBollinger
    };

    let sinal = gerarSinal(indicadores, divergencias, lateral);
    
    // Gerenciar cooldown
    sinal = gerenciarSinaisConsecutivos(sinal);
    
    if (sinal !== "ESPERAR" && state.cooldown <= 0) {
      state.cooldown = CONFIG.LIMIARES.MIN_COOLDOWN;
    } else if (state.cooldown > 0) {
      state.cooldown--;
      sinal = "ESPERAR";
    }

    const score = calcularScore(sinal, indicadores, divergencias);

    state.ultimoSinal = sinal;
    state.ultimoScore = score;
    state.ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR");

    atualizarInterface(sinal, score, state.tendenciaDetectada, state.forcaTendencia);

    // Atualizar interface com informações do BCH
    const criteriosElement = document.getElementById("criterios");
    if (criteriosElement) {
      criteriosElement.innerHTML = `
        <li>🎯 BITCOIN CASH (BCH/USD)</li>
        <li>📊 Tendência: ${state.tendenciaDetectada} (${Math.round(state.forcaTendencia)}%)</li>
        <li>💰 Preço: $${indicadores.close.toFixed(2)}</li>
        <li>📉 RSI: ${rsi.toFixed(1)} ${rsi < CONFIG.LIMIARES.RSI_OVERSOLD ? '🔻' : rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT ? '🔺' : ''}</li>
        <li>📊 MACD: ${macd.histograma > 0 ? '+' : ''}${macd.histograma.toFixed(4)}</li>
        <li>📈 Stochastic: ${stoch.k.toFixed(1)}/${stoch.d.toFixed(1)}</li>
        <li>📌 EMA5: ${ema5?.toFixed(2) || 'N/A'} | EMA13: ${ema13?.toFixed(2) || 'N/A'}</li>
        <li>📊 Suporte: $${state.suporteKey.toFixed(2)} | Resistência: $${state.resistenciaKey.toFixed(2)}</li>
        <li>⚠️ Divergência: ${divergencias.tipoDivergencia}</li>
        <li>🚦 SuperTrend: ${superTrend.direcao > 0 ? 'ALTA' : 'BAIXA'}</li>
        <li>⚡ ATR: ${atr.toFixed(4)}</li>
        <li>🔄 Lateral: ${lateral ? 'SIM' : 'NÃO'}</li>
        <li>💹 Volume: ${(state.volumeRelativo * 100).toFixed(0)}% ${state.volumeRelativo > CONFIG.LIMIARES.VOLUME_ALERTA ? '🚀' : ''}</li>
        <li>📊 VWAP: $${state.vwap.toFixed(2)}</li>
      `;
    }

    state.ultimos.unshift(`${state.ultimaAtualizacao} - ${sinal} (${score}%)`);
    if (state.ultimos.length > 6) state.ultimos.pop();
    
    const ultimosElement = document.getElementById("ultimos");
    if (ultimosElement) {
      ultimosElement.innerHTML = state.ultimos.map(i => `<li>${i}</li>`).join("");
    }

    state.tentativasErro = 0;
    
    if (sinal !== "ESPERAR") {
      log(`BCH SINAL: ${sinal} com ${score}% de confiança`, LOG_LEVEL.INFO);
    }
    
  } catch (e) {
    log("Erro na análise BCH: " + e.message, LOG_LEVEL.ERROR);
    atualizarInterface("ERRO", 0, "ERRO", 0);
    
    const criteriosElement = document.getElementById("criterios");
    if (criteriosElement) {
      criteriosElement.innerHTML = `<li>ERRO BCH: ${e.message}</li>`;
    }
  } finally {
    state.leituraEmAndamento = false;
  }
}

// =============================================
// INICIALIZAÇÃO COM BITCOIN CASH
// =============================================
function iniciarAplicativo() {
  log("Iniciando análise para BITCOIN CASH (BCH/USD)...", LOG_LEVEL.INFO);
  
  setInterval(atualizarRelogio, 1000);
  sincronizarTimer();
  setTimeout(analisarMercado, 2000);
}

// Iniciar quando o documento estiver pronto
if (document.readyState === "complete") {
  iniciarAplicativo();
} else {
  document.addEventListener("DOMContentLoaded", iniciarAplicativo);
}
