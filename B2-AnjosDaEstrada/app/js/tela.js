import { h } from './dom.js';
import { criarSvgCaminhao } from './caminhao.js';
import { classificarDistancia, CAMPOS_DISTANCIA } from './faixas.js';

const TEXTO_DISTANCIA = { livre: '✔ Livre', atencao: '⚠ Atenção', critico: '⛔ CRÍTICO', semsinal: 'Sem sinal' };
const TEXTO_FAROL = { desligado: '○ Desligado', ok: '💡 Aceso', queimado: '⛔ Queimado', semsinal: 'Sem sinal' };
const TITULOS = {
  frente_esq: 'Frente esquerda', frente_dir: 'Frente direita',
  tras_esq: 'Trás esquerda', tras_dir: 'Trás direita',
};

// Cria um card com titulo, valor grande e estado (cor + icone + texto).
function criarCard(titulo) {
  const valor = h('span', { class: 'valor' }, '—');
  const estado = h('span', { class: 'estado' }, '');
  const raiz = h('div', { class: 'card semsinal' }, h('span', { class: 'titulo' }, titulo), valor, estado);
  return { raiz, valor, estado };
}

export function montarTela(raiz) {
  const svg = criarSvgCaminhao();
  const cards = {};
  for (const campo of CAMPOS_DISTANCIA) cards[campo] = criarCard(TITULOS[campo]);
  cards.farol_e = criarCard('Farol esquerdo');
  cards.farol_d = criarCard('Farol direito');
  cards.chuva = criarCard('Pista');

  raiz.replaceChildren(
    h('div', { class: 'coluna esquerda' }, cards.frente_esq.raiz, cards.farol_e.raiz, cards.tras_esq.raiz),
    h('div', { class: 'centro' }, cards.chuva.raiz, svg),
    h('div', { class: 'coluna direita' }, cards.frente_dir.raiz, cards.farol_d.raiz, cards.tras_dir.raiz),
  );

  function pintar(card, classe, textoValor, textoEstado) {
    card.raiz.className = 'card ' + classe;
    card.valor.textContent = textoValor;
    card.estado.textContent = textoEstado;
  }

  // leitura === null significa "sem sinal do caminhao".
  function atualizar(leitura) {
    for (const campo of CAMPOS_DISTANCIA) {
      const zona = svg.querySelector('#zona-' + campo);
      if (!leitura) {
        zona.setAttribute('class', 'zona semsinal');
        pintar(cards[campo], 'semsinal', '—', TEXTO_DISTANCIA.semsinal);
        continue;
      }
      const faixa = classificarDistancia(leitura[campo]);
      zona.setAttribute('class', 'zona ' + faixa);
      pintar(cards[campo], faixa, leitura[campo] === null ? '—' : leitura[campo] + ' cm', TEXTO_DISTANCIA[faixa]);
    }
    for (const [campo, lado] of [['farol_e', 'farol_e'], ['farol_d', 'farol_d']]) {
      const estado = leitura ? leitura[lado] : 'semsinal';
      svg.querySelector('#' + campo).setAttribute('class', 'farol ' + estado);
      pintar(cards[campo], estado, '', TEXTO_FAROL[estado]);
    }
    if (!leitura) pintar(cards.chuva, 'semsinal', '', 'Sem sinal');
    else if (leitura.chuva) pintar(cards.chuva, 'critico', '', '💧 MOLHADA');
    else pintar(cards.chuva, 'livre', '', '✔ Seca');
  }

  atualizar(null);
  return { atualizar };
}
