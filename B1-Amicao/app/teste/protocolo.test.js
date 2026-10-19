import test from 'node:test';
import assert from 'node:assert/strict';
import { lerLinha, LinhaBuffer, quebrarEmBlocos, nomeParaLcd, uidValido, comando } from '../js/protocolo.js';

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
