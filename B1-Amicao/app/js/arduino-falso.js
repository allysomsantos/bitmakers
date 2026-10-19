import { lerLinha, uidValido } from './protocolo.js';

const MAX_TAGS = 10;

// Faz o papel do Arduino dentro do navegador, seguindo as mesmas regras do firmware.
// Serve para testar o app sem hardware (modo ?sim=1).
export class ArduinoFalso {
  constructor({ aoLinha, duracaoCadastroMs = 30000, intervaloRacaoMs = 15000, relogio = Date.now }) {
    this.aoLinha = aoLinha;
    this.duracaoCadastroMs = duracaoCadastroMs;
    this.intervaloRacaoMs = intervaloRacaoMs;
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
    const ultima = this.ultimaPorcao.get(uid);
    const racao = ultima === undefined || agora - ultima >= this.intervaloRacaoMs;
    if (racao) this.ultimaPorcao.set(uid, agora);

    const pesoValido = pesoKg >= 1;
    this.emitir({
      evento: 'visita',
      uid,
      peso_kg: pesoValido ? Math.round(pesoKg * 10) / 10 : null,
      racao,
    });
  }

  ligar() {
    this.emitir({ evento: 'ligado' });
  }

  agua(ligada) {
    this.emitir({ evento: 'agua', bomba: ligada ? 'ligada' : 'desligada' });
  }

  reservatorioVazio() {
    this.emitir({ evento: 'alerta', tipo: 'reservatorio_vazio' });
  }
}
