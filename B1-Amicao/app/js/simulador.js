import { h } from './dom.js';

// Tags de teste: uma de 4 bytes, uma de 7 bytes (como NTAG) e uma que nunca sera cadastrada.
const TAGS_DE_TESTE = [
  ['0A:0B:0C:0D', 'Tag A (4 bytes)'],
  ['11:22:33:44', 'Tag B (4 bytes)'],
  ['04:A1:B2:C3:D4:E5:F6', 'Tag C (7 bytes)'],
  ['99:99:99:99', 'Tag intrusa'],
];

export function montarPainelSimulador(elemento, falso) {
  const tag = h('select', {}, TAGS_DE_TESTE.map(([uid, nome]) => h('option', { value: uid }, nome)));
  const peso = h('input', { type: 'number', step: '0.1', value: '7.0', min: '0' });

  elemento.hidden = false;
  elemento.replaceChildren(
    h('strong', {}, 'Simulador (Arduino falso)'),
    h('label', {}, 'Tag ', tag),
    h('label', {}, 'Peso (kg) ', peso),
    h('button', { onclick: () => falso.passarTag(tag.value, parseFloat(peso.value)) }, 'Encostar tag na balança'),
    h('button', { onclick: () => falso.agua(true) }, 'Bomba ligou'),
    h('button', { onclick: () => falso.agua(false) }, 'Bomba desligou'),
    h('button', { onclick: () => falso.racao(true) }, 'Motor da ração ligou'),
    h('button', { onclick: () => falso.racao(false) }, 'Motor da ração desligou'),
    h('button', { onclick: () => falso.ligar() }, 'Arduino reiniciou'),
    h('button', { onclick: () => falso.definirSensor('leitor', !falso.sensores.leitor) }, 'Liga/desliga o leitor RFID'),
    h('button', { onclick: () => falso.definirSensor('balanca', !falso.sensores.balanca) }, 'Liga/desliga a balança'),
  );
}
