// =============================================
// CONTROLE DE TEMPO E INICIALIZAÇÃO (AJUSTADO)
// =============================================
function iniciarTimer() {
  // Executar primeira análise imediatamente
  analisarMercado();
  
  // Configurar timer periódico
  setInterval(() => {
    if (state.leituraEmAndamento) return;
    
    state.timer--;
    const timerElement = document.getElementById("timer");
    if (timerElement) {
      timerElement.textContent = `0:${state.timer.toString().padStart(2, '0')}`;
    }
    
    if (state.timer <= 0) {
      state.timer = 60;
      analisarMercado();
    }
  }, 1000);
}
