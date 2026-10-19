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
function formularioCadastro(estado, acoes) {
  const uid = estado.cadastro.uidLido;
  const jaCadastrado = estado.cachorros.find(c => c.uid === uid);
  if (jaCadastrado) {
    return h('section', { class: 'cadastro' },
      h('h2', {}, 'Tag já cadastrada'),
      h('p', {}, `Esta tag já pertence ao ${jaCadastrado.nome}.`),
      h('a', { class: 'botao', href: '#/' }, 'Voltar'));
  }

  const entradaNome = h('input', { type: 'text', maxlength: '10', required: true, placeholder: 'Ex.: Rex', autocomplete: 'off' });
  const entradaFoto = h('input', { type: 'file', accept: 'image/*', capture: 'environment' });
  return h('section', { class: 'cadastro' },
    h('h2', {}, 'Tag lida! Agora o nome e a foto'),
    estado.cadastro.mensagem ? h('p', { class: 'aviso-texto' }, estado.cadastro.mensagem) : '',
    h('p', { class: 'neutro' }, 'Tag: ' + uid),
    h('form', {
        id: 'form-cadastro',
        onsubmit: (evento) => {
          evento.preventDefault();
          acoes.salvarCachorro(entradaNome.value, entradaFoto.files[0]);
        },
      },
      h('label', {}, 'Nome (até 10 letras)'), entradaNome,
      h('label', {}, 'Foto (opcional)'), entradaFoto,
      h('p', {}, h('button', { type: 'submit' }, 'Salvar cachorro'), ' ',
        h('a', { class: 'botao claro', href: '#/' }, 'Cancelar'))));
}

export function telaCadastro(estado, acoes) {
  const c = estado.cadastro;
  if (c.fase === 'lido') return formularioCadastro(estado, acoes);

  const segundos = Math.max(0, Math.ceil((c.fimEm - Date.now()) / 1000));
  return h('section', { class: 'cadastro' },
    h('h2', {}, 'Cadastrar cachorro'),
    c.mensagem ? h('p', { class: 'aviso-texto' }, c.mensagem) : '',
    c.fase === 'aguardando' ? h('p', {}, 'Avisando o totem…') : '',
    c.fase === 'ouvindo'
      ? h('div', {},
          h('p', { class: 'instrucao' }, 'Encoste a tag da coleira no leitor do totem.'),
          h('p', {}, 'Tempo restante: ', h('strong', { id: 'contagem', class: 'contagem' }, segundos), ' s'))
      : '',
    c.fase === 'esgotado'
      ? h('div', {}, c.mensagem ? '' : h('p', { class: 'aviso-texto' }, 'O tempo acabou e nenhuma tag foi lida.'),
          h('button', { onclick: acoes.iniciarCadastro }, 'Tentar de novo'))
      : '',
    h('p', {}, h('a', { class: 'botao claro', href: '#/' }, 'Cancelar')),
  );
}

function campoNumero(rotulo, valor, minimo, maximo, passo = 1) {
  const entrada = h('input', { type: 'number', value: valor, min: minimo, max: maximo, step: passo, required: true });
  return { entrada, linha: h('label', {}, rotulo, entrada) };
}

export function telaAjustes(estado, acoes) {
  const queda = campoNumero('Alerta de peso: queda de (%) ', estado.config.quedaPercentual, 1, 50);
  const recente = campoNumero('Visitas recentes na média ', estado.config.janelaRecente, 1, 10);
  const anterior = campoNumero('Visitas de referência ', estado.config.janelaAnterior, 1, 20);
  const minimo = campoNumero('Mínimo de visitas com peso ', estado.config.minimoVisitas, 2, 30);
  const entradaBackup = h('input', { type: 'file', accept: 'application/json' });

  return h('section', { class: 'ajustes' },
    h('a', { href: '#/', class: 'botao claro' }, '← Voltar'),
    h('h2', {}, 'Ajustes'),

    h('h3', {}, 'Totem'),
    estado.conexao === 'conectado'
      ? h('p', { class: 'ok' }, '✔ Conectado ao totem')
      : h('p', {}, h('button', { onclick: acoes.conectar }, 'Conectar ao totem')),

    h('h3', {}, 'Alerta de perda de peso'),
    h('form', {
        onsubmit: (evento) => {
          evento.preventDefault();
          acoes.salvarConfig({
            quedaPercentual: Number(queda.entrada.value),
            janelaRecente: Number(recente.entrada.value),
            janelaAnterior: Number(anterior.entrada.value),
            minimoVisitas: Number(minimo.entrada.value),
          });
        },
      },
      queda.linha, recente.linha, anterior.linha, minimo.linha,
      h('p', {}, h('button', { type: 'submit' }, 'Salvar'))),

    h('h3', {}, 'Cachorros cadastrados'),
    estado.cachorros.length
      ? h('ul', { class: 'lista-ajustes' }, estado.cachorros.map(c => h('li', {},
          c.nome,
          h('button', {
            class: 'perigo',
            onclick: () => { if (confirm(`Remover ${c.nome} e todo o histórico dele?`)) acoes.removerCachorro(c.uid); },
          }, 'Remover'))))
      : h('p', { class: 'vazio' }, 'Nenhum cachorro cadastrado.'),

    h('h3', {}, 'Backup'),
    h('p', {}, h('button', { onclick: acoes.exportar }, 'Exportar backup')),
    h('label', {}, 'Importar backup (substitui tudo)'), entradaBackup,
    h('p', {}, h('button', { onclick: () => { if (entradaBackup.files[0]) acoes.importar(entradaBackup.files[0]); } }, 'Importar')),
  );
}
