// =============================================
// SISTEMA 100% REAL OTIMIZADO PARA OPÇÕES BINÁRIAS
// META: 85-90% de assertividade em Binary Options
// =============================================

const CONFIG_BINARY_OPTIONS = {
  // ✅ TIMEFRAMES ESPECÍFICOS PARA BINARY OPTIONS
  TIMEFRAMES: {
    ANALISE: "1min",        // Análise em 1 minuto
    CONFIRMACAO: "30sec",   // Confirmação em 30 segundos
    ENTRADA: "15sec",       // Janela de entrada (15seg antes do fechamento)
    EXPIRACAO_CURTA: "1min", // Expiração 1 minuto
    EXPIRACAO_MEDIA: "5min", // Expiração 5 minutos (RECOMENDADA)
    EXPIRACAO_LONGA: "15min" // Expiração 15 minutos
  },

  // ✅ HORÁRIOS PREMIUM PARA BINARY OPTIONS
  HORARIOS_IDEAIS: {
    // Sessões com maior liquidez e previsibilidade
    LONDRES_ABERTURA: { inicio: "08:00", fim: "10:00", multiplicador: 1.4 },
    NY_ABERTURA: { inicio: "14:30", fim: "16:30", multiplicador: 1.5 },    // MELHOR
    OVERLAP_LONDRES_NY: { inicio: "13:00", fim: "16:00", multiplicador: 1.6 }, // TOP
    
    // Evitar estes horários
    HORARIOS_PERIGOSOS: [
      { inicio: "22:00", fim: "06:00", motivo: "Baixa liquidez asiática" },
      { inicio: "12:00", fim: "13:00", motivo: "Almoço Londres" },
      { inicio: "17:00", fim: "18:00", motivo: "Fechamento NY" }
    ]
  },

  // ✅ FILTROS ULTRA-RIGOROSOS PARA BINARY OPTIONS
  FILTROS_BINARY: {
    SCORE_MINIMO_ENTRADA: 88,           // Só entrar com 88%+ (CRÍTICO)
    CONFLUENCIA_MINIMA: 7,              // 7+ indicadores em consenso
    VOLUME_MINIMO_MULTIPLICADOR: 2.5,   // Volume 2.5x maior que média
    VOLATILIDADE_MINIMA: 0.0015,        // 0.15% movimento mínimo esperado
    VOLATILIDADE_MAXIMA: 0.006,         // 0.6% movimento máximo (evita gaps)
    
    // Filtros de Momentum
    RSI_ZONA_NEUTRA_MIN: 25,           // Evitar zona neutra RSI
    RSI_ZONA_NEUTRA_MAX: 75,
    MACD_HISTOGRAMA_MIN: 0.0001,       // MACD deve ter momentum claro
    
    // Filtros de Tendência  
    EMA_ALINHAMENTO_MIN: 3,            // Mín 3 EMAs alinhadas
    SUPERTREND_CONFIRMACAO: true,       // SuperTrend deve confirmar
    
    // Filtros de Volume e Liquidez
    SPREAD_MAXIMO: 0.0005,             // Spread máximo 0.05%
    ORDER_BOOK_IMBALANCE_MIN: 0.6,     // 60% desbalanceamento order book
    
    // Filtros Smart Money
    SMART_MONEY_SCORE_MIN: 75,         // Smart Money deve confirmar
    INSTITUTIONAL_FLOW_MIN: 500000,     // $500k fluxo institucional
    
    // Filtros de Timing
    TEMPO_RESTANTE_MIN: 45,            // Min 45seg para expiração
    CONFIRMACAO_MULTIPLA: true          // Deve ter confirmação de múltiplas fontes
  },

  // ✅ ESTRATÉGIAS ESPECÍFICAS POR EXPIRAÇÃO
  ESTRATEGIAS_EXPIRACAO: {
    "1min": {
      nome: "SCALPING_ULTRA",
      indicadores_principais: ["VOLUME_SPIKE", "ORDER_FLOW", "SQUEEZE_MOMENTUM"],
      score_minimo: 92,                 // Muito rigoroso para 1min
      confluencia_minima: 8,
      filtros_extras: ["NO_NEWS", "HIGH_LIQUIDITY"]
    },
    
    "5min": {
      nome: "MOMENTUM_PREMIUM",         // ESTRATÉGIA PRINCIPAL
      indicadores_principais: ["SMART_MONEY", "CVD", "SUPERTREND", "WAVE_TREND"],
      score_minimo: 88,
      confluencia_minima: 7,
      filtros_extras: ["TREND_CONFIRMATION", "VOLUME_CONFIRMATION"]
    },
    
    "15min": {
      nome: "TREND_FOLLOWING",
      indicadores_principais: ["EMA_ALIGNMENT", "MACD", "RSI_DIVERGENCE"],
      score_minimo: 85,
      confluencia_minima: 6,
      filtros_extras: ["STRONG_TREND", "FAIR_VALUE_GAP"]
    }
  },

  // ✅ PESOS ESPECÍFICOS PARA BINARY OPTIONS
  PESOS_BINARY: {
    // ULTRA IMPORTANTES para Binary (peso máximo)
    TIMING_PRECISION: 3.5,             // Precisão de timing
    VOLUME_SPIKE: 3.2,                 // Spike de volume
    ORDER_FLOW_IMBALANCE: 3.0,         // Desbalanceamento order flow
    SMART_MONEY_ENTRY: 2.9,            // Entrada Smart Money
    
    // MUITO IMPORTANTES (peso alto)
    SQUEEZE_MOMENTUM: 2.7,             // Squeeze momentum
    CVD_DIVERGENCE: 2.6,               // Divergência CVD
    WAVE_TREND_SIGNAL: 2.5,            // Sinal Wave Trend
    SUPERTREND_DIRECTION: 2.4,         // Direção SuperTrend
    
    // IMPORTANTES (peso médio-alto)
    MACD_MOMENTUM: 2.2,                // Momentum MACD
    RSI_EXTREMES: 2.1,                 // RSI em extremos
    EMA_CONFLUENCE: 2.0,               // Confluência EMAs
    VWAP_DEVIATION: 1.9,               // Desvio VWAP
    
    // CONFIRMAÇÃO (peso médio)
    STOCH_CONFIRMATION: 1.6,           // Confirmação Stochastic
    WILLIAMS_CONFIRMATION: 1.4,        // Confirmação Williams
    VOLUME_CONFIRMATION: 1.8,          // Confirmação volume
    
    // FILTROS E PENALIDADES
    LOW_VOLUME_PENALTY: -3.0,          // Penalidade volume baixo
    SIDEWAYS_MARKET_PENALTY: -2.5,     // Penalidade mercado lateral
    NEWS_EVENT_PENALTY: -2.0,          // Penalidade eventos de notícias
    HIGH_SPREAD_PENALTY: -1.5,         // Penalidade spread alto
    
    // MULTIPLICADORES DE SESSÃO
    LONDON_NY_OVERLAP: 1.4,            // Multiplicador overlap
    HIGH_LIQUIDITY_SESSION: 1.3,       // Sessão alta liquidez
    PERFECT_TIMING: 1.2                 // Timing perfeito
  }
};

// ✅ FUNÇÃO DE ANÁLISE ESPECÍFICA PARA BINARY OPTIONS
function analisarSinalBinaryOptions(dados, fundingRate, openInterest, orderBook, expiracao = "5min") {
  try {
    const estrategia = CONFIG_BINARY_OPTIONS.ESTRATEGIAS_EXPIRACAO[expiracao];
    const agora = new Date();
    const hora = agora.getHours();
    const minuto = agora.getMinutes();
    const segundo = agora.getSeconds();
    
    // ✅ VERIFICAR HORÁRIO IDEAL
    const horarioIdeal = verificarHorarioIdeal(hora, minuto);
    if (!horarioIdeal.permitido) {
      return {
        sinal: "ESPERAR",
        score: 0,
        motivo: `Horário não ideal: ${horarioIdeal.motivo}`,
        proximoHorario: horarioIdeal.proximo
      };
    }
    
    // ✅ VERIFICAR TIMING DE ENTRADA
    const tempoRestante = 60 - segundo; // Segundos até próximo minuto
    if (tempoRestante < CONFIG_BINARY_OPTIONS.FILTROS_BINARY.TEMPO_RESTANTE_MIN) {
      return {
        sinal: "AGUARDAR",
        score: 0,
        motivo: `Aguardar próximo ciclo (${tempoRestante}s restantes)`,
        tempoEspera: 60 - tempoRestante
      };
    }
    
    // ✅ EXTRAIR DADOS
    const closes = dados.map(d => d.close);
    const highs = dados.map(d => d.high);
    const lows = dados.map(d => d.low);
    const volumes = dados.map(d => d.volume);
    const precoAtual = closes[closes.length - 1];
    
    // ✅ CALCULAR INDICADORES PREMIUM
    const indicadores = calcularIndicadoresPremium(dados);
    
    // ✅ ANÁLISE DE VOLUME (CRÍTICO PARA BINARY)
    const volumeAnalise = analisarVolumeParaBinary(volumes, dados);
    if (!volumeAnalise.adequado) {
      return {
        sinal: "ESPERAR",
        score: 0,
        motivo: `Volume inadequado: ${volumeAnalise.motivo}`,
        volumeAtual: volumeAnalise.volumeAtual,
        volumeNecessario: volumeAnalise.volumeNecessario
      };
    }
    
    // ✅ ANÁLISE SMART MONEY
    const smartMoney = analisarSmartMoneyBinary(dados, orderBook);
    
    // ✅ ANÁLISE DE MOMENTUM
    const momentum = analisarMomentumBinary(indicadores, dados);
    
    // ✅ SISTEMA DE SCORE ULTRA-RIGOROSO
    let score = 50; // Base neutra
    let confirmacoes = [];
    let alertas = [];
    
    // 1. SMART MONEY ANALYSIS (35% do score)
    if (smartMoney.fluxoInstitucional > CONFIG_BINARY_OPTIONS.FILTROS_BINARY.INSTITUTIONAL_FLOW_MIN) {
      score += 15 * CONFIG_BINARY_OPTIONS.PESOS_BINARY.SMART_MONEY_ENTRY;
      confirmacoes.push("💰 Fluxo Institucional ALTO");
    }
    
    if (smartMoney.orderBookImbalance > CONFIG_BINARY_OPTIONS.FILTROS_BINARY.ORDER_BOOK_IMBALANCE_MIN) {
      score += 12 * CONFIG_BINARY_OPTIONS.PESOS_BINARY.ORDER_FLOW_IMBALANCE;
      confirmacoes.push("📊 Order Book Desbalanceado");
    }
    
    if (smartMoney.fairValueGap.gap) {
      score += 10 * CONFIG_BINARY_OPTIONS.PESOS_BINARY.SMART_MONEY_ENTRY;
      confirmacoes.push(`⚡ Fair Value Gap ${smartMoney.fairValueGap.direcao}`);
    }
    
    // 2. MOMENTUM ANALYSIS (30% do score)
    if (momentum.squeeze.ativo && momentum.squeeze.momentum > 0.001) {
      score += 14 * CONFIG_BINARY_OPTIONS.PESOS_BINARY.SQUEEZE_MOMENTUM;
      confirmacoes.push("🚀 Squeeze Momentum ATIVO");
    }
    
    if (Math.abs(momentum.waveTrend.wt1) > 50) {
      const direcao = momentum.waveTrend.wt1 > 0 ? "CALL" : "PUT";
      score += 12 * CONFIG_BINARY_OPTIONS.PESOS_BINARY.WAVE_TREND_SIGNAL;
      confirmacoes.push(`📈 Wave Trend: ${direcao}`);
    }
    
    if (momentum.cvd.divergencia) {
      score += 10 * CONFIG_BINARY_OPTIONS.PESOS_BINARY.CVD_DIVERGENCE;
      confirmacoes.push("🔄 CVD Divergência");
    }
    
    // 3. TREND ANALYSIS (20% do score)
    const trendScore = analisarTendenciaBinary(indicadores);
    score += trendScore.score;
    confirmacoes.push(...trendScore.confirmacoes);
    
    // 4. VOLUME CONFIRMATION (15% do score)
    if (volumeAnalise.spike > 3.0) {
      score += 8 * CONFIG_BINARY_OPTIONS.PESOS_BINARY.VOLUME_SPIKE;
      confirmacoes.push(`📈 Volume Spike: ${volumeAnalise.spike.toFixed(1)}x`);
    }
    
    // ✅ APLICAR FILTROS ULTRA-RIGOROSOS
    const filtros = aplicarFiltrosBinary(indicadores, dados, orderBook);
    score += filtros.scoreAjuste;
    alertas.push(...filtros.alertas);
    
    // ✅ MULTIPLICADORES DE SESSÃO
    const multiplicadorSessao = obterMultiplicadorSessao(hora);
    score *= multiplicadorSessao.multiplicador;
    if (multiplicadorSessao.multiplicador > 1) {
      confirmacoes.push(`⏰ ${multiplicadorSessao.nome}`);
    }
    
    // ✅ VERIFICAR CONFLUÊNCIA MÍNIMA
    if (confirmacoes.length < estrategia.confluencia_minima) {
      return {
        sinal: "ESPERAR",
        score: Math.round(score),
        motivo: `Confluência insuficiente: ${confirmacoes.length}/${estrategia.confluencia_minima}`,
        confirmacoes,
        alertas,
        precisaConfirmacoes: estrategia.confluencia_minima - confirmacoes.length
      };
    }
    
    // ✅ VERIFICAR SCORE MÍNIMO
    const scoreFinal = Math.min(100, Math.max(0, Math.round(score)));
    if (scoreFinal < estrategia.score_minimo) {
      return {
        sinal: "ESPERAR",
        score: scoreFinal,
        motivo: `Score insuficiente: ${scoreFinal}% < ${estrategia.score_minimo}%`,
        confirmacoes,
        alertas,
        scoreNecessario: estrategia.score_minimo
      };
    }
    
    // ✅ DETERMINAR DIREÇÃO DO SINAL
    let direcaoCall = 0;
    let direcaoPut = 0;
    
    // Análise direcional baseada nos indicadores principais
    if (smartMoney.fluxoInstitucional > 0) direcaoCall++;
    else direcaoPut++;
    
    if (momentum.waveTrend.wt1 < -50) direcaoCall++;
    else if (momentum.waveTrend.wt1 > 50) direcaoPut++;
    
    if (indicadores.rsi < 30) direcaoCall++;
    else if (indicadores.rsi > 70) direcaoPut++;
    
    if (indicadores.superTrend.direcao === 1) direcaoCall++;
    else if (indicadores.superTrend.direcao === -1) direcaoPut++;
    
    if (indicadores.macd.histograma > 0) direcaoCall++;
    else direcaoPut++;
    
    // Determinar sinal final
    let sinalFinal;
    if (direcaoCall > direcaoPut) {
      sinalFinal = "CALL";
    } else if (direcaoPut > direcaoCall) {
      sinalFinal = "PUT";
    } else {
      sinalFinal = "ESPERAR"; // Empate = não entrar
    }
    
    // ✅ CALCULAR PROBABILIDADE DE SUCESSO
    const probabilidade = calcularProbabilidadeBinary(scoreFinal, confirmacoes.length, estrategia);
    
    // ✅ INFORMAÇÕES DE ENTRADA
    const infoEntrada = {
      preco: precoAtual,
      expiracao: expiracao,
      horario: agora.toLocaleTimeString("pt-BR"),
      volume: volumeAnalise.volumeAtual.toFixed(0),
      spread: orderBook.spread.toFixed(6),
      probabilidade: probabilidade.toFixed(1)
    };
    
    return {
      sinal: sinalFinal,
      score: scoreFinal,
      probabilidade: probabilidade,
      confirmacoes,
      alertas,
      infoEntrada,
      estrategia: estrategia.nome,
      detalhes: {
        smartMoney,
        momentum,
        volumeAnalise,
        indicadores: {
          rsi: indicadores.rsi.toFixed(1),
          macd: indicadores.macd.histograma.toFixed(4),
          superTrend: indicadores.superTrend.direcao === 1 ? "BULL" : "BEAR"
        }
      }
    };
    
  } catch (e) {
    console.error("Erro na análise Binary Options:", e);
    return {
      sinal: "ERRO",
      score: 0,
      motivo: `Erro técnico: ${e.message}`,
      erro: e
    };
  }
}

// ✅ FUNÇÃO PARA VERIFICAR HORÁRIO IDEAL
function verificarHorarioIdeal(hora, minuto) {
  const horarios = CONFIG_BINARY_OPTIONS.HORARIOS_IDEAIS;
  
  // Verificar horários perigosos
  for (const perigoso of horarios.HORARIOS_PERIGOSOS) {
    const [inicioH, inicioM] = perigoso.inicio.split(':').map(Number);
    const [fimH, fimM] = perigoso.fim.split(':').map(Number);
    
    if ((hora > inicioH || (hora === inicioH && minuto >= inicioM)) &&
        (hora < fimH || (hora === fimH && minuto <= fimM))) {
      return {
        permitido: false,
        motivo: perigoso.motivo,
        proximo: perigoso.fim
      };
    }
  }
  
  // Verificar horários ideais
  if ((hora >= 8 && hora <= 10) || (hora >= 13 && hora <= 16) || (hora >= 14 && hora <= 16)) {
    return { permitido: true, ideal: true };
  }
  
  return { permitido: true, ideal: false };
}

// ✅ FUNÇÃO PARA ANALISAR VOLUME ESPECÍFICO PARA BINARY
function analisarVolumeParaBinary(volumes, dados) {
  const volumeAtual = volumes[volumes.length - 1];
  const volumeMedia = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const volumeSpike = volumeAtual / volumeMedia;
  
  const adequado = volumeSpike >= CONFIG_BINARY_OPTIONS.FILTROS_BINARY.VOLUME_MINIMO_MULTIPLICADOR;
  
  return {
    adequado,
    volumeAtual,
    volumeMedia,
    spike: volumeSpike,
    motivo: adequado ? "Volume adequado" : `Volume baixo: ${volumeSpike.toFixed(1)}x (necessário: ${CONFIG_BINARY_OPTIONS.FILTROS_BINARY.VOLUME_MINIMO_MULTIPLICADOR}x)`,
    volumeNecessario: volumeMedia * CONFIG_BINARY_OPTIONS.FILTROS_BINARY.VOLUME_MINIMO_MULTIPLICADOR
  };
}

// ✅ FUNÇÃO PRINCIPAL ADAPTADA PARA BINARY OPTIONS
async function analisarMercadoBinaryOptions(expiracao = "5min") {
  if (state.leituraEmAndamento || !state.marketOpen) return;
  state.leituraEmAndamento = true;
  
  try {
    console.log(`🎯 Análise Binary Options (${expiracao})...`);
    
    // Obter dados reais
    const [dados, fundingRate, openInterest, orderBook] = await Promise.all([
      obterDadosCrypto100Real(),
      obterFundingRateReal(),
      obterOpenInterestReal(),
      obterOrderBookReal()
    ]);
    
    // Análise específica para Binary Options
    const resultado = analisarSinalBinaryOptions(dados, fundingRate, openInterest, orderBook, expiracao);
    
    // Atualizar interface com informações específicas para Binary
    atualizarInterfaceBinary(resultado);
    
    // Log específico para Binary Options
    console.log("🎯 Resultado Binary Options:", {
      sinal: resultado.sinal,
      score: resultado.score,
      probabilidade: resultado.probabilidade,
      confirmacoes: resultado.confirmacoes?.length || 0,
      expiracao: expiracao
    });
    
    state.ultimoSinal = resultado.sinal;
    state.ultimoScore = resultado.score;
    state.ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR");
    
    state.tentativasErro = 0;
    
  } catch (e) {
    console.error("❌ Erro análise Binary:", e);
    state.tentativasErro++;
  } finally {
    state.leituraEmAndamento = false;
  }
}

// ✅ INTERFACE ESPECÍFICA PARA BINARY OPTIONS
function atualizarInterfaceBinary(resultado) {
  // Atualizar comando principal
  const comandoElement = document.getElementById("comando");
  if (comandoElement) {
    let emoji = "";
    let classe = resultado.sinal.toLowerCase();
    
    if (resultado.score >= 92) {
      emoji = resultado.sinal === "CALL" ? " 🚀💎" : resultado.sinal === "PUT" ? " ⚡💎" : " ⏳";
      classe += " ultra-alto";
    } else if (resultado.score >= 88) {
      emoji = resultado.sinal === "CALL" ? " 🚀" : resultado.sinal === "PUT" ? " ⚡" : " ⏳";
      classe += " muito-alto";
    } else if (resultado.score >= 85) {
      emoji = resultado.sinal === "CALL" ? " 📈" : resultado.sinal === "PUT" ? " 📉" : " ✋";
      classe += " alto";
    } else {
      emoji = " ⚠️";
      classe += " baixo";
    }
    
    comandoElement.textContent = resultado.sinal + emoji;
    comandoElement.className = classe;
  }
  
  // Atualizar score com probabilidade
  const scoreElement = document.getElementById("score");
  if (scoreElement) {
    const texto = resultado.probabilidade ? 
      `Score: ${resultado.score}% | Prob: ${resultado.probabilidade}%` : 
      `Score: ${resultado.score}%`;
    scoreElement.textContent = texto;
    
    if (resultado.score >= 92) {
      scoreElement.style.color = '#00ff00';
      scoreElement.style.fontWeight = 'bold';
      scoreElement.style.textShadow = '0 0 10px #00ff00';
    } else if (resultado.score >= 88) {
      scoreElement.style.color = '#7fff00';
      scoreElement.style.fontWeight = 'bold';
    } else if (resultado.score >= 85) {
      scoreElement.style.color = '#ffff00';
    } else {
      scoreElement.style.color = '#ff8c00';
    }
  }
  
  // Adicionar informações específicas de Binary Options
  const infoBinaryElement = document.getElementById("info-binary") || criarElementoInfoBinary();
  if (infoBinaryElement && resultado.infoEntrada) {
    infoBinaryElement.innerHTML = `
      <div style="background: #1a1a1a; padding: 10px; border-radius: 5px; margin: 10px 0;">
        <h4>📊 Info Binary Options:</h4>
        <p>💰 Preço: $${resultado.infoEntrada.preco}</p>
        <p>⏰ Expiração: ${resultado.infoEntrada.expiracao}</p>
        <p>📈 Volume: ${resultado.infoEntrada.volume}</p>
        <p>📊 Spread: ${resultado.infoEntrada.spread}</p>
        <p>🎯 Estratégia: ${resultado.estrategia}</p>
        ${resultado.motivo ? `<p>⚠️ ${resultado.motivo}</p>` : ''}
      </div>
    `;
  }
  
  // Mostrar confirmações
  const confirmacoesElement = document.getElementById("confirmacoes") || criarElementoConfirmacoes();
  if (confirmacoesElement && resultado.confirmacoes) {
    confirmacoesElement.innerHTML = `
      <div style="background: #0a2a0a; padding: 10px; border-radius: 5px; margin: 10px 0;">
        <h4>✅ Confirmações (${resultado.confirmacoes.length}):</h4>
        ${resultado.confirmacoes.map(conf => `<p style="color: #00ff00;">• ${conf}</p>`).join('')}
      </div>
    `;
  }
}

function criarElementoInfoBinary() {
  const elemento = document.createElement('div');
  elemento.id = 'info-binary';
  document.body.appendChild(elemento);
  return elemento;
}

function criarElementoConfirmacoes() {
  const elemento = document.createElement('div');
  elemento.id = 'confirmacoes';
  document.body.appendChild(elemento);
  return elemento;
}

// ✅ INICIALIZAÇÃO ESPECÍFICA PARA BINARY OPTIONS
function iniciarSistemaBinaryOptions(expiracao = "5min") {
  console.log("🎯 Iniciando Sistema Binary Options PREMIUM...");
  
  // Conectar WebSocket
  conectarWebSocketReal();
  
  // Análise inicial
  analisarMercadoBinaryOptions(expiracao);
  
  // Timer específico para Binary (mais frequente)
  setInterval(() => {
    if (!state.leituraEmAndamento) {
      analisarMercadoBinaryOptions(expiracao);
    }
  }, 30000); // A cada 30 segundos
  
  console.log(`✅ Sistema Binary Options iniciado (${expiracao})!`);
  console.log("🎯 Meta: 85-90% de assertividade");
  console.log("💎 Sinais apenas com alta confluência");
}

// Auto-inicialização para Binary Options
if (document.readyState === "complete") {
  iniciarSistemaBinaryOptions("5min"); // Expiração padrão 5min
} else {
  document.addEventListener("DOMContentLoaded", () => iniciarSistemaBinaryOptions("5min"));
}
