// =============================================
// CONFIGURAÇÕES GLOBAIS (ATUALIZADAS PARA TWELVE DATA - EURUSD)
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
  suporteKey: 0
};

const CONFIG = {
  API_ENDPOINTS: {
    TWELVE_DATA: "https://api.twelvedata.com",
    MARKET_DATA: "https://api.twelvedata.com/market_data"
  },
  API_KEY: "9cf795b2a4f14d43a049ca935d174ebb",
  WS_ENDPOINT: "wss://ws.twelvedata.com/v1/quotes/ws?symbol=EUR/USD&apikey=9cf795b2a4f14d43a049ca935d174ebb",
  PARES: {
    FOREX_IDX: "EUR/USD"
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
    LIQUIDITY_ZONES: 20
  },
  LIMIARES: {
    SCORE_ALTO: 75,  // Ajustado para Forex
    SCORE_MEDIO: 60,
    RSI_OVERBOUGHT: 65,  // Mais conservador para Forex
    RSI_OVERSOLD: 35,
    STOCH_OVERBOUGHT: 80,
    STOCH_OVERSOLD: 20,
    WILLIAMS_OVERBOUGHT: -20,
    WILLIAMS_OVERSOLD: -80,
    VOLUME_ALTO: 1.5,  // Volume menos crítico em Forex
    VARIACAO_LATERAL: 0.5,  // Menor variação para pares de moedas
    VWAP_DESVIO: 0.005,  // Desvio menor para Forex
    ATR_LIMIAR: 0.01   // Limiar menor para pares de moedas
  },
  PESOS: {
    RSI: 1.3,  // Peso reduzido para Forex
    MACD: 2.0,
    TENDENCIA: 2.2,  // Tendência ligeiramente menos importante
    VOLUME: 1.2,  // Volume menos importante em Forex
    STOCH: 1.0,
    WILLIAMS: 0.9,
    VWAP: 1.5,  // VWAP mais importante em Forex
    SUPERTREND: 1.7,
    VOLUME_PROFILE: 1.2,  // Perfil de volume menos crítico
    DIVERGENCIA: 1.8,
    LIQUIDITY: 1.9
  }
};

// =============================================
// FUNÇÕES DE DADOS ATUALIZADAS PARA TWELVE DATA
// =============================================
async function obterDadosTwelveData() {
  try {
    const response = await fetch(
      `${CONFIG.API_ENDPOINTS.TWELVE_DATA}/time_series?symbol=${CONFIG.PARES.FOREX_IDX}&interval=1min&outputsize=100&apikey=${CONFIG.API_KEY}`
    );
    
    if (!response.ok) throw new Error("Falha na API Twelve Data");
    
    const data = await response.json();
    
    if (!data.values || !Array.isArray(data.values)) {
      throw new Error("Formato de dados inválido da API");
    }
    
    return data.values.map(item => ({
      time: item.datetime,
      open: parseFloat(item.open),
      high: parseFloat(item.high),
      low: parseFloat(item.low),
      close: parseFloat(item.close),
      volume: parseFloat(item.volume || 0) // Volume pode não estar disponível para Forex
    })).reverse(); // Invertendo para ter os dados mais antigos primeiro
  } catch (e) {
    console.error("Erro ao obter dados da Twelve Data:", e);
    throw e;
  }
}

// =============================================
// SISTEMA DE TENDÊNCIA AJUSTADO PARA FOREX
// =============================================
function avaliarTendencia(closes, ema8, ema21, ema200, volume, volumeMedio) {
  const ultimoClose = closes[closes.length - 1];
  
  // Tendência de longo prazo
  const tendenciaLongoPrazo = ultimoClose > ema200 ? "ALTA" : "BAIXA";
  
  // Tendência de médio prazo
  const tendenciaMedioPrazo = ema8 > ema21 ? "ALTA" : "BAIXA";
  
  // Força da tendência (ajustada para Forex)
  const distanciaMedia = Math.abs(ema8 - ema21);
  const forcaBase = Math.min(100, Math.round(distanciaMedia / ultimoClose * 10000)); // Multiplicador maior para Forex
  
  // Em Forex, o volume é menos significativo
  const forcaVolume = volume > volumeMedio * 1.2 ? 10 : 0;
  
  let forcaTotal = forcaBase + forcaVolume;
  if (tendenciaLongoPrazo === tendenciaMedioPrazo) forcaTotal += 20; // Bonus menor
  
  // Determinar tendência final (limiares ajustados)
  if (forcaTotal > 70) { // Limiar mais baixo para Forex
    return { 
      tendencia: tendenciaMedioPrazo === "ALTA" ? "FORTE_ALTA" : "FORTE_BAIXA",
      forca: Math.min(100, forcaTotal)
    };
  }
  
  if (forcaTotal > 45) { // Limiar mais baixo
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
// GERADOR DE SINAIS AJUSTADO PARA FOREX
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
    superTrend,
    volumeProfile,
    liquidez
  } = indicadores;
  
  // Definir níveis-chave de suporte e resistência
  state.suporteKey = Math.min(volumeProfile.vaLow, liquidez.suporte, emaMedia);
  state.resistenciaKey = Math.max(volumeProfile.vaHigh, liquidez.resistencia, emaMedia);
  
  // 1. Sinal de tendência forte (limiares ajustados)
  if (indicadores.tendencia.tendencia === "FORTE_ALTA") {
    const condicoesCompra = [
      close > emaCurta,
      macd.histograma > 0,
      stoch.k > 50,
      volume > volumeMedia * 1.1 // Limiar de volume mais baixo
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
      volume > volumeMedia * 1.1
    ];
    
    if (condicoesVenda.filter(Boolean).length >= 3) {
      return "PUT";
    }
  }
  
  // 3. Sinal de rompimento (limiares ajustados)
  if (close > state.resistenciaKey && volume > volumeMedia * 1.5) {
    return "CALL";
  }
  
  if (close < state.suporteKey && volume > volumeMedia * 1.5) {
    return "PUT";
  }
  
  // 4. Sinal de reversão por divergência (mais importante em Forex)
  if (divergencias.divergenciaRSI) {
    if (divergencias.tipoDivergencia === "ALTA" && close > state.suporteKey) {
      return "CALL";
    }
    
    if (divergencias.tipoDivergencia === "BAIXA" && close < state.resistenciaKey) {
      return "PUT";
    }
  }
  
  // 5. Sinal de reversão por RSI extremo (limiares ajustados)
  if (rsi < 35 && close > emaMedia) {
    return "CALL";
  }
  
  if (rsi > 65 && close < emaMedia) {
    return "PUT";
  }
  
  return "ESPERAR";
}

// =============================================
// CORE DO SISTEMA ATUALIZADO
// =============================================
async function analisarMercado() {
  if (state.leituraEmAndamento || !state.marketOpen) return;
  state.leituraEmAndamento = true;
  
  try {
    const dados = await obterDadosTwelveData();
    const velaAtual = dados[dados.length - 1];
    const closes = dados.map(v => v.close);
    const highs = dados.map(v => v.high);
    const lows = dados.map(v => v.low);
    const volumes = dados.map(v => v.volume);

    const ema8Array = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_CURTA);
    const ema21Array = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_MEDIA);
    const ema200Array = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_LONGA);
    const ema8 = ema8Array[ema8Array.length-1] || 0;
    const ema21 = ema21Array[ema21Array.length-1] || 0;
    const ema200 = ema200Array[ema200Array.length-1] || 0;

    const volumeMedia = calcularMedia.simples(volumes.slice(-CONFIG.PERIODOS.SMA_VOLUME), CONFIG.PERIODOS.SMA_VOLUME) || 1;
    const superTrend = calcularSuperTrend(dados);
    const volumeProfile = calcularVolumeProfile(dados);
    const liquidez = calcularLiquidez(dados);
    
    const rsi = calcularRSI(closes);
    const stoch = calcularStochastic(highs, lows, closes);
    const macd = calcularMACD(closes);
    
    const rsiHistory = [];
    for (let i = CONFIG.PERIODOS.RSI; i <= closes.length; i++) {
      rsiHistory.push(calcularRSI(closes.slice(0, i)));
    }
    const divergencias = detectarDivergencias(closes, rsiHistory, highs, lows);

    // SISTEMA DE TENDÊNCIA
    const tendencia = avaliarTendencia(closes, ema8, ema21, ema200, velaAtual.volume, volumeMedia);
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
      tendencia
    };

    // GERADOR DE SINAIS
    const sinal = gerarSinal(indicadores, divergencias);
    const score = calcularScore(sinal, indicadores, divergencias);

    // ATUALIZAR ESTADO
    state.ultimoSinal = sinal;
    state.ultimoScore = score;
    state.ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR");

    // ATUALIZAR INTERFACE
    atualizarInterface(sinal, score, state.tendenciaDetectada, state.forcaTendencia);

    const criteriosElement = document.getElementById("criterios");
    if (criteriosElement) {
      criteriosElement.innerHTML = `
        <li>📊 Tendência: ${state.tendenciaDetectada} (${state.forcaTendencia}%)</li>
        <li>💰 Preço: ${indicadores.close.toFixed(5)}</li>
        <li>📉 RSI: ${rsi.toFixed(2)} ${rsi < CONFIG.LIMIARES.RSI_OVERSOLD ? '🔻' : rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT ? '🔺' : ''}</li>
        <li>📊 MACD: ${macd.histograma.toFixed(6)} ${macd.histograma > 0 ? '🟢' : '🔴'}</li>
        <li>📈 Stochastic: ${stoch.k.toFixed(2)}/${stoch.d.toFixed(2)}</li>
        <li>💹 Volume: ${(indicadores.volume/1).toFixed(1)} vs ${(volumeMedia/1).toFixed(1)}</li>
        <li>📌 Médias: EMA8 ${ema8.toFixed(5)} | EMA21 ${ema21.toFixed(5)}</li>
        <li>📊 Suporte: ${state.suporteKey.toFixed(5)} | Resistência: ${state.resistenciaKey.toFixed(5)}</li>
        <li>⚠️ Divergência: ${divergencias.tipoDivergencia}</li>
        <li>🚦 SuperTrend: ${superTrend.direcao > 0 ? 'ALTA' : 'BAIXA'} (${superTrend.valor.toFixed(5)})</li>
      `;
    }

    state.ultimos.unshift(`${state.ultimaAtualizacao} - ${sinal} (${score}%)`);
    if (state.ultimos.length > 8) state.ultimos.pop();
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
// WEBSOCKET ATUALIZADO PARA TWELVE DATA
// =============================================
function iniciarWebSocket() {
  if (state.websocket) state.websocket.close();

  state.websocket = new WebSocket(CONFIG.WS_ENDPOINT);

  state.websocket.onopen = () => {
    console.log('Conexão WebSocket estabelecida com Twelve Data');
    // Subscrever ao par EUR/USD
    state.websocket.send(JSON.stringify({
      action: "subscribe",
      params: {
        symbols: "EUR/USD"
      }
    }));
  };
  
  state.websocket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.event === "price") {
      // Atualizar dados em tempo real
      analisarMercado();
    }
  };
  
  state.websocket.onerror = (error) => console.error('Erro WebSocket:', error);
  
  state.websocket.onclose = () => setTimeout(iniciarWebSocket, 5000);
}

// Restante do código permanece igual (funções de indicadores, utilitários, etc.)
// ...
