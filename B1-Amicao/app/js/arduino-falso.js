import { lerLinha, uidValido } from './protocolo.js';

const MAX_TAGS = 10;

// Faz o papel do Arduino dentro do navegador, seguindo as mesmas regras do firmware.
// Serve para testar o app sem hardware (modo ?sim=1).
export class ArduinoFalso {
  constructor({ aoLinha, duracaoCadastroMs = 30000, intervaloRacaoMs = 60000, duracaoProcessoMs = 0, animarProcesso = false, relogio = Date.now }) {
    this.aoLinha = aoLinha;
    this.duracaoCadastroMs = duracaoCadastroMs;
    this.intervaloRacaoMs = intervaloRacaoMs;
    this.duracaoProcessoMs = duracaoProcessoMs;   // quanto tempo o totem fica "ocupado" depois de uma visita
    this.animarProcesso = animarProcesso;         // no navegador: motor e bomba acendem em sequencia
    this.ocupadoAte = 0;
    this.sensores = { leitor: true, balanca: true };
    this.temporizadorStatus = null;
    this.relogio = relogio;
    this.tags = new Map();            // uid -> nome (faz o papel da EEPROM)
    this.ultimaPorcao = new Map();    // uid -> momento da ultima racao
    this.modoCadastro = false;
    this.temporizador = null;
  }

  emitir(objeto) {
    this.aoLinha(JSON.stringify(objeto));
  }

  // Texto que o app mandaria pelo Bluetooth.
  receberComando(texto) {
    const c = lerLinha(texto);
    if (!c) return;
    if (c.cmd === 'cadastrar') this.ligarModoCadastro();
    else if (c.cmd === 'cancelar') this.desligarModoCadastro();
    else if (c.cmd === 'listar') this.enviarCadastros();
    else if (c.cmd === 'permitir') this.permitir(c.uid, c.nome);
    else if (c.cmd === 'remover') this.remover(c.uid);
  }

  permitir(uid, nome) {
    const cabe = this.tags.has(uid) || this.tags.size < MAX_TAGS;
    if (uidValido(uid) && cabe) {
      this.tags.set(uid, String(nome ?? '').slice(0, 10));
      this.ultimaPorcao.delete(uid);
    }
    this.enviarCadastros();
  }

  remover(uid) {
    this.tags.delete(uid);
    this.ultimaPorcao.delete(uid);
    this.enviarCadastros();
  }

  enviarCadastros() {
    this.emitir({ evento: 'cadastros', uids: [...this.tags.keys()] });
  }

  ligarModoCadastro() {
    clearTimeout(this.temporizador);
    this.modoCadastro = true;
    this.emitir({ evento: 'modo_cadastro', ativo: true });
    this.temporizador = setTimeout(() => this.desligarModoCadastro(), this.duracaoCadastroMs);
  }

  desligarModoCadastro() {
    if (!this.modoCadastro) return;
    clearTimeout(this.temporizador);
    this.modoCadastro = false;
    this.emitir({ evento: 'modo_cadastro', ativo: false });
  }

  // Alguem encostou uma tag no leitor.
  passarTag(uid, pesoKg) {
    if (this.modoCadastro) {
      this.emitir({ evento: 'tag_lida', uid });
      this.desligarModoCadastro();
      return;
    }
    if (!this.tags.has(uid)) return;   // tag desconhecida: nada acontece

    const agora = this.relogio();
    if (agora < this.ocupadoAte) return;   // totem ocupado (pesando, dando racao e agua): le e descarta a tag
    this.ocupadoAte = agora + this.duracaoProcessoMs;
    const ultima = this.ultimaPorcao.get(uid);
    const racao = ultima === undefined || agora - ultima >= this.intervaloRacaoMs;
    if (racao) this.ultimaPorcao.set(uid, agora);

    const pesoValido = pesoKg >= 1;
    const visita = {
      evento: 'visita',
      uid,
      peso_kg: pesoValido ? Math.round(pesoKg * 10) / 10 : null,
      racao,
    };
    if (!this.animarProcesso) {
      this.emitir(visita);
      return;
    }
    // Como no totem: pesa, motor da racao, bomba, e so no fim manda a visita.
    const passos = racao
      ? [[0, () => this.racao(true)], [2500, () => this.racao(false)], [2500, () => this.agua(true)],
         [5500, () => this.agua(false)], [5600, () => this.emitir(visita)]]
      : [[1500, () => this.emitir(visita)]];
    for (const [quando, fazer] of passos) setTimeout(fazer, quando);
  }

  ligar() {
    this.emitir({ evento: 'ligado' });
    this.emitirStatus();
  }

  emitirStatus() {
    this.emitir({ evento: 'status', leitor: this.sensores.leitor, balanca: this.sensores.balanca });
  }

  // Simula um sensor que falha ou volta ao normal ('leitor' ou 'balanca').
  definirSensor(nome, funcionando) {
    this.sensores[nome] = funcionando;
    this.emitirStatus();
  }

  // O firmware repete o status a cada 5 s. So o navegador liga isso (os testes nao).
  iniciarStatusPeriodico(intervaloMs = 5000) {
    clearInterval(this.temporizadorStatus);
    this.temporizadorStatus = setInterval(() => this.emitirStatus(), intervaloMs);
  }

  agua(ligada) {
    this.emitir({ evento: 'agua', bomba: ligada ? 'ligada' : 'desligada' });
  }

  racao(ligado) {
    this.emitir({ evento: 'racao', motor: ligado ? 'ligado' : 'desligado' });
  }
}
