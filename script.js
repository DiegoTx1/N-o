// =============================================
        // CONFIGURAÇÕES GLOBAIS (ESTRATÉGIA 2025 OTIMIZADA)
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
            marketOpen: true,
            tendenciaDetectada: "NEUTRA",
            forcaTendencia: 0,
            dadosHistoricosM1: [],
            dadosHistoricosM5: [],
            cooldown: 0,
            indicadoresM1: null,
            lastCandleTimeM1: null,
            lastCandleTimeM5: null
        };

        const CONFIG = {
            API_ENDPOINTS: {
                TWELVE_DATA: "https://api.twelvedata.com"
            },
            PARES: {
                FOREX: "EUR/USD"
            },
            PERIODOS: {
                RSI: 14,
                STOCH_K: 14,
                STOCH_D: 3,
                EMA_CURTA: 8,
                EMA_MEDIA: 21,
                EMA_LONGA: 50,
                EMA_LONGA2: 200,
                MACD_RAPIDA: 12,
                MACD_LENTA: 26,
                MACD_SINAL: 9,
                ATR: 14,
                SUPERTREND: 10,
                ADX: 14,
                BOLLINGER: 20,
                ENTROPIA: 14
            },
            LIMIARES: {
                SCORE_ALTO: 85,
                SCORE_MEDIO: 70,
                RSI_OVERBOUGHT: 70,
                RSI_OVERSOLD: 30,
                STOCH_OVERBOUGHT: 80,
                STOCH_OVERSOLD: 20,
                VARIACAO_LATERAL: 0.0005,
                ATR_LIMIAR: 0.0008,
                ADX_TENDENCIA: 25,
                BOLLINGER_LARGURA: 0.0008,
                ENTROPIA_ALTA: 0.5
            },
            PESOS: {
                RSI: 1.5,
                MACD: 2.0,
                TENDENCIA: 2.5,
                SUPERTREND: 1.8,
                ADX: 2.2,
                BOLLINGER: 1.9,
                ENTROPIA: 2.0
            }
        };

        // =============================================
        // GERENCIADOR DE CHAVES API
        // =============================================
        const API_KEYS = [
            "0105e6681b894e0185704171c53f5075",
            "b7a9c9a3d8f74a1d8e4b6c3f0d8f3e7a",
            "c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3"
        ];
        let currentKeyIndex = 0;
        let errorCount = 0;

        // =============================================
        // SISTEMA DE TENDÊNCIA AVANÇADO 2025 (OTIMIZADO)
        // =============================================
        function avaliarTendencia(ema8, ema21, ema50, ema200, close, adx, atr) {
            // Verificar o alinhamento das médias
            const alinhamentoAlta = ema8 > ema21 && ema21 > ema50 && ema50 > ema200;
            const alinhamentoBaixa = ema8 < ema21 && ema21 < ema50 && ema50 < ema200;

            // Calcular distância percentual entre EMAs
            const distanciaAlta = alinhamentoAlta 
                ? ((ema8 - ema21) / ema21 + (ema21 - ema50) / ema50 + (ema50 - ema200) / ema200) / 3 * 100
                : 0;
            
            const distanciaBaixa = alinhamentoBaixa 
                ? ((ema21 - ema8) / ema8 + (ema50 - ema21) / ema21 + (ema200 - ema50) / ema50) / 3 * 100
                : 0;

            // Força da tendência baseada no ADX, ATR e distância entre EMAs
            const forcaADX = adx > CONFIG.LIMIARES.ADX_TENDENCIA ? adx : 0;
            const forcaATR = atr > CONFIG.LIMIARES.ATR_LIMIAR ? (atr / CONFIG.LIMIARES.ATR_LIMIAR) * 25 : 0;
            const forcaDistancia = Math.max(distanciaAlta, distanciaBaixa) * 0.8;
            
            const forcaTendencia = Math.min(100, forcaADX + forcaATR + forcaDistancia);

            // Classificação da tendência
            if (alinhamentoAlta && close > ema200 && forcaTendencia > 60) {
                return { tendencia: "FORTE ALTA 📈", forca: forcaTendencia };
            } else if (alinhamentoBaixa && close < ema200 && forcaTendencia > 60) {
                return { tendencia: "FORTE BAIXA 📉", forca: forcaTendencia };
            } else if (ema8 > ema21 && ema21 > ema50 && close > ema50) {
                return { tendencia: "ALTA ↗️", forca: forcaTendencia };
            } else if (ema8 < ema21 && ema21 < ema50 && close < ema50) {
                return { tendencia: "BAIXA ↘️", forca: forcaTendencia };
            }

            return { tendencia: "NEUTRA ➖", forca: 0 };
        }

        // =============================================
        // INDICADORES QUÂNTICOS 2025 (OTIMIZADOS)
        // =============================================

        // 1. OSCILADOR DE ENTROPIA DE MERCADO (MELHORADO)
        function calcularEntropiaMercado(dados, periodo = CONFIG.PERIODOS.ENTROPIA) {
            try {
                if (dados.length < periodo * 2) return 0.5;
                
                const entropias = [];
                for (let i = periodo; i < dados.length; i++) {
                    const slice = dados.slice(i - periodo, i);
                    const retornos = [];
                    
                    for (let j = 1; j < slice.length; j++) {
                        retornos.push(Math.log(slice[j].close / slice[j-1].close));
                    }
                    
                    // CORREÇÃO: Adicionado o parâmetro de período faltante
                    const media = calcularMedia.simples(retornos, retornos.length);
                    const variancia = retornos.reduce((sum, r) => sum + Math.pow(r - media, 2), 0) / periodo;
                    const entropia = Math.sqrt(2 * Math.PI * Math.E * variancia);
                    entropias.push(entropia);
                }
                
                // Normalização robusta
                if (entropias.length < 2) return 0.5;
                
                const maxEntropia = Math.max(...entropias);
                const minEntropia = Math.min(...entropias);
                const range = maxEntropia - minEntropia;
                
                return range > 0 
                    ? (entropias[entropias.length - 1] - minEntropia) / range
                    : 0.5;
            } catch (e) {
                console.error("Erro no cálculo de entropia:", e);
                return 0.5;
            }
        }

        // =============================================
        // SISTEMA DE CONFIRMAÇÃO MULTI TIMEFRAME (REVISTO)
        // =============================================
        function confirmarSinalMultiTimeframe(sinalM1, indicadoresM1, indicadoresM5) {
            // Filtro 1: Tendência consistente
            const tendenciaAlinhada = 
                (sinalM1 === "CALL" && 
                (indicadoresM5.tendencia.tendencia.includes("ALTA") || 
                indicadoresM1.tendencia.tendencia.includes("ALTA"))) ||
                (sinalM1 === "PUT" && 
                (indicadoresM5.tendencia.tendencia.includes("BAIXA") || 
                indicadoresM1.tendencia.tendencia.includes("BAIXA")));
            
            // Filtro 2: SuperTrend convergente
            const superTrendAlinhado = 
                (sinalM1 === "CALL" && 
                indicadoresM1.superTrend.direcao > 0 && 
                indicadoresM5.superTrend.direcao > 0) ||
                (sinalM1 === "PUT" && 
                indicadoresM1.superTrend.direcao < 0 && 
                indicadoresM5.superTrend.direcao < 0);
            
            // Filtro 3: ADX acima do limiar em ambos timeframes
            const adxConfirmado = 
                indicadoresM1.adx > CONFIG.LIMIARES.ADX_TENDENCIA && 
                indicadoresM5.adx > CONFIG.LIMIARES.ADX_TENDENCIA;
            
            // Requer pelo menos 2 confirmações
            const confirmacoes = [
                tendenciaAlinhada,
                superTrendAlinhado,
                adxConfirmado
            ].filter(Boolean).length;
            
            return confirmacoes >= 2;
        }

        // =============================================
        // GERADOR DE SINAIS 2025 (M1 + M5) - OTIMIZADO
        // =============================================
        async function gerarSinalAvancado(indicadoresM1, indicadoresM5) {
            // 1. Sinal primário no M1
            let sinalM1 = "ESPERAR";
            const { rsi, stoch, close, bollinger, adx } = indicadoresM1;
            
            // Estratégia Bollinger Reversão com confirmação de EMA
            if (close < bollinger.inferior && 
                rsi < CONFIG.LIMIARES.RSI_OVERSOLD && 
                stoch.k < CONFIG.LIMIARES.STOCH_OVERSOLD &&
                close < indicadoresM1.emaCurta) {
                sinalM1 = "CALL";
            } else if (close > bollinger.superior && 
                    rsi > CONFIG.LIMIARES.RSI_OVERBOUGHT && 
                    stoch.k > CONFIG.LIMIARES.STOCH_OVERBOUGHT &&
                    close > indicadoresM1.emaCurta) {
                sinalM1 = "PUT";
            }
            
            // Estratégia Trend Following com filtro ADX
            if (adx > CONFIG.LIMIARES.ADX_TENDENCIA) {
                if (indicadoresM1.tendencia.tendencia.includes("ALTA") && 
                    close > indicadoresM1.emaCurta && 
                    close > bollinger.media &&
                    close > indicadoresM1.emaMedia) {
                    sinalM1 = "CALL";
                } else if (indicadoresM1.tendencia.tendencia.includes("BAIXA") && 
                        close < indicadoresM1.emaCurta && 
                        close < bollinger.media &&
                        close < indicadoresM1.emaMedia) {
                    sinalM1 = "PUT";
                }
            }
            
            // 2. Confirmação com M5 e fatores técnicos
            if (sinalM1 !== "ESPERAR") {
                const confirmado = confirmarSinalMultiTimeframe(
                    sinalM1, 
                    indicadoresM1, 
                    indicadoresM5
                );
                
                if (!confirmado) sinalM1 = "ESPERAR";
            }
            
            // 3. Filtro de entropia (evitar mercados caóticos)
            if (indicadoresM1.entropia > CONFIG.LIMIARES.ENTROPIA_ALTA) {
                sinalM1 = "ESPERAR";
            }
            
            // 4. Filtro de volatilidade (ATR)
            if (indicadoresM1.atr < CONFIG.LIMIARES.ATR_LIMIAR * 0.7) {
                sinalM1 = "ESPERAR";
            }
            
            return sinalM1;
        }

        // =============================================
        // CALCULADOR DE CONFIANÇA 2025 (PRECISÃO MELHORADA)
        // =============================================
        function calcularScore(sinal, indicadoresM1) {
            if (sinal === "ESPERAR") return 0;
            
            const fatores = {
                tendencia: indicadoresM1.tendencia.forca * 0.3,
                rsi: sinal === "CALL" 
                    ? Math.max(0, (CONFIG.LIMIARES.RSI_OVERSOLD - indicadoresM1.rsi) / 10)
                    : Math.max(0, (indicadoresM1.rsi - CONFIG.LIMIARES.RSI_OVERBOUGHT) / 10),
                bollinger: sinal === "CALL"
                    ? (indicadoresM1.bollinger.media - indicadoresM1.close) / 
                    (indicadoresM1.bollinger.media - indicadoresM1.bollinger.inferior) * 25
                    : (indicadoresM1.close - indicadoresM1.bollinger.media) / 
                    (indicadoresM1.bollinger.superior - indicadoresM1.bollinger.media) * 25,
                adx: Math.min(30, indicadoresM1.adx * 0.4),
                entropia: Math.min(20, (1 - indicadoresM1.entropia) * 20),
                emaAlinhamento: indicadoresM1.tendencia.tendencia.includes("FORTE") ? 15 : 0
            };
            
            // Cálculo do score
            let score = 40; // Base
            score += fatores.tendencia + fatores.rsi + fatores.bollinger + 
                    fatores.adx + fatores.entropia + fatores.emaAlinhamento;
            
            // Penalização se divergência de indicadores
            const divergencia = 
                (sinal === "CALL" && indicadoresM1.stoch.k < 50) ||
                (sinal === "PUT" && indicadoresM1.stoch.k > 50);
            
            if (divergencia) score = Math.max(0, score - 20);
            
            return Math.min(100, Math.max(0, Math.round(score)));
        }

        // =============================================
        // FUNÇÕES UTILITÁRIAS (MANTIDAS)
        // =============================================
        function formatarTimer(segundos) {
            return `0:${segundos.toString().padStart(2, '0')}`;
        }

        function atualizarRelogio() {
            const elementoHora = document.getElementById("hora");
            const currentTimeElement = document.getElementById("current-time");
            
            if (elementoHora || currentTimeElement) {
                const now = new Date();
                state.ultimaAtualizacao = now.toLocaleTimeString("pt-BR", {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                });
                
                if (elementoHora) {
                    elementoHora.textContent = state.ultimaAtualizacao;
                }
                
                if (currentTimeElement) {
                    currentTimeElement.textContent = now.toLocaleTimeString("pt-BR");
                }
                
                // Verificar se o mercado está aberto (Forex 24/5)
                const day = now.getDay();
                const hour = now.getHours();
                state.marketOpen = (day >= 1 && day <= 5) || (day === 0 && hour >= 17) || (day === 6 && hour < 17);
            }
        }

        function atualizarInterface(sinal, score, tendencia, forcaTendencia) {
            const comandoElement = document.getElementById("comando");
            if (!comandoElement) return;
            
            if (!state.marketOpen) {
                comandoElement.textContent = "Mercado Fechado";
                comandoElement.className = "esperar";
                return;
            }
            
            comandoElement.textContent = sinal;
            comandoElement.className = sinal.toLowerCase();
            
            if (sinal === "CALL") comandoElement.textContent += " 📈";
            else if (sinal === "PUT") comandoElement.textContent += " 📉";
            else if (sinal === "ESPERAR") comandoElement.textContent += " ✋";
            
            const scoreElement = document.getElementById("score");
            if (scoreElement) {
                scoreElement.textContent = `Confiança: ${score}%`;
                scoreElement.className = "confidence";
                
                if (score >= CONFIG.LIMIARES.SCORE_ALTO) {
                    scoreElement.classList.add("positive");
                    scoreElement.classList.remove("medium-confidence", "low-confidence");
                } else if (score >= CONFIG.LIMIARES.SCORE_MEDIO) {
                    scoreElement.classList.add("medium-confidence");
                    scoreElement.classList.remove("positive", "low-confidence");
                } else {
                    scoreElement.classList.add("low-confidence");
                    scoreElement.classList.remove("positive", "medium-confidence");
                }
            }
            
            const tendenciaElement = document.getElementById("tendencia");
            const forcaElement = document.getElementById("forca-tendencia");
            if (tendenciaElement && forcaElement) {
                tendenciaElement.textContent = tendencia;
                forcaElement.textContent = `${forcaTendencia}%`;
            }
            
            // Atualizar informações avançadas
            const entropyElement = document.getElementById("entropia");
            if (entropyElement && state.indicadoresM1) {
                entropyElement.textContent = `${(state.indicadoresM1.entropia * 100).toFixed(1)}%`;
            }
        }

        // =============================================
        // INDICADORES TÉCNICOS (OTIMIZADOS)
        // =============================================
        const calcularMedia = {
            simples: (dados, periodo) => {
                if (!Array.isArray(dados) || dados.length === 0 || periodo <= 0) return 0;
                const slice = dados.slice(-periodo);
                const sum = slice.reduce((a, b) => a + b, 0);
                return sum / slice.length;
            },

            exponencial: (dados, periodo) => {
                if (!Array.isArray(dados) || dados.length < periodo) return [];
                
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
            if (closes.length < periodo + 1) return 50;
            
            let gains = 0;
            let losses = 0;
            
            for (let i = 1; i <= periodo; i++) {
                const diff = closes[i] - closes[i - 1];
                if (diff > 0) gains += diff;
                else losses -= diff;
            }
            
            const avgGain = gains / periodo || 1;
            const avgLoss = losses / periodo || 1;
            
            const rs = avgGain / avgLoss;
            return 100 - (100 / (1 + rs));
        }

        function calcularStochastic(highs, lows, closes, 
                                periodoK = CONFIG.PERIODOS.STOCH_K, 
                                periodoD = CONFIG.PERIODOS.STOCH_D) {
            try {
                if (closes.length < periodoK) return { k: 50, d: 50 };
                
                const kValues = [];
                for (let i = periodoK - 1; i < closes.length; i++) {
                    const startIndex = Math.max(0, i - periodoK + 1);
                    const sliceHigh = highs.slice(startIndex, i + 1);
                    const sliceLow = lows.slice(startIndex, i + 1);
                    
                    const highestHigh = Math.max(...sliceHigh);
                    const lowestLow = Math.min(...sliceLow);
                    const range = highestHigh - lowestLow;
                    const k = range !== 0 ? ((closes[i] - lowestLow) / range) * 100 : 50;
                    kValues.push(k);
                }
                
                const kSuavizado = [];
                for (let i = periodoD - 1; i < kValues.length; i++) {
                    const startIndex = Math.max(0, i - periodoD + 1);
                    const slice = kValues.slice(startIndex, i + 1);
                    const mediaK = calcularMedia.simples(slice, slice.length) || 50;
                    kSuavizado.push(mediaK);
                }
                
                const dValues = [];
                for (let i = periodoD - 1; i < kSuavizado.length; i++) {
                    const startIndex = Math.max(0, i - periodoD + 1);
                    const slice = kSuavizado.slice(startIndex, i + 1);
                    dValues.push(calcularMedia.simples(slice, slice.length) || 50);
                }
                
                return {
                    k: kSuavizado.length > 0 ? kSuavizado[kSuavizado.length - 1] : 50,
                    d: dValues.length > 0 ? dValues[dValues.length - 1] : 50
                };
            } catch (e) {
                console.error("Erro no cálculo Stochastic:", e);
                return { k: 50, d: 50 };
            }
        }

        function calcularMACD(closes, rapida = CONFIG.PERIODOS.MACD_RAPIDA, 
                            lenta = CONFIG.PERIODOS.MACD_LENTA, 
                            sinal = CONFIG.PERIODOS.MACD_SINAL) {
            const emaRapida = calcularMedia.exponencial(closes, rapida);
            const emaLenta = calcularMedia.exponencial(closes, lenta);
            
            if (emaRapida.length === 0 || emaLenta.length === 0) {
                return {
                    histograma: 0,
                    macdLinha: 0,
                    sinalLinha: 0
                };
            }
            
            const startIdx = Math.max(0, emaLenta.length - emaRapida.length);
            const macdLine = emaRapida.slice(-emaLenta.length).map((val, idx) => 
                val - emaLenta[startIdx + idx]
            );
            
            const signalLine = calcularMedia.exponencial(macdLine, sinal);
            
            return {
                histograma: macdLine.length > 0 && signalLine.length > 0 ? 
                            macdLine[macdLine.length-1] - signalLine[signalLine.length-1] : 0,
                macdLinha: macdLine.length > 0 ? macdLine[macdLine.length-1] : 0,
                sinalLinha: signalLine.length > 0 ? signalLine[signalLine.length-1] : 0
            };
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
                console.error("Erro no cálculo ATR:", e);
                return 0;
            }
        }

        function calcularSuperTrend(dados, periodo = CONFIG.PERIODOS.SUPERTREND, multiplicador = 3.0) {
            try {
                if (dados.length < periodo) return { direcao: 0, valor: 0 };
                
                const superTrends = [];
                
                for (let i = periodo; i < dados.length; i++) {
                    // Calcular ATR para cada vela
                    const atrSlice = dados.slice(i - periodo, i);
                    const atr = calcularATR(atrSlice, periodo);
                    
                    const hl2 = (dados[i].high + dados[i].low) / 2;
                    const upperBand = hl2 + (multiplicador * atr);
                    const lowerBand = hl2 - (multiplicador * atr);
                    
                    let superTrend;
                    let direcao;
                    
                    if (i === periodo) {
                        superTrend = upperBand;
                        direcao = 1;
                    } else {
                        const prevSuperTrend = superTrends[superTrends.length - 1].valor;
                        
                        if (dados[i-1].close > prevSuperTrend) {
                            direcao = 1;
                            superTrend = Math.max(lowerBand, prevSuperTrend);
                        } else {
                            direcao = -1;
                            superTrend = Math.min(upperBand, prevSuperTrend);
                        }
                    }
                    
                    superTrends.push({ direcao, valor: superTrend });
                }
                
                return superTrends.length > 0 ? superTrends[superTrends.length - 1] : { direcao: 0, valor: 0 };
                
            } catch (e) {
                console.error("Erro no cálculo SuperTrend:", e);
                return { direcao: 0, valor: 0 };
            }
        }

        function calcularADX(dados, periodo = CONFIG.PERIODOS.ADX) {
            try {
                if (dados.length < periodo * 2) return 0;
                
                // Calcular +DM e -DM
                const plusDM = [];
                const minusDM = [];
                
                for (let i = 1; i < dados.length; i++) {
                    const upMove = dados[i].high - dados[i-1].high;
                    const downMove = dados[i-1].low - dados[i].low;
                    
                    if (upMove > downMove && upMove > 0) {
                        plusDM.push(upMove);
                        minusDM.push(0);
                    } else if (downMove > upMove && downMove > 0) {
                        plusDM.push(0);
                        minusDM.push(downMove);
                    } else {
                        plusDM.push(0);
                        minusDM.push(0);
                    }
                }
                
                // Calcular True Range
                const tr = [];
                for (let i = 1; i < dados.length; i++) {
                    tr.push(Math.max(
                        dados[i].high - dados[i].low,
                        Math.abs(dados[i].high - dados[i-1].close),
                        Math.abs(dados[i].low - dados[i-1].close)
                    ));
                }
                
                // Suavizar valores
                const smoothPlusDM = [calcularMedia.simples(plusDM.slice(0, periodo), periodo)];
                const smoothMinusDM = [calcularMedia.simples(minusDM.slice(0, periodo), periodo)];
                const smoothTR = [calcularMedia.simples(tr.slice(0, periodo), periodo)];
                
                for (let i = periodo; i < plusDM.length; i++) {
                    if (i >= smoothPlusDM.length) break;
                    smoothPlusDM.push(smoothPlusDM[smoothPlusDM.length - 1] * (periodo - 1)/periodo + plusDM[i]);
                    smoothMinusDM.push(smoothMinusDM[smoothMinusDM.length - 1] * (periodo - 1)/periodo + minusDM[i]);
                    smoothTR.push(smoothTR[smoothTR.length - 1] * (periodo - 1)/periodo + tr[i]);
                }
                
                // Calcular DI+ e DI-
                const plusDI = smoothPlusDM.map((dm, i) => (dm / smoothTR[i]) * 100);
                const minusDI = smoothMinusDM.map((dm, i) => (dm / smoothTR[i]) * 100);
                
                // Calcular DX
                const dx = plusDI.map((pdi, i) => {
                    const mdi = minusDI[i];
                    const sum = pdi + mdi;
                    return sum !== 0 ? (Math.abs(pdi - mdi) / sum * 100 : 0;
                });
                
                // Calcular ADX
                const adx = [calcularMedia.simples(dx.slice(0, periodo), periodo)];
                for (let i = periodo; i < dx.length; i++) {
                    adx.push((adx[adx.length - 1] * (periodo - 1) + dx[i]) / periodo);
                }
                
                return adx.length > 0 ? adx[adx.length - 1] : 0;
            } catch (e) {
                console.error("Erro no cálculo ADX:", e);
                return 0;
            }
        }

        function calcularBollingerBands(closes, periodo = CONFIG.PERIODOS.BOLLINGER, desvios = 2) {
            try {
                if (closes.length < periodo) return { superior: 0, inferior: 0, media: 0 };
                
                const media = calcularMedia.simples(closes.slice(-periodo), periodo);
                const desvioPadrao = Math.sqrt(
                    closes.slice(-periodo)
                        .map(val => Math.pow(val - media, 2))
                        .reduce((sum, val) => sum + val, 0) / periodo
                );
                
                return {
                    superior: media + (desvioPadrao * desvios),
                    inferior: media - (desvioPadrao * desvios),
                    media: media
                };
            } catch (e) {
                console.error("Erro no cálculo Bollinger Bands:", e);
                return { superior: 0, inferior: 0, media: 0 };
            }
        }

        // =============================================
        // CORE DO SISTEMA (ESTRATÉGIA 2025) - OTIMIZADO
        // =============================================
        async function analisarMercado() {
            if (state.leituraEmAndamento) return;
            state.leituraEmAndamento = true;
            
            try {
                // Obter dados em paralelo para M1 e M5
                const [dadosM1, dadosM5] = await Promise.all([
                    obterDadosTwelveData("1min"),
                    obterDadosTwelveData("5min")
                ]);
                
                // Verificar se os dados mudaram
                const lastCandleM1 = dadosM1.length > 0 ? dadosM1[dadosM1.length - 1].time : null;
                const lastCandleM5 = dadosM5.length > 0 ? dadosM5[dadosM5.length - 1].time : null;
                
                const dadosMudaramM1 = state.lastCandleTimeM1 !== lastCandleM1;
                const dadosMudaramM5 = state.lastCandleTimeM5 !== lastCandleM5;
                
                if (!dadosMudaramM1 && !dadosMudaramM5) {
                    state.leituraEmAndamento = false;
                    return;
                }
                
                state.dadosHistoricosM1 = dadosM1;
                state.dadosHistoricosM5 = dadosM5;
                state.lastCandleTimeM1 = lastCandleM1;
                state.lastCandleTimeM5 = lastCandleM5;
                
                if (dadosM1.length < 100 || dadosM5.length < 100) {
                    throw new Error(`Dados insuficientes (M1:${dadosM1.length} M5:${dadosM5.length})`);
                }
                
                const velaAtualM1 = dadosM1[dadosM1.length - 1];
                const closesM1 = dadosM1.map(v => v.close);
                const highsM1 = dadosM1.map(v => v.high);
                const lowsM1 = dadosM1.map(v => v.low);
                
                const velaAtualM5 = dadosM5[dadosM5.length - 1];
                const closesM5 = dadosM5.map(v => v.close);
                const highsM5 = dadosM5.map(v => v.high);
                const lowsM5 = dadosM5.map(v => v.low);

                // Calcular indicadores para M1
                const ema8M1 = calcularMedia.exponencial(closesM1, CONFIG.PERIODOS.EMA_CURTA).slice(-1)[0];
                const ema21M1 = calcularMedia.exponencial(closesM1, CONFIG.PERIODOS.EMA_MEDIA).slice(-1)[0];
                const ema50M1 = calcularMedia.exponencial(closesM1, CONFIG.PERIODOS.EMA_LONGA).slice(-1)[0];
                const ema200M1 = calcularMedia.exponencial(closesM1, CONFIG.PERIODOS.EMA_LONGA2).slice(-1)[0];
                
                const rsiM1 = calcularRSI(closesM1.slice(-100));
                const stochM1 = calcularStochastic(highsM1, lowsM1, closesM1);
                const atrM1 = calcularATR(dadosM1);
                const adxM1 = calcularADX(dadosM1);
                const tendenciaM1 = avaliarTendencia(ema8M1, ema21M1, ema50M1, ema200M1, velaAtualM1.close, adxM1, atrM1);
                const superTrendM1 = calcularSuperTrend(dadosM1);
                const bollingerM1 = calcularBollingerBands(closesM1);
                const entropiaM1 = calcularEntropiaMercado(dadosM1);
                const macdM1 = calcularMACD(closesM1);
                
                // Calcular indicadores para M5
                const ema8M5 = calcularMedia.exponencial(closesM5, CONFIG.PERIODOS.EMA_CURTA).slice(-1)[0];
                const ema21M5 = calcularMedia.exponencial(closesM5, CONFIG.PERIODOS.EMA_MEDIA).slice(-1)[0];
                const ema50M5 = calcularMedia.exponencial(closesM5, CONFIG.PERIODOS.EMA_LONGA).slice(-1)[0];
                const ema200M5 = calcularMedia.exponencial(closesM5, CONFIG.PERIODOS.EMA_LONGA2).slice(-1)[0];
                const atrM5 = calcularATR(dadosM5);
                const adxM5 = calcularADX(dadosM5);
                const tendenciaM5 = avaliarTendencia(ema8M5, ema21M5, ema50M5, ema200M5, velaAtualM5.close, adxM5, atrM5);
                const superTrendM5 = calcularSuperTrend(dadosM5);

                // Preparar dados para geração de sinal
                const indicadoresM1 = {
                    rsi: rsiM1,
                    stoch: stochM1,
                    emaCurta: ema8M1,
                    emaMedia: ema21M1,
                    emaLonga: ema50M1,
                    emaLonga2: ema200M1,
                    close: velaAtualM1.close,
                    superTrend: superTrendM1,
                    tendencia: tendenciaM1,
                    atr: atrM1,
                    adx: adxM1,
                    bollinger: bollingerM1,
                    entropia: entropiaM1,
                    macd: macdM1
                };

                const indicadoresM5 = {
                    tendencia: tendenciaM5,
                    superTrend: superTrendM5,
                    adx: adxM5
                };

                // Armazenar para uso na interface
                state.indicadoresM1 = indicadoresM1;

                state.tendenciaDetectada = tendenciaM1.tendencia;
                state.forcaTendencia = Math.round(tendenciaM1.forca);

                // Gerar sinal com estratégia 2025
                let sinal = await gerarSinalAvancado(indicadoresM1, indicadoresM5);
                const score = calcularScore(sinal, indicadoresM1);

                // Cooldown adaptativo baseado na confiança
                if (sinal !== "ESPERAR" && state.cooldown <= 0) {
                    state.cooldown = score > CONFIG.LIMIARES.SCORE_ALTO ? 3 : 
                                    score > CONFIG.LIMIARES.SCORE_MEDIO ? 4 : 0;
                } 
                
                if (state.cooldown > 0) {
                    sinal = "ESPERAR";
                    state.cooldown--;
                }

                state.ultimoSinal = sinal;
                state.ultimoScore = score;
                state.ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR");

                atualizarInterface(sinal, score, state.tendenciaDetectada, state.forcaTendencia);

                const criteriosElement = document.getElementById("criterios");
                if (criteriosElement) {
                    criteriosElement.innerHTML = `
                        <li><i class="fas fa-arrow-trend-up"></i> Tendência: <span class="${tendenciaM1.tendencia.includes('ALTA') ? 'positive' : tendenciaM1.tendencia.includes('BAIXA') ? 'critical' : ''}">${tendenciaM1.tendencia}</span> (${state.forcaTendencia}%)</li>
                        <li><i class="fas fa-money-bill-wave"></i> Preço: ${indicadoresM1.close.toFixed(5)}</li>
                        <li><i class="fas fa-wave-square"></i> RSI: ${rsiM1.toFixed(2)} ${rsiM1 < 30 ? '🔻' : rsiM1 > 70 ? '🔺' : ''}</li>
                        <li><i class="fas fa-chart-line"></i> Stochastic: ${stochM1.k.toFixed(2)}/${stochM1.d.toFixed(2)}</li>
                        <li><i class="fas fa-sliders"></i> Médias: EMA8 ${ema8M1.toFixed(5)} | EMA21 ${ema21M1.toFixed(5)} | EMA50 ${ema50M1.toFixed(5)} | EMA200 ${ema200M1.toFixed(5)}</li>
                        <li><i class="fas fa-arrows-left-right"></i> Bollinger: ${bollingerM1.inferior.toFixed(5)}-${bollingerM1.superior.toFixed(5)}</li>
                        <li><i class="fas fa-route"></i> SuperTrend: ${superTrendM1.direcao > 0 ? 'ALTA' : 'BAIXA'}</li>
                        <li><i class="fas fa-chart-simple"></i> ADX: ${adxM1.toFixed(2)} ${adxM1 > 25 ? '📈' : ''}</li>
                        <li><i class="fas fa-random"></i> Entropia: ${(entropiaM1 * 100).toFixed(1)}%</li>
                        <li><i class="fas fa-bolt"></i> ATR: ${atrM1.toFixed(5)}</li>
                        <li><i class="fas fa-chart-area"></i> MACD: ${macdM1.histograma.toFixed(6)}</li>
                    `;
                }

                state.ultimos.unshift({
                    time: state.ultimaAtualizacao,
                    signal: sinal,
                    score: score
                });
                
                if (state.ultimos.length > 8) state.ultimos.pop();
                
                const ultimosElement = document.getElementById("ultimos");
                if (ultimosElement) {
                    ultimosElement.innerHTML = state.ultimos.map(item => {
                        const signalClass = item.signal === "CALL" ? "call-signal" : 
                                          item.signal === "PUT" ? "put-signal" : "wait-signal";
                        return `<li class="signal-item">
                            <span class="signal-time">${item.time}</span>
                            <span class="${signalClass}">${item.signal} (${item.score}%)</span>
                        </li>`;
                    }).join("");
                }

                state.tentativasErro = 0;
            } catch (e) {
                console.error("Erro na análise:", e);
                atualizarInterface("ERRO", 0, "ERRO", 0);
                
                const criteriosElement = document.getElementById("criterios");
                if (criteriosElement) {
                    criteriosElement.innerHTML = `<li class="critical"><i class="fas fa-exclamation-triangle"></i> ERRO: ${e.message}</li>`;
                }
                
                if (++state.tentativasErro > 3) {
                    setTimeout(() => location.reload(), 10000);
                }
            } finally {
                state.leituraEmAndamento = false;
            }
        }

        // =============================================
        // FUNÇÕES DE DADOS (TWELVE DATA API REAL)
        // =============================================
        async function obterDadosTwelveData(interval = "1min") {
            try {
                const apiKey = API_KEYS[currentKeyIndex];
                const url = `${CONFIG.API_ENDPOINTS.TWELVE_DATA}/time_series?symbol=${CONFIG.PARES.FOREX}&interval=${interval}&outputsize=200&apikey=${apiKey}`;
                
                // Timeout para evitar bloqueios
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 8000);
                
                const response = await fetch(url, {
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    throw new Error(`Falha na API: ${response.status}`);
                }
                
                const data = await response.json();
                
                if (data.status === 'error') {
                    throw new Error(data.message || `Erro Twelve Data: ${data.code}`);
                }
                
                const valores = data.values ? data.values.reverse() : [];
                
                return valores.map(item => ({
                    time: item.datetime,
                    open: parseFloat(item.open),
                    high: parseFloat(item.high),
                    low: parseFloat(item.low),
                    close: parseFloat(item.close),
                    volume: 1
                }));
            } catch (e) {
                console.error("Erro ao obter dados:", e);
                
                errorCount++;
                if (errorCount >= 2) {
                    currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
                    errorCount = 0;
                }
                
                throw e;
            }
        }

        // =============================================
        // CONTROLE DE TEMPO
        // =============================================
        function sincronizarTimer() {
            clearInterval(state.intervaloAtual);
            const agora = new Date();
            const segundos = agora.getSeconds();
            state.timer = 60 - segundos;
            
            const elementoTimer = document.getElementById("timer");
            if (elementoTimer) {
                elementoTimer.textContent = formatarTimer(state.timer);
            }
            
            state.intervaloAtual = setInterval(() => {
                state.timer--;
                
                if (elementoTimer) {
                    elementoTimer.textContent = formatarTimer(state.timer);
                }
                
                if (state.timer <= 0) {
                    clearInterval(state.intervaloAtual);
                    analisarMercado();
                    sincronizarTimer();
                }
            }, 1000);
        }

        // =============================================
        // INICIALIZAÇÃO
        // =============================================
        function iniciarAplicativo() {
            // Iniciar processos
            setInterval(atualizarRelogio, 1000);
            atualizarRelogio();
            sincronizarTimer();
            
            // Primeira análise
            setTimeout(analisarMercado, 1000);
        }

        // Iniciar quando o documento estiver pronto
        if (document.readyState === "complete") iniciarAplicativo();
        else document.addEventListener("DOMContentLoaded", iniciarAplicativo);
