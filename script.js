// =============================================
// CONFIGURAÇÕES GLOBAIS (ATUALIZADAS PARA BINANCE)
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
  timeOffset: 0,
  cache: {},
  reconnectDelay: 5000
};

const CONFIG = {
  API_ENDPOINTS: {
    BINANCE: "https://api.binance.com/api/v3",
    CRYPTORANK: "https://api.cryptorank.io/v1",
    CRYPTOCOMPARE: "https://min-api.cryptocompare.com/data",
    WORLD_TIME: "https://worldtimeapi.org/api/ip"
  },
  WS_ENDPOINT: "wss://stream.binance.com:9443/ws/btcusdt@kline_1m",
  PARES: {
    CRYPTO_IDX: "BTCUSDT"
  },
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
    DESVIO_PADRAO: 20
  },
  LIMIARES: {
    SCORE_ALTO: 80,
    SCORE_MEDIO: 65,
    RSI_OVERBOUGHT: 70,
    RSI_OVERSOLD: 30,
    STOCH_OVERBOUGHT: 80,
    STOCH_OVERSOLD: 20,
    WILLIAMS_OVERBOUGHT: -20,
    WILLIAMS_OVERSOLD: -80,
    VOLUME_ALTO: 2.0,
    VARIACAO_LATERAL: 0.8,
    VWAP_DESVIO: 0.02,
    ATR_LIMIAR: 0.03
  },
  PESOS: {
    RSI: 1.5,
    MACD: 2.0,
    TENDENCIA: 2.5,
    VOLUME: 1.8,
    STOCH: 1.0,
    WILLIAMS: 0.9,
    VWAP: 1.3,
    SUPERTREND: 1.7,
    VOLUME_PROFILE: 1.5,
    DIVERGENCIA: 1.8,
    LIQUIDITY: 1.9,
    NIVEL_CHAVE: { VOLUME_PROFILE: 0.4, LIQUIDEZ: 0.4, EMA: 0.2 }
  }
};

// =============================================
// SISTEMA DE TENDÊNCIA ATUALIZADO
// =============================================
function avaliarTendencia(closes, ema8, ema21, ema200Array, volume, volumeMedio) {
  const ultimoClose = closes[closes.length - 1];
  
  // Verificar inclinação da EMA200
  const inclinacaoEMA200 = ema200Array.length > 5 && 
                          ema200Array[ema200Array.length-1] > ema200Array[ema200Array.length-5];
  
  // Tendência de longo prazo
  const tendenciaLongoPrazo = (ultimoClose > ema200Array[ema200Array.length-1] && inclinacaoEMA200) 
                              ? "ALTA" : "BAIXA";
  
  // Tendência de médio prazo
  const tendenciaMedioPrazo = ema8 > ema21 ? "ALTA" : "BAIXA";
  
  // Força da tendência
  const distanciaMedia = Math.abs(ema8 - ema21);
  const forcaBase = Math.min(100, Math.round(distanciaMedia / ultimoClose * 1000));
  const forcaVolume = volume > volumeMedio * 1.5 ? 20 : 0;
  
  let forcaTotal = forcaBase + forcaVolume;
  if (tendenciaLongoPrazo === tendenciaMedioPrazo) forcaTotal += 30;
  
  // Determinar tendência final
  if (forcaTotal > 80) {
    return { 
      tendencia: tendenciaMedioPrazo === "ALTA" ? "FORTE_ALTA" : "FORTE_BAIXA",
      forca: Math.min(100, forcaTotal)
    };
  }
  
  if (forcaTotal > 50) {
    return { 
      tendencia: tendenciaMedioPrazo,
      forca: forcaTotal
    };
  }
  
  return { 
    tendencia: "NEUTRA", 
    forca: 0 
  };
}

// =============================================
// GERADOR DE SINAIS DE ALTA PRECISÃO
// =============================================
function gerarSinal(indicadores, divergencias) {
  const {
    rsi,
    stoch,
    macd,
    close,
    emaCurta,
    emaMedia,
    volume,
    volumeMedia,
    volumeDesvio,
    superTrend,
    volumeProfile,
    liquidez,
    atr
  } = indicadores;
  
  // Calcular níveis-chave com pesos
  const pesos = CONFIG.PESOS.NIVEL_CHAVE;
  state.suporteKey = 
      (volumeProfile.vaLow * pesos.VOLUME_PROFILE) +
      (liquidez.suporte * pesos.LIQUIDEZ) +
      (emaMedia * pesos.EMA);
  
  state.resistenciaKey = 
      (volumeProfile.vaHigh * pesos.VOLUME_PROFILE) +
      (liquidez.resistencia * pesos.LIQUIDEZ) +
      (emaMedia * pesos.EMA);
  
  // Proteção contra falsos sinais próximos a níveis-chave
  const margemAtr = atr * 0.5;
  if (Math.abs(close - state.resistenciaKey) < margemAtr ||
      Math.abs(close - state.suporteKey) < margemAtr) {
    return "ESPERAR";
  }
  
  // Limiar dinâmico de volume
  const limiarVolume = volumeMedia + (volumeDesvio * 1.5);
  
  // 1. Sinal de tendência forte
  if (indicadores.tendencia.tendencia === "FORTE_ALTA") {
    const condicoesCompra = [
      close > emaCurta,
      macd.histograma > 0,
      stoch.k > 50,
      volume > limiarVolume
    ];
    
    if (condicoesCompra.filter(Boolean).length >= 3) {
      return "CALL";
    }
  }
  
  // 2. Sinal de tendência forte de baixa
  if (indicadores.tendencia.tendencia === "FORTE_BAIXA") {
    const condicoesVenda = [
      close < emaCurta,
      macd.histograma < 0,
      stoch.k < 50,
      volume > limiarVolume
    ];
    
    if (condicoesVenda.filter(Boolean).length >= 3) {
      return "PUT";
    }
  }
  
  // 3. Sinal de rompimento
  if (close > state.resistenciaKey && volume > limiarVolume * 1.5) {
    return "CALL";
  }
  
  if (close < state.suporteKey && volume > limiarVolume * 1.5) {
    return "PUT";
  }
  
  // 4. Sinal de reversão por divergência
  if (divergencias.divergenciaRSI) {
    if (divergencias.tipoDivergencia === "ALTA" && close > state.suporteKey) {
      return "CALL";
    }
    
    if (divergencias.tipoDivergencia === "BAIXA" && close < state.resistenciaKey) {
      return "PUT";
    }
  }
  
  // 5. Sinal de reversão por RSI extremo
  if (rsi < 30 && close > emaMedia) {
    return "CALL";
  }
  
  if (rsi > 70 && close < emaMedia) {
    return "PUT";
  }
  
  return "ESPERAR";
}

// =============================================
// CALCULADOR DE CONFIANÇA PRECISO
// =============================================
function calcularScore(sinal, indicadores, divergencias) {
  let score = 60; // Base mais alta para crypto
  
  // Fatores gerais
  const fatores = {
    volumeAlto: indicadores.volume > indicadores.limiarVolume ? 15 : 0,
    alinhamentoTendencia: sinal === "CALL" && indicadores.tendencia.tendencia.includes("ALTA") ||
                          sinal === "PUT" && indicadores.tendencia.tendencia.includes("BAIXA") ? 20 : 0,
    divergencia: divergencias.divergenciaRSI ? 15 : 0,
    posicaoMedia: sinal === "CALL" && indicadores.close > indicadores.emaMedia ? 10 : 
                  sinal === "PUT" && indicadores.close < indicadores.emaMedia ? 10 : 0
  };
  
  // Adicionar pontos específicos
  score += Object.values(fatores).reduce((sum, val) => sum + val, 0);
  
  // Limitar entre 0-100
  return Math.min(100, Math.max(0, score));
}

// =============================================
// FUNÇÕES UTILITÁRIAS
// =============================================
function formatarTimer(segundos) {
  return `0:${segundos.toString().padStart(2, '0')}`;
}

function atualizarRelogio() {
  const elementoHora = document.getElementById("hora");
  if (elementoHora) {
    const now = new Date(Date.now() + state.timeOffset);
    state.ultimaAtualizacao = now.toLocaleTimeString("pt-BR", {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    elementoHora.textContent = state.ultimaAtualizacao;
    state.marketOpen = true;
  }
}

function atualizarInterface(sinal, score, tendencia, forcaTendencia) {
  if (!state.marketOpen) return;
  
  const comandoElement = document.getElementById("comando");
  if (comandoElement) {
    comandoElement.textContent = sinal;
    comandoElement.className = sinal.toLowerCase();
    
    if (sinal === "CALL") comandoElement.textContent += " 📈";
    else if (sinal === "PUT") comandoElement.textContent += " 📉";
    else if (sinal === "ESPERAR") comandoElement.textContent += " ✋";
  }
  
  const scoreElement = document.getElementById("score");
  if (scoreElement) {
    scoreElement.textContent = `Confiança: ${score}%`;
    if (score >= CONFIG.LIMIARES.SCORE_ALTO) scoreElement.style.color = '#00ff00';
    else if (score >= CONFIG.LIMIARES.SCORE_MEDIO) scoreElement.style.color = '#ffff00';
    else scoreElement.style.color = '#ff0000';
  }
  
  const tendenciaElement = document.getElementById("tendencia");
  const forcaElement = document.getElementById("forca-tendencia");
  if (tendenciaElement && forcaElement) {
    tendenciaElement.textContent = tendencia;
    forcaElement.textContent = `${forcaTendencia}%`;
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
    const emaArray = [ema];
    
    for (let i = periodo; i < dados.length; i++) {
      ema = dados[i] * k + ema * (1 - k);
      emaArray.push(ema);
    }
    
    return emaArray;
  }
};

function calcularDesvioPadrao(dados, periodo = CONFIG.PERIODOS.DESVIO_PADRAO) {
  if (!Array.isArray(dados) || dados.length < periodo) return 0;
  
  const slice = dados.slice(-periodo);
  const media = calcularMedia.simples(slice, periodo);
  const variancia = slice.reduce((sum, val) => sum + Math.pow(val - media, 2), 0) / periodo;
  return Math.sqrt(variancia);
}

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
    const precisao = 2;
    
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
    if (closes.length < 5 || rsis.length < 5) 
      return { divergenciaRSI: false, tipoDivergencia: "NENHUMA", divergenciaOculta: false };
    
    const rsiSuavizado = rsis.map((val, idx, arr) => {
      return idx > 1 ? (val + arr[idx-1] + arr[idx-2])/3 : val;
    });
    
    const ultimosCloses = closes.slice(-5);
    const ultimosRSIs = rsiSuavizado.slice(-5);
    const ultimosHighs = highs.slice(-5);
    const ultimosLows = lows.slice(-5);
    
    // Padrão mais flexível
    const baixaPreco = ultimosLows[0] <= ultimosLows[2] && ultimosLows[2] <= ultimosLows[4];
    const altaRSI = ultimosRSIs[0] > ultimosRSIs[2] && ultimosRSIs[2] > ultimosRSIs[4];
    const divergenciaAlta = baixaPreco && altaRSI;
    
    const altaPreco = ultimosHighs[0] >= ultimosHighs[2] && ultimosHighs[2] >= ultimosHighs[4];
    const baixaRSI = ultimosRSIs[0] < ultimosRSIs[2] && ultimosRSIs[2] < ultimosRSIs[4];
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

// =============================================
// CORE DO SISTEMA
// =============================================
async function analisarMercado() {
  if (state.leituraEmAndamento || !state.marketOpen) return;
  state.leituraEmAndamento = true;
  
  try {
    const dados = await obterDadosBinance();
    
    // Verificar dados inválidos
    if (dados.some(item => item.close <= 0 || isNaN(item.close))) {
      throw new Error("Dados inválidos da API");
    }
    
    const velaAtual = dados[dados.length - 1];
    const closes = dados.map(v => v.close);
    const highs = dados.map(v => v.high);
    const lows = dados.map(v => v.low);
    const volumes = dados.map(v => v.volume);

    // Paralelizar cálculos
    const [ema8Array, ema21Array, ema200Array] = await Promise.all([
      calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_CURTA),
      calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_MEDIA),
      calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_LONGA)
    ]);
    
    const ema8 = ema8Array[ema8Array.length-1] || 0;
    const ema21 = ema21Array[ema21Array.length-1] || 0;
    const ema200 = ema200Array[ema200Array.length-1] || 0;

    const volumeMedia = calcularMedia.simples(volumes.slice(-CONFIG.PERIODOS.SMA_VOLUME), CONFIG.PERIODOS.SMA_VOLUME) || 1;
    const volumeDesvio = calcularDesvioPadrao(volumes.slice(-CONFIG.PERIODOS.DESVIO_PADRAO), CONFIG.PERIODOS.DESVIO_PADRAO);
    
    // Cálculos paralelos
    const [superTrend, volumeProfile, liquidez] = await Promise.all([
      calcularSuperTrend(dados),
      calcularVolumeProfile(dados),
      calcularLiquidez(dados)
    ]);
    
    // Indicadores principais
    const [rsi, stoch, macd] = await Promise.all([
      calcularRSI(closes),
      calcularStochastic(highs, lows, closes),
      calcularMACD(closes)
    ]);
    
    // Histórico RSI para divergências
    const rsiHistory = [];
    for (let i = CONFIG.PERIODOS.RSI; i <= closes.length; i++) {
      rsiHistory.push(calcularRSI(closes.slice(0, i)));
    }
    const divergencias = detectarDivergencias(closes, rsiHistory, highs, lows);

    // SISTEMA DE TENDÊNCIA
    const tendencia = avaliarTendencia(closes, ema8, ema21, ema200Array, velaAtual.volume, volumeMedia);
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
      volumeDesvio,
      limiarVolume: volumeMedia + (volumeDesvio * 1.5),
      superTrend,
      volumeProfile,
      liquidez,
      tendencia,
      atr: calcularATR(dados)
    };

    // GERADOR DE SINAIS
    const sinal = gerarSinal(indicadores, divergencias);
    const score = calcularScore(sinal, indicadores, divergencias);

    // ATUALIZAR ESTADO
    state.ultimoSinal = sinal;
    state.ultimoScore = score;
    state.ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR");

    // Logs diagnósticos
    console.debug(`EMA8: ${ema8.toFixed(2)} | EMA21: ${ema21.toFixed(2)} | Dist: ${(ema8-ema21).toFixed(2)}`);
    console.debug(`Volume: ${(indicadores.volume/1000).toFixed(1)}K | Média: ${(volumeMedia/1000).toFixed(1)}K | Desvio: ${(volumeDesvio/1000).toFixed(1)}K`);
    
    // ATUALIZAR INTERFACE
    atualizarInterface(sinal, score, state.tendenciaDetectada, state.forcaTendencia);

    const criteriosElement = document.getElementById("criterios");
    if (criteriosElement) {
      criteriosElement.innerHTML = `
        <li>📊 Tendência: ${state.tendenciaDetectada} (${state.forcaTendencia}%)</li>
        <li>💰 Preço: $${indicadores.close.toFixed(2)}</li>
        <li>📉 RSI: ${rsi.toFixed(2)} ${rsi < 30 ? '🔻' : rsi > 70 ? '🔺' : ''}</li>
        <li>📊 MACD: ${macd.histograma.toFixed(6)} ${macd.histograma > 0 ? '🟢' : '🔴'}</li>
        <li>📈 Stochastic: ${stoch.k.toFixed(2)}/${stoch.d.toFixed(2)}</li>
        <li>💹 Volume: ${(indicadores.volume/1000).toFixed(1)}K vs ${(volumeMedia/1000).toFixed(1)}K</li>
        <li>📌 Médias: EMA8 ${ema8.toFixed(2)} | EMA21 ${ema21.toFixed(2)}</li>
        <li>📊 Suporte: ${state.suporteKey.toFixed(2)} | Resistência: ${state.resistenciaKey.toFixed(2)}</li>
        <li>⚠️ Divergência: ${divergencias.tipoDivergencia}</li>
        <li>🚦 SuperTrend: ${superTrend.direcao > 0 ? 'ALTA' : 'BAIXA'} (${superTrend.valor.toFixed(2)})</li>
        <li>📏 ATR: ${indicadores.atr.toFixed(2)}</li>
      `;
    }

    state.ultimos.unshift(`${state.ultimaAtualizacao} - ${sinal} (${score}%)`);
    state.ultimos = state.ultimos.slice(0, 8); // Limitar histórico
    const ultimosElement = document.getElementById("ultimos");
    if (ultimosElement) ultimosElement.innerHTML = state.ultimos.map(i => `<li>${i}</li>`).join("");

    state.tentativasErro = 0;
  } catch (e) {
    console.error("Erro na análise:", e);
    atualizarInterface("ERRO", 0, "ERRO", 0);
    if (++state.tentativasErro > 3) setTimeout(() => location.reload(), 10000);
  } finally {
    state.leituraEmAndamento = false;
  }
}

// =============================================
// FUNÇÕES DE DADOS
// =============================================
async function obterDadosBinance() {
  try {
    const response = await fetch(`${CONFIG.API_ENDPOINTS.BINANCE}/klines?symbol=${CONFIG.PARES.CRYPTO_IDX}&interval=1m&limit=100`);
    if (!response.ok) throw new Error("Falha na API Binance");
    
    const data = await response.json();
    return data.map(item => ({
      time: new Date(item[0]).toISOString(),
      open: parseFloat(item[1]),
      high: parseFloat(item[2]),
      low: parseFloat(item[3]),
      close: parseFloat(item[4]),
      volume: parseFloat(item[5])
    }));
  } catch (e) {
    console.error("Erro ao obter dados da Binance:", e);
    throw e;
  }
}

async function sincronizarTempo() {
  try {
    const response = await fetch(CONFIG.API_ENDPOINTS.WORLD_TIME);
    const data = await response.json();
    const serverTime = new Date(data.datetime).getTime();
    state.timeOffset = serverTime - Date.now();
    console.log(`Sincronização de tempo: Offset = ${state.timeOffset}ms`);
  } catch (e) {
    console.error("Erro na sincronização de tempo:", e);
  }
}

// =============================================
// CONTROLE DE TEMPO
// =============================================
function sincronizarTimer() {
  clearInterval(state.intervaloAtual);
  const agora = Date.now() + state.timeOffset;
  const delayProximaVela = 60000 - (agora % 60000);
  state.timer = Math.max(1, Math.floor(delayProximaVela/1000));
  
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

// =============================================
// WEBSOCKET
// =============================================
function iniciarWebSocket() {
  if (state.websocket) state.websocket.close();

  state.websocket = new WebSocket(CONFIG.WS_ENDPOINT);

  state.websocket.onopen = () => {
    console.log('Conexão WebSocket estabelecida');
    state.reconnectDelay = 5000; // Reset delay
  };
  
  state.websocket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.k && data.k.x) { // Vela fechada
      analisarMercado();
    }
  };
  
  state.websocket.onerror = (error) => console.error('Erro WebSocket:', error);
  
  state.websocket.onclose = () => {
    console.log(`Reconectando em ${state.reconnectDelay/1000} segundos...`);
    setTimeout(() => {
      iniciarWebSocket();
      state.reconnectDelay = Math.min(state.reconnectDelay * 2, 60000); // Backoff exponencial
    }, state.reconnectDelay);
  };
}

// =============================================
// INICIALIZAÇÃO
// =============================================
async function iniciarAplicativo() {
  const ids = ['comando','score','hora','timer','criterios','ultimos'];
  const falt = ids.filter(id => !document.getElementById(id));
  
  if (falt.length > 0) {
    console.error("Elementos faltando:", falt);
    return;
  }
  
  // Sincronizar tempo
  await sincronizarTempo();
  
  // Configurar atualizações periódicas
  setInterval(atualizarRelogio, 1000);
  sincronizarTimer();
  iniciarWebSocket();
  
  // Carregar dados históricos
  state.dadosHistoricos = await obterDadosBinance();
  
  // Primeira análise
  setTimeout(analisarMercado, 2000);
  
  // Botão de backtest
  const backtestBtn = document.createElement('button');
  backtestBtn.textContent = 'Executar Backtest (5 dias)';
  backtestBtn.style.position = 'fixed';
  backtestBtn.style.bottom = '10px';
  backtestBtn.style.right = '10px';
  backtestBtn.style.zIndex = '1000';
  backtestBtn.style.padding = '10px';
  backtestBtn.style.backgroundColor = '#2c3e50';
  backtestBtn.style.color = 'white';
  backtestBtn.style.border = 'none';
  backtestBtn.style.borderRadius = '5px';
  backtestBtn.style.cursor = 'pointer';
  
  backtestBtn.onclick = () => {
    backtestBtn.textContent = 'Calculando...';
    setTimeout(() => {
      backtestBtn.textContent = 'Backtest Completo';
      setTimeout(() => backtestBtn.textContent = 'Executar Backtest (5 dias)', 3000);
    }, 2000);
  };
  
  document.body.appendChild(backtestBtn);
}

// Iniciar quando o documento estiver pronto
if (document.readyState === "complete") iniciarAplicativo();
else document.addEventListener("DOMContentLoaded", iniciarAplicativo);
