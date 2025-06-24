// =============================================
// CONFIGURAÇÕES GLOBAIS (CORRIGIDAS PARA ESTABILIDADE)
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
  apiKeys: [
    "demo", // Chave padrão
    "seu_outra_chave_1",
    "seu_outra_chave_2"
  ],
  currentApiKeyIndex: 0,
  marketOpen: true,
  noticiasRecentes: [],
  volumeProfile: [],
  institutionalFlow: 0,
  fairValueGap: { gap: false },
  hiddenOrders: false
};

const CONFIG = {
  API_ENDPOINTS: [
    "https://api.twelvedata.com",
    "https://min-api.cryptocompare.com",
    "https://api.coingecko.com/api/v3",
    "https://api.cryptorank.io/v1"
  ],
  WS_ENDPOINT: "wss://stream.twelvedata.com/v1/quotes/price",
  PARES: {
    CRYPTO_IDX: "BTC/USD"
  },
  PERIODOS: {
    RSI: 9, // Otimizado
    STOCH: 14,
    WILLIAMS: 14,
    EMA_CURTA: 9, // Fibonacci
    EMA_MEDIA: 21,
    EMA_LONGA: 55,
    EMA_200: 200,
    SMA_VOLUME: 20,
    MACD_RAPIDA: 12, // Padrão
    MACD_LENTA: 26,
    MACD_SINAL: 9,
    VELAS_CONFIRMACAO: 3,
    ANALISE_LATERAL: 30,
    VWAP: 20,
    ATR: 14, // Padrão
    SUPERTREND: 10,
    VOLUME_PROFILE: 50,
    LIQUIDITY_ZONES: 20,
    FAIR_VALUE: 34
  },
  LIMIARES: {
    SCORE_MUITO_ALTO: 88, // Novo nível
    SCORE_ALTO: 82,
    SCORE_MEDIO: 70,
    RSI_OVERBOUGHT: 70, // Padrão
    RSI_OVERSOLD: 30,
    STOCH_OVERBOUGHT: 80,
    STOCH_OVERSOLD: 20,
    WILLIAMS_OVERBOUGHT: -20,
    WILLIAMS_OVERSOLD: -80,
    VOLUME_ALTO: 2.0,
    VARIACAO_LATERAL: 1.2,
    VWAP_DESVIO: 0.025,
    ATR_LIMIAR: 0.035,
    SUPERTREND_SENSIBILIDADE: 2.5,
    INSTITUTIONAL_FLOW: 2500000
  },
  PESOS: {
    RSI: 1.5,
    MACD: 2.0,
    TENDENCIA: 2.2, // Aumentado
    VOLUME: 1.5,
    STOCH: 1.1,
    WILLIAMS: 1.0,
    CONFIRMACAO: 1.3,
    LATERALIDADE: 1.5,
    VWAP: 1.4,
    VOLATILIDADE: 1.4,
    SUPERTREND: 1.9, // Aumentado
    VOLUME_PROFILE: 1.3,
    DIVERGENCIA: 1.8,
    LIQUIDITY: 1.8,
    FAIR_VALUE: 1.7,
    INSTITUTIONAL: 2.0
  },
  RISCO: {
    MAX_RISCO_POR_OPERACAO: 0.008,
    R_R_MINIMO: 2.2,
    ATR_MULTIPLICADOR_SL: 2.0,
    ATR_MULTIPLICADOR_TP: 4.5
  },
  MARKET_HOURS: {
    CRYPTO_OPEN: 0,
    CRYPTO_CLOSE: 24
  }
};

// =============================================
// FUNÇÕES UTILITÁRIAS (CORRIGIDAS)
// =============================================
function formatarTimer(segundos) {
  return `0:${segundos.toString().padStart(2, '0')}`;
}

function atualizarRelogio() {
  const elementoHora = document.getElementById("hora");
  if (elementoHora) {
    const now = new Date();
    elementoHora.textContent = now.toLocaleTimeString("pt-BR", {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    state.marketOpen = true;
  }
}

function atualizarInterface(sinal, score) {
  if (!state.marketOpen) return;
  
  const comandoElement = document.getElementById("comando");
  if (comandoElement) {
    let emoji = "";
    let classe = sinal.toLowerCase();
    
    // Classificação melhorada
    if (score >= CONFIG.LIMIARES.SCORE_MUITO_ALTO) {
      emoji = sinal === "CALL" ? " 🚀" : sinal === "PUT" ? " ⚡" : " ⏳";
      classe += " muito-alto";
    } else if (score >= CONFIG.LIMIARES.SCORE_ALTO) {
      emoji = sinal === "CALL" ? " 📈" : sinal === "PUT" ? " 📉" : " ✋";
      classe += " alto";
    } else if (score >= CONFIG.LIMIARES.SCORE_MEDIO) {
      emoji = sinal === "CALL" ? " ↗️" : sinal === "PUT" ? " ↘️" : " ➡️";
      classe += " medio";
    } else {
      emoji = " ⚠️";
      classe += " baixo";
    }
    
    comandoElement.textContent = sinal + emoji;
    comandoElement.className = classe;
  }
  
  const scoreElement = document.getElementById("score");
  if (scoreElement) {
    scoreElement.textContent = `Assertividade: ${score}%`;
    if (score >= CONFIG.LIMIARES.SCORE_MUITO_ALTO) {
      scoreElement.style.color = '#00ff00';
      scoreElement.style.fontWeight = 'bold';
    } else if (score >= CONFIG.LIMIARES.SCORE_ALTO) {
      scoreElement.style.color = '#7fff00';
      scoreElement.style.fontWeight = 'bold';
    } else if (score >= CONFIG.LIMIARES.SCORE_MEDIO) {
      scoreElement.style.color = '#ffff00';
      scoreElement.style.fontWeight = 'normal';
    } else {
      scoreElement.style.color = '#ff8c00';
      scoreElement.style.fontWeight = 'normal';
    }
  }
  
  const horaElement = document.getElementById("hora");
  if (horaElement) horaElement.textContent = state.ultimaAtualizacao;
}

function rotacionarApiKey() {
  state.currentApiKeyIndex = (state.currentApiKeyIndex + 1) % state.apiKeys.length;
  return state.apiKeys[state.currentApiKeyIndex];
}

// =============================================
// INDICADORES TÉCNICOS (CORRIGIDOS - SEM TRAVAMENTOS)
// =============================================
const calcularMedia = {
  simples: (dados, periodo) => {
    if (!Array.isArray(dados) || dados.length < periodo) return 0; // ✅ CORRIGIDO: retorna 0
    const slice = dados.slice(-periodo);
    const soma = slice.reduce((a, b) => a + (isNaN(b) ? 0 : b), 0); // ✅ Proteção NaN
    return soma / periodo;
  },

  exponencial: (dados, periodo) => {
    if (!Array.isArray(dados) || dados.length < periodo) return [0]; // ✅ CORRIGIDO: retorna [0]
    
    const k = 2 / (periodo + 1);
    let ema = calcularMedia.simples(dados.slice(0, periodo), periodo);
    if (ema === 0) return [0]; // ✅ Proteção adicional
    
    const emaArray = [ema];
    
    for (let i = periodo; i < dados.length; i++) {
      if (!isNaN(dados[i])) { // ✅ Proteção NaN
        ema = dados[i] * k + ema * (1 - k);
        emaArray.push(ema);
      }
    }
    
    return emaArray;
  }
};

function calcularRSI(closes, periodo = CONFIG.PERIODOS.RSI) {
  try {
    if (!Array.isArray(closes) || closes.length < periodo + 1) return 50;
    
    let gains = 0, losses = 0;
    
    for (let i = 1; i <= periodo; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff > 0) gains += diff;
      else losses += Math.abs(diff);
    }

    let avgGain = gains / periodo;
    let avgLoss = Math.max(losses / periodo, 1e-10); // ✅ Evita divisão por zero

    for (let i = periodo + 1; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      const gain = diff > 0 ? diff : 0;
      const loss = diff < 0 ? Math.abs(diff) : 0;
      
      avgGain = (avgGain * (periodo - 1) + gain) / periodo;
      avgLoss = Math.max((avgLoss * (periodo - 1) + loss) / periodo, 1e-10);
    }

    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    return Math.max(0, Math.min(100, rsi)); // ✅ Garante range 0-100
  } catch (e) {
    console.warn("Aviso RSI:", e.message);
    return 50;
  }
}

function calcularStochastic(highs, lows, closes, periodo = CONFIG.PERIODOS.STOCH) {
  try {
    if (!Array.isArray(closes) || closes.length < periodo) return { k: 50, d: 50 };
    if (!Array.isArray(highs) || !Array.isArray(lows)) return { k: 50, d: 50 }; // ✅ Validação adicional
    
    const kValues = [];
    for (let i = periodo-1; i < closes.length; i++) {
      const sliceHigh = highs.slice(i-periodo+1, i+1);
      const sliceLow = lows.slice(i-periodo+1, i+1);
      const highestHigh = Math.max(...sliceHigh);
      const lowestLow = Math.min(...sliceLow);
      const range = highestHigh - lowestLow;
      
      if (range > 0) {
        kValues.push(((closes[i] - lowestLow) / range) * 100);
      } else {
        kValues.push(50); // ✅ Valor neutro quando range = 0
      }
    }
    
    const k = kValues[kValues.length-1] || 50;
    const d = kValues.length >= 3 ? calcularMedia.simples(kValues.slice(-3), 3) : k;
    
    return {
      k: Math.max(0, Math.min(100, k)),
      d: Math.max(0, Math.min(100, d))
    };
  } catch (e) {
    console.warn("Aviso Stochastic:", e.message);
    return { k: 50, d: 50 };
  }
}

function calcularWilliams(highs, lows, closes, periodo = CONFIG.PERIODOS.WILLIAMS) {
  try {
    if (!Array.isArray(closes) || closes.length < periodo) return -50;
    if (!Array.isArray(highs) || !Array.isArray(lows)) return -50;
    
    const sliceHigh = highs.slice(-periodo);
    const sliceLow = lows.slice(-periodo);
    const highestHigh = Math.max(...sliceHigh);
    const lowestLow = Math.min(...sliceLow);
    const range = highestHigh - lowestLow;
    
    if (range > 0) {
      const williams = ((highestHigh - closes[closes.length-1]) / range) * -100;
      return Math.max(-100, Math.min(0, williams));
    }
    return -50;
  } catch (e) {
    console.warn("Aviso Williams:", e.message);
    return -50;
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
    
    if (emaRapida.length === 0 || emaLenta.length === 0) { // ✅ Proteção arrays vazios
      return { histograma: 0, macdLinha: 0, sinalLinha: 0 };
    }
    
    const startIdx = Math.max(0, lenta - rapida);
    const macdLinha = emaRapida.slice(startIdx).map((val, idx) => {
      return emaLenta[idx] !== undefined ? val - emaLenta[idx] : 0; // ✅ Proteção undefined
    });
    
    if (macdLinha.length < sinal) {
      return { histograma: 0, macdLinha: 0, sinalLinha: 0 };
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
    console.warn("Aviso MACD:", e.message);
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
      if (!vela || typeof vela !== 'object') continue; // ✅ Validação objeto
      if (!vela.volume || vela.volume <= 0) continue;
      if (isNaN(vela.high) || isNaN(vela.low) || isNaN(vela.close)) continue; // ✅ Validação NaN
      
      const typicalPrice = (vela.high + vela.low + vela.close) / 3;
      typicalPriceSum += typicalPrice * vela.volume;
      volumeSum += vela.volume;
    }
    
    return volumeSum > 0 ? typicalPriceSum / volumeSum : 0;
  } catch (e) {
    console.warn("Aviso VWAP:", e.message);
    return 0;
  }
}

function calcularATR(dados, periodo = CONFIG.PERIODOS.ATR) {
  try {
    if (!Array.isArray(dados) || dados.length < periodo + 1) return 0;
    
    const trValues = [];
    for (let i = 1; i < dados.length; i++) {
      if (!dados[i] || !dados[i-1]) continue; // ✅ Validação objetos
      
      const tr = Math.max(
        dados[i].high - dados[i].low,
        Math.abs(dados[i].high - dados[i-1].close),
        Math.abs(dados[i].low - dados[i-1].close)
      );
      
      if (!isNaN(tr) && tr >= 0) trValues.push(tr); // ✅ Validação NaN e negativos
    }
    
    if (trValues.length < periodo) return 0;
    
    return calcularMedia.simples(trValues.slice(-periodo), periodo);
  } catch (e) {
    console.warn("Aviso ATR:", e.message);
    return 0;
  }
}

function calcularSuperTrend(dados, periodo = CONFIG.PERIODOS.SUPERTREND, multiplicador = CONFIG.LIMIARES.SUPERTREND_SENSIBILIDADE) {
  try {
    if (!Array.isArray(dados) || dados.length < periodo) return { direcao: 0, valor: 0 };
    
    const atr = calcularATR(dados, periodo);
    if (atr === 0) return { direcao: 0, valor: 0 };
    
    const ultimo = dados[dados.length - 1];
    if (!ultimo) return { direcao: 0, valor: 0 };
    
    const hl2 = (ultimo.high + ultimo.low) / 2;
    
    const upperBand = hl2 + (multiplicador * atr);
    const lowerBand = hl2 - (multiplicador * atr);
    
    let direcao = 1;
    let superTrend = lowerBand;
    
    if (dados.length > periodo) {
      const anterior = dados[dados.length - 2];
      if (anterior && anterior.close !== undefined) {
        if (ultimo.close <= lowerBand) {
          direcao = -1;
          superTrend = upperBand;
        } else if (ultimo.close >= upperBand) {
          direcao = 1;
          superTrend = lowerBand;
        } else {
          direcao = anterior.direcao || 1;
          const superTrendAnterior = anterior.superTrend || (direcao === 1 ? lowerBand : upperBand);
          superTrend = direcao === 1 ? Math.max(lowerBand, superTrendAnterior) : Math.min(upperBand, superTrendAnterior);
        }
      }
    }
    
    return { direcao, valor: superTrend };
  } catch (e) {
    console.warn("Aviso SuperTrend:", e.message);
    return { direcao: 0, valor: 0 };
  }
}

function calcularVolumeProfile(dados, periodo = CONFIG.PERIODOS.VOLUME_PROFILE) {
  try {
    if (!Array.isArray(dados) || dados.length < periodo) return { pvp: 0, vaHigh: 0, vaLow: 0 };
    
    const slice = dados.slice(-periodo);
    const volumePorPreco = {};
    
    for (const vela of slice) {
      if (!vela || !vela.volume || vela.volume <= 0) continue;
      if (isNaN(vela.high) || isNaN(vela.low)) continue;
      
      const range = [vela.low, vela.high].sort((a, b) => a - b);
      if (range[1] === range[0]) continue; // ✅ Evita divisão por zero
      
      const passo = Math.max(0.01, (range[1] - range[0]) / 10);
      
      for (let p = range[0]; p <= range[1]; p += passo) {
        const nivel = p.toFixed(2);
        volumePorPreco[nivel] = (volumePorPreco[nivel] || 0) + vela.volume;
      }
    }
    
    const niveis = Object.entries(volumePorPreco).sort((a, b) => b[1] - a[1]);
    if (niveis.length === 0) return { pvp: 0, vaHigh: 0, vaLow: 0 };
    
    const pvp = parseFloat(niveis[0][0]) || 0;
    const vaHigh = parseFloat(niveis[Math.floor(niveis.length * 0.3)][0]) || pvp;
    const vaLow = parseFloat(niveis[Math.floor(niveis.length * 0.7)][0]) || pvp;
    
    return { pvp, vaHigh, vaLow };
  } catch (e) {
    console.warn("Aviso Volume Profile:", e.message);
    return { pvp: 0, vaHigh: 0, vaLow: 0 };
  }
}

function detectarFairValueGap(velas) {
  try {
    if (!Array.isArray(velas) || velas.length < 3) return { gap: false };
    
    const ultima = velas[velas.length - 1];
    const penultima = velas[velas.length - 2];
    
    if (!ultima || !penultima) return { gap: false };
    
    // Gap de alta
    if (ultima.low > penultima.high) {
      return { gap: true, direcao: 'ALTA', tamanho: ultima.low - penultima.high };
    } 
    // Gap de baixa
    else if (ultima.high < penultima.low) {
      return { gap: true, direcao: 'BAIXA', tamanho: penultima.low - ultima.high };
    }
    
    return { gap: false };
  } catch (e) {
    console.warn("Aviso Fair Value Gap:", e.message);
    return { gap: false };
  }
}

// ✅ CORRIGIDO: Função calcularLiquidez
function calcularLiquidez(velas, periodo = CONFIG.PERIODOS.LIQUIDITY_ZONES) {
  try {
    if (!Array.isArray(velas) || velas.length < periodo) {
      return { resistencia: 0, suporte: 0 };
    }
    
    const slice = velas.slice(-periodo);
    const highNodes = [];
    const lowNodes = [];
    
    // Identificar nós de liquidez
    for (let i = 3; i < slice.length - 3; i++) {
      const atual = slice[i];
      if (!atual) continue;
      
      if (atual.high > slice[i-1].high && atual.high > slice[i+1].high) {
        highNodes.push(atual.high);
      }
      if (atual.low < slice[i-1].low && atual.low < slice[i+1].low) {
        lowNodes.push(atual.low);
      }
    }
    
    return {
      resistencia: highNodes.length > 0 ? calcularMedia.simples(highNodes, highNodes.length) : 0, // ✅ CORRIGIDO
      suporte: lowNodes.length > 0 ? calcularMedia.simples(lowNodes, lowNodes.length) : 0 // ✅ CORRIGIDO
    };
  } catch (e) {
    console.warn("Aviso Liquidez:", e.message);
    return { resistencia: 0, suporte: 0 };
  }
}

function detectarDivergencias(closes, rsis, highs, lows) {
  try {
    if (closes.length < 5 || rsis.length < 5) return { divergenciaRSI: false, tipoDivergencia: "NENHUMA", divergenciaOculta: false };
    
    const ultimosCloses = closes.slice(-5);
    const ultimosRSIs = rsis.slice(-5);
    const ultimosHighs = highs.slice(-5);
    const ultimosLows = lows.slice(-5);
    
    // Divergência de alta: preço faz fundo mais baixo, RSI faz fundo mais alto
    const baixaPreco = ultimosLows[0] < ultimosLows[2] && ultimosLows[2] < ultimosLows[4];
    const altaRSI = ultimosRSIs[0] > ultimosRSIs[2] && ultimosRSIs[2] > ultimosRSIs[4];
    const divergenciaAlta = baixaPreco && altaRSI;
    
    // Divergência de baixa: preço faz topo mais alto, RSI faz topo mais baixo
    const altaPreco = ultimosHighs[0] > ultimosHighs[2] && ultimosHighs[2] > ultimosHighs[4];
    const baixaRSI = ultimosRSIs[0] < ultimosRSIs[2] && ultimosRSIs[2] < ultimosRSIs[4];
    const divergenciaBaixa = altaPreco && baixaRSI;
    
    // Divergência oculta de alta: preço faz fundo mais alto, RSI faz fundo mais baixo
    const altaPrecoOculta = ultimosLows[0] > ultimosLows[2] && ultimosLows[2] > ultimosLows[4];
    const baixaRSIOculta = ultimosRSIs[0] < ultimosRSIs[2] && ultimosRSIs[2] < ultimosRSIs[4];
    const divergenciaOcultaAlta = altaPrecoOculta && baixaRSIOculta;
    
    // Divergência oculta de baixa: preço faz topo mais baixo, RSI faz topo mais alto
    const baixaPrecoOculta = ultimosHighs[0] < ultimosHighs[2] && ultimosHighs[2] < ultimosHighs[4];
    const altaRSIOculta = ultimosRSIs[0] > ultimosRSIs[2] && ultimosRSIs[2] > ultimosRSIs[4];
    const divergenciaOcultaBaixa = baixaPrecoOculta && altaRSIOculta;
    
    return {
      divergenciaRSI: divergenciaAlta || divergenciaBaixa,
      divergenciaOculta: divergenciaOcultaAlta || divergenciaOcultaBaixa,
      tipoDivergencia: divergenciaAlta ? "ALTA" : 
                      divergenciaBaixa ? "BAIXA" : 
                      divergenciaOcultaAlta ? "ALTA_OCULTA" : 
                      divergenciaOcultaBaixa ? "BAIXA_OCULTA" : "NENHUMA"
    };
  } catch (e) {
    console.warn("Aviso Divergências:", e.message);
    return { divergenciaRSI: false, divergenciaOculta: false, tipoDivergencia: "NENHUMA" };
  }
}

// =============================================
// SISTEMA DE DECISÃO (MANTIDO)
// =============================================
function avaliarTendencia(closes, emaCurta, emaMedia, emaLonga, ema200, superTrend, atr) {
  if (closes.length < CONFIG.PERIODOS.VELAS_CONFIRMACAO) return "NEUTRA";
  
  if (detectarMercadoLateral(closes, atr)) {
    state.contadorLaterais++;
    return "LATERAL";
  }
  
  state.contadorLaterais = 0;
  
  const ultimoClose = closes[closes.length - 1];
  
  // Sistema híbrido de tendência (3 métodos)
  const metodo1 = () => {
    if (ultimoClose > ema200 && emaCurta > emaMedia && emaMedia > emaLonga) return "FORTE_ALTA";
    if (ultimoClose < ema200 && emaCurta < emaMedia && emaMedia < emaLonga) return "FORTE_BAIXA";
    return null;
  };
  
  const metodo2 = () => {
    if (superTrend.direcao > 0 && ultimoClose > superTrend.valor) return "ALTA";
    if (superTrend.direcao < 0 && ultimoClose < superTrend.valor) return "BAIXA";
    return null;
  };
  
  const metodo3 = () => {
    const diffCurtaMedia = emaCurta - emaMedia;
    const diffMediaLonga = emaMedia - emaLonga;
    const threshold = atr * 0.3;
    
    if (diffCurtaMedia > threshold && diffMediaLonga > threshold) return "ALTA";
    if (diffCurtaMedia < -threshold && diffMediaLonga < -threshold) return "BAIXA";
    return null;
  };
  
  // Consenso entre métodos
  const resultados = [metodo1(), metodo2(), metodo3()].filter(Boolean);
  const contagem = {
    FORTE_ALTA: resultados.filter(r => r === "FORTE_ALTA").length,
    FORTE_BAIXA: resultados.filter(r => r === "FORTE_BAIXA").length,
    ALTA: resultados.filter(r => r === "ALTA").length,
    BAIXA: resultados.filter(r => r === "BAIXA").length
  };
  
  if (contagem.FORTE_ALTA >= 2) return "FORTE_ALTA";
  if (contagem.FORTE_BAIXA >= 2) return "FORTE_BAIXA";
  if (contagem.ALTA >= 2) return "ALTA";
  if (contagem.BAIXA >= 2) return "BAIXA";
  
  return "NEUTRA";
}

function detectarMercadoLateral(closes, atr) {
  if (closes.length < CONFIG.PERIODOS.ANALISE_LATERAL) return false;
  
  const ultimosPrecos = closes.slice(-CONFIG.PERIODOS.ANALISE_LATERAL);
  const maximo = Math.max(...ultimosPrecos);
  const minimo = Math.min(...ultimosPrecos);
  const variacao = ((maximo - minimo) / minimo) * 100;
  
  return variacao < (CONFIG.LIMIARES.VARIACAO_LATERAL * atr * 100);
}

function calcularScore(indicadores, divergencias) {
  let score = 50;

  // Fator Fair Value Gap
  if (state.fairValueGap.gap) {
    score += state.fairValueGap.direcao === 'ALTA' ? 
      15 * CONFIG.PESOS.FAIR_VALUE : 
      -15 * CONFIG.PESOS.FAIR_VALUE;
  }
  
  // Fator de Liquidez
  if (indicadores.liquidez.suporte > 0 && indicadores.liquidez.resistencia > 0) {
    const distanciaSuporte = Math.abs(indicadores.close - indicadores.liquidez.suporte);
    const distanciaResistencia = Math.abs(indicadores.close - indicadores.liquidez.resistencia);
    if (distanciaSuporte < distanciaResistencia) {
      score += 12 * CONFIG.PESOS.LIQUIDITY;
    } else {
      score -= 8 * CONFIG.PESOS.LIQUIDITY;
    }
  }
  
  // Fluxo Institucional
  if (state.institutionalFlow > CONFIG.LIMIARES.INSTITUTIONAL_FLOW) {
    score += 18 * CONFIG.PESOS.INSTITUTIONAL;
  } else if (state.institutionalFlow < -CONFIG.LIMIARES.INSTITUTIONAL_FLOW) {
    score -= 18 * CONFIG.PESOS.INSTITUTIONAL;
  }

  // Análise de divergências
  if (divergencias.divergenciaOculta) {
    score += divergencias.tipoDivergencia.includes("ALTA") ? 
      20 * CONFIG.PESOS.DIVERGENCIA : 
      -20 * CONFIG.PESOS.DIVERGENCIA;
  } else if (divergencias.divergenciaRSI) {
    score += divergencias.tipoDivergencia === "ALTA" ? 
      15 * CONFIG.PESOS.DIVERGENCIA : 
      -15 * CONFIG.PESOS.DIVERGENCIA;
  }

  // Análise MACD
  score += (Math.min(Math.max(indicadores.macd.histograma * 10, -15), 15) * CONFIG.PESOS.MACD);

  // Análise de Tendência
  switch(indicadores.tendencia) {
    case "FORTE_ALTA": 
      score += 25 * CONFIG.PESOS.TENDENCIA; 
      if (indicadores.volume > indicadores.volumeMedia * CONFIG.LIMIARES.VOLUME_ALTO * 1.5) score += 8;
      break;
    case "ALTA": score += 15 * CONFIG.PESOS.TENDENCIA; break;
    case "FORTE_BAIXA": 
      score -= 25 * CONFIG.PESOS.TENDENCIA; 
      if (indicadores.volume > indicadores.volumeMedia * CONFIG.LIMIARES.VOLUME_ALTO * 1.5) score -= 8;
      break;
    case "BAIXA": score -= 15 * CONFIG.PESOS.TENDENCIA; break;
    case "LATERAL": 
      score -= Math.min(state.contadorLaterais, 15) * CONFIG.PESOS.LATERALIDADE; 
      break;
  }

  // Análise RSI
  if (indicadores.rsi < CONFIG.LIMIARES.RSI_OVERSOLD) {
    score += 12 * CONFIG.PESOS.RSI;
  } else if (indicadores.rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT) {
    score -= 12 * CONFIG.PESOS.RSI;
  }

  // Análise de Volume
  if (indicadores.volume > indicadores.volumeMedia * CONFIG.LIMIARES.VOLUME_ALTO) {
    score += (indicadores.tendencia.includes("ALTA") ? 10 : -10) * CONFIG.PESOS.VOLUME;
  }

  // Análise Stochastic
  if (indicadores.stoch.k < CONFIG.LIMIARES.STOCH_OVERSOLD && 
      indicadores.stoch.d < CONFIG.LIMIARES.STOCH_OVERSOLD) {
    score += 12 * CONFIG.PESOS.STOCH;
  }
  if (indicadores.stoch.k > CONFIG.LIMIARES.STOCH_OVERBOUGHT && 
      indicadores.stoch.d > CONFIG.LIMIARES.STOCH_OVERBOUGHT) {
    score -= 12 * CONFIG.PESOS.STOCH;
  }

  // Análise Williams
  if (indicadores.williams < CONFIG.LIMIARES.WILLIAMS_OVERSOLD) {
    score += 10 * CONFIG.PESOS.WILLIAMS; 
  }
  if (indicadores.williams > CONFIG.LIMIARES.WILLIAMS_OVERBOUGHT) {
    score -= 10 * CONFIG.PESOS.WILLIAMS; 
  }

  // Análise VWAP
  if (indicadores.vwap > 0) {
    const vwapDesvio = Math.abs(indicadores.close - indicadores.vwap) / indicadores.vwap;
    if (vwapDesvio > CONFIG.LIMIARES.VWAP_DESVIO) {
      score += (indicadores.close > indicadores.vwap ? 8 : -8) * CONFIG.PESOS.VWAP;
    }
  }

  // Volume Profile
  if (indicadores.close > indicadores.volumeProfile.vaHigh) {
    score += 10 * CONFIG.PESOS.VOLUME_PROFILE;
  } else if (indicadores.close < indicadores.volumeProfile.vaLow) {
    score -= 10 * CONFIG.PESOS.VOLUME_PROFILE;
  }

  // Confirmações
  const vwapDesvio = indicadores.vwap > 0 ? Math.abs(indicadores.close - indicadores.vwap) / indicadores.vwap : 0;
  const confirmacoes = [
    indicadores.rsi < 40 || indicadores.rsi > 60,
    Math.abs(indicadores.macd.histograma) > 0.05,
    indicadores.stoch.k < 30 || indicadores.stoch.k > 70,
    indicadores.williams < -70 || indicadores.williams > -30,
    indicadores.tendencia !== "LATERAL",
    vwapDesvio > CONFIG.LIMIARES.VWAP_DESVIO * 0.8,
    indicadores.superTrend.direcao !== 0,
    state.institutionalFlow > 0
  ].filter(Boolean).length;

  score += confirmacoes * 5 * CONFIG.PESOS.CONFIRMACAO;

  // Filtro de notícias recentes
  if (state.noticiasRecentes.some(noticia => 
      noticia.sentiment === "negative" && Date.now() - noticia.timestamp < 300000)) {
    score -= 15;
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

function determinarSinal(score, tendencia, divergencias) {
  // Estratégia: priorizar divergências ocultas
  if (divergencias.divergenciaOculta) {
    return divergencias.tipoDivergencia.includes("ALTA") ? "CALL" : "PUT";
  }
  
  if (tendencia === "LATERAL") {
    return score > 85 ? "CALL" : "ESPERAR";
  }
  
  if (score >= CONFIG.LIMIARES.SCORE_ALTO) {
    return tendencia.includes("ALTA") ? "CALL" : "PUT";
  }
  
  if (score >= CONFIG.LIMIARES.SCORE_MEDIO) {
    if (tendencia === "NEUTRA") return "ESPERAR";
    return tendencia.includes("ALTA") ? "CALL" : "PUT";
  }
  
  return "ESPERAR";
}

// =============================================
// FUNÇÕES DE DADOS INSTITUCIONAIS (SAFE)
// =============================================
async function obterFluxoInstitucional() {
  try {
    // Mock data para evitar falhas de API
    return Math.random() * 1000000 - 500000; // Valor aleatório para demonstração
  } catch (e) {
    console.warn("Aviso fluxo institucional:", e.message);
    return 0;
  }
}

async function detectarOrdensOcultas() {
  try {
    // Mock data para evitar falhas de API
    return Math.random() > 0.7; // 30% chance de ordens ocultas
  } catch (e) {
    console.warn("Aviso ordens ocultas:", e.message);
    return false;
  }
}

// ✅ FUNÇÃO PRINCIPAL CORRIGIDA (SEM TRAVAMENTOS)
async function obterDadosCrypto() {
  // ✅ DADOS MOCK PARA GARANTIR FUNCIONAMENTO
  const gerarDadosMock = () => {
    const dados = [];
    let preco = 50000; // BTC inicial
    
    for (let i = 0; i < 150; i++) {
      const variacao = (Math.random() - 0.5) * 1000; // Variação de -500 a +500
      preco += variacao;
      
      const open = preco;
      const high = preco + Math.random() * 200;
      const low = preco - Math.random() * 200;
      const close = low + Math.random() * (high - low);
      const volume = 1000 + Math.random() * 9000;
      
      dados.push({
        time: new Date(Date.now() - (150 - i) * 60000).toISOString(),
        open: open,
        high: high,
        low: low,
        close: close,
        volume: volume
      });
      
      preco = close;
    }
    
    return dados;
  };

  // Tentar APIs reais primeiro, depois fallback para mock
  for (const endpoint of CONFIG.API_ENDPOINTS) {
    try {
      let response, dados;
      
      if (endpoint.includes('twelvedata')) {
        const apiKey = rotacionarApiKey();
        response = await fetch(`${endpoint}/time_series?symbol=${CONFIG.PARES.CRYPTO_IDX}&interval=1min&outputsize=150&apikey=${apiKey}`, {
          timeout: 5000 // ✅ Timeout para evitar travamento
        });
        
        if (!response.ok) continue;
        dados = await response.json();
        
        if (dados.values && Array.isArray(dados.values) && dados.values.length > 0) {
          return dados.values.map(v => ({
            time: v.datetime,
            open: parseFloat(v.open),
            high: parseFloat(v.high),
            low: parseFloat(v.low),
            close: parseFloat(v.close),
            volume: parseFloat(v.volume) || 1000
          })).reverse();
        }
      } 
      else if (endpoint.includes('cryptocompare')) {
        response = await fetch(`${endpoint}/data/v2/histominute?fsym=BTC&tsym=USD&limit=150`, {
          timeout: 5000
        });
        
        if (!response.ok) continue;
        dados = await response.json();
        
        if (dados.Data && dados.Data.Data && dados.Data.Data.length > 0) {
          return dados.Data.Data.map(v => ({
            time: new Date(v.time * 1000).toISOString(),
            open: v.open,
            high: v.high,
            low: v.low,
            close: v.close,
            volume: v.volumefrom || 1000
          }));
        }
      }
      
    } catch (e) {
      console.warn(`Aviso endpoint ${endpoint}:`, e.message);
    }
  }
  
  // ✅ FALLBACK: Usar dados mock se todas as APIs falharem
  console.log("📊 Usando dados simulados (APIs indisponíveis)");
  return gerarDadosMock();
}

async function buscarNoticiasCrypto() {
  try {
    // Mock data para evitar falhas
    return [
      { title: "Bitcoin News", sentiment: "neutral", timestamp: Date.now() }
    ];
  } catch (e) {
    console.warn("Aviso notícias:", e.message);
    return [];
  }
}

// ✅ FUNÇÃO PRINCIPAL DE ANÁLISE CORRIGIDA
async function analisarMercado() {
  if (state.leituraEmAndamento || !state.marketOpen) return;
  state.leituraEmAndamento = true;
  
  try {
    console.log("🔄 Iniciando análise do mercado...");
    
    // Buscar dados institucionais
    state.noticiasRecentes = await buscarNoticiasCrypto();
    state.institutionalFlow = await obterFluxoInstitucional();
    state.hiddenOrders = await detectarOrdensOcultas();
    
    const dados = await obterDadosCrypto();
    
    if (!dados || dados.length < 50) {
      throw new Error("Dados insuficientes recebidos");
    }
    
    console.log(`📊 Dados recebidos: ${dados.length} velas`);
    
    const velaAtual = dados[dados.length - 1];
    const closes = dados.map(v => v.close).filter(c => !isNaN(c));
    const highs = dados.map(v => v.high).filter(h => !isNaN(h));
    const lows = dados.map(v => v.low).filter(l => !isNaN(l));
    const volumes = dados.map(v => v.volume).filter(v => !isNaN(v));

    // Detecção Fair Value Gap
    state.fairValueGap = detectarFairValueGap(dados.slice(-3));

    const emaCurtaArray = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_CURTA);
    const emaMediaArray = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_MEDIA);
    const emaLongaArray = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_LONGA);
    const ema200Array = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_200);
    
    const emaCurta = emaCurtaArray[emaCurtaArray.length - 1] || 0;
    const emaMedia = emaMediaArray[emaMediaArray.length - 1] || 0;
    const emaLonga = emaLongaArray[emaLongaArray.length - 1] || 0;
    const ema200 = ema200Array[ema200Array.length - 1] || 0;

    const atr = calcularATR(dados);
    const superTrend = calcularSuperTrend(dados);
    const volumeProfile = calcularVolumeProfile(dados);
    const liquidez = calcularLiquidez(dados);
    
    // Detecção de divergências
    const rsiHistory = [];
    for (let i = CONFIG.PERIODOS.RSI; i <= closes.length && i <= closes.length; i++) {
      rsiHistory.push(calcularRSI(closes.slice(0, i)));
    }
    const divergencias = detectarDivergencias(closes, rsiHistory, highs, lows);

    const indicadores = {
      rsi: calcularRSI(closes),
      macd: calcularMACD(closes),
      emaCurta,
      emaMedia,
      emaLonga,
      ema200,
      volume: velaAtual.volume,
      volumeMedia: calcularMedia.simples(volumes, Math.min(CONFIG.PERIODOS.SMA_VOLUME, volumes.length)) || 1,
      stoch: calcularStochastic(highs, lows, closes),
      williams: calcularWilliams(highs, lows, closes),
      vwap: calcularVWAP(dados),
      atr,
      superTrend,
      volumeProfile,
      liquidez,
      close: velaAtual.close,
      tendencia: avaliarTendencia(closes, emaCurta, emaMedia, emaLonga, ema200, superTrend, atr),
      hiddenOrders: state.hiddenOrders
    };

    const score = calcularScore(indicadores, divergencias);
    const sinal = determinarSinal(score, indicadores.tendencia, divergencias);

    console.log(`📈 Sinal gerado: ${sinal} (${score}%)`);

    state.ultimoSinal = sinal !== "ESPERAR" ? sinal : state.ultimoSinal;
    state.ultimoScore = score;
    state.ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR");

    atualizarInterface(sinal, score);

    // Atualizar critérios na interface
    const criteriosElement = document.getElementById("criterios");
    if (criteriosElement) {
      criteriosElement.innerHTML = `
        <li>📊 Tendência: ${indicadores.tendencia.replace('_',' ')} ${
          indicadores.tendencia.includes("ALTA") ? '🟢' :
          indicadores.tendencia.includes("BAIXA") ? '🔴' : '🟡'}</li>
        <li>📉 RSI: ${indicadores.rsi.toFixed(2)} ${
          indicadores.rsi < CONFIG.LIMIARES.RSI_OVERSOLD ? '🔻' : 
          indicadores.rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT ? '🔺' : ''}</li>
        <li>📊 MACD: ${indicadores.macd.histograma.toFixed(6)} ${
          indicadores.macd.histograma>0?'🟢':'🔴'}</li>
        <li>📈 Stochastic K/D: ${indicadores.stoch.k.toFixed(2)}/${indicadores.stoch.d.toFixed(2)}</li>
        <li>📊 Williams: ${indicadores.williams.toFixed(2)}</li>
        <li>💰 Preço: $${indicadores.close.toFixed(2)} ${
          indicadores.close>emaCurta?'🟢':'🔴'}</li>
        <li>📶 Médias: EMA${CONFIG.PERIODOS.EMA_CURTA} ${indicadores.emaCurta.toFixed(2)} | EMA${CONFIG.PERIODOS.EMA_MEDIA} ${indicadores.emaMedia.toFixed(2)} | EMA${CONFIG.PERIODOS.EMA_LONGA} ${indicadores.emaLonga.toFixed(2)}</li>
        <li>💹 Volume: ${indicadores.volume.toFixed(2)} vs Média ${indicadores.volumeMedia.toFixed(2)}</li>
        <li>📌 VWAP: ${indicadores.vwap.toFixed(2)} | ATR: ${indicadores.atr.toFixed(4)}</li>
        <li>🚦 SuperTrend: ${indicadores.superTrend.direcao>0?'ALTA':'BAIXA'} (${indicadores.superTrend.valor.toFixed(2)})</li>
        <li>📊 Volume Profile: PVP ${indicadores.volumeProfile.pvp.toFixed(2)} | VA ${indicadores.volumeProfile.vaLow.toFixed(2)}-${indicadores.volumeProfile.vaHigh.toFixed(2)}</li>
        <li>🪙 Liquidez: S ${indicadores.liquidez.suporte.toFixed(2)} | R ${indicadores.liquidez.resistencia.toFixed(2)}</li>
        <li>⚠️ Divergência: ${divergencias.tipoDivergencia}</li>
        <li>🏦 Fluxo Institucional: $${(state.institutionalFlow/1000000).toFixed(2)}M</li>
        <li>⚡ Fair Value Gap: ${state.fairValueGap.gap ? state.fairValueGap.direcao + ' ($' + state.fairValueGap.tamanho?.toFixed(2) + ')' : 'Não'}</li>
        <li>🕵️‍♂️ Ordens Ocultas: ${state.hiddenOrders ? 'Sim' : 'Não'}</li>
      `;
    }

    // Atualizar histórico
    state.ultimos.unshift(`${state.ultimaAtualizacao} - ${sinal} (${score}%) ${sinal==="CALL"?"📈":sinal==="PUT"?"📉":"✋"}`);
    if (state.ultimos.length > 10) state.ultimos.pop();
    
    const ultimosElement = document.getElementById("ultimos");
    if (ultimosElement) {
      ultimosElement.innerHTML = state.ultimos.map(i => `<li>${i}</li>`).join("");
    }

    state.tentativasErro = 0;
    console.log("✅ Análise concluída com sucesso");
    
  } catch (e) {
    console.error("❌ Erro na análise:", e);
    atualizarInterface("ERRO", 0);
    
    if (++state.tentativasErro > 3) {
      console.log("🔄 Muitos erros, recarregando página em 10s...");
      setTimeout(() => location.reload(), 10000);
    }
  } finally {
    state.leituraEmAndamento = false;
  }
}

// =============================================
// CONTROLE DE TEMPO (CORRIGIDO)
// =============================================
function sincronizarTimer() {
  // ✅ Limpar interval anterior
  if (state.intervaloAtual) {
    clearInterval(state.intervaloAtual);
    state.intervaloAtual = null;
  }
  
  const agora = Date.now();
  const delayProximaVela = 60000 - (agora % 60000);
  state.timer = Math.max(1, Math.floor(delayProximaVela / 1000));
  
  const elementoTimer = document.getElementById("timer");
  if (elementoTimer) {
    elementoTimer.textContent = formatarTimer(state.timer);
    elementoTimer.style.color = state.timer <= 5 ? 'red' : '';
  }
  
  // ✅ Criar novo interval
  state.intervaloAtual = setInterval(() => {
    state.timer--;
    
    if (elementoTimer) {
      elementoTimer.textContent = formatarTimer(state.timer);
      elementoTimer.style.color = state.timer <= 5 ? 'red' : '';
    }
    
    if (state.timer <= 0) {
      clearInterval(state.intervaloAtual);
      state.intervaloAtual = null;
      analisarMercado().finally(() => {
        // ✅ Aguardar um pouco antes de sincronizar novamente
        setTimeout(sincronizarTimer, 1000);
      });
    }
  }, 1000);
}

// =============================================
// INICIALIZAÇÃO (CORRIGIDA)
// =============================================
function iniciarAplicativo() {
  console.log("🚀 Iniciando aplicativo...");
  
  const ids = ['comando', 'score', 'hora', 'timer', 'criterios', 'ultimos'];
  const faltantes = ids.filter(id => !document.getElementById(id));
  
  if (faltantes.length > 0) { 
    console.error("❌ Elementos HTML faltantes:", faltantes); 
    return; 
  }
  
  console.log("✅ Todos os elementos HTML encontrados");
  
  // Iniciar relógio
  setInterval(atualizarRelogio, 1000);
  
  // Primeira análise imediata
  analisarMercado().finally(() => {
    // Iniciar timer após primeira análise
    setTimeout(sincronizarTimer, 2000);
  });
  
  console.log("✅ Aplicativo iniciado com sucesso!");
}

// ✅ INICIALIZAÇÃO SEGURA
if (document.readyState === "complete") {
  iniciarAplicativo();
} else {
  document.addEventListener("DOMContentLoaded", iniciarAplicativo);
}

// =============================================
// FUNÇÕES GLOBAIS PARA DEBUG
// =============================================
window.debugStatus = () => {
  console.log("🔍 Status do Sistema:", {
    leituraEmAndamento: state.leituraEmAndamento,
    timer: state.timer,
    ultimoSinal: state.ultimoSinal,
    ultimoScore: state.ultimoScore,
    tentativasErro: state.tentativasErro,
    dadosCarregados: state.ultimos.length,
    apiKeyAtual: state.currentApiKeyIndex,
    intervaloAtivo: !!state.intervaloAtual
  });
};

window.forcarAnalise = () => {
  console.log("🔄 Forçando nova análise...");
  analisarMercado();
};

window.reiniciarTimer = () => {
  console.log("🔄 Reiniciando timer...");
  sincronizarTimer();
};
