// =============================================
// CONFIGURAÇÕES GLOBAIS
// =============================================
let win = 0, loss = 0;
let ultimos = [];
let timer = 300; // Timer regressivo de 5 minutos (formato 4:59)

// =============================================
// FUNÇÕES PRINCIPAIS
// =============================================

// Atualiza relógio na interface
function atualizarHora() {
  const agora = new Date();
  document.getElementById("hora").textContent = agora.toLocaleTimeString("pt-BR");
}

// Registra WIN/LOSS
function registrar(tipo) {
  if (tipo === 'WIN') win++;
  else loss++;
  document.getElementById("historico").textContent = `${win} WIN / ${loss} LOSS`;
}

// Formata timer para "4:59"
function formatarTimer(segundos) {
  const minutos = Math.floor(segundos / 60);
  const segundosRestantes = segundos % 60;
  return `${minutos}:${segundosRestantes.toString().padStart(2, '0')}`;
}

// =============================================
// ANÁLISE TÉCNICA (STOCKITY PRO)
// =============================================
async function leituraReal() {
  try {
    // Busca dados da Binance (velas de 5min)
    const response = await fetch("https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=5m&limit=100");
    const dados = await response.json();
    
    // Extrai dados das velas
    const closes = dados.map(v => parseFloat(v[4]));
    const highs = dados.map(v => parseFloat(v[2]));
    const lows = dados.map(v => parseFloat(v[3]));

    // Calcula indicadores
    const rsi = calcularRSI(closes, 14);
    const macd = calcularMACD(closes, 12, 26, 9);
    const sma9 = calcularSMA(closes, 9);
    const ema21 = calcularEMA(closes, 21);
    const ema50 = calcularEMA(closes, 50);
    const fractals = detectarFractais(highs, lows, 5);
    const adx = calcularADX(highs, lows, closes, 14);

    // Lógica de decisão (Stockity Pro)
    let comando = "ESPERAR";
    if (rsi < 30 && sma9 > ema21 && ema21 > ema50 && macd.histograma > 0 && fractals.ultimo === "FUNDO" && adx > 25) {
      comando = "CALL";
    } 
    else if (rsi > 70 && sma9 < ema21 && ema21 < ema50 && macd.histograma < 0 && fractals.ultimo === "TOPO" && adx > 25) {
      comando = "PUT";
    }

    // Atualiza interface
    atualizarInterface(comando, rsi, adx, macd, sma9, ema21, ema50, fractals);

  } catch (e) {
    console.error("Erro na leitura:", e);
  }
}

// Atualiza elementos da interface
function atualizarInterface(comando, rsi, adx, macd, sma9, ema21, ema50, fractals) {
  document.getElementById("comando").textContent = comando;
  document.getElementById("score").textContent = `RSI: ${rsi.toFixed(2)} | ADX: ${adx.toFixed(2)}`;

  // Critérios técnicos
  const criterios = [
    `RSI: ${rsi.toFixed(2)} ${rsi < 30 ? "↓" : rsi > 70 ? "↑" : "-"}`,
    `ADX: ${adx.toFixed(2)} ${adx > 25 ? "✅ Tendência Forte" : "✖️ Tendência Fraca"}`,
    `MACD: ${macd.histograma.toFixed(4)}`,
    `Médias: ${sma9.toFixed(2)} > ${ema21.toFixed(2)} > ${ema50.toFixed(2)}`,
    `Fractal: ${fractals.ultimo || "Nenhum"}`
  ];

  document.getElementById("criterios").innerHTML = criterios.map(c => `<li>${c}</li>`).join("");

  // Atualiza histórico
  const horario = new Date().toLocaleTimeString("pt-BR");
  ultimos.unshift(`${horario} - ${comando} (RSI: ${rsi.toFixed(2)})`);
  if (ultimos.length > 5) ultimos.pop();
  document.getElementById("ultimos").innerHTML = ultimos.map(i => `<li>${i}</li>`).join("");

  // Sons de alerta
  if (comando === "CALL") document.getElementById("som-call").play();
  if (comando === "PUT") document.getElementById("som-put").play();
}

// =============================================
// FUNÇÕES DE INDICADORES TÉCNICOS
// =============================================

// Calcula RSI (14 períodos)
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

// Calcula MACD (12, 26, 9)
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

// Calcula SMA (Média Móvel Simples)
function calcularSMA(dados, periodo) {
  const slice = dados.slice(-periodo);
  return slice.reduce((a, b) => a + b, 0) / periodo;
}

// Calcula EMA (Média Móvel Exponencial)
function calcularEMA(dados, periodo) {
  const k = 2 / (periodo + 1);
  let ema = dados[0];
  for (let i = 1; i < dados.length; i++) {
    ema = dados[i] * k + ema * (1 - k);
  }
  return ema;
}

// Detecta fractais (topos/fundos em 5 velas)
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

// Calcula ADX (14 períodos - versão simplificada)
function calcularADX(highs, lows, closes, periodo) {
  // Cálculo simplificado para exemplo (substitua por biblioteca técnica para precisão)
  const variacao = Math.abs(closes[closes.length - 1] - closes[closes.length - periodo]);
  const mediaVariacao = variacao / periodo;
  return Math.min(mediaVariacao * 10, 60); // Simula ADX entre 0-60
}

// =============================================
// TIMER E INICIALIZAÇÃO
// =============================================

// Timer regressivo (5 minutos)
setInterval(() => {
  timer--;
  document.getElementById("timer").textContent = formatarTimer(timer);
  if (timer <= 0) {
    leituraReal();
    timer = 300; // Reinicia para 5 minutos
  }
}, 1000);

// Atualiza relógio a cada 1 segundo
setInterval(atualizarHora, 1000);

// Inicializa
atualizarHora();
leituraReal(); // Primeira execução
