// Variáveis globais
let historico = { win: 0, loss: 0 };
let sinaisRecentes = [];
let intervaloAnalise = 60; // segundos
let analiseAtiva = true;

// Elementos DOM
const comandoElement = document.getElementById('comando');
const scoreElement = document.getElementById('score');
const timerElement = document.getElementById('timer');
const horaElement = document.getElementById('hora');
const criteriosElement = document.getElementById('criterios');
const historicoElement = document.getElementById('historico');
const ultimosElement = document.getElementById('ultimos');
const somCall = document.getElementById('som-call');
const somPut = document.getElementById('som-put');

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  atualizarHistorico();
  iniciarAnalise();
  iniciarTemporizador();
});

// Função para iniciar o temporizador
function iniciarTemporizador() {
  let tempo = intervaloAnalise;
  timerElement.textContent = tempo;
  
  const contador = setInterval(() => {
    tempo--;
    timerElement.textContent = tempo;
    
    if (tempo <= 0) {
      clearInterval(contador);
      if (analiseAtiva) {
        realizarAnalise();
      }
      iniciarTemporizador();
    }
  }, 1000);
}

// Função para realizar a análise técnica
async function realizarAnalise() {
  try {
    // Obter dados do BTCUSDT (simulação)
    const dadosBTC = await obterDadosBTC();
    
    // Calcular indicadores
    const ema9 = calcularEMA(dadosBTC.fechamentos, 9);
    const ema21 = calcularEMA(dadosBTC.fechamentos, 21);
    const rsi = calcularRSI(dadosBTC.fechamentos, 14);
    const macd = calcularMACD(dadosBTC.fechamentos);
    const volumeAtual = dadosBTC.volumes[dadosBTC.volumes.length - 1];
    const volumeMedio = calcularMedia(dadosBTC.volumes, 5);
    
    // Critérios de análise
    const criterios = {
      tendenciaAlta: ema9 > ema21,
      rsiNeutroAlta: rsi > 50 && rsi < 70,
      rsiNeutroBaixa: rsi < 50 && rsi > 30,
      macdPositivo: macd.histograma > 0,
      volumeAcimaMedia: volumeAtual > volumeMedio,
      tendenciaForte: Math.abs(ema9 - ema21) > dadosBTC.fechamentos[dadosBTC.fechamentos.length - 1] * 0.001
    };
    
    // Calcular score
    let pontos = 0;
    let totalCritérios = 0;
    criteriosElement.innerHTML = '';
    
    // Avaliar cada critério
    for (const [chave, valor] of Object.entries(criterios)) {
      totalCritérios++;
      if (valor) pontos++;
      
      const li = document.createElement('li');
      li.textContent = formatarCritério(chave) + ': ' + (valor ? 'Atendido' : 'Não atendido');
      li.className = valor ? 'criterio-positivo' : 'criterio-negativo';
      criteriosElement.appendChild(li);
    }
    
    const score = Math.round((pontos / totalCritérios) * 100);
    scoreElement.textContent = `${score}%`;
    
    // Determinar sinal com base na pontuação
    let sinal = 'ESPERAR';
    let classe = 'esperar';
    
    if (score >= 70) {
      if (criterios.tendenciaAlta && criterios.rsiNeutroAlta) {
        sinal = 'CALL';
        classe = 'call';
        somCall.play().catch(e => console.log("Erro ao reproduzir som:", e));
      } else if (!criterios.tendenciaAlta && criterios.rsiNeutroBaixa) {
        sinal = 'PUT';
        classe = 'put';
        somPut.play().catch(e => console.log("Erro ao reproduzir som:", e));
      }
    }
    
    // Atualizar interface
    comandoElement.textContent = sinal;
    comandoElement.className = classe;
    
    // Atualizar hora da última análise
    const agora = new Date();
    horaElement.textContent = agora.toLocaleTimeString();
    
    // Registrar sinal recente
    if (sinal !== 'ESPERAR') {
      registrarSinalRecente(sinal, score, agora);
    }
    
  } catch (erro) {
    console.error('Erro na análise:', erro);
    comandoElement.textContent = 'ERRO';
    comandoElement.className = 'erro';
    scoreElement.textContent = '--%';
  }
}

// Funções auxiliares para análise técnica
function calcularEMA(valores, periodos) {
  const k = 2 / (periodos + 1);
  let ema = valores[0];
  
  for (let i = 1; i < valores.length; i++) {
    ema = valores[i] * k + ema * (1 - k);
  }
  
  return ema;
}

function calcularRSI(valores, periodos) {
  let ganhos = 0;
  let perdas = 0;
  
  for (let i = 1; i <= periodos; i++) {
    const diferenca = valores[i] - valores[i - 1];
    if (diferenca >= 0) {
      ganhos += diferenca;
    } else {
      perdas -= diferenca;
    }
  }
  
  const rs = ganhos / perdas;
  return 100 - (100 / (1 + rs));
}

function calcularMACD(valores) {
  const ema12 = calcularEMA(valores, 12);
  const ema26 = calcularEMA(valores, 26);
  const macd = ema12 - ema26;
  const sinal = calcularEMA(valores.slice(-9), 9); // EMA 9 do MACD
  const histograma = macd - sinal;
  
  return { macd, sinal, histograma };
}

function calcularMedia(valores, periodos) {
  const inicio = Math.max(0, valores.length - periodos);
  const valoresRecentes = valores.slice(inicio);
  const soma = valoresRecentes.reduce((acc, val) => acc + val, 0);
  return soma / valoresRecentes.length;
}

function formatarCritério(chave) {
  const formatos = {
    tendenciaAlta: 'Tendência de Alta',
    rsiNeutroAlta: 'RSI Neutro-Alta',
    rsiNeutroBaixa: 'RSI Neutro-Baixa',
    macdPositivo: 'MACD Positivo',
    volumeAcimaMedia: 'Volume Acima da Média',
    tendenciaForte: 'Tendência Forte'
  };
  
  return formatos[chave] || chave;
}

// Funções de registro
function registrar(resultado) {
  if (resultado === 'WIN') historico.win++;
  if (resultado === 'LOSS') historico.loss++;
  atualizarHistorico();
}

function atualizarHistorico() {
  historicoElement.textContent = `${historico.win} WIN / ${historico.loss} LOSS`;
}

function registrarSinalRecente(sinal, score, data) {
  const sinalInfo = {
    sinal,
    score,
    hora: data.toLocaleTimeString()
  };
  
  sinaisRecentes.unshift(sinalInfo);
  if (sinaisRecentes.length > 5) sinaisRecentes.pop();
  
  atualizarUltimosSinais();
}

function atualizarUltimosSinais() {
  ultimosElement.innerHTML = '';
  
  sinaisRecentes.forEach(info => {
    const li = document.createElement('li');
    li.textContent = `${info.sinal} (${info.score}%)`;
    li.className = info.sinal === 'CALL' ? 'sinal-call' : 'sinal-put';
    const spanHora = document.createElement('span');
    spanHora.textContent = info.hora;
    spanHora.style.opacity = '0.7';
    li.appendChild(spanHora);
    ultimosElement.appendChild(li);
  });
}

// Simulação de dados da API
async function obterDadosBTC() {
  // Em uma aplicação real, isso seria substituído por uma chamada API
  return new Promise(resolve => {
    setTimeout(() => {
      // Gerar dados fictícios
      const fechamentos = [];
      const volumes = [];
      let preco = 60000;
      
      for (let i = 0; i < 100; i++) {
        const variacao = (Math.random() - 0.5) * 1000;
        preco += variacao;
        const volume = 100 + Math.random() * 50;
        
        fechamentos.push(preco);
        volumes.push(volume);
      }
      
      resolve({ fechamentos, volumes });
    }, 300);
  });
}

// Iniciar o processo de análise
function iniciarAnalise() {
  realizarAnalise();
  setInterval(() => {
    if (analiseAtiva) realizarAnalise();
  }, intervaloAnalise * 1000);
}
