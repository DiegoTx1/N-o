let win = 0, loss = 0, timer = 60;
let ultimos = [];

function atualizarHora() {
  const agora = new Date();
  document.getElementById("hora").textContent = agora.toLocaleTimeString("pt-BR");
}

function registrar(tipo) {
  if (tipo === 'WIN') win++;
  else loss++;
  document.getElementById("historico").textContent = `${win} WIN / ${loss} LOSS`;
}

async function leituraReal() {
  try {
    const r = await fetch("https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=5m&limit=100");
    const dados = await r.json();
    const closes = dados.map(v => parseFloat(v[4]));
    const highs = dados.map(v => parseFloat(v[2]));
    const lows = dados.map(v => parseFloat(v[3]));

    // Novos indicadores (Stockity)
    const rsi = calcularRSI(closes, 14);
    const macd = calcularMACD(closes, 12, 26, 9);
    const sma9 = calcularSMA(closes, 9);
    const ema21 = calcularEMA(closes, 21);
    const ema50 = calcularEMA(closes, 50);
    const adx = 30; // Placeholder (substitua por cálculo real)
    const fractals = detectarFractais(highs, lows, 5);

    // Lógica Stockity
    let comando = "ESPERAR";
    if (rsi < 30 && sma9 > ema21 && ema21 > ema50 && macd.histograma > 0 && adx > 25 && fractals.ultimo === "FUNDO") {
      comando = "CALL";
    } 
    else if (rsi > 70 && sma9 < ema21 && ema21 < ema50 && macd.histograma < 0 && adx > 25 && fractals.ultimo === "TOPO") {
      comando = "PUT";
    }

    // Interface (original)
    document.getElementById("comando").textContent = comando;
    document.getElementById("score").textContent = `RSI: ${rsi.toFixed(2)} | ADX: ${adx}`;

    const criterios = [
      `RSI: ${rsi.toFixed(2)} ${rsi < 30 ? "↓" : rsi > 70 ? "↑" : "-"}`,
      `MACD: ${macd.histograma.toFixed(4)}`,
      `Médias: ${sma9.toFixed(2)} > ${ema21.toFixed(2)} > ${ema50.toFixed(2)}`,
      `Fractal: ${fractals.ultimo || "Nenhum"}`
    ];

    document.getElementById("criterios").innerHTML = criterios.map(c => `<li>${c}</li>`).join("");

    const horario = new Date().toLocaleTimeString("pt-BR");
    ultimos.unshift(`${horario} - ${comando} (RSI: ${rsi.toFixed(2)})`);
    if (ultimos.length > 5) ultimos.pop();
    document.getElementById("ultimos").innerHTML = ultimos.map(i => `<li>${i}</li>`).join("");

    if (comando === "CALL") document.getElementById("som-call").play();
    if (comando === "PUT") document.getElementById("som-put").play();

  } catch (e) {
    console.error("Erro na leitura:", e);
  }
}

// Funções auxiliares (novas)
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
  return { histograma: macdLine - signalLine };
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
  return { ultimo: fractais[fractais.length - 1]?.tipo };
}

// Timer (original)
setInterval(() => {
  timer--;
  document.getElementById("timer").textContent = timer;
  if (timer === 5) {
    leituraReal();
  }
  if (timer <= 0) {
    timer = 60;
  }
}, 1000);

setInterval(atualizarHora, 1000);
