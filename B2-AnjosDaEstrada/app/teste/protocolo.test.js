import test from 'node:test';
import assert from 'node:assert/strict';
import { lerLinha, LinhaBuffer, quebrarEmBlocos, lerLeitura } from '../js/protocolo.js';

const LINHA = '{"frente_esq":12,"frente_dir":null,"tras_esq":4,"tras_dir":30,"chuva":true,"farol_e":"ok","farol_d":"queimado"}';

test('lerLeitura le a linha completa do Arduino', () => {
  assert.deepEqual(lerLeitura(lerLinha(LINHA)), {
    frente_esq: 12, frente_dir: null, tras_esq: 4, tras_dir: 30,
    chuva: true, farol_e: 'ok', farol_d: 'queimado',
  });
});

test('lerLeitura rejeita linha incompleta ou com valor invalido', () => {
  assert.equal(lerLeitura(null), null);
  assert.equal(lerLeitura({ frente_esq: 1 }), null);
  const semChuva = JSON.parse(LINHA); delete semChuva.chuva;
  assert.equal(lerLeitura(semChuva), null);
  assert.equal(lerLeitura({ ...JSON.parse(LINHA), farol_e: 'quebrou' }), null);
});

test('distancia negativa ou nao numerica vira null', () => {
  const l = lerLeitura({ ...JSON.parse(LINHA), frente_esq: -3, tras_dir: 'x' });
  assert.equal(l.frente_esq, null);
  assert.equal(l.tras_dir, null);
});

test('LinhaBuffer junta pedacos ate o \\n', () => {
  const buffer = new LinhaBuffer();
  assert.deepEqual(buffer.adicionar('{"a":'), []);
  assert.deepEqual(buffer.adicionar('1}\r\n{"b":2}\n'), ['{"a":1}', '{"b":2}']);
});

test('quebrarEmBlocos corta em 20 bytes', () => {
  assert.deepEqual(quebrarEmBlocos('x'.repeat(45)).map(b => b.length), [20, 20, 5]);
});

test('lerLinha ignora lixo', () => {
  assert.equal(lerLinha('APP> oi'), null);
  assert.equal(lerLinha('{quebrado'), null);
});
