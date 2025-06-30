// =============================================
        // CONFIGURAÇÕES GLOBAIS (OTIMIZADAS PARA EURUSD)
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
            rsiCache: { avgGain: 0, avgLoss: 0, initialized: false },
            emaCache: { ema5: null, ema13: null, ema200: null },
            macdCache: { emaRapida: null, emaLenta: null, macdLine: [], signalLine: [] },
            superTrendCache: [],
            atrGlobal: 0,
            rsiHistory: [],
            cooldown: 0,
            stochCache: []
        };

        const CONFIG = {
            API_ENDPOINTS: { TWELVE_DATA: "https://api.twelvedata.com" },
            PARES: { FOREX_IDX: "EUR/USD" },
            PERIODOS: {
                RSI: 9,
                STOCH_K: 14,
                STOCH_D: 3,
                EMA_CURTA: 5,
                EMA_MEDIA: 13,
                EMA_LONGA: 200,
                MACD_RAPIDA: 6,
                MACD_LENTA: 13,
                MACD_SINAL: 9,
                ANALISE_LATERAL: 20,
                ATR: 14,
                SUPERTREND: 7,
                VOLUME_PROFILE: 50,
                DIVERGENCIA_LOOKBACK: 8,
                EXTREME_LOOKBACK: 2
            },
            LIMIARES: {
                SCORE_ALTO: 85,
                SCORE_MEDIO: 70,
                RSI_OVERBOUGHT: 70,
                RSI_OVERSOLD: 30,
                STOCH_OVERBOUGHT: 85,
                STOCH_OVERSOLD: 15,
                VARIACAO_LATERAL: 0.0003,
                ATR_LIMIAR: 0.0005,
                BUCKET_SIZE: 0.0005,
                LATERALIDADE_LIMIAR: 0.0003
            },
            PESOS: {
                RSI: 1.7,
                MACD: 2.2,
                TENDENCIA: 2.8,
                STOCH: 1.2,
                SUPERTREND: 1.9,
                DIVERGENCIA: 2.0
            },
            HORARIOS_OPERACAO: [
                { inicio: 7, fim: 17 },  // Londres (08:00-18:00 horário local)
                { inicio: 12, fim: 20 }  // Nova York (08:00-16:00 horário local)
            ]
        };

        // =============================================
        // GERENCIADOR DE CHAVES API
        // =============================================
        const API_KEYS = ["9cf795b2a4f14d43a049ca935d174ebb", "0105e6681b894e0185704171c53f5075"];
        let currentKeyIndex = 0;

        // =============================================
        // VERIFICAÇÃO DE HORÁRIO DE OPERAÇÃO (CORRIGIDA)
        // =============================================
        function verificarHorarioOperacao() {
            const horaUTC = new Date().getUTCHours();
            return CONFIG.HORARIOS_OPERACAO.some(horario => 
                horaUTC >= horario.inicio && horaUTC < horario.fim
            );
        }

        // =============================================
        // SISTEMA DE TENDÊNCIA OTIMIZADO PARA EURUSD
        // =============================================
        function avaliarTendencia(ema5, ema13) {
            const gradiente = (ema5 - ema13) / ema13 * 10000;
            const forca = Math.min(100, Math.abs(gradiente * 2));
            
            if (forca > 75) {
                return gradiente > 0 
                    ? { tendencia: "FORTE_ALTA", forca }
                    : { tendencia: "FORTE_BAIXA", forca };
            }
            
            if (forca > 40) {
                return gradiente > 0 
                    ? { tendencia: "ALTA", forca } 
                    : { tendencia: "BAIXA", forca };
            }
            
            return { tendencia: "NEUTRA", forca: 0 };
        }

        // =============================================
        // DETECÇÃO DE LATERALIDADE (OTIMIZADA)
        // =============================================
        function detectarLateralidade(closes) {
            if (closes.length < 20) return false;
            const variacoes = closes.slice(-20).map((c, i, arr) => 
                i > 0 ? Math.abs(c - arr[i-1]) : 0
            ).slice(1);
            return calcularMedia.simples(variacoes) < CONFIG.LIMIARES.LATERALIDADE_LIMIAR;
        }

        // =============================================
        // SUPORTE/RESISTÊNCIA DINÂMICO (SIMPLIFICADO)
        // =============================================
        function calcularZonasPreco(dados) {
            const periodo = Math.min(50, dados.length);
            const slice = dados.slice(-periodo);
            const highs = slice.map(v => v.high);
            const lows = slice.map(v => v.low);
            return {
                resistencia: Math.max(...highs),
                suporte: Math.min(...lows)
            };
        }

        // =============================================
        // GERADOR DE SINAIS PARA EURUSD (CORRIGIDO)
        // =============================================
        function gerarSinal(indicadores, divergencias, lateral) {
            const { close, emaCurta, macd, tendencia, superTrend } = indicadores;
            
            if (lateral) return "ESPERAR";

            // Priorizar tendência forte
            if (tendencia.forca > 80) {
                if (tendencia.tendencia.includes("ALTA") && close > emaCurta && macd.histograma > 0) 
                    return "CALL";
                if (tendencia.tendencia.includes("BAIXA") && close < emaCurta && macd.histograma < 0) 
                    return "PUT";
            }

            // Breakout com buffer de 0.1%
            const buffer = (state.resistenciaKey - state.suporteKey) * 0.001;
            if (close > state.resistenciaKey + buffer) return "CALL";
            if (close < state.suporteKey - buffer) return "PUT";

            // Divergências somente em tendências moderadas
            if (divergencias.divergenciaRSI && tendencia.forca < 80) {
                if (divergencias.tipoDivergencia === "ALTA" && close > state.suporteKey) 
                    return "CALL";
                if (divergencias.tipoDivergencia === "BAIXA" && close < state.resistenciaKey) 
                    return "PUT";
            }
            
            // Confirmação SuperTrend
            if (tendencia.tendencia.includes("ALTA") && close > superTrend.valor) 
                return "CALL";
            if (tendencia.tendencia.includes("BAIXA") && close < superTrend.valor) 
                return "PUT";

            return "ESPERAR";
        }

        // =============================================
        // CALCULADOR DE CONFIANÇA (MAIS PRECISO)
        // =============================================
        function calcularScore(sinal, indicadores, divergencias) {
            let score = 65;
            const { tendencia, close, emaMedia, superTrend } = indicadores;

            // Fatores principais
            if (sinal === "CALL") {
                if (tendencia.tendencia.includes("ALTA")) score += 25;
                if (close > emaMedia) score += 15;
                if (close > superTrend.valor) score += 10;
            } 
            else if (sinal === "PUT") {
                if (tendencia.tendencia.includes("BAIXA")) score += 25;
                if (close < emaMedia) score += 15;
                if (close < superTrend.valor) score += 10;
            }
            
            if (divergencias.divergenciaRSI) score += 20;
            
            return Math.min(100, Math.max(0, score));
        }

        // =============================================
        // FUNÇÕES UTILITÁRIAS
        // =============================================
        function formatarTimer(segundos) {
            return `0:${segundos.toString().padStart(2, '0')}`;
        }

        function atualizarRelogio() {
            const elementoHora = document.getElementById("hora");
            const lastUpdated = document.getElementById("last-updated");
            const marketStatus = document.getElementById("market-status");
            const statusIndicator = document.querySelector(".status-indicator");
            
            if (elementoHora) {
                const now = new Date();
                state.ultimaAtualizacao = now.toLocaleTimeString("pt-BR", {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                });
                elementoHora.textContent = state.ultimaAtualizacao;
                state.marketOpen = verificarHorarioOperacao();
                
                if (lastUpdated) lastUpdated.textContent = state.ultimaAtualizacao;
                
                if (marketStatus && statusIndicator) {
                    if (state.marketOpen) {
                        marketStatus.textContent = "Mercado Aberto";
                        marketStatus.className = "market-status market-open";
                        statusIndicator.className = "status-indicator open";
                    } else {
                        marketStatus.textContent = "Mercado Fechado";
                        marketStatus.className = "market-status market-closed";
                        statusIndicator.className = "status-indicator closed";
                    }
                }
            }
        }

        // =============================================
        // INDICADORES TÉCNICOS (OTIMIZADOS)
        // =============================================
        const calcularMedia = {
            simples: (dados, periodo = dados.length) => {
                const slice = dados.slice(-periodo);
                return slice.reduce((a, b) => a + b, 0) / slice.length;
            },
            exponencial: (dados, periodo) => {
                if (dados.length < periodo) return [];
                let ema = calcularMedia.simples(dados.slice(0, periodo), k = 2/(periodo+1);
                const emas = [ema];
                for (let i = periodo; i < dados.length; i++) {
                    ema = dados[i] * k + ema * (1 - k);
                    emas.push(ema);
                }
                return emas;
            }
        };

        // RSI com cálculo incremental
        function calcularRSI(closes) {
            const periodo = CONFIG.PERIODOS.RSI;
            if (closes.length < periodo + 1) return 50;
            
            if (!state.rsiCache.initialized) {
                let gains = 0, losses = 0;
                for (let i = 1; i <= periodo; i++) {
                    const diff = closes[i] - closes[i-1];
                    if (diff > 0) gains += diff;
                    else losses -= diff;
                }
                state.rsiCache.avgGain = gains / periodo;
                state.rsiCache.avgLoss = losses / periodo;
                state.rsiCache.initialized = true;
            } else {
                const diff = closes[closes.length-1] - closes[closes.length-2];
                if (diff > 0) {
                    state.rsiCache.avgGain = (state.rsiCache.avgGain * (periodo-1) + diff) / periodo;
                    state.rsiCache.avgLoss = (state.rsiCache.avgLoss * (periodo-1)) / periodo;
                } else {
                    state.rsiCache.avgGain = (state.rsiCache.avgGain * (periodo-1)) / periodo;
                    state.rsiCache.avgLoss = (state.rsiCache.avgLoss * (periodo-1) - diff) / periodo;
                }
            }
            
            const rs = state.rsiCache.avgLoss ? state.rsiCache.avgGain / state.rsiCache.avgLoss : Infinity;
            return 100 - (100 / (1 + rs));
        }

        // Stochastic otimizado
        function calcularStochastic(highs, lows, closes) {
            const periodoK = CONFIG.PERIODOS.STOCH_K;
            const periodoD = CONFIG.PERIODOS.STOCH_D;
            
            if (closes.length < periodoK) return { k: 50, d: 50 };
            
            const sliceHigh = highs.slice(-periodoK);
            const sliceLow = lows.slice(-periodoK);
            const highestHigh = Math.max(...sliceHigh);
            const lowestLow = Math.min(...sliceLow);
            const range = highestHigh - lowestLow;
            const k = range ? ((closes[closes.length-1] - lowestLow) / range) * 100 : 50;
            
            state.stochCache.push(k);
            if (state.stochCache.length > periodoD) state.stochCache.shift();
            
            const d = state.stochCache.length ? 
                calcularMedia.simples(state.stochCache, state.stochCache.length) : 50;
            
            return { k, d };
        }

        // MACD otimizado
        function calcularMACD(closes) {
            const rapida = CONFIG.PERIODOS.MACD_RAPIDA;
            const lenta = CONFIG.PERIODOS.MACD_LENTA;
            const sinal = CONFIG.PERIODOS.MACD_SINAL;
            
            if (state.macdCache.emaRapida === null) {
                const emaRapida = calcularMedia.exponencial(closes, rapida);
                const emaLenta = calcularMedia.exponencial(closes, lenta);
                const macdLine = emaRapida.slice(lenta - rapida).map((val, idx) => val - emaLenta[idx]);
                const signalLine = calcularMedia.exponencial(macdLine, sinal);
                
                state.macdCache = {
                    emaRapida: emaRapida[emaRapida.length-1],
                    emaLenta: emaLenta[emaLenta.length-1],
                    macdLine: macdLine,
                    signalLine: signalLine
                };
            } else {
                const kRapida = 2/(rapida+1), kLenta = 2/(lenta+1);
                const novoValor = closes[closes.length-1];
                state.macdCache.emaRapida = novoValor * kRapida + state.macdCache.emaRapida * (1 - kRapida);
                state.macdCache.emaLenta = novoValor * kLenta + state.macdCache.emaLenta * (1 - kLenta);
                
                const novaMacdLinha = state.macdCache.emaRapida - state.macdCache.emaLenta;
                state.macdCache.macdLine.push(novaMacdLinha);
                
                if (state.macdCache.signalLine.length === 0) {
                    state.macdCache.signalLine.push(novaMacdLinha);
                } else {
                    const kSinal = 2/(sinal+1);
                    const ultimoSinal = state.macdCache.signalLine[state.macdCache.signalLine.length-1];
                    const novoSignal = novaMacdLinha * kSinal + ultimoSinal * (1 - kSinal);
                    state.macdCache.signalLine.push(novoSignal);
                }
            }
            
            const macdVal = state.macdCache.macdLine[state.macdCache.macdLine.length-1];
            const signalVal = state.macdCache.signalLine[state.macdCache.signalLine.length-1];
            
            return {
                histograma: macdVal - signalVal,
                macdLinha: macdVal,
                sinalLinha: signalVal
            };
        }

        // ATR para SuperTrend
        function calcularATR(dados, periodo = CONFIG.PERIODOS.ATR) {
            if (dados.length < periodo + 1) return 0;
            
            const trs = [];
            for (let i = 1; i < dados.length; i++) {
                const tr = Math.max(
                    dados[i].high - dados[i].low,
                    Math.abs(dados[i].high - dados[i-1].close),
                    Math.abs(dados[i].low - dados[i-1].close)
                );
                trs.push(tr);
            }
            
            return calcularMedia.simples(trs.slice(-periodo), periodo);
        }

        // SuperTrend otimizado
        function calcularSuperTrend(dados) {
            const periodo = CONFIG.PERIODOS.SUPERTREND;
            if (dados.length < periodo) return { valor: 0, direcao: 0 };
            
            if (state.atrGlobal === 0) {
                state.atrGlobal = calcularATR(dados, periodo);
            }
            
            const vela = dados[dados.length-1];
            const hl2 = (vela.high + vela.low) / 2;
            const atr = state.atrGlobal;
            const upper = hl2 + 3 * atr;
            const lower = hl2 - 3 * atr;
            
            let valor, direcao;
            
            if (state.superTrendCache.length === 0) {
                valor = upper;
                direcao = 1;
            } else {
                const prev = state.superTrendCache[state.superTrendCache.length-1];
                if (vela.close > prev.valor) {
                    direcao = 1;
                    valor = Math.max(lower, prev.valor);
                } else {
                    direcao = -1;
                    valor = Math.min(upper, prev.valor);
                }
            }
            
            state.superTrendCache.push({ valor, direcao });
            if (state.superTrendCache.length > 100) state.superTrendCache.shift();
            
            return { valor, direcao };
        }

        // Detecção de divergências (simplificada)
        function detectarDivergencias(closes, rsis, highs, lows) {
            const lookback = CONFIG.PERIODOS.DIVERGENCIA_LOOKBACK;
            if (closes.length < lookback || rsis.length < lookback) 
                return { divergenciaRSI: false, tipoDivergencia: "NENHUMA" };
            
            // Busca por máximos e mínimos nos preços e RSI
            const priceMax = Math.max(...highs.slice(-lookback));
            const priceMin = Math.min(...lows.slice(-lookback));
            const rsiMax = Math.max(...rsis.slice(-lookback));
            const rsiMin = Math.min(...rsis.slice(-lookback));
            
            // Verifica divergências regulares
            const lastPrice = closes[closes.length-1];
            const lastRsi = rsis[rsis.length-1];
            
            if (lastPrice === priceMax && lastRsi < rsiMax - 5) {
                return { divergenciaRSI: true, tipoDivergencia: "BAIXA" };
            }
            
            if (lastPrice === priceMin && lastRsi > rsiMin + 5) {
                return { divergenciaRSI: true, tipoDivergencia: "ALTA" };
            }
            
            return { divergenciaRSI: false, tipoDivergencia: "NENHUMA" };
        }

        // =============================================
        // CORE DO SISTEMA (CORRIGIDO)
        // =============================================
        async function analisarMercado() {
            if (state.leituraEmAndamento) return;
            state.leituraEmAndamento = true;
            
            try {
                const dados = await obterDadosTwelveData();
                state.dadosHistoricos = dados;
                if (dados.length < 50) {
                    console.log("Aguardando mais dados...");
                    return;
                }

                const velaAtual = dados[dados.length - 1];
                const closes = dados.map(v => v.close);
                const highs = dados.map(v => v.high);
                const lows = dados.map(v => v.low);

                // Calcular EMAs
                const ema5 = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_CURTA).pop();
                const ema13 = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_MEDIA).pop();
                
                const superTrend = calcularSuperTrend(dados);
                const rsi = calcularRSI(closes);
                const stoch = calcularStochastic(highs, lows, closes);
                const macd = calcularMACD(closes);
                
                // Atualizar histórico RSI
                state.rsiHistory.push(rsi);
                if (state.rsiHistory.length > 100) state.rsiHistory.shift();

                const divergencias = detectarDivergencias(closes, state.rsiHistory, highs, lows);
                const tendencia = avaliarTendencia(ema5, ema13);
                const lateral = detectarLateralidade(closes);
                const zonas = calcularZonasPreco(dados);
                
                state.tendenciaDetectada = tendencia.tendencia;
                state.forcaTendencia = tendencia.forca;
                state.resistenciaKey = zonas.resistencia;
                state.suporteKey = zonas.suporte;

                const indicadores = {
                    rsi, stoch, macd, emaCurta: ema5, emaMedia: ema13,
                    close: velaAtual.close, tendencia, superTrend
                };

                let sinal = gerarSinal(indicadores, divergencias, lateral);
                
                // Aplicar cooldown
                if (sinal !== "ESPERAR" && state.cooldown <= 0) {
                    state.cooldown = 3;
                } else if (state.cooldown > 0) {
                    state.cooldown--;
                    sinal = "ESPERAR";
                }

                const score = calcularScore(sinal, indicadores, divergencias);
                state.ultimoSinal = sinal;
                state.ultimoScore = score;
                state.ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR");

                // Atualizar interface
                atualizarInterface(sinal, score, state.tendenciaDetectada, state.forcaTendencia);

                // Atualizar histórico de sinais
                state.ultimos.unshift(`${state.ultimaAtualizacao} - ${sinal} (${score}%)`);
                if (state.ultimos.length > 8) state.ultimos.pop();
                const ultimosElement = document.getElementById("ultimos");
                if (ultimosElement) ultimosElement.innerHTML = state.ultimos.map(i => `<li>${i}</li>`).join("");
                
                // Atualizar critérios
                const criteriosElement = document.getElementById("criterios");
                if (criteriosElement) {
                    criteriosElement.innerHTML = `
                        <li>📊 Tendência: ${state.tendenciaDetectada} (${state.forcaTendencia}%)</li>
                        <li>💰 Preço: ${indicadores.close.toFixed(5)}</li>
                        <li>📉 RSI: ${rsi.toFixed(2)}</li>
                        <li>📊 MACD: ${macd.histograma.toFixed(6)}</li>
                        <li>📌 Suporte: ${state.suporteKey.toFixed(5)}</li>
                        <li>📌 Resistência: ${state.resistenciaKey.toFixed(5)}</li>
                        <li>⚠️ Divergência: ${divergencias.tipoDivergencia}</li>
                    `;
                }

            } catch (e) {
                console.error("Erro na análise:", e);
                atualizarInterface("ERRO", 0, "ERRO", 0);
                
                const criteriosElement = document.getElementById("criterios");
                if (criteriosElement) criteriosElement.innerHTML = `<li>Erro: ${e.message}</li>`;
                
                if (++state.tentativasErro > 3) setTimeout(() => location.reload(), 10000);
            } finally {
                state.leituraEmAndamento = false;
            }
        }

        // =============================================
        // OBTER DADOS (SIMULAÇÃO PARA DEMONSTRAÇÃO)
        // =============================================
        async function obterDadosTwelveData() {
            // Em produção real, usar a API Twelve Data
            // Para demonstração, geramos dados simulados
            const agora = new Date();
            const dados = [];
            
            // Preço base do EUR/USD
            let precoAtual = 1.0800;
            
            // Gerar 100 velas de 1 minuto
            for (let i = 100; i > 0; i--) {
                const time = new Date(agora.getTime() - i * 60000);
                const open = precoAtual;
                
                // Variação de preço aleatória
                const variacao = (Math.random() - 0.5) * 0.005;
                const close = open + variacao;
                const high = Math.max(open, close) + Math.random() * 0.001;
                const low = Math.min(open, close) - Math.random() * 0.001;
                const volume = 1000000 + Math.random() * 500000;
                
                dados.push({
                    time: time.toISOString(),
                    open,
                    high,
                    low,
                    close,
                    volume
                });
                
                precoAtual = close;
            }
            
            return dados;
        }

        // =============================================
        // CONTROLE DE TEMPO (CORRIGIDO)
        // =============================================
        function sincronizarTimer() {
            clearInterval(state.intervaloAtual);
            
            // Atualizar timer a cada segundo
            const elementoTimer = document.getElementById("timer");
            state.timer = 60;
            
            function atualizar() {
                state.timer--;
                if (elementoTimer) {
                    elementoTimer.textContent = formatarTimer(state.timer);
                    if (state.timer <= 5) elementoTimer.style.color = '#e74c3c';
                    else elementoTimer.style.color = '#3498db';
                }
                
                if (state.timer <= 0) {
                    state.timer = 60;
                    analisarMercado();
                }
            }
            
            // Ajustar para iniciar no próximo minuto
            const agora = new Date();
            const segundos = agora.getSeconds();
            state.timer = 60 - segundos;
            
            // Primeira execução
            setTimeout(() => {
                atualizar();
                state.intervaloAtual = setInterval(atualizar, 1000);
            }, (60 - segundos) * 1000);
        }

        // =============================================
        // ATUALIZAR INTERFACE
        // =============================================
        function atualizarInterface(sinal, score, tendencia, forca) {
            const comandoElement = document.getElementById("comando");
            const scoreElement = document.getElementById("score");
            const tendenciaElement = document.getElementById("tendencia");
            const forcaElement = document.getElementById("forca-tendencia");
            
            if (comandoElement) {
                comandoElement.textContent = sinal;
                comandoElement.className = sinal.toLowerCase();
                
                if (sinal === "CALL") comandoElement.innerHTML += " 📈";
                else if (sinal === "PUT") comandoElement.innerHTML += " 📉";
                else if (sinal === "ERRO") comandoElement.innerHTML += " ❗";
                else comandoElement.innerHTML += " ✋";
            }
            
            if (scoreElement) {
                scoreElement.textContent = `Confiança: ${score}%`;
                if (score >= CONFIG.LIMIARES.SCORE_ALTO) scoreElement.style.color = '#2ecc71';
                else if (score >= CONFIG.LIMIARES.SCORE_MEDIO) scoreElement.style.color = '#f39c12';
                else scoreElement.style.color = '#e74c3c';
            }
            
            if (tendenciaElement) {
                tendenciaElement.textContent = tendencia;
                if (tendencia.includes("ALTA")) tendenciaElement.className = "stat-value trend-up";
                else if (tendencia.includes("BAIXA")) tendenciaElement.className = "stat-value trend-down";
                else tendenciaElement.className = "stat-value trend-neutral";
            }
            
            if (forcaElement) forcaElement.textContent = `${forca}%`;
        }

        // =============================================
        // INICIALIZAÇÃO (CORRIGIDA)
        // =============================================
        function iniciarAplicativo() {
            // Iniciar processos
            atualizarRelogio();
            setInterval(atualizarRelogio, 1000);
            sincronizarTimer();
            
            // Forçar uma primeira análise
            setTimeout(analisarMercado, 2000);
            
            // Configurar botões
            document.getElementById("refresh-btn").addEventListener("click", analisarMercado);
            document.getElementById("backtest-btn").addEventListener("click", () => {
                alert("Backtest será executado em breve!");
            });
        }

        document.addEventListener("DOMContentLoaded", iniciarAplicativo);
    
