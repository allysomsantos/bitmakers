import { h, mesmoDia } from './dom.js';
import { avaliarPeso, tendencia } from './pesos.js';

const SETAS = { subiu: '↑', desceu: '↓', igual: '→' };

function foto(cachorro) {
  return cachorro.foto
    ? h('img', { class: 'foto', src: cachorro.foto, alt: 'Foto de ' + cachorro.nome })
    : h('div', { class: 'foto sem-foto' }, '🐶');
}

function cardCachorro(estado, cachorro) {
  const visitas = estado.visitas[cachorro.uid] ?? [];
  const pesos = visitas.filter(v => typeof v.peso_kg === 'number').map(v => v.peso_kg);
  const ultimo = pesos.length ? pesos[pesos.length - 1] : null;
  const seta = SETAS[tendencia(pesos)] ?? '';
  const comeuHoje = visitas.some(v => v.racao && mesmoDia(v.quando, new Date()));
  const perdeuPeso = avaliarPeso(visitas, estado.config).alerta;

  return h('a', {
      class: 'card' + (perdeuPeso ? ' alerta' : ''),
      href: '#/cachorro/' + encodeURIComponent(cachorro.uid),
    },
    foto(cachorro),
    h('strong', {}, cachorro.nome),
    h('span', { class: comeuHoje ? 'ok' : 'neutro' }, comeuHoje ? '✔ Já comeu hoje' : 'Ainda não comeu hoje'),
    h('span', {}, ultimo !== null ? `${ultimo.toFixed(1)} kg ${seta}` : 'Sem peso ainda'),
    perdeuPeso ? h('span', { class: 'selo perigo' }, '⚠ Perdeu peso') : '',
  );
}

export function telaInicio(estado, acoes) {
  const cards = estado.cachorros.map(c => cardCachorro(estado, c));
  return h('section', { class: 'inicio' },
    h('div', { class: 'grade' },
      cards.length ? cards : h('p', { class: 'vazio' }, 'Nenhum cachorro cadastrado ainda. Toque em "Cadastrar cachorro".')),
    h('a', { class: 'botao grande', href: '#/cadastro' }, '＋ Cadastrar cachorro'),
  );
}

// Provisorias: as tarefas 5, 6 e 7 trocam estas funcoes pelas telas de verdade.
export function telaDetalhe() { return h('p', {}, 'Detalhe: em construção'); }
export function telaCadastro() { return h('p', {}, 'Cadastro: em construção'); }
export function telaAjustes() { return h('p', {}, 'Ajustes: em construção'); }
