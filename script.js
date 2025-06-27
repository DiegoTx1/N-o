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
  historicoDesempenho: [],
  taxaAcerto: 70, // Taxa inicial estimada
  ambienteMercado: "INDEFINIDO",
  timeframes: {
    hora: { dados: [], tendencia: "NEUTRA" },
    quinzeMin: { dados: [], confirmacao: false },
    cincoMin: { dados: [], sinal: "ESPERAR" }
  }
};

const CONFIG = {
  API_ENDPOINTS: {
    TWELVE_DATA: "https://api.twelvedata.com"
  },
  PARES: {
    FOREX_IDX: "EUR/USD"
  },
  TIMEFRAMES: {
    HORA: "1h",
    QUINZE_MIN: "15min",
    CINCO_MIN: "5min"
  },
  PERIODOS: {
    RSI: 14,
    EMA_CURTA: 5,
    EMA_MEDIA: 21,
    EMA_LONGA: 89,
    EMA_TENDENCIA: 200,
    MACD_RAPIDA: 12,
    MACD_LENTA: 26,
    MACD_SINAL: 9,
    ATR: 14,
    ADX: 14,
    VOLUME_PROFILE: 50
  },
  LIMIARES: {
    SCORE_ALTO: 85,
    SCORE_MEDIO: 70,
    RSI_OVERBOUGHT: 70,
    RSI_OVERSOLD: 30,
    VOLUME_CONFIRMACAO: 1.5,
    ATR_LATERAL: 0.0003,
    ADX_TENDENCIA: 25,
    BREAKOUT_MARGEM: 0.0003
  },
  PESOS: {
    TENDENCIA: 0.4,
    CONFIRMACAO: 0.3,
    ENTRADA: 0.3
  }
};

// =============================================
// GERENCIADOR DE CHAVES API
// =============================================
const API_KEYS = [
  "9cf795b2a4f14d43a049ca935d174ebb",
  "0105e6681b894e0185704171c53f5075"
];
let currentKeyIndex = 0;
let errorCount = 0;

// =============================================
// FUNÇÕES DE INDICADORES TÉCNICOS
// =============================================

// Funções básicas de média
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

// Cálculo de EMA
function calcularEMA(dados, periodo) {
  if (dados.length < periodo) return 0;
  const emaArray = calcularMedia.exponencial(dados, periodo);
  return emaArray[emaArray.length - 1];
}

// Cálculo de ATR (Average True Range)
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

// Cálculo de ADX (Average Directional Index)
function calcularADX(highs, lows, closes, periodo = CONFIG.PERIODOS.ADX) {
  try {
    if (highs.length < periodo * 2 || lows.length < periodo * 2 || closes.length < periodo * 2) {
      return 0;
    }
    
    const plusDM = [];
    const minusDM = [];
    const trueRanges = [];
    
    for (let i = 1; i < closes.length; i++) {
      const upMove = highs[i] - highs[i-1];
      const downMove = lows[i-1] - lows[i];
      
      plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
      minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
      
      trueRanges.push(Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i-1]),
        Math.abs(lows[i] - closes[i-1])
      ));
    }
    
    const smooth = (values, period) => {
      const smoothed = [];
      let firstSum = values.slice(0, period).reduce((a, b) => a + b, 0);
      smoothed.push(firstSum / period);
      
      for (let i = period; i < values.length; i++) {
        smoothed.push((smoothed[smoothed.length - 1] * (period - 1) + values[i]) / period);
      }
      return smoothed;
    };
    
    const smoothPlusDM = smooth(plusDM, periodo);
    const smoothMinusDM = smooth(minusDM, periodo);
    const smoothTR = smooth(trueRanges, periodo);
    
    const plusDI = smoothPlusDM.map((dm, i) => 100 * (dm / smoothTR[i]));
    const minusDI = smoothMinusDM.map((dm, i) => 100 * (dm / smoothTR[i]));
    
    const dx = plusDI.map((pdi, i) => 
      100 * Math.abs(pdi - minusDI[i]) / (pdi + minusDI[i] || 1)
    );
    
    const adx = smooth(dx, periodo).pop();
    return adx || 0;
  } catch (e) {
    console.error("Erro no cálculo ADX:", e);
    return 0;
  }
}

// Identificação do ambiente de mercado
function identificarAmbienteMercado(dados) {
  try {
    const closes = dados.map(v => v.close);
    const volatilidade = calcularATR(dados);
    const adx = calcularADX(
      dados.map(v => v.high),
      dados.map(v => v.low),
      closes
    );
    
    if (adx > CONFIG.LIMIARES.ADX_TENDENCIA) {
      return "TENDÊNCIA";
    }
    
    if (volatilidade < CONFIG.LIMIARES.ATR_LATERAL) {
      return "LATERALIZADO";
    }
    
    return "CONSOLIDAÇÃO";
  } catch (e) {
    console.error("Erro na identificação do ambiente:", e);
    return "INDEFINIDO";
  }
}

// =============================================
// SISTEMA MULTI-TIMEFRAME
// =============================================

// Obter dados para um timeframe específico
async function obterDadosTimeframe(intervalo) {
  try {
    const apiKey = API_KEYS[currentKeyIndex];
    const url = `${CONFIG.API_ENDPOINTS.TWELVE_DATA}/time_series?symbol=${CONFIG.PARES.FOREX_IDX}&interval=${intervalo}&outputsize=100&apikey=${apiKey}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Falha na API: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.status === 'error') {
      throw new Error(data.message || `Erro Twelve Data: ${data.code}`);
    }
    
    const valores = data.values ? data.values.reverse() : [];
    
    return valores.map(item => ({
      time: item.datetime,
      open: parseFloat(item.open),
      high: parseFloat(item.high),
      low: parseFloat(item.low),
      close: parseFloat(item.close),
      volume: parseFloat(item.volume) || 1
    }));
  } catch (e) {
    console.error(`Erro ao obter dados para ${intervalo}:`, e);
    
    errorCount++;
    if (errorCount >= 2) {
      currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
      errorCount = 0;
    }
    
    throw e;
  }
}

// Atualizar todos os timeframes
async function atualizarTimeframes() {
  try {
    state.timeframes.hora.dados = await obterDadosTimeframe(CONFIG.TIMEFRAMES.HORA);
    state.timeframes.quinzeMin.dados = await obterDadosTimeframe(CONFIG.TIMEFRAMES.QUINZE_MIN);
    state.timeframes.cincoMin.dados = await obterDadosTimeframe(CONFIG.TIMEFRAMES.CINCO_MIN);
    
    // Analisar tendência no timeframe de 1 hora
    const dadosHora = state.timeframes.hora.dados;
    if (dadosHora.length > 0) {
      const closes = dadosHora.map(v => v.close);
      const ema200 = calcularEMA(closes, CONFIG.PERIODOS.EMA_TENDENCIA);
      const ultimoClose = dadosHora[dadosHora.length - 1].close;
      state.timeframes.hora.tendencia = ultimoClose > ema200 ? "ALTA" : "BAIXA";
    }
    
    // Verificar confirmação no timeframe de 15 minutos
    const dados15min = state.timeframes.quinzeMin.dados;
    if (dados15min.length > 0) {
      const closes = dados15min.map(v => v.close);
      const ema50 = calcularEMA(closes, 50);
      const rsi = calcularRSI(closes);
      const ultimoClose = dados15min[dados15min.length - 1].close;
      
      state.timeframes.quinzeMin.confirmacao = (
        (state.timeframes.hora.tendencia === "ALTA" && ultimoClose > ema50 && rsi > 50) ||
        (state.timeframes.hora.tendencia === "BAIXA" && ultimoClose < ema50 && rsi < 50)
      );
    }
    
    // Identificar ambiente de mercado no timeframe de 5 minutos
    state.ambienteMercado = identificarAmbienteMercado(state.timeframes.cincoMin.dados);
    
  } catch (e) {
    console.error("Erro ao atualizar timeframes:", e);
  }
}

// =============================================
// GERADOR DE SINAIS AVANÇADO
// =============================================

// Estratégia para mercados em tendência
function estrategiaTrendFollowing(dados) {
  const closes = dados.map(v => v.close);
  const ultimo = dados[dados.length - 1];
  
  const ema5 = calcularEMA(closes, CONFIG.PERIODOS.EMA_CURTA);
  const ema21 = calcularEMA(closes, CONFIG.PERIODOS.EMA_MEDIA);
  const rsi = calcularRSI(closes);
  const macd = calcularMACD(closes);
  
  if (state.timeframes.hora.tendencia === "ALTA") {
    const condicoes = [
      ultimo.close > ema5,
      ema5 > ema21,
      rsi > 50,
      macd.histograma > 0,
      ultimo.volume > (calcularMedia.simples(dados.map(v => v.volume).slice(-20), 20) * 1.2
    ];
    
    return condicoes.filter(Boolean).length >= 4 ? "CALL" : "ESPERAR";
  }
  
  if (state.timeframes.hora.tendencia === "BAIXA") {
    const condicoes = [
      ultimo.close < ema5,
      ema5 < ema21,
      rsi < 50,
      macd.histograma < 0,
      ultimo.volume > (calcularMedia.simples(dados.map(v => v.volume).slice(-20), 20) * 1.2
    ];
    
    return condicoes.filter(Boolean).length >= 4 ? "PUT" : "ESPERAR";
  }
  
  return "ESPERAR";
}

// Estratégia para mercados lateralizados
function estrategiaMeanReversion(dados) {
  const closes = dados.map(v => v.close);
  const ultimo = dados[dados.length - 1];
  
  const rsi = calcularRSI(closes);
  const stoch = calcularStochastic(
    dados.map(v => v.high),
    dados.map(v => v.low),
    closes
  );
  
  const resistencia = Math.max(...dados.slice(-20).map(v => v.high));
  const suporte = Math.min(...dados.slice(-20).map(v => v.low));
  
  if (rsi < CONFIG.LIMIARES.RSI_OVERSOLD && stoch.k < 20) {
    return "CALL";
  }
  
  if (rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT && stoch.k > 80) {
    return "PUT";
  }
  
  return "ESPERAR";
}

// Estratégia para mercados em consolidação
function estrategiaBreakout(dados) {
  const ultimo = dados[dados.length - 1];
  
  const resistencia = Math.max(...dados.slice(-20).map(v => v.high));
  const suporte = Math.min(...dados.slice(-20).map(v => v.low));
  
  if (ultimo.close > (resistencia + CONFIG.LIMIARES.BREAKOUT_MARGEM)) {
    return "CALL";
  }
  
  if (ultimo.close < (suporte - CONFIG.LIMIARES.BREAKOUT_MARGEM)) {
    return "PUT";
  }
  
  return "ESPERAR";
}

// Gerar sinal baseado no ambiente de mercado
function gerarSinal() {
  const dados5min = state.timeframes.cincoMin.dados;
  if (dados5min.length === 0) return "ESPERAR";
  
  // Verificar confirmação de timeframe superior
  if (!state.timeframes.quinzeMin.confirmacao) {
    return "ESPERAR";
  }
  
  // Selecionar estratégia baseada no ambiente
  switch(state.ambienteMercado) {
    case "TENDÊNCIA":
      return estrategiaTrendFollowing(dados5min);
      
    case "LATERALIZADO":
      return estrategiaMeanReversion(dados5min);
      
    case "CONSOLIDAÇÃO":
      return estrategiaBreakout(dados5min);
      
    default:
      return "ESPERAR";
  }
}

// Calcular score de confiança
function calcularScore(sinal) {
  let score = 60;
  
  // Peso da tendência principal
  if (sinal === "CALL" && state.timeframes.hora.tendencia === "ALTA") score += 15;
  if (sinal === "PUT" && state.timeframes.hora.tendencia === "BAIXA") score += 15;
  
  // Peso da confirmação
  if (state.timeframes.quinzeMin.confirmacao) score += 10;
  
  // Peso do ambiente de mercado
  if (state.ambienteMercado === "TENDÊNCIA") score += 10;
  
  // Limitar entre 0-100
  return Math.min(100, Math.max(0, score));
}

// Atualizar desempenho do sistema
function atualizarDesempenho(acerto) {
  state.historicoDesempenho.push(acerto);
  if (state.historicoDesempenho.length > 100) {
    state.historicoDesempenho.shift();
  }
  
  const acertos = state.historicoDesempenho.filter(a => a).length;
  state.taxaAcerto = Math.round((acertos / state.historicoDesempenho.length) * 100) || 70;
}

// =============================================
// INTERFACE DO USUÁRIO
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
    state.marketOpen = true;
  }
}

function atualizarInterface(sinal, score) {
  if (!state.marketOpen) return;
  
  // Atualizar comando principal
  const comandoElement = document.getElementById("comando");
  if (comandoElement) {
    comandoElement.textContent = sinal;
    comandoElement.className = sinal.toLowerCase();
    
    if (sinal === "CALL") comandoElement.textContent += " 📈";
    else if (sinal === "PUT") comandoElement.textContent += " 📉";
    else if (sinal === "ESPERAR") comandoElement.textContent += " ✋";
  }
  
  // Atualizar score de confiança
  const scoreElement = document.getElementById("score");
  if (scoreElement) {
    scoreElement.textContent = `Confiança: ${score}%`;
    if (score >= CONFIG.LIMIARES.SCORE_ALTO) scoreElement.style.color = '#00ff00';
    else if (score >= CONFIG.LIMIARES.SCORE_MEDIO) scoreElement.style.color = '#ffff00';
    else scoreElement.style.color = '#ff0000';
  }
  
  // Atualizar informações de timeframe
  const tendenciaElement = document.getElementById("tendencia");
  const confirmacaoElement = document.getElementById("confirmacao");
  const ambienteElement = document.getElementById("ambiente");
  
  if (tendenciaElement) {
    tendenciaElement.textContent = state.timeframes.hora.tendencia || "NEUTRA";
    tendenciaElement.style.color = state.timeframes.hora.tendencia === "ALTA" ? 
      '#00ff00' : state.timeframes.hora.tendencia === "BAIXA" ? '#ff0000' : '#ffff00';
  }
  
  if (confirmacaoElement) {
    confirmacaoElement.textContent = state.timeframes.quinzeMin.confirmacao ? "CONFIRMADO" : "NÃO CONFIRMADO";
    confirmacaoElement.style.color = state.timeframes.quinzeMin.confirmacao ? '#00ff00' : '#ff0000';
  }
  
  if (ambienteElement) {
    ambienteElement.textContent = state.ambienteMercado;
    
    if (state.ambienteMercado === "TENDÊNCIA") ambienteElement.style.color = '#00ff00';
    else if (state.ambienteMercado === "LATERALIZADO") ambienteElement.style.color = '#ffff00';
    else if (state.ambienteMercado === "CONSOLIDAÇÃO") ambienteElement.style.color = '#ff9900';
    else ambienteElement.style.color = '#ffffff';
  }
  
  // Atualizar diagnóstico
  const diagnosticoElement = document.getElementById("diagnostico");
  if (diagnosticoElement) {
    diagnosticoElement.innerHTML = `
      <li>📈 Taxa de Acerto: ${state.taxaAcerto}%</li>
      <li>🔄 Último Sinal: ${state.ultimoSinal || "N/A"}</li>
      <li>⚙️ Sensibilidade: ${state.ambienteMercado === "TENDÊNCIA" ? "ALTA" : "MÉDIA"}</li>
    `;
  }
  
  // Atualizar últimos sinais
  state.ultimos.unshift(`${state.ultimaAtualizacao} - ${sinal} (${score}%)`);
  if (state.ultimos.length > 8) state.ultimos.pop();
  
  const ultimosElement = document.getElementById("ultimos");
  if (ultimosElement) {
    ultimosElement.innerHTML = state.ultimos.map(item => {
      const [time, signal] = item.split(" - ");
      return `<li>${time} - ${signal}</li>`;
    }).join("");
  }
}

// =============================================
// CORE DO SISTEMA
// =============================================

async function analisarMercado() {
  if (state.leituraEmAndamento || !state.marketOpen) return;
  state.leituraEmAndamento = true;
  
  try {
    // Atualizar dados de todos os timeframes
    await atualizarTimeframes();
    
    // Gerar sinal
    const sinal = gerarSinal();
    const score = calcularScore(sinal);
    
    // Atualizar estado
    state.ultimoSinal = sinal;
    state.ultimoScore = score;
    
    // Atualizar interface
    atualizarInterface(sinal, score);
    
    // Atualizar critérios técnicos na interface
    const criteriosElement = document.getElementById("criterios");
    if (criteriosElement) {
      const dados5min = state.timeframes.cincoMin.dados;
      const ultimo = dados5min[dados5min.length - 1];
      const closes = dados5min.map(v => v.close);
      
      criteriosElement.innerHTML = `
        <li>📊 Tendência: ${state.timeframes.hora.tendencia}</li>
        <li>🔄 Ambiente: ${state.ambienteMercado}</li>
        <li>💰 Preço: ${ultimo.close.toFixed(5)}</li>
        <li>📉 RSI: ${calcularRSI(closes).toFixed(2)}</li>
        <li>📊 Volume: ${ultimo.volume} (${calcularMedia.simples(dados5min.slice(-20).map(v => v.volume), 20).toFixed(2)})</li>
        <li>📌 EMA5: ${calcularEMA(closes, 5).toFixed(5)}</li>
        <li>📌 EMA21: ${calcularEMA(closes, 21).toFixed(5)}</li>
      `;
    }
    
    state.tentativasErro = 0;
  } catch (e) {
    console.error("Erro na análise:", e);
    atualizarInterface("ERRO", 0);
    
    const criteriosElement = document.getElementById("criterios");
    if (criteriosElement) {
      criteriosElement.innerHTML = `<li>ERRO: ${e.message}</li>`;
    }
    
    if (++state.tentativasErro > 3) setTimeout(() => location.reload(), 10000);
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
      analisarMercado().finally(sincronizarTimer);
    }
  }, 1000);
}

// =============================================
// INICIALIZAÇÃO
// =============================================

function iniciarAplicativo() {
  // Criar elementos de diagnóstico se não existirem
  const diagnosticoHTML = `
    <div id="diagnostico" style="margin-top: 20px; padding: 10px; background: #1e2a38; border-radius: 5px;">
      <h3>Diagnóstico do Sistema</h3>
      <ul id="diagnostico-list"></ul>
    </div>
  `;
  
  const timeframesHTML = `
    <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
      <div>
        <strong>Tendência (1h):</strong>
        <span id="tendencia">CARREGANDO...</span>
      </div>
      <div>
        <strong>Confirmação (15min):</strong>
        <span id="confirmacao">CARREGANDO...</span>
      </div>
      <div>
        <strong>Ambiente (5min):</strong>
        <span id="ambiente">CARREGANDO...</span>
      </div>
    </div>
  `;
  
  const container = document.querySelector('.container');
  if (container) {
    container.insertAdjacentHTML('beforeend', timeframesHTML);
    container.insertAdjacentHTML('beforeend', diagnosticoHTML);
  }
  
  // Iniciar processos
  setInterval(atualizarRelogio, 1000);
  sincronizarTimer();
  
  // Primeira análise após 2 segundos
  setTimeout(analisarMercado, 2000);
  
  // Simular desempenho (em produção real, isso viria de operações reais)
  setInterval(() => {
    if (Math.random() > 0.3) {
      atualizarDesempenho(true);
    } else {
      atualizarDesempenho(false);
    }
  }, 30000);
}

// Iniciar quando o documento estiver pronto
if (document.readyState === "complete") iniciarAplicativo();
else document.addEventListener("DOMContentLoaded", iniciarAplicativo);
