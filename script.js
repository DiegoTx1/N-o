
'use strict';

// ============================================================
// ATLAS IA — MAGIC CANDLE + MAGIC MONEY + SUPORTE/RESISTÊNCIA
// JavaScript | Deriv WebSocket | M5
// Sinais: CALL / PUT / ESPERAR
// ============================================================

const CONFIG = {
    APP_ID: 1089,

    // ATENÇÃO:
    // R_50 é um símbolo da Deriv, não o Crypto IDX da Binomo.
    // Este código recebe dados da Deriv.
    // Troque somente por um símbolo válido na API utilizada.
    SYMBOL: 'R_50',

    GRANULARITY: 300,       // 5 minutos
    FAST_PERIOD: 3,
    SLOW_PERIOD: 7,
    TREND_PERIOD: 200,

    MAGIC_FAST: 1,
    MAGIC_SLOW: 34,
    MAGIC_SIGNAL: 4,

    SR_LOOKBACK: 10,
    MIN_SCORE: 60,
    HISTORY_LIMIT: 6,
    MAX_CANDLES: 500,

    WS_URL: 'wss://ws.derivws.com/websockets/v3?app_id=1089'
};

// ============================================================
// ESTADO
// ============================================================

const state = {
    ws: null,
    candles: [],
    currentPrice: null,
    timerInterval: null,
    reconnectTimer: null,
    timerSeconds: CONFIG.GRANULARITY,
    connected: false,
    history: [],
    reconnectAttempts: 0,
    lastCandleEpoch: 0,
    lastProcessedEpoch: 0,
    signalCount: 0,
    connectionGeneration: 0
};

// ============================================================
// UTILITÁRIOS
// ============================================================

function el(id) {
    return document.getElementById(id);
}

function setText(id, value) {
    const node = el(id);
    if (node) node.textContent = value;
}

function mean(values) {
    if (!values.length) return null;
    return values.reduce((sum, n) => sum + n, 0) / values.length;
}

function candleRange(c) {
    return Math.max(0, c.high - c.low);
}

function candleBody(c) {
    return Math.abs(c.close - c.open);
}

function isBullish(c) {
    return c.close > c.open;
}

function isBearish(c) {
    return c.close < c.open;
}

// ============================================================
// MÉDIAS MÓVEIS
// ============================================================

function smaAt(values, period, index) {
    if (index < period - 1) return null;

    const slice = values.slice(index - period + 1, index + 1);

    if (
        slice.length !== period ||
        slice.some(v => !Number.isFinite(v))
    ) {
        return null;
    }

    return mean(slice);
}

function wmaAt(values, period, index) {
    if (index < period - 1) return null;

    const slice = values.slice(index - period + 1, index + 1);

    if (
        slice.length !== period ||
        slice.some(v => !Number.isFinite(v))
    ) {
        return null;
    }

    let weightedSum = 0;
    let weightTotal = 0;

    for (let i = 0; i < period; i++) {
        const weight = i + 1;
        weightedSum += slice[i] * weight;
        weightTotal += weight;
    }

    return weightedSum / weightTotal;
}

// ============================================================
// MAGIC CANDLE
// SMA rápida - SMA lenta
// Cruzamento da diferença com sua WMA de sinal
// ============================================================

function calcularMagic(candles) {
    const closes = candles.map(c => c.close);
    const differential = [];

    for (let i = 0; i < closes.length; i++) {
        const fast = smaAt(closes, CONFIG.MAGIC_FAST, i);
        const slow = smaAt(closes, CONFIG.MAGIC_SLOW, i);

        differential.push(
            fast !== null && slow !== null
                ? fast - slow
                : null
        );
    }

    const last = candles.length - 1;
    const previous = last - 1;

    if (previous < 0) {
        return { crossUp: false, crossDown: false };
    }

    const currentDiff = differential[last];
    const previousDiff = differential[previous];

    const currentSignal = wmaAt(
        differential, CONFIG.MAGIC_SIGNAL, last
    );

    const previousSignal = wmaAt(
        differential, CONFIG.MAGIC_SIGNAL, previous
    );

    if (
        currentDiff === null ||
        previousDiff === null ||
        currentSignal === null ||
        previousSignal === null
    ) {
        return { crossUp: false, crossDown: false };
    }

    return {
        crossUp:
            currentDiff > currentSignal &&
            previousDiff <= previousSignal,

        crossDown:
            currentDiff < currentSignal &&
            previousDiff >= previousSignal
    };
}

// ============================================================
// MAGIC MONEY — MÉDIAS 3, 7 E 200
// ============================================================

function calcularTendencia(candles) {
    const closes = candles.map(c => c.close);
    const i = candles.length - 1;

    const fast = smaAt(closes, CONFIG.FAST_PERIOD, i);
    const slow = smaAt(closes, CONFIG.SLOW_PERIOD, i);
    const trend = smaAt(closes, CONFIG.TREND_PERIOD, i);
    const close = closes[i];

    const ready =
        fast !== null &&
        slow !== null &&
        trend !== null;

    return {
        fast,
        slow,
        trend,
        ready,

        alta: ready &&
            close > trend &&
            fast > slow &&
            close > slow,

        baixa: ready &&
            close < trend &&
            fast < slow &&
            close < slow
    };
}

// ============================================================
// PADRÃO DE ENGOLFO
// ============================================================

function engolfoCompra(current, previous) {
    return (
        isBullish(current) &&
        isBearish(previous) &&
        current.close > previous.open &&
        current.open <= previous.close &&
        candleBody(current) > candleBody(previous)
    );
}

function engolfoVenda(current, previous) {
    return (
        isBearish(current) &&
        isBullish(previous) &&
        current.close < previous.open &&
        current.open >= previous.close &&
        candleBody(current) > candleBody(previous)
    );
}

// ============================================================
// SUPORTE E RESISTÊNCIA
// Usa máximas e mínimas anteriores, sem a vela atual
// ============================================================

function calcularSR(candles, period = CONFIG.SR_LOOKBACK) {
    if (candles.length < period + 1) {
        return {
            resistance: null,
            support: null,
            breakoutUp: false,
            breakoutDown: false
        };
    }

    const current = candles[candles.length - 1];

    // Exclui a vela analisada para evitar comparar com ela mesma.
    const previous = candles.slice(-(period + 1), -1);

    const resistance = Math.max(...previous.map(c => c.high));
    const support = Math.min(...previous.map(c => c.low));

    return {
        resistance,
        support,
        breakoutUp: current.close > resistance,
        breakoutDown: current.close < support
    };
}

// ============================================================
// REJEIÇÃO DE SUPORTE/RESISTÊNCIA
// ============================================================

function rejeicaoCompra(candle, support) {
    if (support === null) return false;

    const range = candleRange(candle);
    if (range === 0) return false;

    const lowerWick =
        Math.min(candle.open, candle.close) - candle.low;

    return (
        isBullish(candle) &&
        candle.low <= support + range * 0.15 &&
        lowerWick / range >= 0.30
    );
}

function rejeicaoVenda(candle, resistance) {
    if (resistance === null) return false;

    const range = candleRange(candle);
    if (range === 0) return false;

    const upperWick =
        candle.high - Math.max(candle.open, candle.close);

    return (
        isBearish(candle) &&
        candle.high >= resistance - range * 0.15 &&
        upperWick / range >= 0.30
    );
}

// ============================================================
// EXPANSÃO DO RANGE
// Não é volume real. Compara o range da vela com velas anteriores.
// ============================================================

function calcularRangeRelativo(candles, period = 20) {
    if (candles.length < period + 1) return null;

    const current = candleRange(candles[candles.length - 1]);

    const previous = candles
        .slice(-(period + 1), -1)
        .map(candleRange);

    const average = mean(previous);

    if (average === null || average <= 0) return null;

    return current / average;
}

// ============================================================
// GERADOR UNIFICADO DE SINAL
// ============================================================

function gerarSinal(candles) {
    const empty = {
        sinal: 'ESPERAR',
        score: 0,
        scoreCall: 0,
        scorePut: 0,
        ema: null,
        vwap: null,
        volRel: null,
        forca: null,
        magic: null,
        tendencia: null,
        sr: null,
        motivo: 'Aguardando dados suficientes'
    };

    const minimum = Math.max(
        CONFIG.TREND_PERIOD + 2,
        CONFIG.MAGIC_SLOW + CONFIG.MAGIC_SIGNAL + 2,
        CONFIG.SR_LOOKBACK + 2
    );

    if (candles.length < minimum) return empty;

    const current = candles[candles.length - 1];
    const previous = candles[candles.length - 2];

    const closes = candles.map(c => c.close);
    const tendencia = calcularTendencia(candles);
    const magic = calcularMagic(candles);
    const sr = calcularSR(candles);
    const rangeRel = calcularRangeRelativo(candles);

    const range = candleRange(current);
    const forca = range > 0
        ? candleBody(current) / range
        : 0;

    const bullEngulf = engolfoCompra(current, previous);
    const bearEngulf = engolfoVenda(current, previous);

    const supportBounce = rejeicaoCompra(
        current, sr.support
    );

    const resistanceReject = rejeicaoVenda(
        current, sr.resistance
    );

    let call = 0;
    let put = 0;

    // Magic CANDLE: cruzamento confirmado.
    if (magic.crossUp) call += 35;
    if (magic.crossDown) put += 35;

    // MAGIC MONEY: direção das médias 3, 7 e 200.
    if (tendencia.alta) call += 20;
    if (tendencia.baixa) put += 20;

    // Padrão de engolfo.
    if (bullEngulf) call += 25;
    if (bearEngulf) put += 25;

    // Rompimento de suporte/resistência.
    if (sr.breakoutUp) call += 20;
    if (sr.breakoutDown) put += 20;

    // Rejeição de nível: confirmação adicional.
    if (supportBounce) call += 10;
    if (resistanceReject) put += 10;

    // Expansão de range: filtro complementar.
    // Não adiciona pontos por si só.
    const rangeExpanded =
        rangeRel !== null && rangeRel >= 1.10;

    call = Math.min(call, 100);
    put = Math.min(put, 100);

    let sinal = 'ESPERAR';
    let score = 0;
    let motivo = 'Sem confirmação suficiente';

    // Evita escolher direção quando os dois lados pontuam parecido.
    if (
        call >= CONFIG.MIN_SCORE &&
        call > put
    ) {
        sinal = 'CALL';
        score = call;
        motivo = 'Confluência de compra confirmada';
    } else if (
        put >= CONFIG.MIN_SCORE &&
        put > call
    ) {
        sinal = 'PUT';
        score = put;
        motivo = 'Confluência de venda confirmada';
    } else if (call === put && call > 0) {
        motivo = 'Condições conflitantes';
    }

    // A força do corpo é informativa; não representa probabilidade.
    return {
        sinal,
        score,
        scoreCall: call,
        scorePut: put,
        ema: tendencia.fast,
        vwap: null,
        volRel: rangeRel,
        forca,
        magic,
        tendencia,
        sr,
        rangeExpanded,
        motivo
    };
}

// ============================================================
// WEBSOCKET
// ============================================================

function conectar() {
    clearTimeout(state.reconnectTimer);

    if (
        state.ws &&
        (state.ws.readyState === WebSocket.OPEN ||
         state.ws.readyState === WebSocket.CONNECTING)
    ) {
        return;
    }

    const generation = ++state.connectionGeneration;

    setStatus('connecting', 'Conectando...');
    console.log('[WS] Conectando à API:', CONFIG.SYMBOL);

    let ws;

    try {
        ws = new WebSocket(CONFIG.WS_URL);
    } catch (error) {
        console.error('[WS] Falha ao criar conexão:', error);
        agendarReconexao();
        return;
    }

    state.ws = ws;

    ws.onopen = () => {
        if (generation !== state.connectionGeneration) return;

        state.connected = true;
        state.reconnectAttempts = 0;

        setStatus('connected', `Conectado · ${CONFIG.SYMBOL}`);

        // Histórico e assinatura de candles.
        ws.send(JSON.stringify({
            ticks_history: CONFIG.SYMBOL,
            adjust_start_time: 1,
            count: CONFIG.MAX_CANDLES,
            end: 'latest',
            granularity: CONFIG.GRANULARITY,
            style: 'candles',
            subscribe: 1
        }));

        // Preço atual.
        ws.send(JSON.stringify({
            ticks: CONFIG.SYMBOL,
            subscribe: 1
        }));
    };

    ws.onmessage = event => {
        if (generation !== state.connectionGeneration) return;

        try {
            handleMessage(JSON.parse(event.data));
        } catch (error) {
            console.error('[WS] Erro ao processar mensagem:', error);
        }
    };

    ws.onerror = error => {
        console.error('[WS] Erro de conexão:', error);
        setStatus('error', 'Erro de conexão');
    };

    ws.onclose = () => {
        if (generation !== state.connectionGeneration) return;

        state.connected = false;
        state.ws = null;

        setStatus('error', 'Desconectado');
        agendarReconexao();
    };
}

function agendarReconexao() {
    if (state.reconnectTimer) return;

    const delay = Math.min(
        2000 * Math.pow(2, state.reconnectAttempts),
        30000
    );

    state.reconnectAttempts++;

    state.reconnectTimer = setTimeout(() => {
        state.reconnectTimer = null;
        conectar();
    }, delay);
}

// ============================================================
// RECEBIMENTO DOS DADOS
// ============================================================

function handleMessage(data) {
    if (data.error) {
        console.error('[API]', data.error.message);

        const error = el('errorMsg');
        if (error) {
            error.style.display = 'block';
            error.textContent =
                `Erro da API: ${data.error.message}`;
        }

        return;
    }

    if (data.msg_type === 'candles' && Array.isArray(data.candles)) {
        const candles = data.candles.map(c => ({
            open: Number(c.open),
            high: Number(c.high),
            low: Number(c.low),
            close: Number(c.close),
            epoch: Number(c.epoch)
        })).filter(c =>
            Number.isFinite(c.epoch) &&
            Number.isFinite(c.open) &&
            Number.isFinite(c.high) &&
            Number.isFinite(c.low) &&
            Number.isFinite(c.close)
        );

        if (!candles.length) return;

        state.candles = candles.slice(-CONFIG.MAX_CANDLES);
        state.lastCandleEpoch =
            state.candles[state.candles.length - 1].epoch;

        // Não emite sinal histórico usando a vela possivelmente aberta.
        atualizarInterface({
            sinal: 'ESPERAR',
            score: 0,
            ema: null,
            vwap: null,
            volRel: null,
            forca: null,
            motivo: 'Aguardando fechamento da próxima vela'
        });

        iniciarTimer();
        return;
    }

    if (data.msg_type === 'ohlc' && data.ohlc) {
        const c = data.ohlc;

        const candle = {
            open: Number(c.open),
            high: Number(c.high),
            low: Number(c.low),
            close: Number(c.close),
            epoch: Number(c.open_time)
        };

        if (
            !Number.isFinite(candle.epoch) ||
            !Number.isFinite(candle.close)
        ) return;

        if (!state.candles.length) {
            state.candles.push(candle);
            state.lastCandleEpoch = candle.epoch;
            iniciarTimer();
            return;
        }

        if (candle.epoch > state.lastCandleEpoch) {
            // A vela anterior terminou. Analisa apenas essa vela fechada.
            const closedCandles = state.candles.slice();

            if (
                closedCandles.length &&
                closedCandles[closedCandles.length - 1].epoch >
                    state.lastProcessedEpoch
            ) {
                processarSinal(closedCandles);
            }

            state.candles.push(candle);
            state.candles = state.candles.slice(-CONFIG.MAX_CANDLES);
            state.lastCandleEpoch = candle.epoch;

            iniciarTimer();
        } else if (candle.epoch === state.lastCandleEpoch) {
            // Atualiza a vela em formação, sem gerar sinais nela.
            state.candles[state.candles.length - 1] = candle;
        }
    }

    if (data.msg_type === 'tick' && data.tick) {
        state.currentPrice = Number(data.tick.quote);

        if (Number.isFinite(state.currentPrice)) {
            setText('priceDisplay', state.currentPrice.toFixed(2));
        }
    }
}

// ============================================================
// PROCESSAMENTO — UMA VEZ POR VELA FECHADA
// ============================================================

function processarSinal(closedCandles) {
    if (!closedCandles || !closedCandles.length) return;

    const candle = closedCandles[closedCandles.length - 1];

    if (candle.epoch <= state.lastProcessedEpoch) return;

    state.lastProcessedEpoch = candle.epoch;

    const r = gerarSinal(closedCandles);

    atualizarInterface(r);

    const time = new Date(candle.epoch * 1000)
        .toLocaleTimeString('pt-BR');

    if (r.sinal !== 'ESPERAR') {
        state.signalCount++;

        console.log(
            `[SINAL #${state.signalCount}] ${r.sinal}` +
            ` | Score técnico: ${r.score}` +
            ` | Vela: ${time}` +
            ` | ${r.motivo}`
        );
    }

    state.history.unshift({
        time,
        sinal: r.sinal,
        score: r.score
    });

    state.history = state.history.slice(0, CONFIG.HISTORY_LIMIT);
    renderHistorico();
    setText('updateTime', time);
}

// ============================================================
// INTERFACE
// ============================================================

function atualizarInterface(r) {
    const sinal = r.sinal || 'ESPERAR';
    const cls = sinal.toLowerCase();

    const card = el('signalCard');
    if (card) card.className = `signal-card ${cls}`;

    const value = el('signalValue');
    if (value) {
        value.textContent = sinal;
        value.className = `signal-value ${cls}`;
    }

    const arrow = el('signalArrow');
    if (arrow) {
        arrow.textContent =
            sinal === 'CALL' ? '↑' :
            sinal === 'PUT' ? '↓' : '—';

        arrow.className = `signal-arrow ${cls}`;
    }

    const score = Math.max(0, Math.min(100, r.score || 0));

    setText('scoreText', `${score}%`);

    const bar = el('scoreBar');
    if (bar) {
        bar.style.width = `${score}%`;
        bar.className = `score-bar-fill ${cls}`;
    }

    if (r.ema !== null && Number.isFinite(r.ema)) {
        setText('emaVal', r.ema.toFixed(2));
    }

    if (r.vwap !== null && Number.isFinite(r.vwap)) {
        setText('vwapVal', r.vwap.toFixed(2));
    } else {
        setText('vwapVal', 'N/A');
    }

    if (r.volRel !== null && Number.isFinite(r.volRel)) {
        setText('volVal', `${r.volRel.toFixed(2)}x`);

        setText(
            'volSub',
            r.volRel >= 1.1
                ? 'range expandido'
                : 'range normal'
        );
    } else {
        setText('volVal', 'N/A');
    }

    if (r.forca !== null && Number.isFinite(r.forca)) {
        setText('forcaVal', `${(r.forca * 100).toFixed(0)}%`);

        setText(
            'forcaSub',
            r.forca > 0.65 ? 'vela forte' :
            r.forca > 0.45 ? 'vela média' :
            'vela fraca'
        );
    }

    if (r.tendencia) {
        setText(
            'emaSub',
            r.tendencia.alta ? 'Tendência de alta' :
            r.tendencia.baixa ? 'Tendência de baixa' :
            r.tendencia.ready ? 'Tendência indefinida' :
            'Aguardando 200 velas'
        );
    }

    if (r.sr) {
        setText(
            'srResistance',
            r.sr.resistance === null ? 'N/A' :
            r.sr.resistance.toFixed(2)
        );

        setText(
            'srSupport',
            r.sr.support === null ? 'N/A' :
            r.sr.support.toFixed(2)
        );
    }

    setText('signalReason', r.motivo || 'Aguardando confirmação');

    const error = el('errorMsg');
    if (error && state.connected) error.style.display = 'none';
}

function renderHistorico() {
    const list = el('historyList');
    if (!list) return;

    list.innerHTML = state.history.map(h => {
        const item = document.createElement('div');
        item.className = 'history-item';

        const time = document.createElement('span');
        time.className = 'history-time';
        time.textContent = h.time;

        const badge = document.createElement('span');
        badge.className = `history-badge ${h.sinal.toLowerCase()}`;
        badge.textContent = h.sinal;

        const score = document.createElement('span');
        score.className = 'history-score';
        score.textContent = `${h.score}%`;

        item.append(time, badge, score);
        return item.outerHTML;
    }).join('');
}

// ============================================================
// TIMER M5
// ============================================================

function iniciarTimer() {
    clearInterval(state.timerInterval);

    const update = () => {
        const now = Math.floor(Date.now() / 1000);

        state.timerSeconds =
            CONFIG.GRANULARITY - (now % CONFIG.GRANULARITY);

        const min = Math.floor(state.timerSeconds / 60);
        const sec = state.timerSeconds % 60;

        const timer = el('timer');

        if (timer) {
            timer.textContent =
                `${min}:${String(sec).padStart(2, '0')}`;

            timer.classList.toggle(
                'urgent',
                state.timerSeconds <= 10
            );
        }
    };

    update();
    state.timerInterval = setInterval(update, 1000);
}

// ============================================================
// STATUS
// ============================================================

function setStatus(type, message) {
    const dot = el('statusDot');
    const text = el('statusText');
    const live = el('liveText');
    const liveDot = el('liveDot');

    if (dot) dot.className = `status-dot ${type}`;
    if (text) text.textContent = message;

    if (live) {
        live.textContent =
            type === 'connected' ? 'AO VIVO' :
            type === 'connecting' ? 'CONECTANDO' :
            'OFFLINE';
    }

    if (liveDot) {
        liveDot.style.background =
            type === 'connected' ? '#2ecc71' :
            type === 'connecting' ? '#f1c40f' :
            '#e74c3c';
    }

    const error = el('errorMsg');

    if (error && type === 'connected') {
        error.style.display = 'none';
    } else if (error && type === 'error') {
        error.style.display = 'block';
        error.textContent = message;
    }
}

// ============================================================
// INICIALIZAÇÃO
// ============================================================

console.log('Atlas IA — Magic Candle iniciado');
console.log('Símbolo configurado:', CONFIG.SYMBOL);
console.log('Período:', CONFIG.GRANULARITY, 'segundos');

conectar();

setTimeout(() => {
    if (!state.candles.length && state.connected) {
        const error = el('errorMsg');

        if (error) {
            error.style.display = 'block';
            error.textContent =
                'Sem candles. Confirme se o símbolo está disponível na API.';
        }
    }
}, 10000);

window.addEventListener('beforeunload', () => {
    clearInterval(state.timerInterval);
    clearTimeout(state.reconnectTimer);

    if (state.ws) {
        state.ws.onclose = null;
        state.ws.close();
    }
});
