import test from 'node:test';
import assert from 'node:assert/strict';
import { ArduinoFalso } from '../js/arduino-falso.js';
import { comando } from '../js/protocolo.js';

function criar(opcoes = {}) {
  const linhas = [];
  let agora = 0;
  const falso = new ArduinoFalso({
    aoLinha: texto => linhas.push(JSON.parse(texto)),
    relogio: () => agora,
    ...opcoes,
  });
  return { falso, linhas, avancar: ms => { agora += ms; } };
}

const REX = '0A:0B:0C:0D';

test('tag desconhecida fora do modo cadastro nao gera nada', () => {
  const { falso, linhas } = criar();
  falso.passarTag('99:99:99:99', 7);
  assert.deepEqual(linhas, []);
});

test('modo cadastro: a proxima tag vira tag_lida e o modo termina', () => {
  const { falso, linhas } = criar();
  falso.receberComando(comando.cadastrar());
  falso.passarTag(REX, 7);
  assert.deepEqual(linhas, [
    { evento: 'modo_cadastro', ativo: true },
    { evento: 'tag_lida', uid: REX },
    { evento: 'modo_cadastro', ativo: false },
  ]);
});

test('permitir cadastra e responde com a lista', () => {
  const { falso, linhas } = criar();
  falso.receberComando(comando.permitir(REX, 'Rex'));
  assert.deepEqual(linhas, [{ evento: 'cadastros', uids: [REX] }]);
});

test('visita: racao na primeira vez, sem racao dentro do intervalo, com racao depois', () => {
  const { falso, linhas, avancar } = criar();
  falso.receberComando(comando.permitir(REX, 'Rex'));
  linhas.length = 0;
  falso.passarTag(REX, 7);
  falso.passarTag(REX, 7);
  avancar(61000);   // o intervalo da racao e de 1 minuto
  falso.passarTag(REX, 7);
  assert.deepEqual(linhas.map(l => l.racao), [true, false, true]);
});

test('totem ocupado: tag que chega durante o processo e descartada, e volta a valer depois', () => {
  const { falso, linhas, avancar } = criar({ duracaoProcessoMs: 5000 });
  falso.receberComando(comando.permitir(REX, 'Rex'));
  falso.receberComando(comando.permitir('11:22:33:44', 'Pipoca'));
  linhas.length = 0;
  falso.passarTag(REX, 7);                 // comeca o processo
  avancar(2000);
  falso.passarTag('11:22:33:44', 5);       // durante o processo: ignorada
  assert.equal(linhas.length, 1);
  avancar(4000);                           // processo terminou
  falso.passarTag('11:22:33:44', 5);       // agora vale
  assert.deepEqual(linhas.map(l => l.uid), [REX, '11:22:33:44']);
});

test('racao e agua mandam os eventos do motor e da bomba', () => {
  const { falso, linhas } = criar();
  falso.racao(true);
  falso.racao(false);
  falso.agua(true);
  assert.deepEqual(linhas, [
    { evento: 'racao', motor: 'ligado' },
    { evento: 'racao', motor: 'desligado' },
    { evento: 'agua', bomba: 'ligada' },
  ]);
});

test('ligar manda o evento ligado e o status dos sensores', () => {
  const { falso, linhas } = criar();
  falso.ligar();
  assert.deepEqual(linhas, [
    { evento: 'ligado' },
    { evento: 'status', leitor: true, balanca: true },
  ]);
});

test('definirSensor avisa quando um sensor falha e quando volta', () => {
  const { falso, linhas } = criar();
  falso.definirSensor('leitor', false);
  falso.definirSensor('leitor', true);
  falso.definirSensor('balanca', false);
  assert.deepEqual(linhas, [
    { evento: 'status', leitor: false, balanca: true },
    { evento: 'status', leitor: true, balanca: true },
    { evento: 'status', leitor: true, balanca: false },
  ]);
});

test('peso abaixo de 1 kg vira null e o peso sai com 1 casa', () => {
  const { falso, linhas } = criar();
  falso.receberComando(comando.permitir(REX, 'Rex'));
  linhas.length = 0;
  falso.passarTag(REX, 0.4);
  falso.passarTag(REX, 7.04);
  assert.equal(linhas[0].peso_kg, null);
  assert.equal(linhas[1].peso_kg, 7);
});

test('remover volta a ignorar a tag', () => {
  const { falso, linhas } = criar();
  falso.receberComando(comando.permitir(REX, 'Rex'));
  falso.receberComando(comando.remover(REX));
  linhas.length = 0;
  falso.passarTag(REX, 7);
  assert.deepEqual(linhas, []);
});

test('uid invalido nao e gravado', () => {
  const { falso, linhas } = criar();
  falso.receberComando('{"cmd":"permitir","uid":"xx","nome":"Rex"}\n');
  assert.deepEqual(linhas, [{ evento: 'cadastros', uids: [] }]);
});

test('lista cheia: a 11a tag nao entra', () => {
  const { falso, linhas } = criar();
  for (let n = 0; n < 11; n++) {
    const uid = '0A:0B:0C:' + n.toString(16).toUpperCase().padStart(2, '0');
    falso.receberComando(comando.permitir(uid, 'C' + n));
  }
  assert.equal(linhas.at(-1).uids.length, 10);
});

test('modo cadastro expira sozinho', async () => {
  const { falso, linhas } = criar({ duracaoCadastroMs: 10 });
  falso.receberComando(comando.cadastrar());
  await new Promise(ok => setTimeout(ok, 40));
  assert.deepEqual(linhas.at(-1), { evento: 'modo_cadastro', ativo: false });
});

test('cancelar encerra o modo cadastro', () => {
  const { falso, linhas } = criar();
  falso.receberComando(comando.cadastrar());
  falso.receberComando(comando.cancelar());
  assert.deepEqual(linhas.at(-1), { evento: 'modo_cadastro', ativo: false });
});
