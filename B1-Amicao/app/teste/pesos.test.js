import test from 'node:test';
import assert from 'node:assert/strict';
import {
  avaliarPeso, anotarVisitas, compararComAnteriores, tendencia, LIMITE_VARIACAO_PERCENTUAL,
} from '../js/pesos.js';

const v = (...pesos) => pesos.map(p => ({ peso_kg: p }));

test('o limite e de 20%', () => {
  assert.equal(LIMITE_VARIACAO_PERCENTUAL, 20);
});

test('primeira pesagem: nada para comparar, sem alerta', () => {
  assert.equal(avaliarPeso(v(7)).alerta, false);
  assert.equal(compararComAnteriores([], 7), null);
});

test('a partir da segunda pesagem ja compara com a primeira', () => {
  const r = avaliarPeso(v(10, 7.5));   // -25%
  assert.equal(r.alerta, true);
  assert.equal(r.direcao, 'menos');
  assert.ok(Math.abs(r.variacaoPercentual + 25) < 0.001);
});

test('ganho de peso de 20% ou mais tambem sinaliza', () => {
  const r = avaliarPeso(v(10, 12));    // +20%
  assert.equal(r.alerta, true);
  assert.equal(r.direcao, 'mais');
});

test('menos de 20% de diferenca: sem alerta', () => {
  assert.equal(avaliarPeso(v(10, 8.5)).alerta, false);     // -15%
  assert.equal(avaliarPeso(v(10, 11.9)).alerta, false);    // +19%
});

test('compara com a media de TODAS as pesagens anteriores', () => {
  // media anterior = (10 + 12 + 11) / 3 = 11. Ultimo 8,5 = -22,7%
  const r = avaliarPeso(v(10, 12, 11, 8.5));
  assert.equal(r.alerta, true);
  assert.ok(Math.abs(r.mediaAnterior - 11) < 1e-9);
});

test('visitas sem peso (null) nao contam', () => {
  assert.equal(avaliarPeso(v(10, null, 7, null)).alerta, true);   // 7 contra 10
  assert.equal(avaliarPeso(v(null, null)).alerta, false);
});

test('o alerta some quando a ultima pesagem volta ao normal', () => {
  assert.equal(avaliarPeso(v(10, 7)).alerta, true);        // 7 contra 10 = -30%
  assert.equal(avaliarPeso(v(10, 7, 9.5)).alerta, false);  // 9,5 contra media 8,5 = +11,8%
});

test('anotarVisitas marca cada visita com a comparacao dela', () => {
  const anotadas = anotarVisitas(v(10, 10, 7, null, 9.5));
  assert.equal(anotadas[0].comparacao, null);
  assert.equal(anotadas[1].comparacao.alerta, false);
  assert.equal(anotadas[2].comparacao.alerta, true);     // 7 contra 10 = -30%
  assert.equal(anotadas[3].comparacao, null);            // sem peso
  assert.equal(anotadas[4].comparacao.alerta, false);    // 9,5 contra media (10+10+7)/3 = 9 = +5,6%
});

test('tendencia compara os dois ultimos pesos', () => {
  assert.equal(tendencia([7.0, 6.5]), 'desceu');
  assert.equal(tendencia([6.5, 7.0]), 'subiu');
  assert.equal(tendencia([7.0, 7.05]), 'igual');
  assert.equal(tendencia([7.0]), null);
});
