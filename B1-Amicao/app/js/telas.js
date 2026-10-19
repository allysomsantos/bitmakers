import { h, mesmoDia, formatarQuando } from './dom.js';
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
const NS_SVG = 'http://www.w3.org/2000/svg';

function noSvg(tag, atributos = {}, texto = null) {
  const elemento = document.createElementNS(NS_SVG, tag);
  for (const [nome, valor] of Object.entries(atributos)) elemento.setAttribute(nome, valor);
  if (texto !== null) elemento.textContent = texto;
  return elemento;
}

// Grafico de linha do peso, um ponto por pesagem valida.
export function graficoPeso(pesos) {
  const largura = 600, altura = 240, margem = 40;
  const svg = noSvg('svg', { viewBox: `0 0 ${largura} ${altura}`, class: 'grafico', role: 'img', 'aria-label': 'Gráfico de peso' });
  if (pesos.length < 2) {
    svg.append(noSvg('text', { x: largura / 2, y: altura / 2, 'text-anchor': 'middle' }, 'Precisa de pelo menos 2 pesagens'));
    return svg;
  }
  const minimo = Math.min(...pesos) - 0.5;
  const maximo = Math.max(...pesos) + 0.5;
  const x = i => margem + (i * (largura - 2 * margem)) / (pesos.length - 1);
  const y = p => altura - margem - ((p - minimo) * (altura - 2 * margem)) / (maximo - minimo);

  svg.append(
    noSvg('text', { x: 4, y: y(maximo) + 4 }, maximo.toFixed(1)),
    noSvg('text', { x: 4, y: y(minimo) + 4 }, minimo.toFixed(1)),
    noSvg('polyline', { class: 'linha', points: pesos.map((p, i) => `${x(i)},${y(p)}`).join(' ') }),
  );
  pesos.forEach((p, i) => {
    svg.append(noSvg('circle', { class: 'ponto', cx: x(i), cy: y(p), r: 5 }));
    svg.append(noSvg('text', { x: x(i), y: y(p) - 10, 'text-anchor': 'middle' }, p.toFixed(1)));
  });
  return svg;
}

export function telaDetalhe(estado, uid) {
  const cachorro = estado.cachorros.find(c => c.uid === uid);
  if (!cachorro) return h('p', {}, 'Cachorro não encontrado. ', h('a', { href: '#/' }, 'Voltar'));

  const visitas = estado.visitas[uid] ?? [];
  const pesos = visitas.filter(v => typeof v.peso_kg === 'number').map(v => v.peso_kg);
  const avaliacao = avaliarPeso(visitas, estado.config);
  const linhas = [...visitas].reverse().map(v => h('tr', {},
    h('td', {}, formatarQuando(v.quando)),
    h('td', {}, v.peso_kg !== null ? v.peso_kg.toFixed(1) + ' kg' : 'sem peso'),
    h('td', {}, v.racao ? 'Comeu' : 'Só passou'),
  ));

  return h('section', { class: 'detalhe' },
    h('a', { href: '#/', class: 'botao claro' }, '← Voltar'),
    h('div', { class: 'detalhe-topo' },
      foto(cachorro),
      h('div', {},
        h('h2', {}, cachorro.nome),
        avaliacao.alerta
          ? h('span', { class: 'selo perigo' }, `⚠ Perdeu peso (${avaliacao.quedaPercentual.toFixed(0)}%)`)
          : h('span', { class: 'selo ok' }, 'Peso estável'))),
    h('h3', {}, 'Peso'),
    graficoPeso(pesos),
    h('h3', {}, 'Visitas'),
    linhas.length
      ? h('table', { class: 'visitas' },
          h('thead', {}, h('tr', {}, h('th', {}, 'Quando'), h('th', {}, 'Peso'), h('th', {}, 'Ração'))),
          h('tbody', {}, linhas))
      : h('p', { class: 'vazio' }, 'Nenhuma visita registrada ainda.'),
  );
}
export function telaCadastro() { return h('p', {}, 'Cadastro: em construção'); }
export function telaAjustes() { return h('p', {}, 'Ajustes: em construção'); }
