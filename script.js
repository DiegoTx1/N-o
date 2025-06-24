// =============================================
// CONFIGURAÇÕES OTIMIZADAS PARA GBP/NZD
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
  websocket: null,
  marketOpen: true,
  tendenciaDetectada: "NEUTRA",
  forcaTendencia: 0,
  resistenciaKey: 0,
  suporteKey: 0,
  ultimoPreco: 0
};

const CONFIG = {
  API_ENDPOINTS: {
    TWELVE_DATA: "https://api.twelvedata.com",
    FOREX: "https://api.twelvedata.com/forex"
  },
  WS_ENDPOINT: "wss://ws.twelvedata.com/v1/quotes/price?apikey=9cf795b2a4f14d43a049ca935d174ebb",
  PARES: {
    FOREX: "GBP/NZD"
  },
  PERIODOS: {
    RSI: 14,
    STOCH: 14,
    EMA_CURTA: 8,
    EMA_MEDIA: 21,
    EMA_LONGA: 50,
    SMA_VOLUME: 20,
    MACD_RAPIDA: 12,
    MACD_LENTA: 26,
    MACD_SINAL: 9,
    ANALISE_LATERAL: 20,
    ATR: 14,
    SUPERTREND: 10
  },
  LIMIARES: {
    SCORE_ALTO: 80,  // Aumentado para entradas mais assertivas
    SCORE_MEDIO: 65,
    RSI_OVERBOUGHT: 70,
    RSI_OVERSOLD: 30,
    STOCH_OVERBOUGHT: 80,
    STOCH_OVERSOLD: 20,
    VARIACAO_LATERAL: 0.3,
    ATR_LIMIAR: 0.005
  },
  PESOS: {
    TENDENCIA: 3.0,  // Peso maior para tendência
    MACD: 2.0,
    RSI: 1.5,
    VOLUME: 1.2,
    STOCH: 1.0,
    SUPERTREND: 2.0,
    PRICE_ACTION: 2.5
  }
};

// =============================================
// SISTEMA DE TENDÊNCIA OTIMIZADO PARA GBP/NZD
// =============================================
function avaliarTendencia(closes, ema8, ema21, ema50, atr) {
  const ultimoClose = closes[closes.length - 1];
  const penultimoClose = closes[closes.length - 2];
  
  // Tendência de curto prazo (agressiva)
  const acimaEMA8 = ultimoClose > ema8;
  const acimaEMA21 = ultimoClose > ema21;
  const acimaEMA50 = ultimoClose > ema50;
  
  // Força da tendência baseada em ATR
  const forcaBase = Math.min(100, Math.round((ema8 - ema21) / atr * 10));
  
  // Confirmação de momentum
  const momentumPositivo = ultimoClose > penultimoClose && ema8 > ema21;
  const momentumNegativo = ultimoClose < penultimoClose && ema8 < ema21;
  
  if (acimaEMA8 && acimaEMA21 && acimaEMA50 && momentumPositivo) {
    return { 
      tendencia: "FORTE_ALTA",
      forca: Math.min(100, forcaBase + 30)
    };
  }
  
  if (!acimaEMA8 && !acimaEMA21 && !acimaEMA50 && momentumNegativo) {
    return { 
      tendencia: "FORTE_BAIXA",
      forca: Math.min(100, forcaBase + 30)
    };
  }
  
  if (acimaEMA21 && acimaEMA50) {
    return { 
      tendencia: "ALTA",
      forca: Math.max(30, forcaBase)
    };
  }
  
  if (!acimaEMA21 && !acimaEMA50) {
    return { 
      tendencia: "BAIXA",
      forca: Math.max(30, forcaBase)
    };
  }
  
  return { 
    tendencia: "NEUTRA", 
    forca: 0 
  };
}

// =============================================
// GERADOR DE SINAIS ASSERTIVOS - GBP/NZD
// =============================================
function gerarSinal(indicadores) {
  const {
    rsi,
    stoch,
    macd,
    close,
    emaCurta,
    emaMedia,
    volume,
    volumeMedia,
    superTrend,
    atr,
    tendencia
  } = indicadores;

  // Filtro de volatilidade - ignorar mercados muito planos
  if (atr < CONFIG.LIMIARES.ATR_LIMIAR) {
    return "ESPERAR";
  }

  // SINAIS DE TENDÊNCIA FORTE
  if (tendencia.tendencia === "FORTE_ALTA") {
    const condicoesCompra = [
      close > emaCurta,
      macd.histograma > 0,
      stoch.k > stoch.d && stoch.k > 50,
      rsi > 50 && rsi < 70,
      superTrend.direcao > 0
    ];
    
    if (condicoesCompra.filter(Boolean).length >= 4) {
      return "CALL";
    }
  }

  if (tendencia.tendencia === "FORTE_BAIXA") {
    const condicoesVenda = [
      close < emaCurta,
      macd.histograma < 0,
      stoch.k < stoch.d && stoch.k < 50,
      rsi < 50 && rsi > 30,
      superTrend.direcao < 0
    ];
    
    if (condicoesVenda.filter(Boolean).length >= 4) {
      return "PUT";
    }
  }

  // SINAIS DE CONTRA-TENDÊNCIA (apenas para traders experientes)
  if (tendencia.forca < 50) {
    if (rsi < 30 && close > emaMedia && macd.histograma > 0) {
      return "CALL";
    }
    
    if (rsi > 70 && close < emaMedia && macd.histograma < 0) {
      return "PUT";
    }
  }

  return "ESPERAR";
}

// =============================================
// CALCULADOR DE SCORE PRECISO - GBP/NZD
// =============================================
function calcularScore(sinal, indicadores) {
  let score = 50; // Base mais conservadora

  // Fatores de Confirmação
  const fatores = {
    alinhamentoTendencia: sinal === "CALL" && indicadores.tendencia.tendencia.includes("ALTA") ||
                         sinal === "PUT" && indicadores.tendencia.tendencia.includes("BAIXA") ? 30 : 0,
    
    momentumMACD: sinal === "CALL" && indicadores.macd.histograma > 0 ? 15 :
                 sinal === "PUT" && indicadores.macd.histograma < 0 ? 15 : 0,
    
    volume: indicadores.volume > indicadores.volumeMedia * 1.5 ? 15 : 0,
    
    posicaoMedia: sinal === "CALL" && indicadores.close > indicadores.emaMedia ? 10 : 
                  sinal === "PUT" && indicadores.close < indicadores.emaMedia ? 10 : 0,
    
    superTrend: (sinal === "CALL" && indicadores.superTrend.direcao > 0) ||
                (sinal === "PUT" && indicadores.superTrend.direcao < 0) ? 20 : 0,
    
    rsi: sinal === "CALL" && indicadores.rsi > 50 && indicadores.rsi < 70 ? 10 :
         sinal === "PUT" && indicadores.rsi < 50 && indicadores.rsi > 30 ? 10 : 0
  };

  // Adicionar pontos e ajustar pelo ATR (volatilidade)
  score += Object.values(fatores).reduce((sum, val) => sum + val, 0);
  score *= 1 + (Math.min(indicadores.atr / 0.01, 1) * 0.5); // Aumenta score em mercados mais voláteis

  // Limitar entre 0-100
  return Math.min(100, Math.max(0, Math.round(score)));
}

// =============================================
// FUNÇÕES DE ANÁLISE TÉCNICA (OTIMIZADAS)
// =============================================
async function analisarMercado() {
  if (state.leituraEmAndamento || !state.marketOpen) return;
  state.leituraEmAndamento = true;
  
  try {
    const dados = await obterDadosForex();
    const velaAtual = dados[dados.length - 1];
    const closes = dados.map(v => v.close);
    const highs = dados.map(v => v.high);
    const lows = dados.map(v => v.low);
    const volumes = dados.map(v => v.volume);

    // Cálculo de indicadores
    const ema8 = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_CURTA).pop();
    const ema21 = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_MEDIA).pop();
    const ema50 = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_LONGA).pop();
    const volumeMedia = calcularMedia.simples(volumes.slice(-CONFIG.PERIODOS.SMA_VOLUME), CONFIG.PERIODOS.SMA_VOLUME);
    const atr = calcularATR(dados);
    const superTrend = calcularSuperTrend(dados);
    const rsi = calcularRSI(closes);
    const stoch = calcularStochastic(highs, lows, closes);
    const macd = calcularMACD(closes);

    // Avaliação de tendência
    const tendencia = avaliarTendencia(closes, ema8, ema21, ema50, atr);
    state.tendenciaDetectada = tendencia.tendencia;
    state.forcaTendencia = tendencia.forca;

    // Gerar sinal
    const indicadores = {
      rsi, stoch, macd,
      close: velaAtual.close,
      emaCurta: ema8,
      emaMedia: ema21,
      volume: velaAtual.volume,
      volumeMedia,
      superTrend,
      atr,
      tendencia
    };

    const sinal = gerarSinal(indicadores);
    const score = calcularScore(sinal, indicadores);

    // Atualizar estado e interface
    state.ultimoSinal = sinal;
    state.ultimoScore = score;
    state.ultimoPreco = velaAtual.close;
    state.ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR");
    
    atualizarInterface(sinal, score, tendencia.tendencia, tendencia.forca);
    atualizarDetalhesTecnicos(indicadores);

  } catch (e) {
    console.error("Erro na análise:", e);
    atualizarInterface("ERRO", 0, "ERRO", 0);
  } finally {
    state.leituraEmAndamento = false;
  }
}

// =============================================
// FUNÇÕES AUXILIARES (ATUALIZADAS)
// =============================================
function atualizarDetalhesTecnicos(indicadores) {
  const criteriosElement = document.getElementById("criterios");
  if (criteriosElement) {
    criteriosElement.innerHTML = `
      <li>📊 Tendência: ${indicadores.tendencia.tendencia} (${indicadores.tendencia.forca}%)</li>
      <li>💰 Preço: ${indicadores.close.toFixed(5)}</li>
      <li>📈 EMA8: ${indicadores.emaCurta.toFixed(5)} | EMA21: ${indicadores.emaMedia.toFixed(5)}</li>
      <li>📉 RSI: ${indicadores.rsi.toFixed(1)}</li>
      <li>📊 MACD: ${indicadores.macd.histograma.toFixed(5)}</li>
      <li>📈 Stochastic: ${indicadores.stoch.k.toFixed(1)}/${indicadores.stoch.d.toFixed(1)}</li>
      <li>💹 Volume: ${(indicadores.volume/1000).toFixed(1)}K (Média: ${(indicadores.volumeMedia/1000).toFixed(1)}K)</li>
      <li>📌 ATR: ${indicadores.atr.toFixed(5)}</li>
      <li>🚦 SuperTrend: ${indicadores.superTrend.direcao > 0 ? 'ALTA' : 'BAIXA'}</li>
    `;
  }
}

// =============================================
// INICIALIZAÇÃO (MANTIDA)
// =============================================
function iniciarAplicativo() {
  // Configurar atualizações periódicas
  setInterval(atualizarRelogio, 1000);
  sincronizarTimer();
  iniciarWebSocket();
  
  // Primeira análise
  setTimeout(analisarMercado, 2000);
}

document.addEventListener("DOMContentLoaded", iniciarAplicativo);
