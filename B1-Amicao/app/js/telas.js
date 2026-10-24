import { h, mesmoDia, formatarQuando, formatarQuandoCurto } from './dom.js';
import { avaliarPeso, anotarVisitas, tendencia, formatarVariacao } from './pesos.js';

const SETAS = { subiu: '↑', desceu: '↓', igual: '→' };
const MAX_PASSADAS = 40;   // quantas passadas aparecem na tela inicial

function foto(cachorro) {
  return cachorro.foto
    ? h('img', { class: 'foto', src: cachorro.foto, alt: 'Foto de ' + cachorro.nome })
    : h('div', { class: 'foto sem-foto' }, '🐶');
}

// "+12% mais pesado" / "−11% mais leve"
function textoVariacao(comparacao) {
  return `${formatarVariacao(comparacao)} ${comparacao.direcao === 'mais' ? 'mais pesado' : 'mais leve'}`;
}

function cardCachorro(estado, cachorro) {
  const visitas = estado.visitas[cachorro.uid] ?? [];
  const pesos = visitas.filter(v => typeof v.peso_kg === 'number').map(v => v.peso_kg);
  const ultimo = pesos.length ? pesos[pesos.length - 1] : null;
  const seta = SETAS[tendencia(pesos)] ?? '';
  const comeuHoje = visitas.some(v => v.racao && mesmoDia(v.quando, new Date()));
  const avaliacao = avaliarPeso(visitas);

  return h('a', {
      class: 'card' + (avaliacao.alerta ? ' alerta' : ''),
      href: '#/cachorro/' + encodeURIComponent(cachorro.uid),
    },
    foto(cachorro),
    h('strong', {}, cachorro.nome),
    h('span', { class: comeuHoje ? 'ok' : 'neutro' }, comeuHoje ? '✔ Já comeu hoje' : 'Ainda não comeu hoje'),
    h('span', { class: 'peso-card' }, ultimo !== null ? `${ultimo.toFixed(1)} kg ${seta}` : 'Sem peso ainda'),
    avaliacao.alerta ? h('span', { class: 'selo perigo' }, '⚠ ' + textoVariacao(avaliacao)) : '',
  );
}

// Todas as passadas de todos os cachorros, da mais recente para a mais antiga.
export function listarPassadas(estado) {
  const todas = [];
  for (const cachorro of estado.cachorros) {
    for (const visita of anotarVisitas(estado.visitas[cachorro.uid] ?? [])) {
      todas.push({ ...visita, cachorro });
    }
  }
  return todas.sort((a, b) => b.quando.localeCompare(a.quando));
}

function linhaPassada(passada) {
  const { cachorro, comparacao } = passada;
  const alerta = comparacao?.alerta === true;
  return h('li', { class: 'passada' + (alerta ? ' alerta' : '') },
    foto(cachorro),
    h('div', { class: 'passada-info' },
      h('strong', {}, cachorro.nome),
      h('span', { class: 'neutro' }, formatarQuandoCurto(passada.quando))),
    h('div', { class: 'passada-peso' },
      h('strong', {}, typeof passada.peso_kg === 'number' ? passada.peso_kg.toFixed(1) + ' kg' : 'sem peso'),
      alerta ? h('span', { class: 'selo perigo' }, '⚠ ' + textoVariacao(comparacao)) : ''),
    h('span', { class: 'passada-racao ' + (passada.racao ? 'ok' : 'neutro') }, passada.racao ? '🍖 Comeu' : 'Só passou'),
  );
}

function painelHistorico(estado) {
  const passadas = listarPassadas(estado);
  const hoje = passadas.filter(p => mesmoDia(p.quando, new Date()));
  const racoesHoje = hoje.filter(p => p.racao).length;
  return h('section', { class: 'painel historico' },
    h('div', { class: 'painel-titulo' },
      h('h2', {}, 'Últimas passadas'),
      h('span', { class: 'neutro' }, `Hoje: ${hoje.length} passada${hoje.length === 1 ? '' : 's'}, ${racoesHoje} ração${racoesHoje === 1 ? '' : 'ões'}`)),
    passadas.length
      ? h('ul', { class: 'lista-passadas' }, passadas.slice(0, MAX_PASSADAS).map(linhaPassada))
      : h('p', { class: 'vazio' }, 'Nenhuma passada ainda. Quando um cachorro encostar a tag, ela aparece aqui.'));
}

export function telaInicio(estado, acoes) {
  const cards = estado.cachorros.map(c => cardCachorro(estado, c));
  return h('section', { class: 'inicio' },
    h('section', { class: 'painel cachorros' },
      h('div', { class: 'painel-titulo' },
        h('h2', {}, 'Cachorros'),
        h('a', { class: 'botao', href: '#/cadastro' }, '＋ Cadastrar cachorro')),
      h('div', { class: 'grade' },
        cards.length ? cards : h('p', { class: 'vazio' }, 'Nenhum cachorro cadastrado ainda. Toque em "Cadastrar cachorro".'))),
    painelHistorico(estado),
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
  const avaliacao = avaliarPeso(visitas);
  const linhas = anotarVisitas(visitas).reverse().map(v => h('tr', { class: v.comparacao?.alerta ? 'alerta' : '' },
    h('td', {}, formatarQuando(v.quando)),
    h('td', {}, v.peso_kg !== null ? v.peso_kg.toFixed(1) + ' kg' : 'sem peso'),
    h('td', {}, v.comparacao ? h('span', { class: v.comparacao.alerta ? 'perigo-texto' : 'neutro' }, formatarVariacao(v.comparacao)) : '—'),
    h('td', {}, v.racao ? 'Comeu' : 'Só passou'),
  ));

  return h('section', { class: 'detalhe' },
    h('a', { href: '#/', class: 'botao claro' }, '← Voltar'),
    h('div', { class: 'detalhe-topo' },
      foto(cachorro),
      h('div', {},
        h('h2', {}, cachorro.nome),
        avaliacao.alerta
          ? h('span', { class: 'selo perigo' }, '⚠ ' + textoVariacao(avaliacao))
          : h('span', { class: 'selo ok' }, avaliacao.motivo === 'sem_anteriores' ? 'Primeira pesagem é só referência' : 'Peso estável'))),
    h('div', { class: 'detalhe-colunas' },
      h('div', {},
        h('h3', {}, 'Peso'),
        graficoPeso(pesos)),
      h('div', {},
        h('h3', {}, 'Visitas'),
        linhas.length
          ? h('table', { class: 'visitas' },
              h('thead', {}, h('tr', {}, h('th', {}, 'Quando'), h('th', {}, 'Peso'), h('th', {}, 'Variação'), h('th', {}, 'Ração'))),
              h('tbody', {}, linhas))
          : h('p', { class: 'vazio' }, 'Nenhuma visita registrada ainda.'))),
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

export function telaAjustes(estado, acoes) {
  const entradaBackup = h('input', { type: 'file', accept: 'application/json' });

  return h('section', { class: 'ajustes' },
    h('a', { href: '#/', class: 'botao claro' }, '← Voltar'),
    h('h2', {}, 'Ajustes'),

    h('h3', {}, 'Totem'),
    estado.conexao === 'conectado'
      ? h('p', { class: 'ok' }, '✔ Conectado ao totem')
      : h('p', {}, h('button', { onclick: acoes.conectar }, 'Conectar ao totem')),

    h('h3', {}, 'Alerta de peso'),
    h('p', { class: 'neutro' },
      'Cada pesagem é comparada com a média de todas as pesagens anteriores do mesmo cachorro. ' +
      'Com 20% ou mais de diferença, para mais ou para menos, o app avisa. Vale a partir da segunda pesagem.'),

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
    estado.armazenamento.protegido === true
      ? h('p', { class: 'ok' }, '✔ Armazenamento protegido: o Chrome não apaga o histórico sozinho.')
      : h('p', { class: 'aviso-texto' },
          '⚠ O Chrome pode apagar o histórico se faltar espaço ou se alguém limpar os dados do site. ' +
          'Instale o app (menu ⋮ → Instalar app) e exporte um backup de vez em quando.'),
    h('p', { class: 'neutro' }, estado.armazenamento.ultimoBackup
      ? 'Último backup: ' + formatarQuando(estado.armazenamento.ultimoBackup)
      : 'Nenhum backup exportado ainda.'),
    h('p', {}, h('button', { onclick: acoes.exportar }, 'Exportar backup')),
    h('label', {}, 'Importar backup (substitui tudo)'), entradaBackup,
    h('p', {}, h('button', { onclick: () => { if (entradaBackup.files[0]) acoes.importar(entradaBackup.files[0]); } }, 'Importar')),
  );
}
