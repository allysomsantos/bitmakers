// Faz o papel do Arduino do B2 no navegador: gera uma linha JSON a cada periodo.
// Serve para testar o app sem hardware (modo ?sim=1).
export class CaminhaoFalso {
  constructor({ aoLinha, periodoMs = 600 }) {
    this.aoLinha = aoLinha;
    this.periodoMs = periodoMs;
    this.distancias = { frente_esq: null, frente_dir: null, tras_esq: null, tras_dir: null };
    this.chuva = false;
    this.semLedEsq = false;   // LED tirado da protoboard
    this.semLedDir = false;
    this.rodando = false;
    this.temporizador = null;
  }

  // O farol fica sempre ligado: sem LED (corrente zero) = queimado.
  static estadoDoFarol(semLed) {
    return semLed ? 'queimado' : 'ok';
  }

  linha() {
    return JSON.stringify({
      ...this.distancias,
      chuva: this.chuva,
      farol_e: CaminhaoFalso.estadoDoFarol(this.semLedEsq),
      farol_d: CaminhaoFalso.estadoDoFarol(this.semLedDir),
    });
  }

  iniciar() {
    this.pausar();
    this.rodando = true;
    this.aoLinha(this.linha());
    this.temporizador = setInterval(() => this.aoLinha(this.linha()), this.periodoMs);
  }

  pausar() {
    clearInterval(this.temporizador);
    this.rodando = false;
  }

  retomar() {
    this.iniciar();
  }
}
