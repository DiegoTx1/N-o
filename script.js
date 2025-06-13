// =============================================
// CONFIGURAÇÕES GLOBAIS
// =============================================
let win = 0, loss = 0;
let ultimos = [];
let timer = 300; // Timer regressivo de 5 minutos (formato 4:59)
let dadosEmTempoReal = {
  rsi: 0,
  adx: 0,
  macdHistograma: 0,
  sma9: 0,
  ema21: 0,
  ema50: 0,
  fractal: "",
  precoAtual: 0
};

// =============================================
// FUNÇÕES PRINCIPAIS
// =============================================

function atualizarHora() {
  const agora = new Date();
  document.getElementById("hora").textContent = agora.toLocaleTimeString("pt-BR");
}

function registrar(tipo) {
  if (tipo === 'WIN') win++;
  else loss++;
  document.getElementById("historico").textContent = `${win} WIN / ${loss} LOSS`;
}

function formatarTimer(segundos) {
  const minutos = Math.floor(segundos / 60);
  const segundosRestantes = segundos % 60;
  return `${minutos}:${segundosRestantes.toString().padStart(2, '0')}`;
}

// =============================================
// ATUALIZAÇÃO EM TEMPO REAL
// =============================================

function atualizarInterfaceEmTempoReal() {
  document.getElementById("criterios").innerHTML = `
    <li>RSI: ${dadosEmTempoReal.rsi.toFixed(2)} ${dadosEmTempoReal.rsi < 30 ? "↓" : dadosEmTempoReal.rsi > 70 ? "↑" : "-"}</li>
    <li>ADX: ${dadosEmTempoReal.adx.toFixed(2)} ${dadosEmTempoReal.adx > 25 ? "✅ Tendência Forte" : "✖️ Tendência Fraca"}</li>
    <li>MACD: ${dadosEmTempoReal.macdHistograma.toFixed(4)}</li>
    <li>Médias: ${dadosEmTempoReal.sma9.toFixed(2)} > ${dadosEmTempoReal.ema21.toFixed(2)} > ${dadosEmTempoReal.ema50.toFixed(2)}</li>
    <li>Fractal: ${dadosEmTempoReal.fractal || "Nenhum"}</li>
    <li>Preço Atual: ${dadosEmTempoReal.precoAtual.toFixed(2)}</li>
  `;
}

// =============================================
// ANÁLISE TÉCNICA
// =============================================

async function buscarDadosBinance() {
  const response = await fetch("https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=5m&limit=100");
  const dados = await response.json();
  return {
    closes: dados.map(v => parseFloat(v[4])),
    highs: dados.map(v => parseFloat(v[2])),
    lows: dados.map(v => parseFloat(v[3])),
    precoAtual: parseFloat(dados[dados.length - 1][4])
  };
}

async function atualizarIndicadores() {
  try {
    const { closes, highs, lows, precoAtual } = await buscarDadosBinance();
    
    dadosEmTempoReal = {
      rsi: calcularRSI(closes, 14),
      adx: calcularADX(highs, lows, closes, 14),
      macdHistograma: calcularMACD(closes, 12, 26, 9).histograma,
      sma9: calcularSMA(closes, 9),
      ema21: calcularEMA(closes, 21),
      ema50: calcularEMA(closes, 50),
      fractal: detectarFractais(highs, lows, 5).ultimo,
      precoAtual
    };

    atualizarInterfaceEmTempoReal();
    return dadosEmTempoReal;

  } catch (e) {
    console.error("Erro ao atualizar indicadores:", e);
  }
}

async function leituraReal() {
  const indicadores = await atualizarIndicadores();
  
  let comando = "ESPERAR";
  if (
    indicadores.rsi < 30 && 
    indicadores.sma9 > indicadores.ema21 && 
    indicadores.ema21 > indicadores.ema50 && 
    indicadores.macdHistograma > 0 && 
    indicadores.fractal === "FUNDO" &&
    indicadores.adx > 25
  ) {
    comando = "CALL";
  } 
  else if (
    indicadores.rsi > 70 && 
    indicadores.sma9 < indicadores.ema21 && 
    indicadores.ema21 < indicadores.ema50 && 
    indicadores.macdHistograma < 0 && 
    indicadores.fractal === "TOPO" &&
    indicadores.adx > 25
  ) {
    comando = "PUT";
  }

  document.getElementById("comando").textContent = comando;
  document.getElementById("score").textContent = `RSI: ${indicadores.rsi.toFixed(2)} | ADX: ${indicadores.adx.toFixed(2)}`;

  const horario = new Date().toLocaleTimeString("pt-BR");
  ultimos.unshift(`${horario} - ${comando} (RSI: ${indicadores.rsi.toFixed(2)})`);
  if (ultimos.length > 5) ultimos.pop();
  document.getElementById("ultimos").innerHTML = ultimos.map(i => `<li>${i}</li>`).join("");

  if (comando === "CALL") document.getElementById("som-call").play();
  if (comando === "PUT") document.getElementById("som-put").play();
}

// =============================================
// FUNÇÕES DE INDICADORES (MANTIDAS)
// =============================================

function calcularRSI(closes, periodo) {
  let ganhos = 0, perdas = 0;
  for (let i = 1; i <= periodo; i++) {
    const diff = closes[i] - closes[i-1];
    if (diff > 0) ganhos += diff;
    else perdas += Math.abs(diff);
  }
  const rs = ganhos / perdas;
  return 100 - (100 / (1 + rs));
}

function calcularMACD(closes, rapida, lenta, sinal) {
  const ema12 = calcularEMA(closes, rapida);
  const ema26 = calcularEMA(closes, lenta);
  const macdLine = ema12 - ema26;
  const signalLine = calcularEMA(closes.map((_, i) => i >= 25 ? macdLine : 0), sinal);
  return { 
    histograma: macdLine - signalLine,
    macdLine,
    signalLine
  };
}

function calcularSMA(dados, periodo) {
  const slice = dados.slice(-periodo);
  return slice.reduce((a, b) => a + b, 0) / periodo;
}

function calcularEMA(dados, periodo) {
  const k = 2 / (periodo + 1);
  let ema = dados[0];
  for (let i = 1; i < dados.length; i++) {
    ema = dados[i] * k + ema * (1 - k);
  }
  return ema;
}

function detectarFractais(highs, lows, periodo) {
  const fractais = [];
  for (let i = periodo; i < highs.length - periodo; i++) {
    if (highs[i] === Math.max(...highs.slice(i - periodo, i + periodo + 1))) {
      fractais.push({ index: i, tipo: "TOPO" });
    } else if (lows[i] === Math.min(...lows.slice(i - periodo, i + periodo + 1))) {
      fractais.push({ index: i, tipo: "FUNDO" });
    }
  }
  return { 
    todos: fractais, 
    ultimo: fractais[fractais.length - 1]?.tipo 
  };
}

function calcularADX(highs, lows, closes, periodo) {
  // Versão simplificada (para versão profissional, use technicalindicators)
  const variacao = Math.abs(closes[closes.length - 1] - closes[closes.length - periodo]);
  const mediaVariacao = variacao / periodo;
  return Math.min(mediaVariacao * 10, 60);
}

// =============================================
// TIMER E INICIALIZAÇÃO
// =============================================

// Atualiza indicadores a cada 15 segundos (para não sobrecarregar a API)
setInterval(atualizarIndicadores, 15000);

// Timer principal (5 minutos)
setInterval(() => {
  timer--;
  document.getElementById("timer").textContent = formatarTimer(timer);
  if (timer <= 0) {
    leituraReal();
    timer = 300;
  }
}, 1000);

// Inicialização
atualizarHora();
atualizarIndicadores(); // Primeira atualização
leituraReal(); // Primeira análise
