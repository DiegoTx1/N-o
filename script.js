// =============================================
// CONFIGURAÇÕES GLOBAIS (OTIMIZADAS PARA CRYPTO IDX)
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
  rsiCache: { avgGain: 0, avgLoss: 0, initialized: false },
  emaCache: {
    ema5: null,
    ema13: null,
    ema50: null
  },
  macdCache: {
    emaRapida: null,
    emaLenta: null,
    macdLine: [],
    signalLine: []
  },
  superTrendCache: [],
  rsiHistory: [],
  cooldown: 0,
  volumeRelativo: 0,
  obv: 0,
  vwap: 0,
  bandasBollinger: {
    superior: 0,
    inferior: 0,
    medio: 0
  }
};

const CONFIG = {
  API_ENDPOINTS: {
    TWELVE_DATA: "https://api.twelvedata.com"
  },
  PARES: {
    CRYPTO_IDX: "BTC/USD"
  },
  PERIODOS: {
    RSI: 9,
    STOCH_K: 14,
    STOCH_D: 3,
    EMA_CURTA: 5,
    EMA_MEDIA: 13,
    EMA_50: 50,
    MACD_RAPIDA: 6,
    MACD_LENTA: 13,
    MACD_SINAL: 9,
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
    SCORE_ALTO: 85,
    SCORE_MEDIO: 70,
    RSI_OVERBOUGHT: 78,
    RSI_OVERSOLD: 22,
    STOCH_OVERBOUGHT: 85,
    STOCH_OVERSOLD: 15,
    VARIACAO_LATERAL: 0.008,
    ATR_LIMIAR: 0.025,
    LATERALIDADE_LIMIAR: 0.008,
    VOLUME_ALERTA: 1.5
  },
  PESOS: {
    RSI: 1.7,
    MACD: 2.2,
    TENDENCIA: 2.8,
    STOCH: 1.2,
    SUPERTREND: 1.9,
    DIVERGENCIA: 2.0,
    VOLUME: 1.5,
    VWAP: 1.3,
    BOLLINGER: 1.4
  }
};

// =============================================
// GERENCIADOR DE CHAVES API
// =============================================
const API_KEYS = [
  "0105e6681b894e0185704171c53f5075",
  "backup_key_here" // Adicione uma chave de backup
];
let currentKeyIndex = 0;
let errorCount = 0;

// =============================================
// SISTEMA DE TENDÊNCIA OTIMIZADO
// =============================================
function avaliarTendencia(ema5, ema13, ema50) {
  const diffCurta = ema5 - ema13;
  const diffLonga = ema13 - ema50;
  
  // Cálculo simplificado da força
  const forca = Math.min(100, Math.abs(diffCurta) * 5000 + Math.abs(diffLonga) * 3000);
  
  if (forca > 80) {
    if (diffCurta > 0 && diffLonga > 0) return { tendencia: "FORTE_ALTA", forca };
    if (diffCurta < 0 && diffLonga < 0) return { tendencia: "FORTE_BAIXA", forca };
  }
  
  if (forca > 45) {
    return diffCurta > 0 
      ? { tendencia: "ALTA", forca } 
      : { tendencia: "BAIXA", forca };
  }
  
  return { tendencia: "NEUTRA", forca: 0 };
}

// =============================================
// DETECÇÃO DE LATERALIDADE OTIMIZADA
// =============================================
function detectarLateralidade(closes, periodo = CONFIG.PERIODOS.ANALISE_LATERAL, limiar = CONFIG.LIMIARES.LATERALIDADE_LIMIAR) {
  if (closes.length < periodo) return false;
  
  let countLaterais = 0;
  const startIndex = closes.length - periodo;
  
  for (let i = startIndex; i < closes.length - 1; i++) {
    const variacao = Math.abs(closes[i] - closes[i-1]) / closes[i-1];
    if (variacao < limiar) countLaterais++;
  }
  
  state.contadorLaterais = countLaterais;
  return countLaterais > periodo * 0.7;
}

// =============================================
// NOVOS INDICADORES PARA CRIPTO (OTIMIZADOS)
// =============================================

// Volume Relativo
function calcularVolumeRelativo(volumes, periodo = CONFIG.PERIODOS.VOLUME_LOOKBACK) {
  if (volumes.length < periodo) return 0;
  
  const slice = volumes.slice(-periodo);
  const mediaVolume = slice.reduce((sum, vol) => sum + vol, 0) / periodo;
  return volumes[volumes.length - 1] / mediaVolume;
}

// On-Balance Volume (OBV)
function calcularOBV(closes, volumes) {
  if (closes.length < 2) return 0;
  
  let obv = 0;
  for (let i = 1; i < closes.length; i++) {
    obv += closes[i] > closes[i-1] ? volumes[i] : closes[i] < closes[i-1] ? -volumes[i] : 0;
  }
  return obv;
}

// Volume Weighted Average Price (VWAP)
function calcularVWAP(dados, periodo = CONFIG.PERIODOS.VWAP) {
  if (dados.length < periodo) return 0;
  
  let tpTotal = 0;
  let volumeTotal = 0;
  const slice = dados.slice(-periodo);
  
  slice.forEach(v => {
    const tp = (v.high + v.low + v.close) / 3;
    tpTotal += tp * v.volume;
    volumeTotal += v.volume;
  });
  
  return tpTotal / volumeTotal;
}

// Bandas de Bollinger
function calcularBandasBollinger(closes, periodo = CONFIG.PERIODOS.BOLLINGER, desvios = 2) {
  if (closes.length < periodo) return { superior: 0, inferior: 0, medio: 0 };
  
  const slice = closes.slice(-periodo);
  const media = slice.reduce((sum, val) => sum + val, 0) / periodo;
  
  const somaQuadrados = slice.reduce((sum, val) => sum + Math.pow(val - media, 2), 0);
  const desvioPadrao = Math.sqrt(somaQuadrados / periodo);
  
  return {
    superior: media + (desvioPadrao * desvios),
    inferior: media - (desvioPadrao * desvios),
    medio: media
  };
}

// =============================================
// GERADOR DE SINAIS OTIMIZADO
// =============================================
function gerarSinal(indicadores, divergencias) {
  const { rsi, stoch, macd, close, tendencia, volumeRelativo, vwap, bandasBollinger } = indicadores;

  // 1. Tendência forte com volume
  if (tendencia.forca > 80 && volumeRelativo > CONFIG.LIMIARES.VOLUME_ALERTA) {
    if (tendencia.tendencia === "FORTE_ALTA" && close > vwap && close > bandasBollinger.medio) return "CALL";
    if (tendencia.tendencia === "FORTE_BAIXA" && close < vwap && close < bandasBollinger.medio) return "PUT";
  }

  // 2. Breakout com volume e Bollinger
  const limiteBreakout = (bandasBollinger.superior - bandasBollinger.inferior) * 0.1;
  if (close > (bandasBollinger.superior + limiteBreakout) && volumeRelativo > 1.8) return "CALL";
  if (close < (bandasBollinger.inferior - limiteBreakout) && volumeRelativo > 1.8) return "PUT";

  // 3. Divergências com OBV
  if (divergencias.divergenciaRSI) {
    if (divergencias.tipoDivergencia === "ALTA" && state.obv > 0) return "CALL";
    if (divergencias.tipoDivergencia === "BAIXA" && state.obv < 0) return "PUT";
  }

  // 4. Reversão com múltiplos indicadores
  if (rsi < CONFIG.LIMIARES.RSI_OVERSOLD && stoch.k < CONFIG.LIMIARES.STOCH_OVERSOLD && close > vwap && macd.histograma > 0) return "CALL";
  if (rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT && stoch.k > CONFIG.LIMIARES.STOCH_OVERBOUGHT && close < vwap && macd.histograma < 0) return "PUT";
  
  return "ESPERAR";
}

// =============================================
// CALCULADOR DE CONFIANÇA OTIMIZADO
// =============================================
function calcularScore(sinal, indicadores, divergencias) {
  let score = 65;

  // Fatores positivos
  if (sinal === "CALL" && indicadores.tendencia.tendencia.includes("ALTA")) score += 25;
  if (sinal === "PUT" && indicadores.tendencia.tendencia.includes("BAIXA")) score += 25;
  
  if (divergencias.divergenciaRSI) score += 20;
  if (indicadores.volumeRelativo > CONFIG.LIMIARES.VOLUME_ALERTA) score += 15;
  
  if ((sinal === "CALL" && indicadores.close > indicadores.vwap) || 
      (sinal === "PUT" && indicadores.close < indicadores.vwap)) score += 10;
  
  if ((sinal === "CALL" && indicadores.close > indicadores.bandasBollinger.medio) || 
      (sinal === "PUT" && indicadores.close < indicadores.bandasBollinger.medio)) score += 8;
  
  if ((sinal === "CALL" && state.obv > 0) || 
      (sinal === "PUT" && state.obv < 0)) score += 7;

  // Penalizar lateralidade
  if (state.contadorLaterais > 5) score = Math.max(0, score - 15);
  
  return Math.min(100, Math.max(0, score));
}

// =============================================
// FUNÇÕES UTILITÁRIAS
// =============================================
function formatarTimer(segundos) {
  return `0:${segundos.toString().padStart(2, '0')}`;
}

function atualizarRelogio() {
  const now = new Date();
  state.ultimaAtualizacao = now.toLocaleTimeString("pt-BR", { timeStyle: "medium" });
  
  const elementoHora = document.getElementById("hora");
  if (elementoHora) elementoHora.textContent = state.ultimaAtualizacao;
}

function atualizarInterface(sinal, score, tendencia, forcaTendencia) {
  const comandoElement = document.getElementById("comando");
  if (comandoElement) {
    comandoElement.textContent = sinal;
    comandoElement.className = sinal.toLowerCase();
    
    if (sinal === "CALL") comandoElement.innerHTML = "CALL 📈";
    else if (sinal === "PUT") comandoElement.innerHTML = "PUT 📉";
    else comandoElement.innerHTML = "ESPERAR ✋";
  }
  
  const scoreElement = document.getElementById("score");
  if (scoreElement) {
    scoreElement.textContent = `Confiança: ${score}%`;
    scoreElement.style.color = score >= CONFIG.LIMIARES.SCORE_ALTO ? '#00ff00' :
                              score >= CONFIG.LIMIARES.SCORE_MEDIO ? '#ffff00' : '#ff0000';
  }
  
  const tendenciaElement = document.getElementById("tendencia");
  const forcaElement = document.getElementById("forca-tendencia");
  if (tendenciaElement && forcaElement) {
    tendenciaElement.textContent = tendencia;
    forcaElement.textContent = `${forcaTendencia}%`;
  }
}

// =============================================
// INDICADORES TÉCNICOS (OTIMIZADOS)
// =============================================
const calcularMedia = {
  simples: (dados, periodo) => {
    const slice = dados.slice(-periodo);
    return slice.reduce((a, b) => a + b, 0) / periodo;
  },

  exponencial: (dados, periodo) => {
    if (dados.length < periodo) return [];
    
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
  if (closes.length < periodo + 1) return 50;
  
  if (!state.rsiCache.initialized) {
    let gains = 0, losses = 0;
    for (let i = 1; i <= periodo; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff > 0) gains += diff;
      else if (diff < 0) losses -= diff;
    }
    
    state.rsiCache.avgGain = gains / periodo;
    state.rsiCache.avgLoss = losses / periodo;
    state.rsiCache.initialized = true;
  } else {
    const diff = closes[closes.length - 1] - closes[closes.length - 2];
    
    state.rsiCache.avgGain = ((state.rsiCache.avgGain * (periodo - 1)) + (diff > 0 ? diff : 0)) / periodo;
    state.rsiCache.avgLoss = ((state.rsiCache.avgLoss * (periodo - 1)) + (diff < 0 ? -diff : 0)) / periodo;
  }
  
  const rs = state.rsiCache.avgLoss === 0 ? 100 : state.rsiCache.avgGain / state.rsiCache.avgLoss;
  return 100 - (100 / (1 + rs));
}

function calcularStochastic(highs, lows, closes, periodoK = 14, periodoD = 3) {
  if (closes.length < periodoK) return { k: 50, d: 50 };
  
  const kValues = [];
  for (let i = periodoK - 1; i < closes.length; i++) {
    const sliceHigh = highs.slice(i - periodoK + 1, i + 1);
    const sliceLow = lows.slice(i - periodoK + 1, i + 1);
    
    const highestHigh = Math.max(...sliceHigh);
    const lowestLow = Math.min(...sliceLow);
    const range = highestHigh - lowestLow;
    const k = range !== 0 ? ((closes[i] - lowestLow) / range) * 100 : 50;
    kValues.push(k);
  }
  
  // Suavização K
  const kSuavizado = [];
  for (let i = periodoD - 1; i < kValues.length; i++) {
    const mediaK = calcularMedia.simples(kValues.slice(i - periodoD + 1, i + 1), periodoD) || 50;
    kSuavizado.push(mediaK);
  }
  
  // Cálculo D
  const dValues = [];
  for (let i = periodoD - 1; i < kSuavizado.length; i++) {
    dValues.push(calcularMedia.simples(kSuavizado.slice(i - periodoD + 1, i + 1), periodoD) || 50);
  }
  
  return {
    k: kSuavizado[kSuavizado.length - 1] || 50,
    d: dValues[dValues.length - 1] || 50
  };
}

// =============================================
// CORE DO SISTEMA (OTIMIZADO)
// =============================================
async function analisarMercado() {
  if (state.leituraEmAndamento) return;
  state.leituraEmAndamento = true;
  
  try {
    const dados = await obterDadosTwelveData();
    state.dadosHistoricos = dados;
    
    if (dados.length < 50) {
      throw new Error(`Dados insuficientes (${dados.length} velas)`);
    }
    
    const velaAtual = dados[dados.length - 1];
    const closes = dados.map(v => v.close);
    const highs = dados.map(v => v.high);
    const lows = dados.map(v => v.low);
    const volumes = dados.map(v => v.volume);

    // Calcular EMAs
    const calcularEMA = (dados, periodo) => {
      const emaArray = calcularMedia.exponencial(dados, periodo);
      return emaArray[emaArray.length - 1];
    };

    const ema5 = calcularEMA(closes, CONFIG.PERIODOS.EMA_CURTA);
    const ema13 = calcularEMA(closes, CONFIG.PERIODOS.EMA_MEDIA);
    const ema50 = calcularEMA(closes, CONFIG.PERIODOS.EMA_50);

    // Calcular novos indicadores
    state.volumeRelativo = calcularVolumeRelativo(volumes);
    state.obv = calcularOBV(closes, volumes);
    state.vwap = calcularVWAP(dados);
    state.bandasBollinger = calcularBandasBollinger(closes);

    // Calcular demais indicadores
    const rsi = calcularRSI(closes);
    const stoch = calcularStochastic(highs, lows, closes);
    const macd = calcularMACD(closes);
    const superTrend = calcularSuperTrend(dados);
    const atr = calcularATR(dados);
    
    // Preencher histórico de RSI
    if (state.rsiHistory.length === 0) {
      for (let i = CONFIG.PERIODOS.RSI; i < closes.length; i++) {
        state.rsiHistory.push(calcularRSI(closes.slice(0, i+1)));
      }
    } else {
      state.rsiHistory.push(calcularRSI(closes));
      if (state.rsiHistory.length > 100) state.rsiHistory.shift();
    }
    
    const divergencias = detectarDivergencias(closes, state.rsiHistory, highs, lows);
    const lateral = detectarLateralidade(closes);
    const tendencia = avaliarTendencia(ema5, ema13, ema50);

    state.tendenciaDetectada = tendencia.tendencia;
    state.forcaTendencia = tendencia.forca;

    const indicadores = {
      rsi,
      stoch,
      macd,
      close: velaAtual.close,
      tendencia,
      volumeRelativo: state.volumeRelativo,
      vwap: state.vwap,
      bandasBollinger: state.bandasBollinger
    };

    let sinal = gerarSinal(indicadores, divergencias);
    
    // Aplicar cooldown
    if (sinal !== "ESPERAR" && state.cooldown <= 0) {
      state.cooldown = 3;
    } else if (state.cooldown > 0) {
      state.cooldown--;
      sinal = "ESPERAR";
    }

    const score = calcularScore(sinal, indicadores, divergencias);

    state.ultimoSinal = sinal;
    state.ultimoScore = score;
    state.ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR");

    atualizarInterface(sinal, score, state.tendenciaDetectada, state.forcaTendencia);

    const criteriosElement = document.getElementById("criterios");
    if (criteriosElement) {
      criteriosElement.innerHTML = `
        <li>📊 Tendência: ${state.tendenciaDetectada} (${state.forcaTendencia}%)</li>
        <li>💰 Preço: ${indicadores.close.toFixed(2)}</li>
        <li>📉 RSI: ${rsi.toFixed(2)} ${rsi < CONFIG.LIMIARES.RSI_OVERSOLD ? '🔻' : rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT ? '🔺' : ''}</li>
        <li>📊 MACD: ${macd.histograma > 0 ? '+' : ''}${macd.histograma.toFixed(4)} ${macd.histograma > 0 ? '🟢' : '🔴'}</li>
        <li>📈 Stochastic: ${stoch.k.toFixed(2)}/${stoch.d.toFixed(2)}</li>
        <li>📌 Médias: EMA5 ${ema5.toFixed(2)} | EMA13 ${ema13.toFixed(2)} | EMA50 ${ema50.toFixed(2)}</li>
        <li>⚠️ Divergência: ${divergencias.tipoDivergencia}</li>
        <li>🚦 SuperTrend: ${superTrend.direcao > 0 ? 'ALTA' : 'BAIXA'} (${superTrend.valor.toFixed(2)})</li>
        <li>💹 Volume: ${(state.volumeRelativo * 100).toFixed(0)}% ${state.volumeRelativo > CONFIG.LIMIARES.VOLUME_ALERTA ? '🚀' : ''}</li>
        <li>📊 VWAP: ${state.vwap.toFixed(2)}</li>
        <li>📊 Bollinger: ${state.bandasBollinger.superior.toFixed(2)} | ${state.bandasBollinger.inferior.toFixed(2)}</li>
      `;
    }

    // Atualizar histórico de sinais
    state.ultimos.unshift(`${state.ultimaAtualizacao} - ${sinal} (${score}%)`);
    if (state.ultimos.length > 8) state.ultimos.pop();
    
    const ultimosElement = document.getElementById("ultimos");
    if (ultimosElement) ultimosElement.innerHTML = state.ultimos.map(i => `<li>${i}</li>`).join("");

    state.tentativasErro = 0;
  } catch (e) {
    console.error("Erro na análise:", e);
    atualizarInterface("ERRO", 0, "ERRO", 0);
    
    if (++state.tentativasErro > 3) {
      setTimeout(() => location.reload(), 10000);
      document.getElementById("criterios").innerHTML = `<li>RECARREGANDO SISTEMA...</li>`;
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
  state.timer = 60 - agora.getSeconds();
  
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
      analisarMercado();
      sincronizarTimer();
    }
  }, 1000);
}

// =============================================
// INICIALIZAÇÃO OTIMIZADA
// =============================================
function iniciarAplicativo() {
  // Configuração inicial da interface
  document.body.innerHTML = `
    <div id="trading-bot" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 800px; margin: 20px auto; padding: 25px; background: #1e1f29; border-radius: 15px; color: #f5f6fa; box-shadow: 0 8px 32px rgba(0,0,0,0.3);">
      <h1 style="text-align: center; color: #6c5ce7; margin-bottom: 30px; font-size: 28px;">
        <i class="fab fa-bitcoin"></i> Robô de Trading CRYPTO IDX
      </h1>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 25px; margin-bottom: 30px;">
        <div id="comando" style="font-size: 32px; font-weight: 700; padding: 25px; border-radius: 12px; text-align: center; background: #2c2d3a; display: flex; align-items: center; justify-content: center; min-height: 120px;">
          --
        </div>
        
        <div style="display: flex; flex-direction: column; justify-content: center; background: #2c2d3a; padding: 20px; border-radius: 12px;">
          <div id="score" style="font-size: 22px; font-weight: 600; margin-bottom: 15px; text-align: center;">--</div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
            <div style="text-align: center;">
              <div style="font-size: 14px; opacity: 0.8;">Atualização</div>
              <div id="hora" style="font-size: 18px; font-weight: 600;">--:--:--</div>
            </div>
            
            <div style="text-align: center;">
              <div style="font-size: 14px; opacity: 0.8;">Próxima Análise</div>
              <div id="timer" style="font-size: 18px; font-weight: 600;">0:60</div>
            </div>
          </div>
        </div>
      </div>
      
      <div style="background: #2c2d3a; padding: 20px; border-radius: 12px; margin-bottom: 25px;">
        <h3 style="margin-top: 0; margin-bottom: 15px; color: #6c5ce7; display: flex; align-items: center;">
          <i class="fas fa-chart-line"></i> Tendência: 
          <span id="tendencia" style="margin-left: 8px;">--</span> 
          <span id="forca-tendencia" style="margin-left: 5px;">--</span>%
        </h3>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
          <div style="background: #3a3b4a; padding: 15px; border-radius: 8px;">
            <h4 style="margin-top: 0; margin-bottom: 10px; color: #a29bfe;">Últimos Sinais</h4>
            <ul id="ultimos" style="list-style: none; padding: 0; margin: 0;"></ul>
          </div>
          
          <div style="background: #3a3b4a; padding: 15px; border-radius: 8px;">
            <h4 style="margin-top: 0; margin-bottom: 10px; color: #a29bfe;">Indicadores</h4>
            <ul id="criterios" style="list-style: none; padding: 0; margin: 0;"></ul>
          </div>
        </div>
      </div>
      
      <div style="text-align: center; font-size: 14px; opacity: 0.7; padding-top: 15px; border-top: 1px solid #3a3b4a;">
        CRYPTO IDX - Análise em tempo real
      </div>
    </div>
  `;
  
  document.body.style.backgroundColor = "#13141a";
  document.body.style.margin = "0";
  document.body.style.padding = "20px";
  
  // Adicionar Font Awesome
  const fontAwesome = document.createElement('link');
  fontAwesome.rel = 'stylesheet';
  fontAwesome.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css';
  document.head.appendChild(fontAwesome);

  // Adicionar estilos dinâmicos
  const style = document.createElement('style');
  style.textContent = `
    .call { 
      background: linear-gradient(135deg, #00b894, #00cec9) !important; 
      color: white !important;
      box-shadow: 0 4px 20px rgba(0, 184, 148, 0.3);
    }
    .put { 
      background: linear-gradient(135deg, #ff7675, #d63031) !important; 
      color: white !important;
      box-shadow: 0 4px 20px rgba(255, 118, 117, 0.3);
    }
    .esperar, .erro { 
      background: linear-gradient(135deg, #0984e3, #6c5ce7) !important; 
      color: white !important;
      box-shadow: 0 4px 20px rgba(108, 92, 231, 0.3);
    }
    #comando {
      transition: all 0.5s cubic-bezier(0.68, -0.55, 0.27, 1.55);
    }
  `;
  document.head.appendChild(style);

  // Iniciar processos
  setInterval(atualizarRelogio, 1000);
  sincronizarTimer();
  analisarMercado();
}

// Iniciar quando o documento estiver pronto
document.addEventListener("DOMContentLoaded", iniciarAplicativo);
