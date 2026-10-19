import test from 'node:test';
import assert from 'node:assert/strict';
import { avaliarPeso, tendencia, PADRAO } from '../js/pesos.js';

const v = (...pesos) => pesos.map(p => ({ peso_kg: p }));

test('menos de 4 visitas validas: sem alerta', () => {
  assert.equal(avaliarPeso(v(7, 6, 6)).alerta, false);
});

test('demonstracao da pelucia: 7, 6, 6, 6 dispara alerta de ~14%', () => {
  const r = avaliarPeso(v(7, 6, 6, 6));
  assert.equal(r.alerta, true);
  assert.ok(Math.abs(r.quedaPercentual - 14.285) < 0.01);
});

test('queda de 4%: sem alerta', () => {
  assert.equal(avaliarPeso(v(100, 96, 96, 96)).alerta, false);
});

test('visitas sem peso (null) nao contam', () => {
  assert.equal(avaliarPeso(v(7, null, 6, null, 6, 6)).alerta, true);
  assert.equal(avaliarPeso(v(null, null, null, null)).alerta, false);
});

test('alerta some quando a media se recupera', () => {
  assert.equal(avaliarPeso(v(7, 6, 6, 6, 7, 7, 7)).alerta, false);
});

test('usa so as 5 visitas anteriores as 3 recentes', () => {
  // 3 recentes = 6,6,6. As 5 anteriores = 9,9,9,9,9 (a de 1 kg, mais antiga, fica de fora)
  assert.equal(avaliarPeso(v(1, 9, 9, 9, 9, 9, 6, 6, 6)).alerta, true);
});

test('tendencia compara os dois ultimos pesos', () => {
  assert.equal(tendencia([7.0, 6.5]), 'desceu');
  assert.equal(tendencia([6.5, 7.0]), 'subiu');
  assert.equal(tendencia([7.0, 7.05]), 'igual');
  assert.equal(tendencia([7.0]), null);
});

test('PADRAO tem os valores da spec', () => {
  assert.deepEqual(PADRAO, { quedaPercentual: 5, janelaRecente: 3, janelaAnterior: 5, minimoVisitas: 4 });
});
