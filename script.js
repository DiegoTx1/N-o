// =============================================
// CONFIGURAÇÕES GLOBAIS (TWELVE DATA API)
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
  ultimaRequisicao: 0,
  contadorRequisicoes: 0
};

const CONFIG = {
  API_ENDPOINTS: {
    TWELVEDATA: "https://api.twelvedata.com"
  },
  PARES: {
    FOREX_IDX: "GBP/NZD"
  },
  PERIODOS: {
    RSI: 14,
    EMA_CURTA: 8,
    EMA_MEDIA: 21
  },
  LIMIARES: {
    SCORE_ALTO: 75
  }
};

// =============================================
// FUNÇÃO PRINCIPAL PARA OBTER DADOS (COM CHAVE CORRIGIDA)
// =============================================
async function obterDadosMercado() {
  // Controle de rate limit (8 requisições/minuto)
  const agora = Date.now();
  if (agora - state.ultimaRequisicao < 7500) { // 7.5s entre chamadas
    await new Promise(resolve => setTimeout(resolve, 7500 - (agora - state.ultimaRequisicao)));
  }

  try {
    state.ultimaRequisicao = Date.now();
    const response = await fetch(
      `${CONFIG.API_ENDPOINTS.TWELVEDATA}/time_series?symbol=GBP/NZD&interval=1min&apikey=9cf795b2a4f14d43a049ca935d174ebb&outputsize=100`
    );

    if (!response.ok) throw new Error("Erro na API");

    const data = await response.json();
    
    if (data.status === "error") {
      throw new Error(data.message || "Erro na Twelve Data");
    }

    return data.values.map(v => ({
      time: v.datetime,
      open: parseFloat(v.open),
      high: parseFloat(v.high),
      low: parseFloat(v.low),
      close: parseFloat(v.close),
      volume: 10000
    })).reverse();

  } catch (e) {
    console.error("Falha na API, usando dados simulados:", e);
    return gerarDadosSimulados();
  }
}

// =============================================
// FUNÇÃO DE FALLBACK (DADOS SIMULADOS)
// =============================================
function gerarDadosSimulados() {
  const dados = [];
  let preco = 1.9000;
  
  for (let i = 0; i < 100; i++) {
    preco += (Math.random() - 0.5) * 0.002;
    dados.push({
      time: new Date(Date.now() - (100 - i) * 60000).toISOString(),
      open: preco,
      high: preco + 0.0015,
      low: preco - 0.0015,
      close: preco,
      volume: 10000
    });
  }
  return dados;
}

// =============================================
// FUNÇÕES ESSENCIAIS (SIMPLIFICADAS)
// =============================================
const calcularMedia = {
  simples: (dados, periodo) => {
    const slice = dados.slice(-periodo);
    return slice.reduce((a, b) => a + b, 0) / periodo;
  },
  exponencial: (dados, periodo) => {
    const k = 2 / (periodo + 1);
    let ema = calcularMedia.simples(dados.slice(0, periodo), periodo);
    return dados.map((val, i) => i < periodo ? null : (ema = val * k + ema * (1 - k)));
  }
};

function calcularRSI(closes, periodo = 14) {
  let gains = 0, losses = 0;
  for (let i = 1; i <= periodo; i++) {
    const diff = closes[i] - closes[i-1];
    gains += Math.max(0, diff);
    losses += Math.abs(Math.min(0, diff));
  }
  const rs = gains / Math.max(losses, 1e-8);
  return 100 - (100 / (1 + rs));
}

// =============================================
// CORE DO SISTEMA (ATUALIZADO)
// =============================================
async function analisarMercado() {
  if (state.leituraEmAndamento) return;
  state.leituraEmAndamento = true;

  try {
    const dados = await obterDadosMercado();
    const velaAtual = dados[dados.length - 1];
    const closes = dados.map(v => v.close);

    const ema8 = calcularMedia.exponencial(closes, 8).pop();
    const ema21 = calcularMedia.exponencial(closes, 21).pop();
    const rsi = calcularRSI(closes);

    // Lógica simplificada de sinal
    let sinal = "ESPERAR";
    let score = 50;
    
    if (ema8 > ema21 && rsi < 70) {
      sinal = "CALL";
      score = 75 + (rsi < 30 ? 15 : 0);
    } else if (ema8 < ema21 && rsi > 30) {
      sinal = "PUT";
      score = 75 + (rsi > 70 ? 15 : 0);
    }

    // Atualiza interface
    document.getElementById("comando").textContent = sinal;
    document.getElementById("score").textContent = `Confiança: ${score}%`;

  } catch (e) {
    console.error("Erro na análise:", e);
  } finally {
    state.leituraEmAndamento = false;
  }
}

// =============================================
// INICIALIZAÇÃO
// =============================================
function iniciarAplicativo() {
  setInterval(() => {
    document.getElementById("hora").textContent = new Date().toLocaleTimeString("pt-BR");
  }, 1000);

  setInterval(analisarMercado, 10000); // Analisa a cada 10 segundos
}

document.addEventListener("DOMContentLoaded", iniciarAplicativo);
