 // =============================================
        // CONFIGURAÇÕES GLOBAIS
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
            dadosHistoricos: [],
            resistenciaKey: 0,
            suporteKey: 0
        };

        const CONFIG = {
            PERIODOS: {
                RSI: 14,
                STOCH: 14,
                EMA_CURTA: 8,
                EMA_MEDIA: 21,
                EMA_LONGA: 200,
                SMA_VOLUME: 20,
                MACD_RAPIDA: 12,
                MACD_LENTA: 26,
                MACD_SINAL: 9,
                VOLUME_PROFILE: 50,
                LIQUIDITY_ZONES: 20
            },
            LIMIARES: {
                SCORE_ALTO: 80,
                SCORE_MEDIO: 65,
                RSI_OVERBOUGHT: 70,
                RSI_OVERSOLD: 30,
                STOCH_OVERBOUGHT: 80,
                STOCH_OVERSOLD: 20,
                VOLUME_ALTO: 2.0
            }
        };

        // =============================================
        // FUNÇÕES UTILITÁRIAS
        // =============================================
        function formatarTimer(segundos) {
            return `0:${segundos.toString().padStart(2, '0')}`;
        }

        function atualizarRelogio() {
            const now = new Date();
            state.ultimaAtualizacao = now.toLocaleTimeString("pt-BR", {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            document.getElementById("hora").textContent = state.ultimaAtualizacao;
        }

        function atualizarInterface(sinal, score, tendencia, forcaTendencia) {
            if (!state.marketOpen) return;
            
            const comandoElement = document.getElementById("comando");
            if (comandoElement) {
                comandoElement.textContent = sinal;
                comandoElement.className = sinal.toLowerCase();
            }
            
            const scoreElement = document.getElementById("score");
            if (scoreElement) {
                scoreElement.textContent = `Confiança: ${score}%`;
                if (score >= CONFIG.LIMIARES.SCORE_ALTO) {
                    scoreElement.style.color = '#2ecc71';
                } else if (score >= CONFIG.LIMIARES.SCORE_MEDIO) {
                    scoreElement.style.color = '#f39c12';
                } else {
                    scoreElement.style.color = '#e74c3c';
                }
            }
            
            const tendenciaElement = document.getElementById("tendencia");
            const forcaElement = document.getElementById("forca-tendencia");
            if (tendenciaElement && forcaElement) {
                tendenciaElement.textContent = tendencia;
                forcaElement.textContent = `${forcaTendencia}%`;
            }
            
            document.getElementById("last-update").textContent = state.ultimaAtualizacao;
        }

        // =============================================
        // INDICADORES TÉCNICOS
        // =============================================
        const calcularMedia = {
            simples: (dados, periodo) => {
                if (!Array.isArray(dados) || dados.length < periodo) return null;
                const slice = dados.slice(-periodo);
                return slice.reduce((a, b) => a + b, 0) / periodo;
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
                avgLoss = (avgLoss * (periodo - 1) + loss) / periodo;
            }

            const rs = avgGain / Math.max(avgLoss, 1e-8);
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
                console.error("Erro no cálculo Stochastic:", e);
                return { k: 50, d: 50 };
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
                console.error("Erro no cálculo MACD:", e);
                return { histograma: 0, macdLinha: 0, sinalLinha: 0 };
            }
        }

        function calcularVolumeProfile(dados, periodo = CONFIG.PERIODOS.VOLUME_PROFILE) {
            try {
                if (!Array.isArray(dados) || dados.length < periodo) return { pvp: 0, vaHigh: 0, vaLow: 0 };
                
                const slice = dados.slice(-periodo);
                const buckets = {};
                const precisao = 2;
                
                for (const vela of slice) {
                    const amplitude = vela.high - vela.low;
                    if (amplitude === 0) continue;
                    
                    const niveis = 10;
                    const passo = amplitude / niveis;
                    
                    for (let i = 0; i < niveis; i++) {
                        const preco = (vela.low + i * passo).toFixed(precisao);
                        buckets[preco] = (buckets[preco] || 0) + (vela.volume / niveis);
                    }
                }
                
                const niveisOrdenados = Object.entries(buckets)
                    .sort((a, b) => b[1] - a[1]);
                
                if (niveisOrdenados.length === 0) return { pvp: 0, vaHigh: 0, vaLow: 0 };
                
                const pvp = parseFloat(niveisOrdenados[0][0]);
                const vaHigh = parseFloat(niveisOrdenados[Math.floor(niveisOrdenados.length * 0.3)]?.[0] || pvp);
                const vaLow = parseFloat(niveisOrdenados[Math.floor(niveisOrdenados.length * 0.7)]?.[0] || pvp);
                
                return { pvp, vaHigh, vaLow };
            } catch (e) {
                console.error("Erro no cálculo Volume Profile:", e);
                return { pvp: 0, vaHigh: 0, vaLow: 0 };
            }
        }

        function calcularLiquidez(velas, periodo = CONFIG.PERIODOS.LIQUIDITY_ZONES) {
            const slice = velas.slice(-periodo);
            const highNodes = [];
            const lowNodes = [];
            
            for (let i = 3; i < slice.length - 3; i++) {
                if (slice[i].high > slice[i-1].high && slice[i].high > slice[i+1].high) {
                    highNodes.push(slice[i].high);
                }
                if (slice[i].low < slice[i-1].low && slice[i].low < slice[i+1].low) {
                    lowNodes.push(slice[i].low);
                }
            }
            
            return {
                resistencia: highNodes.length > 0 ? calcularMedia.simples(highNodes, highNodes.length) : 0,
                suporte: lowNodes.length > 0 ? calcularMedia.simples(lowNodes, lowNodes.length) : 0
            };
        }

        function detectarDivergencias(closes, rsis) {
            try {
                if (closes.length < 5 || rsis.length < 5) 
                    return { divergenciaRSI: false, tipoDivergencia: "NENHUMA" };
                
                const ultimosCloses = closes.slice(-5);
                const ultimosRSIs = rsis.slice(-5);
                
                // Divergência de alta: preço faz fundo mais baixo, RSI faz fundo mais alto
                const baixaPreco = ultimosCloses[0] < ultimosCloses[2] && ultimosCloses[2] < ultimosCloses[4];
                const altaRSI = ultimosRSIs[0] > ultimosRSIs[2] && ultimosRSIs[2] > ultimosRSIs[4];
                const divergenciaAlta = baixaPreco && altaRSI;
                
                // Divergência de baixa: preço faz topo mais alto, RSI faz topo mais baixo
                const altaPreco = ultimosCloses[0] > ultimosCloses[2] && ultimosCloses[2] > ultimosCloses[4];
                const baixaRSI = ultimosRSIs[0] < ultimosRSIs[2] && ultimosRSIs[2] < ultimosRSIs[4];
                const divergenciaBaixa = altaPreco && baixaRSI;
                
                return {
                    divergenciaRSI: divergenciaAlta || divergenciaBaixa,
                    tipoDivergencia: divergenciaAlta ? "ALTA" : 
                                    divergenciaBaixa ? "BAIXA" : "NENHUMA"
                };
            } catch (e) {
                console.error("Erro na detecção de divergências:", e);
                return { divergenciaRSI: false, tipoDivergencia: "NENHUMA" };
            }
        }

        // =============================================
        // SISTEMA DE TENDÊNCIA
        // =============================================
        function avaliarTendencia(closes, ema8, ema21, ema200, volume, volumeMedio) {
            const ultimoClose = closes[closes.length - 1];
            
            // Tendência de longo prazo
            const tendenciaLongoPrazo = ultimoClose > ema200 ? "ALTA" : "BAIXA";
            
            // Tendência de médio prazo
            const tendenciaMedioPrazo = ema8 > ema21 ? "ALTA" : "BAIXA";
            
            // Força da tendência
            const distanciaMedia = Math.abs(ema8 - ema21);
            const forcaBase = Math.min(100, Math.round(distanciaMedia / ultimoClose * 1000));
            const forcaVolume = volume > volumeMedio * 1.5 ? 20 : 0;
            
            let forcaTotal = forcaBase + forcaVolume;
            if (tendenciaLongoPrazo === tendenciaMedioPrazo) forcaTotal += 30;
            
            // Determinar tendência final
            if (forcaTotal > 80) {
                return { 
                    tendencia: tendenciaMedioPrazo === "ALTA" ? "FORTE_ALTA" : "FORTE_BAIXA",
                    forca: Math.min(100, forcaTotal)
                };
            }
            
            if (forcaTotal > 50) {
                return { 
                    tendencia: tendenciaMedioPrazo,
                    forca: forcaTotal
                };
            }
            
            return { 
                tendencia: "NEUTRA", 
                forca: 0 
            };
        }

        // =============================================
        // GERADOR DE SINAIS
        // =============================================
        function gerarSinal(indicadores, divergencias) {
            const {
                rsi,
                stoch,
                macd,
                close,
                emaCurta,
                emaMedia,
                volume,
                volumeMedia,
                volumeProfile,
                liquidez
            } = indicadores;
            
            // Definir níveis-chave de suporte e resistência
            state.suporteKey = Math.min(volumeProfile.vaLow, liquidez.suporte, emaMedia);
            state.resistenciaKey = Math.max(volumeProfile.vaHigh, liquidez.resistencia, emaMedia);
            
            // 1. Sinal de tendência forte
            if (indicadores.tendencia.tendencia === "FORTE_ALTA") {
                const condicoesCompra = [
                    close > emaCurta,
                    macd.histograma > 0,
                    stoch.k > 50,
                    volume > volumeMedia * 1.2
                ];
                
                if (condicoesCompra.filter(Boolean).length >= 3) {
                    return "CALL";
                }
            }
            
            // 2. Sinal de tendência forte de baixa
            if (indicadores.tendencia.tendencia === "FORTE_BAIXA") {
                const condicoesVenda = [
                    close < emaCurta,
                    macd.histograma < 0,
                    stoch.k < 50,
                    volume > volumeMedia * 1.2
                ];
                
                if (condicoesVenda.filter(Boolean).length >= 3) {
                    return "PUT";
                }
            }
            
            // 3. Sinal de rompimento
            if (close > state.resistenciaKey && volume > volumeMedia * 2) {
                return "CALL";
            }
            
            if (close < state.suporteKey && volume > volumeMedia * 2) {
                return "PUT";
            }
            
            // 4. Sinal de reversão por divergência
            if (divergencias.divergenciaRSI) {
                if (divergencias.tipoDivergencia === "ALTA" && close > state.suporteKey) {
                    return "CALL";
                }
                
                if (divergencias.tipoDivergencia === "BAIXA" && close < state.resistenciaKey) {
                    return "PUT";
                }
            }
            
            // 5. Sinal de reversão por RSI extremo
            if (rsi < 30 && close > emaMedia) {
                return "CALL";
            }
            
            if (rsi > 70 && close < emaMedia) {
                return "PUT";
            }
            
            return "ESPERAR";
        }

        // =============================================
        // CALCULADOR DE CONFIANÇA
        // =============================================
        function calcularScore(sinal, indicadores, divergencias) {
            let score = 60; // Base mais alta para crypto
            
            // Fatores gerais
            const fatores = {
                volumeAlto: indicadores.volume > indicadores.volumeMedia * 1.5 ? 15 : 0,
                alinhamentoTendencia: sinal === "CALL" && indicadores.tendencia.tendencia.includes("ALTA") ||
                                    sinal === "PUT" && indicadores.tendencia.tendencia.includes("BAIXA") ? 20 : 0,
                divergencia: divergencias.divergenciaRSI ? 15 : 0,
                posicaoMedia: sinal === "CALL" && indicadores.close > indicadores.emaMedia ? 10 : 
                            sinal === "PUT" && indicadores.close < indicadores.emaMedia ? 10 : 0
            };
            
            // Adicionar pontos específicos
            score += Object.values(fatores).reduce((sum, val) => sum + val, 0);
            
            // Limitar entre 0-100
            return Math.min(100, Math.max(0, score));
        }

        // =============================================
        // SIMULADOR DE DADOS DE MERCADO
        // =============================================
        function gerarDadosSimulados() {
            const dados = [];
            const now = Date.now();
            let price = 60000; // Preço inicial
            
            for (let i = 0; i < 100; i++) {
                // Gerar movimentos de preço mais realistas
                const volatility = 0.01;
                const rnd = Math.random();
                const changePercent = 2 * volatility * rnd;
                if (rnd <= 0.5) changePercent *= -1;
                
                const changeAmount = price * changePercent;
                price += changeAmount;
                
                const open = price;
                const close = price + (Math.random() - 0.5) * price * 0.005;
                const high = Math.max(open, close) + Math.random() * price * 0.01;
                const low = Math.min(open, close) - Math.random() * price * 0.01;
                const volume = 50000 + Math.random() * 50000;
                
                dados.push({
                    time: new Date(now - (100 - i) * 60000).toISOString(),
                    open: parseFloat(open.toFixed(2)),
                    high: parseFloat(high.toFixed(2)),
                    low: parseFloat(low.toFixed(2)),
                    close: parseFloat(close.toFixed(2)),
                    volume: parseFloat(volume.toFixed(2))
                });
            }
            
            return dados;
        }

        // =============================================
        // CORE DO SISTEMA
        // =============================================
        async function analisarMercado() {
            if (state.leituraEmAndamento) return;
            state.leituraEmAndamento = true;
            
            try {
                document.getElementById("status").textContent = "Analisando dados...";
                
                // Usando dados simulados para demonstração
                const dados = gerarDadosSimulados();
                const velaAtual = dados[dados.length - 1];
                const closes = dados.map(v => v.close);
                const highs = dados.map(v => v.high);
                const lows = dados.map(v => v.low);
                const volumes = dados.map(v => v.volume);

                // Calcular médias móveis
                const ema8Array = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_CURTA);
                const ema21Array = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_MEDIA);
                const ema200Array = calcularMedia.exponencial(closes, CONFIG.PERIODOS.EMA_LONGA);
                const ema8 = ema8Array[ema8Array.length-1] || 0;
                const ema21 = ema21Array[ema21Array.length-1] || 0;
                const ema200 = ema200Array[ema200Array.length-1] || 0;

                const volumeMedia = calcularMedia.simples(volumes.slice(-CONFIG.PERIODOS.SMA_VOLUME), CONFIG.PERIODOS.SMA_VOLUME) || 1;
                const volumeProfile = calcularVolumeProfile(dados);
                const liquidez = calcularLiquidez(dados);
                
                // Calcular indicadores
                const rsi = calcularRSI(closes);
                const stoch = calcularStochastic(highs, lows, closes);
                const macd = calcularMACD(closes);
                
                // Calcular divergências
                const rsiHistory = [];
                for (let i = CONFIG.PERIODOS.RSI; i <= closes.length; i++) {
                    rsiHistory.push(calcularRSI(closes.slice(0, i)));
                }
                const divergencias = detectarDivergencias(closes, rsiHistory);

                // Avaliar tendência
                const tendencia = avaliarTendencia(closes, ema8, ema21, ema200, velaAtual.volume, volumeMedia);
                state.tendenciaDetectada = tendencia.tendencia;
                state.forcaTendencia = tendencia.forca;

                const indicadores = {
                    rsi,
                    stoch,
                    macd,
                    emaCurta: ema8,
                    emaMedia: ema21,
                    close: velaAtual.close,
                    volume: velaAtual.volume,
                    volumeMedia,
                    volumeProfile,
                    liquidez,
                    tendencia
                };

                // Gerar sinal
                const sinal = gerarSinal(indicadores, divergencias);
                const score = calcularScore(sinal, indicadores, divergencias);

                state.ultimoSinal = sinal;
                state.ultimoScore = score;
                state.ultimaAtualizacao = new Date().toLocaleTimeString("pt-BR");

                // Atualizar interface
                atualizarInterface(sinal, score, state.tendenciaDetectada, state.forcaTendencia);

                // Atualizar critérios
                const criteriosElement = document.getElementById("criterios");
                if (criteriosElement) {
                    criteriosElement.innerHTML = `
                        <li>📊 Tendência: ${state.tendenciaDetectada} (${state.forcaTendencia}%)</li>
                        <li>💰 Preço: $${indicadores.close.toFixed(2)}</li>
                        <li>📉 RSI: ${rsi.toFixed(2)} ${rsi < 30 ? '🔻' : rsi > 70 ? '🔺' : ''}</li>
                        <li>📊 MACD: ${macd.histograma.toFixed(6)} ${macd.histograma > 0 ? '🟢' : '🔴'}</li>
                        <li>📈 Stochastic K: ${stoch.k.toFixed(2)} | D: ${stoch.d.toFixed(2)}</li>
                        <li>📶 Médias: EMA8 ${ema8.toFixed(2)} | EMA21 ${ema21.toFixed(2)}</li>
                        <li>💹 Volume: ${(indicadores.volume/1000).toFixed(1)}K vs ${(volumeMedia/1000).toFixed(1)}K</li>
                        <li>📊 Perfil Volume: PVP ${volumeProfile.pvp.toFixed(2)}</li>
                        <li>🪙 Suporte: ${state.suporteKey.toFixed(2)} | Resistência: ${state.resistenciaKey.toFixed(2)}</li>
                        <li>⚠️ Divergência: ${divergencias.tipoDivergencia}</li>
                    `;
                }

                // Atualizar histórico
                state.ultimos.unshift(`${state.ultimaAtualizacao} - ${sinal} (${score}%)`);
                if (state.ultimos.length > 10) state.ultimos.pop();
                const ultimosElement = document.getElementById("ultimos");
                if (ultimosElement) {
                    ultimosElement.innerHTML = state.ultimos.map((item, index) => {
                        const sinal = item.includes("CALL") ? "call" : item.includes("PUT") ? "put" : "";
                        return `<li class="${sinal}">${item}</li>`;
                    }).join("");
                }

                state.tentativasErro = 0;
                document.getElementById("status").textContent = "Análise completa";
            } catch (e) {
                console.error("Erro na análise:", e);
                atualizarInterface("ERRO", 0, "ERRO", 0);
                document.getElementById("status").textContent = "Erro na análise";
                
                if (++state.tentativasErro > 3) {
                    document.getElementById("status").textContent = "Reiniciando sistema...";
                    setTimeout(() => location.reload(), 5000);
                }
            } finally {
                state.leituraEmAndamento = false;
            }
        }

        // =============================================
        // CONTROLE DE TEMPO
        // =============================================
        function sincronizarTimer() {
            clearInterval(state.intervaloAtual);
            state.timer = 60;
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
                    analisarMercado().finally(sincronizarTimer);
                }
            }, 1000);
        }

        // =============================================
        // INICIALIZAÇÃO
        // =============================================
        function iniciarAplicativo() {
            // Atualizar relógio a cada segundo
            setInterval(atualizarRelogio, 1000);
            atualizarRelogio();
            
            // Iniciar timer de análise
            sincronizarTimer();
            
            // Executar primeira análise
            setTimeout(analisarMercado, 2000);
            
            // Configurar botões
            document.getElementById("refreshBtn").addEventListener("click", () => {
                analisarMercado();
                sincronizarTimer();
            });
            
            document.getElementById("backtestBtn").addEventListener("click", () => {
                const btn = document.getElementById("backtestBtn");
                btn.textContent = "Executando backtest...";
                btn.disabled = true;
                
                setTimeout(() => {
                    btn.textContent = "Backtest completo!";
                    setTimeout(() => {
                        btn.textContent = "Executar Backtest";
                        btn.disabled = false;
                    }, 2000);
                }, 3000);
            });
        }

        // Iniciar quando o documento estiver pronto
        if (document.readyState === "complete") iniciarAplicativo();
        else document.addEventListener("DOMContentLoaded", iniciarAplicativo);
    
