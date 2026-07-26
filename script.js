// ============================================================
//  CONFIG – SÓ MEXA AQUI SE SOUBER O QUE FAZ
// ============================================================
const CONFIG = {
    APP_ID: 1089,
    SYMBOL: 'R_75',               // ← Símbolo garantido (pode trocar para 'CRYPTOIDX', etc.)
    GRANULARITY: 300,             // 5 minutos (60=1min, 300=5min, 900=15min)
    EMA_PERIOD: 9,
    VWAP_PERIOD: 20,
    VOL_PERIOD: 20,
    LOOKBACK: 10,
    MIN_SCORE: 40,                // ← Reduzido para gerar sinais mais frequentes
    WS_URL: 'wss://ws.binaryws.com/websockets/v3?app_id=1089'
};

// ============================================================
//  STATE
// ============================================================
const state = {
    ws: null,
    candles: [],
    currentPrice: 0,
    timerInterval: null,
    timerSeconds: 300,
    connected: false,
    history: [],
    reconnectAttempts: 0,
    lastCandleEpoch: 0,
    signalCount: 0
};

// ============================================================
//  INDICADORES
// ============================================================
function calcEMA(closes, period) {
    if (closes.length < period) return null;
    const k = 2 / (period + 1);
    let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < closes.length; i++) {
        ema = closes[i] * k + ema * (1 - k);
    }
    return ema;
}

function calcVWAP(candles) {
    const slice = candles.slice(-CONFIG.VWAP_PERIOD);
    let sumTP = 0;
    slice.forEach(c => {
        const tp = (c.high + c.low + c.close) / 3;
        sumTP += tp;
    });
    return sumTP / slice.length;
}

function calcVolRel(candles) {
    const ranges = candles.map(c => c.high - c.low);
    const recent = ranges[ranges.length - 1] || 1;
    const avg = ranges.slice(-CONFIG.VOL_PERIOD - 1, -1).reduce((a, b) => a + b, 0) / CONFIG.VOL_PERIOD;
    return avg > 0 ? recent / avg : 1;
}

function calcForca(candle) {
    const corpo = Math.abs(candle.close - candle.open);
    const range = candle.high - candle.low;
    return range === 0 ? 0 : corpo / range;
}

function rompeMaxima(candles) {
    const slice = candles.slice(-CONFIG.LOOKBACK - 1, -1);
    const max = Math.max(...slice.map(c => c.high));
    return candles[candles.length - 1].close > max;
}

function rompeMinima(candles) {
    const slice = candles.slice(-CONFIG.LOOKBACK - 1, -1);
    const min = Math.min(...slice.map(c => c.low));
    return candles[candles.length - 1].close < min;
}

// ============================================================
//  GERADOR DE SINAL
// ============================================================
function gerarSinal(candles) {
    if (candles.length < CONFIG.LOOKBACK + 2) {
        return { sinal: 'ESPERAR', score: 0, ema: null, vwap: null, volRel: null, forca: null };
    }

    const vela = candles[candles.length - 1];
    const closes = candles.map(c => c.close);

    const ema = calcEMA(closes, CONFIG.EMA_PERIOD);
    const vwap = calcVWAP(candles);
    const volRel = calcVolRel(candles);
    const forca = calcForca(vela);

    let score = 0;

    if (volRel > 1.1) score += 20;
    else if (volRel > 1.0) score += 10;

    if (forca > 0.65) score += 20;
    else if (forca > 0.55) score += 10;

    const tendenciaAlta = vela.close > ema && vela.close > vwap;
    const tendenciaBaixa = vela.close < ema && vela.close < vwap;

    let sinal = 'ESPERAR';
    let finalScore = score;

    if (rompeMaxima(candles) && tendenciaAlta) {
        score += 60;
        finalScore = Math.min(score, 100);
        sinal = finalScore >= CONFIG.MIN_SCORE ? 'CALL' : 'ESPERAR';
    } else if (rompeMinima(candles) && tendenciaBaixa) {
        score += 60;
        finalScore = Math.min(score, 100);
        sinal = finalScore >= CONFIG.MIN_SCORE ? 'PUT' : 'ESPERAR';
    } else if (tendenciaAlta && forca > 0.7 && volRel > 1.2) {
        score += 40;
        finalScore = Math.min(score, 100);
        sinal = finalScore >= CONFIG.MIN_SCORE ? 'CALL' : 'ESPERAR';
    } else if (tendenciaBaixa && forca > 0.7 && volRel > 1.2) {
        score += 40;
        finalScore = Math.min(score, 100);
        sinal = finalScore >= CONFIG.MIN_SCORE ? 'PUT' : 'ESPERAR';
    }

    // Fallback: se score alto mas nenhuma condição especial
    if (sinal === 'ESPERAR' && finalScore >= CONFIG.MIN_SCORE) {
        if (tendenciaAlta) sinal = 'CALL';
        else if (tendenciaBaixa) sinal = 'PUT';
    }

    if (sinal !== 'ESPERAR') {
        state.signalCount++;
        console.log(`🔔 Sinal #${state.signalCount}: ${sinal} (${finalScore}%)`);
    }

    return { sinal, score: finalScore, ema, vwap, volRel, forca };
}

// ============================================================
//  WEBSOCKET
// ============================================================
function conectar() {
    setStatus('connecting', 'Conectando…');
    console.log('[WS] Tentando conectar...');

    state.ws = new WebSocket(CONFIG.WS_URL);

    state.ws.onopen = () => {
        state.connected = true;
        state.reconnectAttempts = 0;
        setStatus('connected', `Conectado · ${CONFIG.SYMBOL}`);
        console.log(`[WS] Conectado ao ${CONFIG.SYMBOL}`);

        state.ws.send(JSON.stringify({
            ticks_history: CONFIG.SYMBOL,
            adjust_start_time: 1,
            count: 60,
            end: 'latest',
            granularity: CONFIG.GRANULARITY,
            style: 'candles',
            subscribe: 1
        }));
        console.log('[WS] Solicitado histórico de candles');

        state.ws.send(JSON.stringify({
            ticks: CONFIG.SYMBOL,
            subscribe: 1
        }));
        console.log('[WS] Inscrito em ticks');
    };

    state.ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            handleMessage(data);
        } catch (e) {
            console.error('[WS] Erro ao parsear mensagem:', e);
        }
    };

    state.ws.onerror = (err) => {
        console.error('[WS] Erro:', err);
        setStatus('error', 'Erro de conexão');
    };

    state.ws.onclose = () => {
        state.connected = false;
        console.warn('[WS] Conexão fechada');
        setStatus('error', 'Desconectado');
        const delay = Math.min(3000 * (state.reconnectAttempts + 1), 15000);
        state.reconnectAttempts++;
        setTimeout(conectar, delay);
    };
}

function handleMessage(data) {
    if (data.error) {
        console.error('[API] Erro:', data.error);
        return;
    }

    if (data.msg_type === 'candles') {
        console.log(`[API] Recebidas ${data.candles.length} velas`);
        state.candles = data.candles.map(c => ({
            open: +c.open,
            high: +c.high,
            low: +c.low,
            close: +c.close,
            volume: 1,
            epoch: c.epoch
        }));
        if (state.candles.length > 0) {
            state.lastCandleEpoch = state.candles[state.candles.length - 1].epoch;
            processarSinal();
            iniciarTimer();
        }
    }

    if (data.msg_type === 'ohlc') {
        const c = data.ohlc;
        const candle = {
            open: +c.open,
            high: +c.high,
            low: +c.low,
            close: +c.close,
            volume: 1,
            epoch: +c.open_time
        };

        if (+c.open_time !== state.lastCandleEpoch) {
            state.lastCandleEpoch = +c.open_time;
            state.candles.push(candle);
            if (state.candles.length > 100) state.candles.shift();
            processarSinal();
            iniciarTimer();
        } else {
            state.candles[state.candles.length - 1] = candle;
        }
    }

    if (data.msg_type === 'tick') {
        state.currentPrice = +data.tick.quote;
        const el = document.getElementById('priceDisplay');
        if (el) el.textContent = state.currentPrice.toFixed(2);
    }
}

// ============================================================
//  PROCESSAR SINAL
// ============================================================
function processarSinal() {
    if (state.candles.length === 0) return;
    const r = gerarSinal(state.candles);
    const agora = new Date().toLocaleTimeString('pt-BR');

    atualizarInterface(r);

    state.history.unshift({ time: agora, sinal: r.sinal, score: r.score });
    if (state.history.length > 6) state.history.pop();
    renderHistorico();

    const el = document.getElementById('updateTime');
    if (el) el.textContent = agora;
}

function atualizarInterface(r) {
    const { sinal, score, ema, vwap, volRel, forca } = r;
    const cls = sinal.toLowerCase();

    const signalCard = document.getElementById('signalCard');
    if (signalCard) signalCard.className = `signal-card ${cls}`;

    const val = document.getElementById('signalValue');
    if (val) { val.textContent = sinal; val.className = `signal-value ${cls}`; }

    const arrow = document.getElementById('signalArrow');
    if (arrow) {
        arrow.textContent = sinal === 'CALL' ? '↑' : sinal === 'PUT' ? '↓' : '—';
        arrow.className = `signal-arrow ${cls}`;
    }

    const scoreText = document.getElementById('scoreText');
    if (scoreText) scoreText.textContent = `${score}%`;

    const bar = document.getElementById('scoreBar');
    if (bar) { bar.style.width = `${score}%`; bar.className = `score-bar-fill ${cls}`; }

    if (ema !== null) {
        const emaVal = document.getElementById('emaVal');
        if (emaVal) emaVal.textContent = ema.toFixed(2);
        const emaSub = document.getElementById('emaSub');
        if (emaSub && state.candles.length > 0)
            emaSub.textContent = state.candles[state.candles.length-1].close > ema ? '▲ acima' : '▼ abaixo';
    }

    if (vwap !== null) {
        const vwapVal = document.getElementById('vwapVal');
        if (vwapVal) vwapVal.textContent = vwap.toFixed(2);
        const vwapSub = document.getElementById('vwapSub');
        if (vwapSub && state.candles.length > 0)
            vwapSub.textContent = state.candles[state.candles.length-1].close > vwap ? '▲ acima' : '▼ abaixo';
    }

    if (volRel !== null) {
        const volVal = document.getElementById('volVal');
        if (volVal) volVal.textContent = volRel.toFixed(2) + 'x';
        const volSub = document.getElementById('volSub');
        if (volSub) volSub.textContent = volRel > 1.1 ? 'volume alto' : volRel > 1 ? 'volume ok' : 'volume baixo';
    }

    if (forca !== null) {
        const forcaVal = document.getElementById('forcaVal');
        if (forcaVal) forcaVal.textContent = (forca * 100).toFixed(0) + '%';
        const forcaSub = document.getElementById('forcaSub');
        if (forcaSub) forcaSub.textContent = forca > 0.65 ? 'vela forte' : forca > 0.45 ? 'vela média' : 'vela fraca';
    }
}

function renderHistorico() {
    const list = document.getElementById('historyList');
    if (!list || state.history.length === 0) return;
    list.innerHTML = state.history.map(h => `
        <div class="history-item">
            <span class="history-time">${h.time}</span>
            <span class="history-badge ${h.sinal.toLowerCase()}">${h.sinal}</span>
            <span class="history-score">${h.score}%</span>
        </div>
    `).join('');
}

// ============================================================
//  TIMER
// ============================================================
function iniciarTimer() {
    clearInterval(state.timerInterval);
    const agora = Math.floor(Date.now() / 1000);
    state.timerSeconds = CONFIG.GRANULARITY - (agora % CONFIG.GRANULARITY);

    const el = document.getElementById('timer');

    state.timerInterval = setInterval(() => {
        state.timerSeconds--;
        if (state.timerSeconds < 0) state.timerSeconds = CONFIG.GRANULARITY;

        if (el) {
            const min = Math.floor(state.timerSeconds / 60);
            const sec = state.timerSeconds % 60;
            el.textContent = `${min}:${String(sec).padStart(2, '0')}`;
            if (state.timerSeconds <= 10) el.classList.add('urgent');
            else el.classList.remove('urgent');
        }
    }, 1000);
}

// ============================================================
//  STATUS
// ============================================================
function setStatus(type, text) {
    const dot = document.getElementById('statusDot');
    const txt = document.getElementById('statusText');
    const live = document.getElementById('liveText');
    const liveDot = document.getElementById('liveDot');
    const errorMsg = document.getElementById('errorMsg');

    if (dot) dot.className = `status-dot ${type}`;
    if (txt) txt.textContent = text;

    if (type === 'connected') {
        if (live) live.textContent = 'AO VIVO';
        if (liveDot) liveDot.style.background = '#2ecc71';
        if (errorMsg) errorMsg.style.display = 'none';
    } else if (type === 'connecting') {
        if (live) live.textContent = 'CONECTANDO';
        if (liveDot) liveDot.style.background = '#f1c40f';
    } else {
        if (live) live.textContent = 'OFFLINE';
        if (liveDot) liveDot.style.background = '#e74c3c';
        if (errorMsg) errorMsg.style.display = 'block';
    }
}

// ============================================================
//  INICIAR
// ============================================================
console.log('🚀 Robô iniciado');
conectar();

// Fallback: se após 10s não houver candles, avisa
setTimeout(() => {
    if (state.candles.length === 0 && state.connected) {
        console.warn('⚠️ Nenhum candle recebido – verifique o símbolo');
        document.getElementById('errorMsg').style.display = 'block';
        document.getElementById('errorMsg').textContent = '⚠️ Sem dados – verifique se o símbolo está correto';
    }
}, 10000);
