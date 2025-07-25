// ==UserScript==
// @name         Robô Trader IQ Option
// @namespace    http://tampermonkey.net/
// @version      1.5
// @description  Robô para análise em tempo real na IQ Option
// @author       SeuNome
// @match        https://iqoption.com/traderoom/*
// @grant        none
// @require      https://cdn.jsdelivr.net/npm/axios@1.1.3/dist/axios.min.js
// ==/UserScript==

(function() {
    'use strict';
    
    // =============================================
    // CONFIGURAÇÕES GLOBAIS
    // =============================================
    const state = {
        // ... (todo o state do seu robô original) ...
        // ADICIONE AQUI TODO O STATE DO SEU ROBÔ ORIGINAL
        assetId: null,
        timeframe: "1min",
        sessionId: null,
        dadosHistoricos: []
    };

    const CONFIG = {
        // ... (todo o CONFIG do seu robô original) ...
        // ADICIONE AQUI TODO O CONFIG DO SEU ROBÔ ORIGINAL
    };

    // =============================================
    // FUNÇÕES PRINCIPAIS (SIMPLIFICADAS)
    // =============================================
    function iniciarConexaoIQ() {
        // 1. Capturar sessão do usuário
        state.sessionId = capturarSessao();

        // 2. Detectar ativo e timeframe
        detectarAtivo();

        // 3. Conectar ao WebSocket
        const ws = new WebSocket("wss://iqoption.com/echo/websocket");

        ws.onopen = () => {
            console.log("[ROBÔ] Conectado à IQ Option");
            autenticarWebSocket(ws);
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data?.name === "candle-generated") {
                processarVela(data.msg);
            }
        };
    }

    function capturarSessao() {
        const cookies = document.cookie.split(';');
        const sessionCookie = cookies.find(c => c.includes('ssid'));
        return sessionCookie ? sessionCookie.split('=')[1].trim() : null;
    }

    function detectarAtivo() {
        try {
            const assetName = document.querySelector(".trading-chart__info__name").innerText.trim();
            const timeframe = document.querySelector(".time-filters__filter--active").dataset.interval;
            
            state.assetId = {
                "BTC/USD": 1,
                "EUR/USD": 3,
                "ETH/USD": 2
            }[assetName] || 1;

            state.timeframe = timeframe || "1min";
        } catch (e) {
            console.error("Erro ao detectar ativo:", e);
            state.assetId = 1; // BTC/USD como padrão
            state.timeframe = "1min";
        }
    }

    function autenticarWebSocket(ws) {
        ws.send(JSON.stringify({
            name: "ssid",
            msg: state.sessionId
        }));

        setTimeout(() => {
            ws.send(JSON.stringify({
                name: "subscribeMessage",
                msg: {
                    name: "candle-generated",
                    params: {
                        routingFilters: {
                            active_id: state.assetId,
                            size: parseInt(state.timeframe)
                        }
                    }
                }
            }));
        }, 1000);
    }

    function processarVela(vela) {
        const novaVela = {
            time: vela.created * 1000,
            open: vela.open,
            high: vela.max,
            low: vela.min,
            close: vela.close,
            volume: vela.volume
        };

        state.dadosHistoricos.push(novaVela);
        
        // Manter apenas 100 velas
        if (state.dadosHistoricos.length > 100) {
            state.dadosHistoricos.shift();
        }

        // Disparar análise
        if (!state.leituraEmAndamento) {
            analisarMercado();
        }
    }

    // =============================================
    // INTEGRAÇÃO COM A INTERFACE DA IQ OPTION
    // =============================================
    function criarInterface() {
        // Remover interface antiga se existir
        const oldContainer = document.getElementById("bot-container");
        if (oldContainer) oldContainer.remove();

        // Criar container do robô
        const container = document.createElement('div');
        container.id = "bot-container";
        container.style = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            z-index: 10000;
            background: #1e1f29;
            border-radius: 10px;
            padding: 15px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            min-width: 250px;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            color: white;
        `;

        container.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <h3 style="margin: 0; color: #6c5ce7;">ROBÔ TRADER</h3>
                <div id="bot-status" style="background: #4CAF50; width: 12px; height: 12px; border-radius: 50%;"></div>
            </div>
            <div id="bot-comando" style="font-size: 24px; font-weight: bold; text-align: center; padding: 10px; border-radius: 5px; background: #2c2d3a; margin-bottom: 10px;">
                --
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div style="text-align: center;">
                    <div style="font-size: 12px; opacity: 0.7;">Confiança</div>
                    <div id="bot-score" style="font-weight: bold;">--%</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 12px; opacity: 0.7;">Ativo</div>
                    <div id="bot-ativo">--</div>
                </div>
            </div>
        `;

        document.body.appendChild(container);
    }

    function atualizarInterface(sinal, score) {
        const comando = document.getElementById("bot-comando");
        const scoreEl = document.getElementById("bot-score");
        const ativoEl = document.getElementById("bot-ativo");
        
        if (comando) {
            comando.textContent = sinal;
            comando.className = "";
            comando.classList.add("bot-" + sinal.toLowerCase());
            
            if (sinal === "CALL") comando.innerHTML = "CALL 📈";
            else if (sinal === "PUT") comando.innerHTML = "PUT 📉";
            else comando.innerHTML = "ESPERAR ✋";
        }
        
        if (scoreEl) scoreEl.textContent = `${score}%`;
        if (ativoEl) ativoEl.textContent = Object.keys(ACTIVE_MAP).find(k => ACTIVE_MAP[k] === state.assetId) || "BTC/USD";
    }

    // =============================================
    // INICIALIZAÇÃO DO SISTEMA
    // =============================================
    function iniciarRobo() {
        // Aguardar carregamento da plataforma
        const checkReady = setInterval(() => {
            if (document.querySelector(".trading-chart")) {
                clearInterval(checkReady);
                
                // Criar interface
                criarInterface();
                
                // Iniciar conexão
                iniciarConexaoIQ();
                
                console.log("[ROBÔ] Inicializado com sucesso!");
            }
        }, 3000);
    }

    // Mapeamento de ativos
    const ACTIVE_MAP = {
        "BTC/USD": 1,
        "ETH/USD": 2,
        "EUR/USD": 3
    };

    // Estilos dinâmicos
    const style = document.createElement('style');
    style.textContent = `
        .bot-call { background: linear-gradient(135deg, #00b894, #00cec9) !important; color: white !important; }
        .bot-put { background: linear-gradient(135deg, #ff7675, #d63031) !important; color: white !important; }
        .bot-esperar { background: linear-gradient(135deg, #0984e3, #6c5ce7) !important; color: white !important; }
    `;
    document.head.appendChild(style);

    // Iniciar quando a página carregar
    window.addEventListener('load', iniciarRobo);
})();
