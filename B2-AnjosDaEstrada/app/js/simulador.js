import { h } from './dom.js';

const CAMPOS = [
  ['frente_esq', 'Frente esq'], ['frente_dir', 'Frente dir'],
  ['tras_esq', 'Trás esq'], ['tras_dir', 'Trás dir'],
];

export function montarPainelSimulador(elemento, falso) {
  function controleDistancia([campo, rotulo]) {
    const numero = h('output', {}, 'livre');
    const barra = h('input', { type: 'range', min: '0', max: '40', value: '40' });
    barra.addEventListener('input', () => {
      const cm = Number(barra.value);
      falso.distancias[campo] = cm >= 40 ? null : cm;       // 40 = sem eco
      numero.textContent = cm >= 40 ? 'livre' : cm + ' cm';
    });
    return h('label', {}, rotulo + ' ', numero, barra);
  }

  function caixa(rotulo, campo) {
    const entrada = h('input', { type: 'checkbox' });
    entrada.addEventListener('change', () => { falso[campo] = entrada.checked; });
    return h('label', { class: 'linha' }, entrada, ' ' + rotulo);
  }

  const pausa = h('input', { type: 'checkbox' });
  pausa.addEventListener('change', () => (pausa.checked ? falso.pausar() : falso.retomar()));

  elemento.hidden = false;
  elemento.replaceChildren(
    h('strong', {}, 'Simulador (caminhão falso)'),
    ...CAMPOS.map(controleDistancia),
    caixa('Pista molhada', 'chuva'),
    caixa('Chave farol esquerdo ligada', 'chaveEsq'),
    caixa('LED esquerdo removido', 'semLedEsq'),
    caixa('Chave farol direito ligada', 'chaveDir'),
    caixa('LED direito removido', 'semLedDir'),
    h('label', { class: 'linha' }, pausa, ' Pausar (simula sem sinal)'),
  );
}
