import test from 'node:test';
import assert from 'node:assert/strict';
import { CaminhaoFalso } from '../js/caminhao-falso.js';
import { lerLinha, lerLeitura } from '../js/protocolo.js';

test('linha do estado inicial e uma leitura valida', () => {
  const falso = new CaminhaoFalso({ aoLinha: () => {} });
  assert.deepEqual(lerLeitura(lerLinha(falso.linha())), {
    frente_esq: null, frente_dir: null, tras_esq: null, tras_dir: null,
    chuva: false, farol_e: 'ok', farol_d: 'ok',
  });
});

test('regra do farol: sempre ligado, sem LED = queimado, com LED de novo = ok', () => {
  const falso = new CaminhaoFalso({ aoLinha: () => {} });
  falso.semLedDir = true;
  const leitura = lerLeitura(lerLinha(falso.linha()));
  assert.equal(leitura.farol_e, 'ok');
  assert.equal(leitura.farol_d, 'queimado');
  falso.semLedDir = false;
  assert.equal(lerLeitura(lerLinha(falso.linha())).farol_d, 'ok');
});

test('distancias e chuva aparecem na linha', () => {
  const falso = new CaminhaoFalso({ aoLinha: () => {} });
  falso.distancias.tras_esq = 4;
  falso.chuva = true;
  const leitura = lerLeitura(lerLinha(falso.linha()));
  assert.equal(leitura.tras_esq, 4);
  assert.equal(leitura.chuva, true);
});

test('iniciar emite linhas no periodo e pausar para', async () => {
  const linhas = [];
  const falso = new CaminhaoFalso({ aoLinha: l => linhas.push(l), periodoMs: 10 });
  falso.iniciar();
  await new Promise(ok => setTimeout(ok, 55));
  falso.pausar();
  const total = linhas.length;
  assert.ok(total >= 3, 'esperava varias linhas, veio ' + total);
  await new Promise(ok => setTimeout(ok, 40));
  assert.equal(linhas.length, total);
  assert.equal(falso.rodando, false);
});
