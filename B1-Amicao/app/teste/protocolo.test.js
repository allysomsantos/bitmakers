import test from 'node:test';
import assert from 'node:assert/strict';
import { lerLinha, LinhaBuffer, quebrarEmBlocos, nomeParaLcd, uidValido, backupValido, comando } from '../js/protocolo.js';

test('lerLinha aceita JSON de objeto', () => {
  assert.deepEqual(lerLinha('{"evento":"ligado"}'), { evento: 'ligado' });
});

test('lerLinha ignora lixo', () => {
  assert.equal(lerLinha('APP> oi'), null);
  assert.equal(lerLinha('{quebrado'), null);
  assert.equal(lerLinha(''), null);
  assert.equal(lerLinha('[1,2]'), null);
});

test('LinhaBuffer junta pedacos ate o \\n', () => {
  const buffer = new LinhaBuffer();
  assert.deepEqual(buffer.adicionar('{"evento":'), []);
  assert.deepEqual(buffer.adicionar('"ligado"}\r\n{"a":'), ['{"evento":"ligado"}']);
  assert.deepEqual(buffer.adicionar('1}\n'), ['{"a":1}']);
});

test('quebrarEmBlocos corta em 20 bytes', () => {
  const blocos = quebrarEmBlocos('x'.repeat(45));
  assert.deepEqual(blocos.map(b => b.length), [20, 20, 5]);
});

test('nomeParaLcd tira acento, simbolos e corta em 10', () => {
  assert.equal(nomeParaLcd('José Ávila Longo'), 'Jose Avila');
  assert.equal(nomeParaLcd('Rex!!'), 'Rex');
});

test('uidValido aceita 4 ou 7 bytes em maiusculo', () => {
  assert.equal(uidValido('0A:0B:0C:0D'), true);
  assert.equal(uidValido('04:A1:B2:C3:D4:E5:F6'), true);
  assert.equal(uidValido('0A:0B:0C'), false);
  assert.equal(uidValido('0A:0B:0C:0D:0E'), false);
  assert.equal(uidValido('0a:0b:0c:0d'), false);
  assert.equal(uidValido('ZZ:0B:0C:0D'), false);
});

test('comandos terminam em \\n e usam nome sem acento', () => {
  assert.equal(comando.cadastrar(), '{"cmd":"cadastrar"}\n');
  assert.equal(comando.cancelar(), '{"cmd":"cancelar"}\n');
  assert.equal(comando.listar(), '{"cmd":"listar"}\n');
  assert.equal(comando.permitir('0A:0B:0C:0D', 'José'), '{"cmd":"permitir","uid":"0A:0B:0C:0D","nome":"Jose"}\n');
  assert.equal(comando.remover('0A:0B:0C:0D'), '{"cmd":"remover","uid":"0A:0B:0C:0D"}\n');
});

// ---------- backupValido ----------
function backupExemplo() {
  return {
    cachorros: [{ uid: '0A:0B:0C:0D', nome: 'Rex' }],
    visitas: [
      { uid: '0A:0B:0C:0D', quando: '2026-10-19T10:00:00.000Z', peso_kg: 7.0, racao: true },
      { uid: '0A:0B:0C:0D', quando: '2026-10-19T14:00:00.000Z', peso_kg: null, racao: false },
    ],
  };
}

test('backupValido aceita um backup correto', () => {
  assert.equal(backupValido(backupExemplo()), true);
});

test('backupValido recusa uid com formato errado', () => {
  const dados = backupExemplo();
  dados.cachorros[0].uid = '0a:0b:0c:0d';
  assert.equal(backupValido(dados), false);

  const outros = backupExemplo();
  outros.visitas[1].uid = 'lixo';
  assert.equal(backupValido(outros), false);
});

test('backupValido recusa nome vazio ou que nao e texto', () => {
  const vazio = backupExemplo();
  vazio.cachorros[0].nome = '';
  assert.equal(backupValido(vazio), false);

  const numero = backupExemplo();
  numero.cachorros[0].nome = 42;
  assert.equal(backupValido(numero), false);
});

test('backupValido recusa visita com peso, quando ou racao invalidos', () => {
  const peso = backupExemplo();
  peso.visitas[0].peso_kg = '7';
  assert.equal(backupValido(peso), false);

  const quando = backupExemplo();
  quando.visitas[0].quando = 123;
  assert.equal(backupValido(quando), false);

  const racao = backupExemplo();
  racao.visitas[0].racao = 'sim';
  assert.equal(backupValido(racao), false);
});

test('backupValido recusa o que nao e lista de objetos', () => {
  assert.equal(backupValido(null), false);
  assert.equal(backupValido({ cachorros: {}, visitas: [] }), false);
  assert.equal(backupValido({ cachorros: [], visitas: 'x' }), false);
  assert.equal(backupValido({ cachorros: [null], visitas: [] }), false);
  assert.equal(backupValido({ cachorros: [], visitas: [5] }), false);
  assert.equal(backupValido({ cachorros: [], visitas: [] }), true);
});
