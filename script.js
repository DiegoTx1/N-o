// ============================================= 
    // SISTEMA 100% REAL - APIS PÚBLICAS GRATUITAS
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
      wins: 0,
      losses: 0
    };

    const CONFIG = {
      // ✅ APIs PÚBLICAS 100% REAIS (SEM CHAVES)
      API_ENDPOINTS_PUBLICAS: [
        {
          nome: "BINANCE_PUBLIC",
          url: "https://api.binance.com/api/v3",
          klines: "/klines?symbol=BTCUSDT&interval=1m&limit=200",
          ticker: "/ticker/24hr?symbol=BTCUSDT",
          depth: "/depth?symbol=BTCUSDT&limit=100",
          trades: "/trades?symbol=BTCUSDT&limit=100",
          price: "/ticker/price?symbol=BTCUSDT"
        },
        {
          nome: "COINBASE_PUBLIC",
          url: "https://api.exchange.coinbase.com",
          candles: "/products/BTC-USD/candles?granularity=60&start=" + new Date(Date.now() - 200*60*1000).toISOString(),
          ticker: "/products/BTC-USD/ticker",
          trades: "/products/BTC-USD/trades"
        },
        {
          nome: "BYBIT_PUBLIC",
          url: "https://api.bybit.com/v5/market",
          kline: "/kline?category=spot&symbol=BTCUSDT&interval=1&limit=200",
          ticker: "/tickers?category=spot&symbol=BTCUSDT",
          orderbook: "/orderbook?category=spot&symbol=BTCUSDT&limit=25"
        },
        {
          nome: "COINGECKO_PUBLIC",
          url: "https://api.coingecko.com/api/v3",
          ohlc: "/coins/bitcoin/ohlc?vs_currency=usd&days=1",
          price: "/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_vol=true&include_24hr_change=true",
          market: "/coins/bitcoin/market_chart?vs_currency=usd&days=1&interval=minute"
        }
      ],

      // ✅ CONFIGURAÇÕES OTIMIZADAS PARA BINARY OPTIONS
      PERIODOS: {
        RSI: 9,
        STOCH: 14,
        WILLIAMS: 14,
        EMA_CURTA: 8,
        EMA_MEDIA: 21,
        EMA_LONGA: 55,
        EMA_200: 200,
        SMA_VOLUME: 20,
        MACD_RAPIDA: 12,
        MACD_LENTA: 26,
        MACD_SINAL: 9,
        VELAS_CONFIRMACAO: 3,
        ANALISE_LATERAL: 30,
        VWAP: 20,
        ATR: 14,
        SUPERTREND: 10
      },

      LIMIARES: {
        SCORE_ULTRA_ALTO: 95,
        SCORE_MUITO_ALTO: 90,
        SCORE_ALTO: 85,
        SCORE_MEDIO: 75,
        
        RSI_OVERBOUGHT: 70,
        RSI_OVERSOLD: 30,
        STOCH_OVERBOUGHT: 80,
        STOCH_OVERSOLD: 20,
        WILLIAMS_OVERBOUGHT: -20,
        WILLIAMS_OVERSOLD: -80,
        
        VOLUME_ALTO: 2.5,
        VOLUME_EXTREMO: 4.0,
        
        VARIACAO_LATERAL: 1.2,
        VWAP_DESVIO: 0.02,
        ATR_LIMIAR: 0.03,
        SUPERTREND_SENSIBILIDADE: 2.5
      },

      PESOS: {
        RSI: 1.8,
        MACD: 2.2,
        TENDENCIA: 2.5,
        VOLUME: 2.0,
        STOCH: 1.2,
        WILLIAMS: 1.1,
        CONFIRMACAO: 1.8,
        LATERALIDADE: 1.5,
        VWAP: 1.6,
        VOLATILIDADE: 1.6,
        SUPERTREND: 2.3,
        VOLUME_PROFILE: 1.5,
        DIVERGENCIA: 2.0,
        LIQUIDITY: 1.9,
        FAIR_VALUE: 1.8,
        INSTITUTIONAL: 2.1
      },

      RISCO: {
        SCORE_MINIMO_ENTRADA: 85,
        CONFLUENCIA_MINIMA: 5,
        VOLUME_MINIMO_MULTIPLICADOR: 2.0
      },

      BINARY_OPTIONS: {
        HORARIOS_IDEAIS: {
          LONDRES_NY: { inicio: 13, fim: 16, multiplicador: 1.4 },
          NY_ABERTURA: { inicio: 14, fim: 17, multiplicador: 1.3 },
          EVITAR: [
            { inicio: 22, fim: 6, motivo: "Baixa liquidez asiática" },
            { inicio: 12, fim: 13, motivo: "Almoço Londres" }
          ]
        },
        EXPIRACAO_RECOMENDADA: "5min",
        TIMEFRAME_ANALISE: "1min"
      }
    };

    // =============================================
    // FUNÇÕES DE DADOS REAIS - APIs PÚBLICAS
    // =============================================

    // ✅ BINANCE API PÚBLICA (SEM CHAVE)
    async function obterDadosBinancePublica() {
      try {
        const endpoint = CONFIG.API_ENDPOINTS_PUBLICAS[0];
        const url = `${endpoint.url}${endpoint.klines}`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`Binance API falhou: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!Array.isArray(data) || data.length === 0) {
          throw new Error("Binance: dados inválidos");
        }
        
        return data.map(kline => ({
          time: new Date(kline[0]).toISOString(),
          open: parseFloat(kline[1]),
          high: parseFloat(kline[2]),
          low: parseFloat(kline[3]),
          close: parseFloat(kline[4]),
          volume: parseFloat(kline[5]),
          timestamp: kline[0],
          trades: parseInt(kline[8]),
          takerBuyVolume: parseFloat(kline[9]),
          source: "BINANCE_PUBLIC"
        }));
        
      } catch (e) {
        console.error("❌ Erro Binance Pública:", e.message);
        throw e;
      }
    }

    // ✅ COINBASE API PÚBLICA (SEM CHAVE)
    async function obterDadosCoinbasePublica() {
      try {
        const endpoint = CONFIG.API_ENDPOINTS_PUBLICAS[1];
        const startTime = new Date(Date.now() - 200*60*1000).toISOString();
        const url = `${endpoint.url}/products/BTC-USD/candles?granularity=60&start=${startTime}`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`Coinbase API falhou: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!Array.isArray(data) || data.length === 0) {
          throw new Error("Coinbase: dados inválidos");
        }
        
        return data.map(candle => ({
          time: new Date(candle[0] * 1000).toISOString(),
          low: parseFloat(candle[1]),
          high: parseFloat(candle[2]),
          open: parseFloat(candle[3]),
          close: parseFloat(candle[4]),
          volume: parseFloat(candle[5]),
          timestamp: candle[0] * 1000,
          source: "COINBASE_PUBLIC"
        })).reverse().slice(-200);
        
      } catch (e) {
        console.error("❌ Erro Coinbase Pública:", e.message);
        throw e;
      }
    }

    // ✅ BYBIT API PÚBLICA (SEM CHAVE)
    async function obterDadosBybitPublica() {
      try {
        const endpoint = CONFIG.API_ENDPOINTS_PUBLICAS[2];
        const url = `${endpoint.url}${endpoint.kline}`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`Bybit API falhou: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.result || !Array.isArray(data.result.list)) {
          throw new Error("Bybit: dados inválidos");
        }
        
        const klines = data.result.list;
        
        return klines.map(kline => ({
          time: new Date(parseInt(kline[0])).toISOString(),
          open: parseFloat(kline[1]),
          high: parseFloat(kline[2]),
          low: parseFloat(kline[3]),
          close: parseFloat(kline[4]),
          volume: parseFloat(kline[5]),
          timestamp: parseInt(kline[0]),
          source: "BYBIT_PUBLIC"
        })).reverse();
        
      } catch (e) {
        console.error("❌ Erro Bybit Pública:", e.message);
        throw e;
      }
    }

    // ✅ COINGECKO API PÚBLICA (CORRIGIDA)
    async function obterDadosCoingeckoPublica() {
      try {
        const endpoint = CONFIG.API_ENDPOINTS_PUBLICAS[3];
        const url = `${endpoint.url}${endpoint.ohlc}`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`CoinGecko API falhou: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!Array.isArray(data)) {
          throw new Error("CoinGecko: dados inválidos");
        }
        
        return data.map(item => ({
          time: new Date(item[0]).toISOString(),
          open: parseFloat(item[1]),
          high: parseFloat(item[2]),
          low: parseFloat(item[3]),
          close: parseFloat(item[4]),
          volume: 1000,
          timestamp: item[0],
          source: "COINGECKO_PUBLIC"
        })).slice(-200);
        
      } catch (e) {
        console.error("❌ Erro CoinGecko Pública:", e.message);
        throw e;
      }
    }

    // ✅ OBTER TICKER PÚBLICO (PREÇO ATUAL)
    async function obterTickerPublico() {
      try {
        const endpoint = CONFIG.API_ENDPOINTS_PUBLICAS[0];
        const url = `${endpoint.url}${endpoint.ticker}`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Ticker falhou: ${response.status}`);
        
        const data = await response.json();
        
        return {
          symbol: data.symbol,
          price: parseFloat(data.lastPrice),
          change: parseFloat(data.priceChange),
          changePercent: parseFloat(data.priceChangePercent),
          volume: parseFloat(data.volume),
          quoteVolume: parseFloat(data.quoteVolume),
          trades: parseInt(data.count)
        };
        
      } catch (e) {
        console.error("❌ Erro Ticker Público:", e.message);
        throw e;
      }
    }

    // ✅ OBTER ORDER BOOK PÚBLICO
    async function obterOrderBookPublico() {
      try {
        const endpoint = CONFIG.API_ENDPOINTS_PUBLICAS[0];
        const url = `${endpoint.url}${endpoint.depth}`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Order Book falhou: ${response.status}`);
        
        const data = await response.json();
        
        const bids = data.bids.slice(0, 10);
        const asks = data.asks.slice(0, 10);
        
        const bidVolume = bids.reduce((sum, bid) => sum + (parseFloat(bid[0]) * parseFloat(bid[1])), 0);
        const askVolume = asks.reduce((sum, ask) => sum + (parseFloat(ask[0]) * parseFloat(ask[1])), 0);
        const totalVolume = bidVolume + askVolume;
        
        const buyPressure = totalVolume > 0 ? bidVolume / totalVolume : 0.5;
        const spread = parseFloat(asks[0][0]) - parseFloat(bids[0][0]);
        const spreadPercent = (spread / parseFloat(bids[0][0])) * 100;
        
        return {
          bidVolume,
          askVolume,
          buyPressure,
          sellPressure: 1 - buyPressure,
          spread,
          spreadPercent,
          bestBid: parseFloat(bids[0][0]),
          bestAsk: parseFloat(asks[0][0]),
          liquidityUSD: totalVolume
        };
        
      } catch (e) {
        console.error("❌ Erro Order Book Público:", e.message);
        return { bidVolume: 0, askVolume: 0, buyPressure: 0.5, sellPressure: 0.5, spread: 0, spreadPercent: 0, liquidityUSD: 0 };
      }
    }

    // ✅ FUNÇÃO PRINCIPAL - APIS PÚBLICAS (OTIMIZADA)
    async function obterDadosReaisPublicos() {
      const apis = [
        { nome: "BINANCE", func: obterDadosBinancePublica },
        { nome: "COINBASE", func: obterDadosCoinbasePublica },
        { nome: "BYBIT", func: obterDadosBybitPublica },
        { nome: "COINGECKO", func: obterDadosCoingeckoPublica }
      ];
      
      // Tentar múltiplas APIs públicas em paralelo
      const promises = apis.map(api => 
        api.func()
          .then(dados => {
            if (!dados || dados.length < 50) {
              throw new Error(`${api.nome}: dados insuficientes`);
            }
            
            // Validar dados
            const ultimaVela = dados[dados.length - 1];
            if (!ultimaVela.close || ultimaVela.close < 10000 || ultimaVela.close > 200000) {
              throw new Error(`${api.nome}: preço inválido $${ultimaVela.close}`);
            }
            
            return dados;
          })
          .catch(e => {
            return Promise.reject(e);
          })
      );
      
      try {
        const dados = await Promise.any(promises);
        return dados;
      } catch (e) {
        throw new Error("❌ Todas as APIs públicas falharam!");
      }
    }

    // =============================================
    // INDICADORES TÉCNICOS
    // =============================================

    function formatarTimer(segundos) {
      return segundos.toString().padStart(2, '0');
    }

    function atualizarRelogio() {
      const elementoHora = document.getElementById("hora");
      if (elementoHora) {
        elementoHora.textContent = new Date().toLocaleTimeString("pt-BR");
        state.marketOpen = true;
      }
    }

    // ✅ FORMATADOR DE MOEDA
    function formatarMoeda(valor) {
      return new Intl.NumberFormat('pt-BR', { 
        style: 'currency', 
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(valor);
    }

    function atualizarInterface(sinal, score) {
      const comandoElement = document.getElementById("comando");
      if (comandoElement) {
        let emoji = "";
        let classe = "esperar";
        
        if (sinal === "CALL") {
          emoji = "📈";
          classe = "call";
        } else if (sinal === "PUT") {
          emoji = "📉";
          classe = "put";
        } else if (sinal === "ERRO") {
          emoji = "⚠️";
          classe = "erro";
        } else {
          emoji = "⏳";
          classe = "esperar";
        }
        
        comandoElement.textContent = `${sinal} ${emoji}`;
        comandoElement.className = classe;
        
        // Tocar som para sinais relevantes
        if (score >= CONFIG.LIMIARES.SCORE_ALTO && (sinal === "CALL" || sinal === "PUT")) {
          const som = document.getElementById(sinal === "CALL" ? "som-call" : "som-put");
          som.currentTime = 0;
          som.play().catch(e => console.log("Erro ao tocar som: ", e));
        }
      }
      
      const scoreElement = document.getElementById("score");
      if (scoreElement) {
        scoreElement.textContent = `Binary Options: ${score}%`;
        
        if (score >= CONFIG.LIMIARES.SCORE_ULTRA_ALTO) {
          scoreElement.style.color = '#00ff00';
        } else if (score >= CONFIG.LIMIARES.SCORE_MUITO_ALTO) {
          scoreElement.style.color = '#7fff00';
        } else if (score >= CONFIG.LIMIARES.SCORE_ALTO) {
          scoreElement.style.color = '#ffff00';
        } else {
          scoreElement.style.color = '#ff8c00';
        }
      }
      
      // Atualizar contagem de wins/losses
      const historicoElement = document.getElementById("historico");
      if (historicoElement) {
        historicoElement.textContent = `${state.wins} WIN / ${state.losses} LOSS`;
      }
    }

    const calcularMedia = {
      simples: (dados, periodo) => {
        if (!Array.isArray(dados) || dados.length < periodo) return 0;
        const slice = dados.slice(-periodo);
        return slice.reduce((a, b) => a + b, 0) / periodo;
      },

      exponencial: (dados, periodo) => {
        if (!Array.isArray(dados) || dados.length < periodo) return [0];
        
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

    function calcularRSI(closes, periodo = CONFIG.PERIODOS.RSI) {
      if (!Array.isArray(closes) || closes.length < periodo + 1) return 50;
      
      let gains = 0, losses = 0;
      
      for (let i = 1; i <= periodo; i++) {
        const diff = closes[i] - closes[i - 1];
        if (diff > 0) gains += diff;
        else losses += Math.abs(diff);
      }

      let avgGain = gains / periodo;
      let avgLoss = Math.max(losses / periodo, 1e-8);

      for (let i = periodo + 1; i < closes.length; i++) {
        const diff = closes[i] - closes[i - 1];
        const gain = diff > 0 ? diff : 0;
        const loss = diff < 0 ? Math.abs(diff) : 0;
        
        avgGain = (avgGain * (periodo - 1) + gain) / periodo;
        avgLoss = Math.max((avgLoss * (periodo - 1) + loss) / periodo, 1e-8);
      }

      const rs = avgGain / avgLoss;
      return 100 - (100 / (1 + rs));
    }

    function calcularStochastic(highs, lows, closes, periodo = CONFIG.PERIODOS.STOCH) {
      try {
        if (!Array.isArray(closes) || closes.length < periodo) return { k: 50, d: 50 };
        
        const kValues = [];
        for (let i = periodo-1; i < closes.length; i++) {
          const sliceHigh = highs.slice(i-periodo+1, i+1);
          const sliceLow = lows.slice(i-periodo+1, i+1);
          const highestHigh = Math.max(...sliceHigh);
          const lowestLow = Math.min(...sliceLow);
          const range = highestHigh - lowestLow;
          kValues.push(range > 0 ? ((closes[i] - lowestLow) / range) * 100 : 50);
        }
        
        const dValues = kValues.length >= 3 ? calcularMedia.simples(kValues.slice(-3), 3) : 50;
        return {
          k: kValues[kValues.length-1] || 50,
          d: dValues || 50
        };
      } catch (e) {
        return { k: 50, d: 50 };
      }
    }

    function calcularWilliams(highs, lows, closes, periodo = CONFIG.PERIODOS.WILLIAMS) {
      try {
        if (!Array.isArray(closes) || closes.length < periodo) return -50;
        
        const sliceHigh = highs.slice(-periodo);
        const sliceLow = lows.slice(-periodo);
        const highestHigh = Math.max(...sliceHigh);
        const lowestLow = Math.min(...sliceLow);
        const range = highestHigh - lowestLow;
        
        return range > 0 ? ((highestHigh - closes[closes.length-1]) / range) * -100 : -50;
      } catch (e) {
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
        
        const startIdx = lenta - rapida;
        const macdLinha = emaRapida.slice(startIdx).map((val, idx) => val - emaLenta[idx]);
        const sinalLinha = calcularMedia.exponencial(macdLinha, sinal);
        
        const ultimoMACD = macdLinha[macdLinha.length - 1] || 0;
        const ultimoSinal = sinalLinha[sinalLinha.length - 1] || 0;
        
        return {
          histograma: ultimoMACD - ultimoSinal,
          macdLinha: ultimoMACD,
          sinalLinha: ultimoSinal
        };
      } catch (e) {
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
          if (!vela || !vela.volume) continue;
          const typicalPrice = (vela.high + vela.low + vela.close) / 3;
          typicalPriceSum += typicalPrice * vela.volume;
          volumeSum += vela.volume;
        }
        
        return volumeSum > 0 ? typicalPriceSum / volumeSum : 0;
      } catch (e) {
        return 0;
      }
    }

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
        return 0;
      }
    }

    function calcularSuperTrend(dados, periodo = CONFIG.PERIODOS.SUPERTREND, multiplicador = CONFIG.LIMIARES.SUPERTREND_SENSIBILIDADE) {
      try {
        if (!Array.isArray(dados) || dados.length < periodo) return { direcao: 0, valor: 0 };
        
        const atr = calcularATR(dados, periodo);
        const ultimo = dados[dados.length - 1];
        const hl2 = (ultimo.high + ultimo.low) / 2;
        
        const upperBand = hl2 + (multiplicador * atr);
        const lowerBand = hl2 - (multiplicador * atr);
        
        let direcao = ultimo.close > hl2 ? 1 : -1;
        let superTrend = direcao === 1 ? lowerBand : upperBand;
        
        return { direcao, valor: superTrend };
      } catch (e) {
        return { direcao: 0, valor: 0 };
      }
    }

    // ✅ DETERMINAÇÃO DE TENDÊNCIA REFATORADA
    function determinarTendencia(emaCurta, emaMedia, emaLonga, precoAtual) {
      try {
        if (emaCurta === 0 || emaMedia === 0 || emaLonga === 0) return "INDEFINIDA";
        
        const regras = [
          { 
            condicao: () => emaCurta > emaMedia && emaMedia > emaLonga && precoAtual > emaCurta, 
            resultado: "FORTE_ALTA" 
          },
          { 
            condicao: () => emaCurta > emaMedia && emaMedia > emaLonga, 
            resultado: "ALTA" 
          },
          { 
            condicao: () => emaCurta < emaMedia && emaMedia < emaLonga && precoAtual < emaCurta, 
            resultado: "FORTE_BAIXA" 
          },
          { 
            condicao: () => emaCurta < emaMedia && emaMedia < emaLonga, 
            resultado: "BAIXA" 
          },
          { 
            condicao: () => true, 
            resultado: "LATERAL" 
          }
        ];
        
        return regras.find(regra => regra.condicao()).resultado;
      } catch (e) {
        return "INDEFINIDA";
      }
    }

    // ✅ VERIFICAR HORÁRIO IDEAL PARA BINARY OPTIONS
    function verificarHorarioIdealBinary() {
      const agora = new Date();
      const hora = agora.getHours();
      
      const horarios = CONFIG.BINARY_OPTIONS.HORARIOS_IDEAIS;
      
      // Verificar horários para evitar
      for (const evitar of horarios.EVITAR) {
        if ((hora >= evitar.inicio && hora < evitar.fim) || 
            (evitar.inicio > evitar.fim && (hora >= evitar.inicio || hora < evitar.fim))) {
          return { ideal: false, motivo: evitar.motivo, multiplicador: 0.7 };
        }
      }
      
      // Verificar horários ideais
      if (hora >= horarios.LONDRES_NY.inicio && hora <= horarios.LONDRES_NY.fim) {
        return { ideal: true, motivo: "Overlap Londres-NY", multiplicador: horarios.LONDRES_NY.multiplicador };
      }
      
      if (hora >= horarios.NY_ABERTURA.inicio && hora <= horarios.NY_ABERTURA.fim) {
        return { ideal: true, motivo: "Abertura NY", multiplicador: horarios.NY_ABERTURA.multiplicador };
      }
      
      return { ideal: false, motivo: "Horário neutro", multiplicador: 1.0 };
    }

    // ✅ CALCULAR SCORE PARA BINARY OPTIONS
    function calcularScoreBinaryOptions(indicadores) {
      let score = 50;
      let confirmacoes = [];
      
      // RSI
      if (indicadores.rsi < CONFIG.LIMIARES.RSI_OVERSOLD) {
        score += 8 * CONFIG.PESOS.RSI;
        confirmacoes.push("RSI Oversold");
      } else if (indicadores.rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT) {
        score -= 8 * CONFIG.PESOS.RSI;
        confirmacoes.push("RSI Overbought");
      }
      
      // MACD
      if (indicadores.macd.histograma > 0.0001) {
        score += 10 * CONFIG.PESOS.MACD;
        confirmacoes.push("MACD Bullish");
      } else if (indicadores.macd.histograma < -0.0001) {
        score -= 10 * CONFIG.PESOS.MACD;
        confirmacoes.push("MACD Bearish");
      }
      
      // Tendência
      switch(indicadores.tendencia) {
        case "FORTE_ALTA":
          score += 15 * CONFIG.PESOS.TENDENCIA;
          confirmacoes.push("Tendência FORTE ALTA");
          break;
        case "ALTA":
          score += 10 * CONFIG.PESOS.TENDENCIA;
          confirmacoes.push("Tendência ALTA");
          break;
        case "FORTE_BAIXA":
          score -= 15 * CONFIG.PESOS.TENDENCIA;
          confirmacoes.push("Tendência FORTE BAIXA");
          break;
        case "BAIXA":
          score -= 10 * CONFIG.PESOS.TENDENCIA;
          confirmacoes.push("Tendência BAIXA");
          break;
        case "LATERAL":
          score -= 5 * CONFIG.PESOS.LATERALIDADE;
          confirmacoes.push("Mercado LATERAL");
          break;
      }
      
      // SuperTrend
      if (indicadores.superTrend.direcao === 1 && indicadores.close > indicadores.superTrend.valor) {
        score += 8 * CONFIG.PESOS.SUPERTREND;
        confirmacoes.push("SuperTrend BULL");
      } else if (indicadores.superTrend.direcao === -1 && indicadores.close < indicadores.superTrend.valor) {
        score -= 8 * CONFIG.PESOS.SUPERTREND;
        confirmacoes.push("SuperTrend BEAR");
      }
      
      // Volume
      const volumeRatio = indicadores.volume / indicadores.volumeMedia;
      if (volumeRatio > CONFIG.LIMIARES.VOLUME_EXTREMO) {
        score += 12 * CONFIG.PESOS.VOLUME;
        confirmacoes.push(`Volume EXTREMO: ${volumeRatio.toFixed(1)}x`);
      } else if (volumeRatio > CONFIG.LIMIARES.VOLUME_ALTO) {
        score += 8 * CONFIG.PESOS.VOLUME;
        confirmacoes.push(`Volume ALTO: ${volumeRatio.toFixed(1)}x`);
      } else if (volumeRatio < 0.8) {
        score -= 8 * CONFIG.PESOS.VOLUME;
        confirmacoes.push("Volume BAIXO");
      }
      
      // Stochastic
      if (indicadores.stoch.k < CONFIG.LIMIARES.STOCH_OVERSOLD) {
        score += 4 * CONFIG.PESOS.STOCH;
        confirmacoes.push("Stoch Oversold");
      } else if (indicadores.stoch.k > CONFIG.LIMIARES.STOCH_OVERBOUGHT) {
        score -= 4 * CONFIG.PESOS.STOCH;
        confirmacoes.push("Stoch Overbought");
      }
      
      // Williams
      if (indicadores.williams < CONFIG.LIMIARES.WILLIAMS_OVERSOLD) {
        score += 3 * CONFIG.PESOS.WILLIAMS;
        confirmacoes.push("Williams Oversold");
      } else if (indicadores.williams > CONFIG.LIMIARES.WILLIAMS_OVERBOUGHT) {
        score -= 3 * CONFIG.PESOS.WILLIAMS;
        confirmacoes.push("Williams Overbought");
      }
      
      // VWAP
      if (indicadores.vwap > 0) {
        const vwapDesvio = Math.abs(indicadores.close - indicadores.vwap) / indicadores.vwap;
        if (vwapDesvio > CONFIG.LIMIARES.VWAP_DESVIO) {
          if (indicadores.close > indicadores.vwap) {
            score += 3 * CONFIG.PESOS.VWAP;
            confirmacoes.push("Acima VWAP");
          } else {
            score -= 3 * CONFIG.PESOS.VWAP;
            confirmacoes.push("Abaixo VWAP");
          }
        }
      }
      
      // Order Book (se disponível)
      if (indicadores.buyPressure !== undefined) {
        if (indicadores.buyPressure > 0.6) {
          score += 5 * CONFIG.PESOS.INSTITUTIONAL;
          confirmacoes.push(`Buy Pressure: ${(indicadores.buyPressure*100).toFixed(1)}%`);
        } else if (indicadores.buyPressure < 0.4) {
          score -= 5 * CONFIG.PESOS.INSTITUTIONAL;
          confirmacoes.push(`Sell Pressure: ${((1-indicadores.buyPressure)*100).toFixed(1)}%`);
        }
      }
      
      // Aplicar multiplicador de horário
      const horario = verificarHorarioIdealBinary();
      score *= horario.multiplicador;
      if (horario.multiplicador !== 1.0) {
        confirmacoes.push(`${horario.motivo} (${horario.multiplicador}x)`);
      }
      
      const scoreFinal = Math.min(100, Math.max(0, Math.round(score)));
      
      return {
        score: scoreFinal,
        confirmacoes,
        confluencia: confirmacoes.length,
        horario: horario,
        volumeRatio: volumeRatio,
        buyPressure: indicadores.buyPressure
      };
    }

    // ✅ DETERMINAR SINAL PARA BINARY OPTIONS
    function determinarSinalBinary(analise, indicadores) {
      // Filtros rigorosos
      if (analise.score < CONFIG.RISCO.SCORE_MINIMO_ENTRADA) {
        return {
          sinal: "ESPERAR",
          motivo: `Score baixo: ${analise.score}% (mín: ${CONFIG.RISCO.SCORE_MINIMO_ENTRADA}%)`,
          analise
        };
      }
      
      if (analise.confluencia < CONFIG.RISCO.CONFLUENCIA_MINIMA) {
        return {
          sinal: "ESPERAR", 
          motivo: `Poucas confirmações: ${analise.confluencia}/${CONFIG.RISCO.CONFLUENCIA_MINIMA}`,
          analise
        };
      }
      
      if (analise.volumeRatio < CONFIG.RISCO.VOLUME_MINIMO_MULTIPLICADOR) {
        return {
          sinal: "ESPERAR",
          motivo: `Volume baixo: ${analise.volumeRatio.toFixed(1)}x (mín: ${CONFIG.RISCO.VOLUME_MINIMO_MULTIPLICADOR}x)`,
          analise
        };
      }
      
      // Determinar direção
      let direcaoCall = 0;
      let direcaoPut = 0;
      
      if (indicadores.rsi < CONFIG.LIMIARES.RSI_OVERSOLD) direcaoCall += 2;
      else if (indicadores.rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT) direcaoPut += 2;
      
      if (indicadores.macd.histograma > 0) direcaoCall += 2;
      else direcaoPut += 2;
      
      if (indicadores.superTrend.direcao === 1) direcaoCall += 3;
      else if (indicadores.superTrend.direcao === -1) direcaoPut += 3;
      
      if (indicadores.tendencia.includes("ALTA")) direcaoCall += 3;
      else if (indicadores.tendencia.includes("BAIXA")) direcaoPut += 3;
      
      if (indicadores.stoch.k < CONFIG.LIMIARES.STOCH_OVERSOLD) direcaoCall += 1;
      else if (indicadores.stoch.k > CONFIG.LIMIARES.STOCH_OVERBOUGHT) direcaoPut += 1;
      
      let sinalFinal;
      if (direcaoCall > direcaoPut + 1) {
        sinalFinal = "CALL";
      } else if (direcaoPut > direcaoCall + 1) {
        sinalFinal = "PUT";
      } else {
        sinalFinal = "ESPERAR";
      }
      
      return {
        sinal: sinalFinal,
        motivo: `Direção: CALL=${direcaoCall}, PUT=${direcaoPut}`,
        analise,
        direcoes: { call: direcaoCall, put: direcaoPut }
      };
    }

    // ✅ FUNÇÃO PARA PARAR O SISTEMA
    function pararSistema() {
      if (state.intervaloAtual) {
        clearInterval(state.intervaloAtual);
        state.intervaloAtual = null;
      }
    }

    // ✅ ATUALIZAR DETALHES TÉCNICOS NA INTERFACE
    function atualizarDetalhes(analise) {
      // Critérios Técnicos
      const criteriosElement = document.getElementById("criterios");
      if (criteriosElement) {
        criteriosElement.innerHTML = analise.confirmacoes.map(item => `<li>${item}</li>`).join("");
      }

      // Horário
      const horarioElement = document.getElementById("horario");
      if (horarioElement) {
        horarioElement.textContent = analise.horario.motivo;
      }

      // Pressão de Compra
      const pressaoElement = document.getElementById("pressao");
      if (pressaoElement && analise.buyPressure !== undefined) {
        pressaoElement.textContent = `${(analise.buyPressure * 100).toFixed(1)}%`;
      }
    }

    // ✅ SINCRONIZAÇÃO DE TIMER MELHORADA
    function sincronizarTimer() {
      const agora = new Date();
      const segundosRestantes = 60 - agora.getSeconds();
      
      state.timer = segundosRestantes;
      
      const timerElement = document.getElementById("timer");
      if (timerElement) timerElement.textContent = formatarTimer(segundosRestantes);
      
      // Parar qualquer intervalo existente
      if (state.intervaloAtual) clearInterval(state.intervaloAtual);
      
      // Configurar nova sincronização
      state.intervaloAtual = setInterval(() => {
        const agora = new Date();
        const segundos = agora.getSeconds();
        state.timer = 60 - segundos;
        
        if (timerElement) timerElement.textContent = formatarTimer(state.timer);
        
        if (segundos === 0 && !state.leituraEmAndamento) {
          analisarMercadoPublico();
        }
      }, 1000);
    }

    // ✅ ANÁLISE PRINCIPAL COM APIs PÚBLICAS
    async function analisarMercadoPublico() {
      if (state.leituraEmAndamento || !state.marketOpen) return;
      state.leituraEmAndamento = true;
      
      try {
        // Obter dados reais de APIs públicas
        const [dados, ticker, orderBook] = await Promise.all([
          obterDadosReaisPublicos(),
          obterTickerPublico().catch(() => null),
          obterOrderBookPublico().catch(() => null)
        ]);
        
        const velaAtual = dados[dados.length - 1];
        
        // Atualizar fonte de dados
        const fonteElement = document.getElementById("fonte");
        if (fonteElement) fonteElement.textContent = velaAtual.source;
        
        // Extrair dados
        const closes = dados.map(v => v.close);
        const highs = dados.map(v => v.high);
        const lows = dados.map(v => v.low);
        const volumes = dados.map(v => v.volume);
        
        // Calcular indicadores
        const indicadores = {
          rsi: calcularRSI(closes),
          macd: calcularMACD(closes),
          stoch: calcularStochastic(highs, lows, closes),
          williams: calcularWilliams(highs, lows, closes),
          superTrend: calcularSuperTrend(dados),
          vwap: calcularVWAP(dados),
          atr: calcularATR(dados),
          
          close: velaAtual.close,
          volume: velaAtual.volume,
          volumeMedia: calcularMedia.simples(volumes.slice(-20), 20),
          
          // Order book (se disponível)
          buyPressure: orderBook?.buyPressure,
          sellPressure: orderBook?.sellPressure,
          spread: orderBook?.spreadPercent
        };
        
        // Calcular tendência
        const emasCurta = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_CURTA);
        const emasMedia = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_MEDIA);
        const emasLonga = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_LONGA);
        
        const emaCurta = emasCurta[emasCurta.length - 1] || 0;
        const emaMedia = emasMedia[emasMedia.length - 1] || 0;
        const emaLonga = emasLonga[emasLonga.length - 1] || 0;
        
        indicadores.tendencia = determinarTendencia(emaCurta, emaMedia, emaLonga, velaAtual.close);
        
        // Análise para binary options
        const analise = calcularScoreBinaryOptions(indicadores);
        const resultado = determinarSinalBinary(analise, indicadores);
        
        // Atualizar estado
        state.ultimoSinal = resultado.sinal;
        state.ultimoScore = resultado.analise.score;
        state.ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR");
        
        // Atualizar interface
        atualizarInterface(resultado.sinal, resultado.analise.score);
        atualizarDetalhes(resultado.analise);
        
        // Histórico (formatar preço com vírgula)
        const precoFormatado = formatarMoeda(velaAtual.close);
        const historico = `${state.ultimaAtualizacao} - ${resultado.sinal} (${resultado.analise.score}%) - ${precoFormatado} - ${velaAtual.source}`;
        state.ultimos.unshift(historico);
        if (state.ultimos.length > 10) state.ultimos.pop();
        
        const ultimosElement = document.getElementById("ultimos");
        if (ultimosElement) {
          ultimosElement.innerHTML = state.ultimos.map(item => {
            let classe = "";
            if (item.includes("CALL")) classe = "call-item";
            else if (item.includes("PUT")) classe = "put-item";
            else if (item.includes("ESPERAR")) classe = "esperar-item";
            return `<li class="${classe}">${item}</li>`;
          }).join("");
        }
        
        state.tentativasErro = 0;
        
      } catch (e) {
        console.error("❌ Erro análise pública:", e);
        atualizarInterface("ERRO", 0);
        state.tentativasErro++;
        
        if (state.tentativasErro > 3) {
          setTimeout(() => {
            state.tentativasErro = 0;
            state.leituraEmAndamento = false;
          }, 60000);
        }
      } finally {
        state.leituraEmAndamento = false;
      }
    }

    // ✅ INICIALIZAÇÃO SISTEMA PÚBLICO
    function iniciarSistemaPublico() {
      // Primeira análise
      analisarMercadoPublico();
      
      // Timer
      sincronizarTimer();
      
      // Relógio
      setInterval(atualizarRelogio, 1000);
      
      // Botões de win/loss
      document.getElementById("btn-win").addEventListener("click", () => {
        state.wins++;
        atualizarInterface(state.ultimoSinal, state.ultimoScore);
      });
      
      document.getElementById("btn-loss").addEventListener("click", () => {
        state.losses++;
        atualizarInterface(state.ultimoSinal, state.ultimoScore);
      });
    }

    // Iniciar quando o documento estiver pronto
    document.addEventListener("DOMContentLoaded", iniciarSistemaPublico);
