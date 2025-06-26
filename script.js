// =============================================
// CONFIGURAÇÕES GLOBAIS COM URLS CORRETAS
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
  noticiasRecentes: [],
  volumeProfile: [],
  institutionalFlow: 0,
  fairValueGap: { gap: false },
  hiddenOrders: false,
  tendenciaDetectada: "NEUTRA",
  forcaTendencia: 0,
  dadosHistoricos: [],
  resistenciaKey: 0,
  suporteKey: 0,
  stopLoss: 0,
  takeProfit: 0,
  historico: { win: 0, loss: 0 },
  apiStatus: "ATIVA",
  atr: 0.0005
};

const CONFIG = {
  API_ENDPOINTS: {
    TWELVE_DATA: "https://api.twelvedata.com",
    CALENDARIO: "https://api.twelvedata.com/economic_calendar"
  },
  PARES: {
    FOREX_IDX: "EUR/USD"
  },
  SUA_CHAVE_API: "9cf795b2a4f14d43a049ca935d174ebb",
  PERIODOS: {
    RSI: 14,
    STOCH: 14,
    WILLIAMS: 14,
    EMA_CURTA: 8,
    EMA_MEDIA: 21,
    EMA_LONGA: 200,
    SMA_VOLUME: 20,
    MACD_RAPIDA: 12,
    MACD_LENTA: 26,
    MACD_SINAL: 9,
    VELAS_CONFIRMACAO: 3,
    ANALISE_LATERAL: 20,
    VWAP: 20,
    ATR: 14,
    SUPERTREND: 10,
    VOLUME_PROFILE: 50,
    LIQUIDITY_ZONES: 20,
    ADX: 14
  },
  LIMIARES: {
    SCORE_ALTO: 75,
    SCORE_MEDIO: 60,
    RSI_OVERBOUGHT: 72,
    RSI_OVERSOLD: 28,
    STOCH_OVERBOUGHT: 82,
    STOCH_OVERSOLD: 18,
    WILLIAMS_OVERBOUGHT: -12,
    WILLIAMS_OVERSOLD: -82,
    VARIACAO_LATERAL: 0.004,
    VWAP_DESVIO: 0.004,
    ATR_LIMIAR: 0.0004,
    ADX_FORTE: 25
  },
  PESOS: {
    RSI: 1.5,
    MACD: 2.0,
    TENDENCIA: 3.0,
    VOLUME: 0.4,
    STOCH: 1.0,
    WILLIAMS: 1.0,
    VWAP: 1.3,
    SUPERTREND: 2.0,
    VOLUME_PROFILE: 1.0,
    DIVERGENCIA: 2.2,
    LIQUIDITY: 1.5,
    ADX: 1.8
  },
  GESTAO_RISCO: {
    MULTIPLICADOR_SL: 1.8,
    MULTIPLICADOR_TP: 3.5,
    RR_MINIMO: 2.0
  }
};

// =============================================
// VERIFICAÇÃO DE MERCADO ABERTO
// =============================================
function verificarHorarioMercado() {
  const agora = new Date();
  const horaUTC = agora.getUTCHours();
  const diaSemana = agora.getUTCDay();
  
  const horarioAltaLiquidez = horaUTC >= 12 && horaUTC < 20;
  const fimDeSemana = diaSemana === 0 || diaSemana === 6;
  
  state.marketOpen = horarioAltaLiquidez && !fimDeSemana;
  return state.marketOpen;
}

// =============================================
// SISTEMA DE TENDÊNCIA COM ADX
// =============================================
function avaliarTendencia(closes, highs, lows, ema8, ema21, ema200) {
  const ultimoClose = closes[closes.length - 1];
  
  const tendenciaLongoPrazo = ultimoClose > ema200 ? "ALTA" : "BAIXA";
  const tendenciaMedioPrazo = ema8 > ema21 ? "ALTA" : "BAIXA";
  
  const distanciaMedia = Math.abs(ema8 - ema21);
  const forcaBase = Math.min(100, Math.round(distanciaMedia / ultimoClose * 10000));
  
  const adx = calcularADX(highs, lows, closes, CONFIG.PERIODOS.ADX);
  const forcaADX = Math.min(100, Math.round(adx * 100 / 50));
  
  let forcaTotal = Math.round(forcaADX * 0.7 + forcaBase * 0.3);
  
  let estrutura = "NEUTRA";
  if (closes.length > 10) {
    const ultimos10 = closes.slice(-10);
    const max10 = Math.max(...ultimos10);
    const min10 = Math.min(...ultimos10);
    
    if (ultimoClose > max10 && closes[closes.length - 2] > closes[closes.length - 3]) {
      estrutura = "ALTA";
    } else if (ultimoClose < min10 && closes[closes.length - 2] < closes[closes.length - 3]) {
      estrutura = "BAIXA";
    }
  }

  const tendenciaDominante = tendenciaMedioPrazo === tendenciaLongoPrazo ? tendenciaMedioPrazo : "NEUTRA";
  
  if (forcaTotal > 80 && adx > CONFIG.LIMIARES.ADX_FORTE && tendenciaDominante === estrutura) {
    return { 
      tendencia: tendenciaDominante === "ALTA" ? "FORTE_ALTA" : "FORTE_BAIXA",
      forca: forcaTotal
    };
  }
  
  if (forcaTotal > 55) {
    return { 
      tendencia: tendenciaDominante,
      forca: forcaTotal
    };
  }
  
  return { 
    tendencia: "NEUTRA", 
    forca: 0 
  };
}

// =============================================
// GERADOR DE SINAIS (COM VERIFICAÇÃO DE MERCADO)
// =============================================
function gerarSinal(indicadores, divergencias) {
  if (!state.marketOpen) return "PAUSADO";
  
  const {
    rsi,
    stoch,
    macd,
    close,
    emaCurta,
    emaMedia,
    superTrend,
    volumeProfile,
    liquidez,
    tendencia,
    volume,
    volumeMedia,
    adx
  } = indicadores;
  
  state.suporteKey = Math.min(volumeProfile.vaLow, liquidez.suporte, emaMedia);
  state.resistenciaKey = Math.max(volumeProfile.vaHigh, liquidez.resistencia, emaMedia);
  
  if (tendencia.tendencia === "FORTE_ALTA") {
    const condicoesCompra = [
      close > emaCurta,
      macd.histograma > 0 && macd.histograma > macd.sinalLinha * 0.8,
      stoch.k > 60 && stoch.k > stoch.d,
      close > superTrend.valor && superTrend.direcao > 0,
      volume > volumeMedia * 1.2,
      adx > CONFIG.LIMIARES.ADX_FORTE
    ];
    
    if (condicoesCompra.filter(Boolean).length >= 3) return "CALL";
  }
  
  if (tendencia.tendencia === "FORTE_BAIXA") {
    const condicoesVenda = [
      close < emaCurta,
      macd.histograma < 0 && macd.histograma < macd.sinalLinha * 0.8,
      stoch.k < 40 && stoch.k < stoch.d,
      close < superTrend.valor && superTrend.direcao < 0,
      volume > volumeMedia * 1.2,
      adx > CONFIG.LIMIARES.ADX_FORTE
    ];
    
    if (condicoesVenda.filter(Boolean).length >= 3) return "PUT";
  }
  
  const variacao = state.resistenciaKey - state.suporteKey;
  const limiteBreakout = Math.max(variacao * 0.15, state.atr * 1.2);
  
  if (close > (state.resistenciaKey + limiteBreakout)) {
    const velas = state.dadosHistoricos.slice(-3);
    const confirmacao = velas.filter(v => v.close > state.resistenciaKey).length >= 2;
    if (volume > volumeMedia * 1.5 && confirmacao) return "CALL";
  }
  
  if (close < (state.suporteKey - limiteBreakout)) {
    const velas = state.dadosHistoricos.slice(-3);
    const confirmacao = velas.filter(v => v.close < state.suporteKey).length >= 2;
    if (volume > volumeMedia * 1.5 && confirmacao) return "PUT";
  }
  
  if (divergencias.divergenciaRSI) {
    if (divergencias.tipoDivergencia === "ALTA") {
      const condicoes = [
        close > state.suporteKey,
        rsi > 45,
        volume > volumeMedia * 1.3,
        stoch.k > 20 && stoch.d > 20
      ];
      if (condicoes.filter(Boolean).length >= 3) return "CALL";
    }
    
    if (divergencias.tipoDivergencia === "BAIXA") {
      const condicoes = [
        close < state.resistenciaKey,
        rsi < 55,
        volume > volumeMedia * 1.3,
        stoch.k < 80 && stoch.d < 80
      ];
      if (condicoes.filter(Boolean).length >= 3) return "PUT";
    }
  }
  
  return "ESPERAR";
}

// =============================================
// CALCULADOR DE CONFIANÇA
// =============================================
function calcularScore(sinal, indicadores, divergencias) {
  if (!state.marketOpen) return 0;
  
  let score = 60;

  const fatores = {
    alinhamentoTendencia: sinal === "CALL" && indicadores.tendencia.tendencia.includes("ALTA") ||
                          sinal === "PUT" && indicadores.tendencia.tendencia.includes("BAIXA") ? 25 : 0,
    divergencia: divergencias.divergenciaRSI ? 22 : 0,
    volume: indicadores.volume > indicadores.volumeMedia * 1.2 ? 12 : 0,
    posicaoMedia: sinal === "CALL" && indicadores.close > indicadores.emaMedia ? 15 : 
                  sinal === "PUT" && indicadores.close < indicadores.emaMedia ? 15 : 0,
    superTrend: sinal === "CALL" && indicadores.close > indicadores.superTrend.valor ? 10 :
                sinal === "PUT" && indicadores.close < indicadores.superTrend.valor ? 10 : 0,
    adx: indicadores.adx > CONFIG.LIMIARES.ADX_FORTE ? 15 : 0
  };
  
  const penalidades = {
    noticiaProxima: state.noticiasRecentes.length > 0 ? -30 : 0,
    rsiExtremo: (indicadores.rsi > 75 || indicadores.rsi < 25) ? -20 : 0
  };

  score += Object.values(fatores).reduce((sum, val) => sum + val, 0);
  score += Object.values(penalidades).reduce((sum, val) => sum + val, 0);
  
  return Math.min(100, Math.max(0, score));
}

// =============================================
// GESTÃO DE RISCO
// =============================================
function calcularGestaoRisco(sinal, close, atr) {
  const { MULTIPLICADOR_SL, MULTIPLICADOR_TP } = CONFIG.GESTAO_RISCO;
  
  if (sinal === "CALL") {
    state.stopLoss = close - (atr * MULTIPLICADOR_SL);
    state.takeProfit = close + (atr * MULTIPLICADOR_TP);
  } else if (sinal === "PUT") {
    state.stopLoss = close + (atr * MULTIPLICADOR_SL);
    state.takeProfit = close - (atr * MULTIPLICADOR_TP);
  } else {
    state.stopLoss = 0;
    state.takeProfit = 0;
  }
}

// =============================================
// FILTRO DE NOTÍCIAS (CORRIGIDO)
// =============================================
async function verificarNoticias() {
  try {
    const response = await fetch(`${CONFIG.API_ENDPOINTS.CALENDARIO}?apikey=${CONFIG.SUA_CHAVE_API}&min_importance=2`);
    if (!response.ok) throw new Error("Erro no calendário");
    
    const data = await response.json();
    const agora = new Date();
    
    if (!data.data) throw new Error("Formato de dados inválido");
    
    state.noticiasRecentes = data.data.filter(evento => {
      const dataEvento = new Date(evento.date);
      const diffHoras = (dataEvento - agora) / (1000 * 60 * 60);
      return diffHoras > 0 && diffHoras < 4;
    });
    
    return state.noticiasRecentes.length === 0;
  } catch (e) {
    console.error("Erro ao verificar notícias:", e);
    return true; // Ignora notícias em caso de erro
  }
}

// =============================================
// INDICADORES TÉCNICOS (COMPLETOS)
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

  const rs = avgGain / Math.max(avgLoss, 1e-8);
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
    
    const dValues = kValues.length >= 3 ? calcularMedia.simples(kValues.slice(-3), 3) : 50;
    return {
      k: kValues[kValues.length-1] || 50,
      d: dValues || 50
    };
  } catch (e) {
    console.error("Erro no cálculo Stochastic:", e);
    return { k: 50, d: 50 };
  }
}

function calcularWilliams(highs, lows, closes, periodo = CONFIG.PERIODOS.WILLIAMS) {
  try {
    if (!Array.isArray(closes) || closes.length < periodo) return 0;
    
    const sliceHigh = highs.slice(-periodo);
    const sliceLow = lows.slice(-periodo);
    const highestHigh = Math.max(...sliceHigh);
    const lowestLow = Math.min(...sliceLow);
    const range = highestHigh - lowestLow;
    
    return range > 0 ? ((highestHigh - closes[closes.length-1]) / range) * -100 : 0;
  } catch (e) {
    console.error("Erro no cálculo Williams:", e);
    return 0;
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
    console.error("Erro no cálculo MACD:", e);
    return { histograma: 0, macdLinha: 0, sinalLinha: 0 };
  }
}

function calcularVWAP(dados, periodo = CONFIG.PERIODOS.VWAP) {
  try {
    if (!Array.isArray(dados) || dados.length < periodo) return 0;
    
    const slice = dados.slice(-periodo);
    let typicalPriceSum = 0;
    let volumeSum = 0;
    
    for (const vela of slice) {
      const typicalPrice = (vela.high + vela.low + vela.close) / 3;
      typicalPriceSum += typicalPrice * vela.volume;
      volumeSum += vela.volume;
    }
    
    return volumeSum > 0 ? typicalPriceSum / volumeSum : 0;
  } catch (e) {
    console.error("Erro no cálculo VWAP:", e);
    return 0;
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
    console.error("Erro no cálculo ATR:", e);
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
        superTrend = Math.max(upperBand, prev.superTrend || upperBand);
      } else {
        direcao = -1;
        superTrend = Math.min(lowerBand, prev.superTrend || lowerBand);
      }
    }
    
    return { direcao, valor: superTrend };
  } catch (e) {
    console.error("Erro no cálculo SuperTrend:", e);
    return { direcao: 0, valor: 0 };
  }
}

function calcularVolumeProfile(dados, periodo = CONFIG.PERIODOS.VOLUME_PROFILE) {
  try {
    if (!Array.isArray(dados) || dados.length < periodo) return { pvp: 0, vaHigh: 0, vaLow: 0 };
    
    const slice = dados.slice(-periodo);
    const buckets = {};
    const precisao = 5;
    
    for (const vela of slice) {
      const amplitude = vela.high - vela.low;
      if (amplitude === 0) continue;
      
      const niveis = 10;
      const passo = amplitude / niveis;
      
      for (let i = 0; i < niveis; i++) {
        const preco = (vela.low + i * passo).toFixed(precisao);
        buckets[preco] = (buckets[preco] || 0) + (vela.volume / niveis);
      }
    }
    
    const niveisOrdenados = Object.entries(buckets)
      .sort((a, b) => b[1] - a[1]);
    
    if (niveisOrdenados.length === 0) return { pvp: 0, vaHigh: 0, vaLow: 0 };
    
    const pvp = parseFloat(niveisOrdenados[0][0]);
    const vaHigh = parseFloat(niveisOrdenados[Math.floor(niveisOrdenados.length * 0.3)]?.[0] || pvp);
    const vaLow = parseFloat(niveisOrdenados[Math.floor(niveisOrdenados.length * 0.7)]?.[0] || pvp);
    
    return { pvp, vaHigh, vaLow };
  } catch (e) {
    console.error("Erro no cálculo Volume Profile:", e);
    return { pvp: 0, vaHigh: 0, vaLow: 0 };
  }
}

function calcularLiquidez(velas, periodo = CONFIG.PERIODOS.LIQUIDITY_ZONES) {
  const slice = velas.slice(-periodo);
  const highNodes = [];
  const lowNodes = [];
  
  for (let i = 3; i < slice.length - 3; i++) {
    if (slice[i].high > slice[i-1].high && slice[i].high > slice[i+1].high) {
      highNodes.push(slice[i].high);
    }
    if (slice[i].low < slice[i-1].low && slice[i].low < slice[i+1].low) {
      lowNodes.push(slice[i].low);
    }
  }
  
  return {
    resistencia: highNodes.length > 0 ? calcularMedia.simples(highNodes, highNodes.length) : 0,
    suporte: lowNodes.length > 0 ? calcularMedia.simples(lowNodes, lowNodes.length) : 0
  };
}

function detectarDivergencias(closes, rsis, highs, lows) {
  try {
    if (closes.length < 10 || rsis.length < 10) 
      return { divergenciaRSI: false, tipoDivergencia: "NENHUMA", divergenciaOculta: false };
    
    const rsiSuavizado = rsis.map((val, idx, arr) => {
      return idx > 1 ? (val + arr[idx-1] + arr[idx-2])/3 : val;
    });
    
    const ultimosCloses = closes.slice(-10);
    const ultimosRSIs = rsiSuavizado.slice(-10);
    const ultimosHighs = highs.slice(-10);
    const ultimosLows = lows.slice(-10);
    
    const baixaPreco = ultimosLows[0] < ultimosLows[4] && ultimosLows[4] < ultimosLows[8];
    const altaRSI = ultimosRSIs[0] > ultimosRSIs[4] && ultimosRSIs[4] > ultimosRSIs[8];
    const divergenciaAlta = baixaPreco && altaRSI;
    
    const altaPreco = ultimosHighs[0] > ultimosHighs[4] && ultimosHighs[4] > ultimosHighs[8];
    const baixaRSI = ultimosRSIs[0] < ultimosRSIs[4] && ultimosRSIs[4] < ultimosRSIs[8];
    const divergenciaBaixa = altaPreco && baixaRSI;
    
    return {
      divergenciaRSI: divergenciaAlta || divergenciaBaixa,
      divergenciaOculta: false,
      tipoDivergencia: divergenciaAlta ? "ALTA" : 
                      divergenciaBaixa ? "BAIXA" : "NENHUMA"
    };
  } catch (e) {
    console.error("Erro na detecção de divergências:", e);
    return { divergenciaRSI: false, divergenciaOculta: false, tipoDivergencia: "NENHUMA" };
  }
}

function calcularADX(highs, lows, closes, periodo = CONFIG.PERIODOS.ADX) {
  if (highs.length < periodo * 2) return 0;
  
  const trs = [Math.abs(highs[0] - lows[0])];
  const plusDMs = [0];
  const minusDMs = [0];
  
  for (let i = 1; i < highs.length; i++) {
    const highDiff = highs[i] - highs[i-1];
    const lowDiff = lows[i-1] - lows[i];
    
    trs.push(Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i-1]),
      Math.abs(lows[i] - closes[i-1])
    ));
    
    plusDMs.push(highDiff > lowDiff && highDiff > 0 ? highDiff : 0);
    minusDMs.push(lowDiff > highDiff && lowDiff > 0 ? lowDiff : 0);
  }
  
  const tr14s = [calcularMedia.simples(trs.slice(0, periodo), periodo)];
  const plusDM14s = [calcularMedia.simples(plusDMs.slice(0, periodo), periodo)];
  const minusDM14s = [calcularMedia.simples(minusDMs.slice(0, periodo), periodo)];
  
  for (let i = periodo; i < trs.length; i++) {
    tr14s.push(tr14s[i-periodo] - (tr14s[i-periodo]/periodo) + trs[i]);
    plusDM14s.push(plusDM14s[i-periodo] - (plusDM14s[i-periodo]/periodo) + plusDMs[i]);
    minusDM14s.push(minusDM14s[i-periodo] - (minusDM14s[i-periodo]/periodo) + minusDMs[i]);
  }
  
  const dxs = [];
  for (let i = periodo; i < tr14s.length; i++) {
    const plusDI = 100 * (plusDM14s[i] / tr14s[i]);
    const minusDI = 100 * (minusDM14s[i] / tr14s[i]);
    const dx = 100 * Math.abs(plusDI - minusDI) / (plusDI + minusDI);
    dxs.push(dx);
  }
  
  return calcularMedia.simples(dxs.slice(-periodo), periodo) || 0;
}

// =============================================
// FUNÇÕES UTILITÁRIAS
// =============================================
function formatarTimer(segundos) {
  return segundos.toString();
}

function atualizarRelogio() {
  const elementoHora = document.getElementById("hora");
  if (elementoHora) {
    const now = new Date();
    state.ultimaAtualizacao = now.toLocaleTimeString("pt-BR");
    elementoHora.textContent = state.ultimaAtualizacao;
  }
}

function atualizarInterface(sinal, score, tendencia, forcaTendencia) {
  const comandoElement = document.getElementById("comando");
  if (comandoElement) {
    comandoElement.textContent = sinal;
    comandoElement.className = sinal.toLowerCase();
  }
  
  const scoreElement = document.getElementById("score");
  if (scoreElement) {
    scoreElement.textContent = `${score}%`;
    if (score >= CONFIG.LIMIARES.SCORE_ALTO) scoreElement.className = "high";
    else if (score >= CONFIG.LIMIARES.SCORE_MEDIO) scoreElement.className = "medium";
    else scoreElement.className = "low";
  }
  
  const criteriosElement = document.getElementById("criterios");
  if (criteriosElement) {
    criteriosElement.innerHTML = `
      <li>Tendência: ${tendencia} (${forcaTendencia}%)</li>
      <li>Suporte: ${state.suporteKey.toFixed(5)}</li>
      <li>Resistência: ${state.resistenciaKey.toFixed(5)}</li>
      <li>Stop Loss: ${state.stopLoss.toFixed(5)}</li>
      <li>Take Profit: ${state.takeProfit.toFixed(5)}</li>
    `;
  }
  
  if (sinal !== "ESPERAR" && sinal !== "PAUSADO") {
    state.ultimos.unshift(`${state.ultimaAtualizacao} - ${sinal} (${score}%)`);
    if (state.ultimos.length > 8) state.ultimos.pop();
    const ultimosElement = document.getElementById("ultimos");
    if (ultimosElement) {
      ultimosElement.innerHTML = state.ultimos.map(i => `<li>${i}</li>`).join("");
    }
  }
}

// =============================================
// CORE DO SISTEMA - OPERAÇÃO REAL
// =============================================
async function analisarMercado() {
  if (state.leituraEmAndamento) return;
  state.leituraEmAndamento = true;
  
  try {
    verificarHorarioMercado();
    
    if (!state.marketOpen) {
      atualizarInterface("PAUSADO", 0, "Mercado Fechado", 0);
      state.leituraEmAndamento = false;
      return;
    }

    const semNoticias = await verificarNoticias();
    if (!semNoticias) {
      atualizarInterface("PAUSADO", 0, "Notícias próximas", 0);
      state.leituraEmAndamento = false;
      return;
    }

    const dados = await obterDadosTwelveData();
    state.dadosHistoricos = dados;
    const velaAtual = dados[dados.length - 1];
    const closes = dados.map(v => v.close);
    const highs = dados.map(v => v.high);
    const lows = dados.map(v => v.low);
    const volumes = dados.map(v => v.volume);

    // Verificação de dados mínimos
    if (closes.length < 50) {
      throw new Error("Dados insuficientes para análise");
    }

    const ema8 = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_CURTA).pop() || 0;
    const ema21 = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_MEDIA).pop() || 0;
    const ema200 = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_LONGA).pop() || 0;
    const volumeMedia = calcularMedia.simples(volumes.slice(-CONFIG.PERIODOS.SMA_VOLUME), CONFIG.PERIODOS.SMA_VOLUME) || 1;
    const superTrend = calcularSuperTrend(dados);
    const volumeProfile = calcularVolumeProfile(dados);
    const liquidez = calcularLiquidez(dados);
    const rsi = calcularRSI(closes);
    const stoch = calcularStochastic(highs, lows, closes);
    const macd = calcularMACD(closes);
    const atr = calcularATR(dados);
    const adx = calcularADX(highs, lows, closes);
    state.atr = atr;

    const rsiHistory = [];
    for (let i = CONFIG.PERIODOS.RSI; i <= closes.length; i++) {
      rsiHistory.push(calcularRSI(closes.slice(0, i)));
    }
    const divergencias = detectarDivergencias(closes, rsiHistory, highs, lows);

    const tendencia = avaliarTendencia(closes, highs, lows, ema8, ema21, ema200);
    state.tendenciaDetectada = tendencia.tendencia;
    state.forcaTendencia = tendencia.forca;

    const indicadores = {
      rsi,
      stoch,
      macd,
      emaCurta: ema8,
      emaMedia: ema21,
      close: velaAtual.close,
      volume: velaAtual.volume,
      volumeMedia,
      superTrend,
      volumeProfile,
      liquidez,
      tendencia,
      adx,
      atr
    };

    const sinal = gerarSinal(indicadores, divergencias);
    const score = calcularScore(sinal, indicadores, divergencias);
    
    calcularGestaoRisco(sinal, velaAtual.close, atr);

    state.ultimoSinal = sinal;
    state.ultimoScore = score;
    state.ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR");

    atualizarInterface(sinal, score, state.tendenciaDetectada, state.forcaTendencia);

    if (sinal === "CALL") console.log("PLAY SOUND: CALL");
    else if (sinal === "PUT") console.log("PLAY SOUND: PUT");

    state.tentativasErro = 0;
    state.apiStatus = "ATIVA";
  } catch (e) {
    console.error("Erro na análise:", e);
    atualizarInterface("ERRO", 0, "ERRO", 0);
    state.apiStatus = "ERRO";
    if (++state.tentativasErro > 3) setTimeout(() => location.reload(), 10000);
  } finally {
    state.leituraEmAndamento = false;
  }
}

// =============================================
// FUNÇÃO PARA REGISTRAR WIN/LOSS
// =============================================
function registrar(resultado) {
  if (resultado === 'WIN') state.historico.win++;
  else if (resultado === 'LOSS') state.historico.loss++;
  
  const historicoElement = document.getElementById("historico");
  if (historicoElement) {
    historicoElement.textContent = `${state.historico.win} WIN / ${state.historico.loss} LOSS`;
  }
}

// =============================================
// FUNÇÕES DE DADOS - COM URLS CORRETAS
// =============================================
async function obterDadosTwelveData() {
  try {
    const response = await fetch(`${CONFIG.API_ENDPOINTS.TWELVE_DATA}/time_series?symbol=${CONFIG.PARES.FOREX_IDX}&interval=1min&outputsize=100&apikey=${CONFIG.SUA_CHAVE_API}`);
    if (!response.ok) throw new Error("Falha na API");
    
    const data = await response.json();
    
    if (data.code || data.status === 'error') {
      throw new Error(data.message || `Erro: ${data.code}`);
    }
    
    const valores = data.values.reverse();
    
    return valores.map(item => ({
      time: item.datetime,
      open: parseFloat(item.open),
      high: parseFloat(item.high),
      low: parseFloat(item.low),
      close: parseFloat(item.close),
      volume: parseFloat(item.volume) || 1
    }));
  } catch (e) {
    console.error("Erro ao obter dados:", e);
    throw e;
  }
}

// =============================================
// CONTROLE DE TEMPO CORRIGIDO
// =============================================
function sincronizarTimer() {
  clearInterval(state.intervaloAtual);
  
  // Atualiza o timer imediatamente
  const agora = new Date();
  const segundos = agora.getSeconds();
  state.timer = 60 - segundos;
  
  const elementoTimer = document.getElementById("timer");
  if (elementoTimer) elementoTimer.textContent = formatarTimer(state.timer);
  
  state.intervaloAtual = setInterval(() => {
    state.timer--;
    
    if (elementoTimer) elementoTimer.textContent = formatarTimer(state.timer);
    
    if (state.timer <= 0) {
      clearInterval(state.intervaloAtual);
      analisarMercado().finally(() => {
        // Reinicia o timer após a análise
        state.timer = 60;
        sincronizarTimer();
      });
    }
  }, 1000);
}

// =============================================
// INICIALIZAÇÃO
// =============================================
function iniciarAplicativo() {
  sincronizarTimer();
  setInterval(atualizarRelogio, 1000);
  setTimeout(analisarMercado, 2000);
  
  // Monitoramento de desempenho
  setInterval(() => {
    console.log("Monitoramento: ", {
      memoria: window.performance.memory,
      tempo: new Date().toLocaleTimeString(),
      status: state.apiStatus
    });
  }, 30000);
}

// Iniciar quando o documento estiver pronto
document.addEventListener("DOMContentLoaded", iniciarAplicativo);
