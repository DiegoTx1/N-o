// =============================================
// CONFIGURAÇÕES AVANÇADAS PARA CRYPTO IDX 2025
// =============================================
const CONFIG = {
    EXCHANGE: 'binance', // binance, bybit ou kraken
    SYMBOL: 'BTCUSDT',
    INTERVAL: '1m',
    MAX_CANDLES: 200,
    INDICATORS: {
        VWAP_PERIOD: 20,
        HMA_PERIOD: 14,
        RSI_PERIOD: 11,
        STOCH_PERIOD: 9,
        SUPERTREND_PERIOD: 10,
        SUPERTREND_MULTIPLIER: 3.0,
        VOLUME_PROFILE_PERIOD: 30,
        QUANTUM_RSI_PERIOD: 7
    },
    THRESHOLDS: {
        RSI_OVERBOUGHT: 68,
        RSI_OVERSOLD: 32,
        VOLUME_SPIKE: 2.0,
        VOLUME_DROPOUT: 0.5
    },
    STRATEGY: {
        MIN_CONFIDENCE: 75,
        TREND_CONFIRMATION: 3, // Número de velas para confirmar tendência
        USE_QUANTUM_INDICATORS: true
    }
};

// =============================================
// ESTADO DO SISTEMA
// =============================================
const state = {
    active: false,
    candles: [],
    currentPrice: 0,
    currentVolume: 0,
    indicators: {
        vwap: 0,
        hma: 0,
        rsi: 50,
        quantumRsi: 50,
        stochK: 50,
        stochD: 50,
        superTrend: 0,
        superTrendDirection: 0,
        volumeProfile: {poc: 0, vaHigh: 0, vaLow: 0}
    },
    trend: {
        direction: 'neutral', // 'bullish', 'bearish', 'neutral'
        strength: 0,
        confirmed: false,
        confirmationCount: 0
    },
    lastSignal: null,
    websocket: null
};

// =============================================
// FUNÇÕES PRINCIPAIS
// =============================================

// Conectar à exchange via WebSocket
function connectToExchange() {
    let wsUrl;
    
    switch(CONFIG.EXCHANGE) {
        case 'bybit':
            wsUrl = `wss://stream.bybit.com/v5/public/linear`;
            break;
        case 'kraken':
            wsUrl = `wss://ws.kraken.com`;
            break;
        case 'binance':
        default:
            wsUrl = `wss://fstream.binance.com/ws/${CONFIG.SYMBOL.toLowerCase()}@kline_${CONFIG.INTERVAL}`;
    }

    state.websocket = new WebSocket(wsUrl);

    state.websocket.onopen = () => {
        console.log(`Conectado à ${CONFIG.EXCHANGE.toUpperCase()} WebSocket`);
        
        // Subscrever aos dados (exemplo para Bybit)
        if (CONFIG.EXCHANGE === 'bybit') {
            const payload = {
                op: "subscribe",
                args: [`kline.${CONFIG.INTERVAL}.${CONFIG.SYMBOL.toUpperCase()}`]
            };
            state.websocket.send(JSON.stringify(payload));
        }
    };

    state.websocket.onmessage = (event) => {
        if (!state.active) return;
        
        const data = JSON.parse(event.data);
        let candle;
        
        // Processar dados de acordo com a exchange
        switch(CONFIG.EXCHANGE) {
            case 'bybit':
                if (!data.data || !data.data[0]) return;
                const k = data.data[0];
                candle = {
                    time: k.start,
                    open: parseFloat(k.open),
                    high: parseFloat(k.high),
                    low: parseFloat(k.low),
                    close: parseFloat(k.close),
                    volume: parseFloat(k.volume),
                    confirmed: k.confirm
                };
                break;
                
            case 'kraken':
                // Implementação para Kraken
                break;
                
            case 'binance':
            default:
                if (!data.k) return;
                candle = {
                    time: data.k.t,
                    open: parseFloat(data.k.o),
                    high: parseFloat(data.k.h),
                    low: parseFloat(data.k.l),
                    close: parseFloat(data.k.c),
                    volume: parseFloat(data.k.v),
                    confirmed: data.k.x
                };
        }
        
        updateCandleData(candle);
    };

    state.websocket.onerror = (error) => {
        console.error('Erro na conexão WebSocket:', error);
        setTimeout(connectToExchange, 5000); // Reconectar após 5 segundos
    };
}

// Atualizar dados de candle
function updateCandleData(candle) {
    // Atualizar candle existente ou adicionar novo
    if (state.candles.length > 0) {
        const lastCandle = state.candles[state.candles.length - 1];
        
        if (!candle.confirmed && lastCandle.time === candle.time) {
            // Atualizar candle atual
            state.candles[state.candles.length - 1] = candle;
        } else if (candle.confirmed) {
            // Adicionar novo candle
            state.candles.push(candle);
            if (state.candles.length > CONFIG.MAX_CANDLES) {
                state.candles.shift();
            }
        }
    } else {
        state.candles.push(candle);
    }
    
    // Atualizar preço e volume atuais
    state.currentPrice = candle.close;
    state.currentVolume = candle.volume;
    
    // Analisar quando o candle for confirmado
    if (candle.confirmed) {
        calculateIndicators();
        analyzeMarket();
    }
}

// =============================================
// INDICADORES AVANÇADOS 2025
// =============================================

// Calcular VWAP (Volume Weighted Average Price)
function calculateVWAP() {
    let cumulativeTPV = 0;
    let cumulativeVolume = 0;
    
    for (const candle of state.candles) {
        const typicalPrice = (candle.high + candle.low + candle.close) / 3;
        cumulativeTPV += typicalPrice * candle.volume;
        cumulativeVolume += candle.volume;
    }
    
    state.indicators.vwap = cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : 0;
}

// Calcular HMA (Hull Moving Average)
function calculateHMA() {
    const prices = state.candles.map(c => c.close);
    const period = CONFIG.INDICATORS.HMA_PERIOD;
    
    if (prices.length < period) return;
    
    const halfPeriod = Math.floor(period / 2);
    const sqrtPeriod = Math.floor(Math.sqrt(period));
    
    const wma1 = calculateWMA(prices, halfPeriod);
    const wma2 = calculateWMA(prices, period);
    
    // Combinar WMAs
    const rawHMA = [];
    for (let i = 0; i < wma2.length; i++) {
        rawHMA.push(2 * wma1[i + (wma1.length - wma2.length)] - wma2[i]);
    }
    
    // Calcular WMA final
    state.indicators.hma = calculateWMA(rawHMA, sqrtPeriod).pop();
}

// Calcular WMA (Weighted Moving Average)
function calculateWMA(prices, period) {
    const weights = Array.from({length: period}, (_, i) => period - i);
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const wma = [];
    
    for (let i = period - 1; i < prices.length; i++) {
        let sum = 0;
        for (let j = 0; j < period; j++) {
            sum += prices[i - j] * weights[j];
        }
        wma.push(sum / totalWeight);
    }
    
    return wma;
}

// Calcular RSI (Relative Strength Index)
function calculateRSI() {
    const prices = state.candles.map(c => c.close);
    const period = CONFIG.INDICATORS.RSI_PERIOD;
    
    if (prices.length < period + 1) return;
    
    let gains = 0;
    let losses = 0;
    
    // Primeiros períodos
    for (let i = 1; i <= period; i++) {
        const diff = prices[i] - prices[i - 1];
        if (diff > 0) gains += diff;
        else losses -= diff;
    }
    
    let avgGain = gains / period;
    let avgLoss = losses / period;
    
    // Períodos subsequentes
    for (let i = period + 1; i < prices.length; i++) {
        const diff = prices[i] - prices[i - 1];
        const gain = diff > 0 ? diff : 0;
        const loss = diff < 0 ? -diff : 0;
        
        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;
    }
    
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    state.indicators.rsi = 100 - (100 / (1 + rs));
}

// Calcular Quantum RSI (RSI aprimorado)
function calculateQuantumRSI() {
    const prices = state.candles.map(c => c.close);
    const period = CONFIG.INDICATORS.QUANTUM_RSI_PERIOD;
    
    if (prices.length < period + 1) return;
    
    // Passo 1: Calcular mudanças de preço
    const changes = [];
    for (let i = 1; i < prices.length; i++) {
        changes.push(prices[i] - prices[i - 1]);
    }
    
    // Passo 2: Aplicar filtro de volatilidade
    const volatilities = [];
    for (let i = period - 1; i < changes.length; i++) {
        const slice = changes.slice(i - period + 1, i + 1);
        const volatility = Math.sqrt(slice.reduce((sum, val) => sum + val * val, 0) / period);
        volatilities.push(volatility);
    }
    
    // Passo 3: Calcular RSI com volatilidade ajustada
    let gains = 0;
    let losses = 0;
    
    for (let i = 0; i < period; i++) {
        const change = changes[i];
        const adjChange = change / (volatilities[0] || 1);
        
        if (adjChange > 0) gains += adjChange;
        else losses -= adjChange;
    }
    
    let avgGain = gains / period;
    let avgLoss = losses / period;
    
    for (let i = period; i < changes.length; i++) {
        const change = changes[i];
        const volatility = volatilities[i - period];
        const adjChange = change / volatility;
        
        const gain = adjChange > 0 ? adjChange : 0;
        const loss = adjChange < 0 ? -adjChange : 0;
        
        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;
    }
    
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    state.indicators.quantumRsi = 100 - (100 / (1 + rs));
}

// Calcular Stochastic Oscillator
function calculateStochastic() {
    const highs = state.candles.map(c => c.high);
    const lows = state.candles.map(c => c.low);
    const closes = state.candles.map(c => c.close);
    const period = CONFIG.INDICATORS.STOCH_PERIOD;
    
    if (closes.length < period) return;
    
    const kValues = [];
    
    for (let i = period - 1; i < closes.length; i++) {
        const highestHigh = Math.max(...highs.slice(i - period + 1, i + 1));
        const lowestLow = Math.min(...lows.slice(i - period + 1, i + 1));
        const currentClose = closes[i];
        
        kValues.push(100 * (currentClose - lowestLow) / (highestHigh - lowestLow));
    }
    
    state.indicators.stochK = kValues[kValues.length - 1];
    
    // Calcular %D (média móvel de %K)
    if (kValues.length >= 3) {
        state.indicators.stochD = (kValues[kValues.length - 1] + kValues[kValues.length - 2] + kValues[kValues.length - 3]) / 3;
    }
}

// Calcular SuperTrend
function calculateSuperTrend() {
    const period = CONFIG.INDICATORS.SUPERTREND_PERIOD;
    const multiplier = CONFIG.INDICATORS.SUPERTREND_MULTIPLIER;
    
    if (state.candles.length < period) return;
    
    // Calcular ATR
    const atr = calculateATR();
    
    const currentCandle = state.candles[state.candles.length - 1];
    const hl2 = (currentCandle.high + currentCandle.low) / 2;
    
    const upperBand = hl2 + multiplier * atr;
    const lowerBand = hl2 - multiplier * atr;
    
    // Determinar direção
    let direction = 1; // 1 = bullish, -1 = bearish
    let superTrend = lowerBand;
    
    if (state.candles.length > period) {
        const prevCandle = state.candles[state.candles.length - 2];
        
        if (prevCandle.close > (state.indicators.superTrend || upperBand)) {
            direction = 1;
            superTrend = Math.min(upperBand, state.indicators.superTrend || upperBand);
        } else if (prevCandle.close < (state.indicators.superTrend || lowerBand)) {
            direction = -1;
            superTrend = Math.max(lowerBand, state.indicators.superTrend || lowerBand);
        } else {
            direction = state.indicators.superTrendDirection || 1;
            superTrend = state.indicators.superTrend || upperBand;
        }
    }
    
    state.indicators.superTrend = superTrend;
    state.indicators.superTrendDirection = direction;
}

// Calcular ATR (Average True Range)
function calculateATR() {
    const period = CONFIG.INDICATORS.SUPERTREND_PERIOD;
    
    if (state.candles.length < period + 1) return 0;
    
    let trSum = 0;
    const startIndex = state.candles.length - period;
    
    for (let i = startIndex; i < state.candles.length; i++) {
        if (i === 0) continue;
        
        const tr = Math.max(
            state.candles[i].high - state.candles[i].low,
            Math.abs(state.candles[i].high - state.candles[i-1].close),
            Math.abs(state.candles[i].low - state.candles[i-1].close)
        );
        
        trSum += tr;
    }
    
    return trSum / period;
}

// Calcular Volume Profile
function calculateVolumeProfile() {
    const period = CONFIG.INDICATORS.VOLUME_PROFILE_PERIOD;
    const candles = state.candles.slice(-period);
    
    if (candles.length < period) return;
    
    const volumeByPrice = {};
    let totalVolume = 0;
    
    for (const candle of candles) {
        const priceRange = [];
        const step = (candle.high - candle.low) / 100;
        
        for (let p = candle.low; p <= candle.high; p += step) {
            priceRange.push(p.toFixed(2));
        }
        
        const volumePerPrice = candle.volume / priceRange.length;
        
        for (const price of priceRange) {
            volumeByPrice[price] = (volumeByPrice[price] || 0) + volumePerPrice;
            totalVolume += volumePerPrice;
        }
    }
    
    // Encontrar POC (Point of Control)
    let poc = 0;
    let maxVolume = 0;
    
    for (const [price, volume] of Object.entries(volumeByPrice)) {
        if (volume > maxVolume) {
            maxVolume = volume;
            poc = parseFloat(price);
        }
    }
    
    // Calcular Value Area (70%)
    const sortedPrices = Object.entries(volumeByPrice)
        .sort((a, b) => b[1] - a[1])
        .map(entry => parseFloat(entry[0]));
    
    let valueAreaVolume = 0;
    let valueAreaHigh = poc;
    let valueAreaLow = poc;
    
    for (const price of sortedPrices) {
        if (valueAreaVolume >= totalVolume * 0.7) break;
        
        if (price > valueAreaHigh) valueAreaHigh = price;
        if (price < valueAreaLow) valueAreaLow = price;
        
        valueAreaVolume += volumeByPrice[price.toFixed(2)];
    }
    
    state.indicators.volumeProfile = {
        poc,
        vaHigh: valueAreaHigh,
        vaLow: valueAreaLow
    };
}

// =============================================
// ANÁLISE DE TENDÊNCIA E SINAIS
// =============================================

// Calcular todos os indicadores
function calculateIndicators() {
    calculateVWAP();
    calculateHMA();
    calculateRSI();
    
    if (CONFIG.STRATEGY.USE_QUANTUM_INDICATORS) {
        calculateQuantumRSI();
    }
    
    calculateStochastic();
    calculateSuperTrend();
    calculateVolumeProfile();
    determineMarketTrend();
}

// Determinar tendência do mercado
function determineMarketTrend() {
    const trendFactors = [];
    
    // Fator 1: Relação preço/HMA
    if (state.currentPrice > state.indicators.hma) {
        trendFactors.push('bullish');
    } else {
        trendFactors.push('bearish');
    }
    
    // Fator 2: Direção do SuperTrend
    if (state.indicators.superTrendDirection === 1) {
        trendFactors.push('bullish');
    } else if (state.indicators.superTrendDirection === -1) {
        trendFactors.push('bearish');
    }
    
    // Fator 3: Posição do preço em relação ao VWAP
    if (state.currentPrice > state.indicators.vwap) {
        trendFactors.push('bullish');
    } else {
        trendFactors.push('bearish');
    }
    
    // Fator 4: Volume Profile
    if (state.currentPrice > state.indicators.volumeProfile.vaHigh) {
        trendFactors.push('bullish');
    } else if (state.currentPrice < state.indicators.volumeProfile.vaLow) {
        trendFactors.push('bearish');
    }
    
    // Contar fatores
    const bullishCount = trendFactors.filter(f => f === 'bullish').length;
    const bearishCount = trendFactors.filter(f => f === 'bearish').length;
    
    // Determinar tendência
    const newDirection = bullishCount > bearishCount ? 'bullish' : bearishCount > bullishCount ? 'bearish' : 'neutral';
    
    // Verificar confirmação de tendência
    if (state.trend.direction === newDirection) {
        state.trend.confirmationCount = Math.min(state.trend.confirmationCount + 1, CONFIG.STRATEGY.TREND_CONFIRMATION);
    } else {
        state.trend.confirmationCount = 1;
        state.trend.direction = newDirection;
    }
    
    // Marcar tendência como confirmada
    state.trend.confirmed = state.trend.confirmationCount >= CONFIG.STRATEGY.TREND_CONFIRMATION;
    state.trend.strength = Math.max(bullishCount, bearishCount);
}

// Analisar mercado e gerar sinal
function analyzeMarket() {
    let signal = 'ESPERAR';
    let confidence = 0;
    let reasons = [];
    
    // 1. Verificar condições para CALL (compra)
    if (state.trend.direction === 'bullish' && state.trend.confirmed) {
        const rsiToUse = CONFIG.STRATEGY.USE_QUANTUM_INDICATORS ? 
                         state.indicators.quantumRsi : state.indicators.rsi;
        
        const volumeAvg = state.candles.slice(-CONFIG.INDICATORS.VOLUME_PROFILE_PERIOD)
                          .reduce((sum, c) => sum + c.volume, 0) / CONFIG.INDICATORS.VOLUME_PROFILE_PERIOD;
        
        const volumeSpike = state.currentVolume > volumeAvg * CONFIG.THRESHOLDS.VOLUME_SPIKE;
        
        if (rsiToUse < CONFIG.THRESHOLDS.RSI_OVERBOUGHT) {
            confidence = 70;
            reasons.push('Tendência de alta confirmada');
            
            if (volumeSpike) {
                confidence += 10;
                reasons.push('Volume acima da média');
            }
            
            if (state.currentPrice > state.indicators.superTrend && state.indicators.superTrendDirection === 1) {
                confidence += 10;
                reasons.push('SuperTrend confirmando');
            }
            
            if (state.currentPrice > state.indicators.volumeProfile.vaHigh) {
                confidence += 5;
                reasons.push('Preço acima da área de valor');
            }
            
            signal = 'CALL';
        }
    }
    
    // 2. Verificar condições para PUT (venda)
    if (state.trend.direction === 'bearish' && state.trend.confirmed) {
        const rsiToUse = CONFIG.STRATEGY.USE_QUANTUM_INDICATORS ? 
                         state.indicators.quantumRsi : state.indicators.rsi;
        
        const volumeAvg = state.candles.slice(-CONFIG.INDICATORS.VOLUME_PROFILE_PERIOD)
                          .reduce((sum, c) => sum + c.volume, 0) / CONFIG.INDICATORS.VOLUME_PROFILE_PERIOD;
        
        const volumeSpike = state.currentVolume > volumeAvg * CONFIG.THRESHOLDS.VOLUME_SPIKE;
        
        if (rsiToUse > CONFIG.THRESHOLDS.RSI_OVERSOLD) {
            confidence = 70;
            reasons.push('Tendência de baixa confirmada');
            
            if (volumeSpike) {
                confidence += 10;
                reasons.push('Volume acima da média');
            }
            
            if (state.currentPrice < state.indicators.superTrend && state.indicators.superTrendDirection === -1) {
                confidence += 10;
                reasons.push('SuperTrend confirmando');
            }
            
            if (state.currentPrice < state.indicators.volumeProfile.vaLow) {
                confidence += 5;
                reasons.push('Preço abaixo da área de valor');
            }
            
            signal = 'PUT';
        }
    }
    
    // 3. Emitir sinal se confiança for suficiente
    if (confidence >= CONFIG.STRATEGY.MIN_CONFIDENCE) {
        emitSignal(signal, confidence, reasons);
    }
}

// Emitir sinal
function emitSignal(signal, confidence, reasons) {
    // Atualizar estado
    state.lastSignal = {
        time: Date.now(),
        signal,
        confidence,
        reasons
    };
    
    // Implementar lógica para notificar o trader
    console.log(`[SINAL] ${signal} (${confidence}%) - ${reasons.join(', ')}`);
    
    // Aqui você pode implementar:
    // - Notificação visual/sonora
    // - Envio de alerta por e-mail/telegram
    // - Integração com API da corretora
}

// =============================================
// CONTROLE DO ROBÔ
// =============================================

// Iniciar o robô
function startRobot() {
    if (state.active) return;
    
    state.active = true;
    state.candles = [];
    connectToExchange();
}

// Parar o robô
function stopRobot() {
    state.active = false;
    if (state.websocket) {
        state.websocket.close();
        state.websocket = null;
    }
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    startRobot();
});

// =============================================
// FUNÇÕES AUXILIARES PARA BACKTEST
// =============================================

async function fetchHistoricalData() {
    try {
        const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${CONFIG.SYMBOL}&interval=${CONFIG.INTERVAL}&limit=300`);
        const data = await response.json();
        
        return data.map(kline => ({
            time: kline[0],
            open: parseFloat(kline[1]),
            high: parseFloat(kline[2]),
            low: parseFloat(kline[3]),
            close: parseFloat(kline[4]),
            volume: parseFloat(kline[5]),
            confirmed: true
        }));
    } catch (error) {
        console.error('Erro ao obter dados históricos:', error);
        return [];
    }
}

async function runBacktest() {
    const historicalData = await fetchHistoricalData();
    if (historicalData.length === 0) return;
    
    const results = [];
    
    // Simular chegada de candles
    for (let i = 0; i < historicalData.length; i++) {
        const candle = historicalData[i];
        updateCandleData(candle);
        
        if (state.lastSignal) {
            // Verificar resultado do sinal após 3 candles
            if (i + 3 < historicalData.length) {
                const entryPrice = candle.close;
                const exitPrice = historicalData[i + 3].close;
                const profit = state.lastSignal.signal === 'CALL' ? 
                              (exitPrice - entryPrice) / entryPrice * 100 :
                              (entryPrice - exitPrice) / entryPrice * 100;
                
                results.push({
                    signal: state.lastSignal.signal,
                    confidence: state.lastSignal.confidence,
                    entryPrice,
                    exitPrice,
                    profit: profit.toFixed(2) + '%'
                });
            }
        }
    }
    
    console.log('Resultados do Backtest:', results);
    return results;
}
