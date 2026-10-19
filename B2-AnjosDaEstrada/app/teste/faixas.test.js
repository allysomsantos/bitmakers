import test from 'node:test';
import assert from 'node:assert/strict';
import { classificarDistancia, menorDistancia, intervaloBipe, decidirSom, alertasAtivos } from '../js/faixas.js';

const base = { frente_esq: null, frente_dir: null, tras_esq: null, tras_dir: null, chuva: false, farol_e: 'ok', farol_d: 'ok' };

test('limites das faixas: 15 e 5 sao atencao, 4 e critico, 16 e livre', () => {
  assert.equal(classificarDistancia(16), 'livre');
  assert.equal(classificarDistancia(15), 'atencao');
  assert.equal(classificarDistancia(5), 'atencao');
  assert.equal(classificarDistancia(4), 'critico');
  assert.equal(classificarDistancia(1), 'critico');
  assert.equal(classificarDistancia(0), 'critico');
  assert.equal(classificarDistancia(null), 'livre');
});

test('menorDistancia ignora null', () => {
  assert.equal(menorDistancia(base), null);
  assert.equal(menorDistancia({ ...base, frente_esq: 30, tras_dir: 12 }), 12);
});

test('intervaloBipe vai de 600 ms (15 cm) a 200 ms (5 cm)', () => {
  assert.equal(intervaloBipe(15), 600);
  assert.equal(intervaloBipe(10), 400);
  assert.equal(intervaloBipe(5), 200);
});

test('decidirSom segue o sensor mais proximo', () => {
  assert.deepEqual(decidirSom(base), { tipo: 'silencio' });
  assert.deepEqual(decidirSom({ ...base, tras_esq: 40 }), { tipo: 'silencio' });
  assert.deepEqual(decidirSom({ ...base, tras_esq: 10 }), { tipo: 'bipe', intervaloMs: 400 });
  assert.deepEqual(decidirSom({ ...base, tras_esq: 10, frente_dir: 3 }), { tipo: 'continuo' });
});

test('alertasAtivos: chuva e farol queimado, com o nome do item', () => {
  assert.deepEqual(alertasAtivos(base), []);
  const ativos = alertasAtivos({ ...base, chuva: true, farol_d: 'queimado' });
  assert.deepEqual(ativos.map(a => a.id), ['chuva', 'farol_d']);
  assert.equal(ativos[1].texto, 'Farol direito queimado');
});

test('farol desligado nao e alerta', () => {
  assert.deepEqual(alertasAtivos({ ...base, farol_e: 'desligado' }), []);
});
