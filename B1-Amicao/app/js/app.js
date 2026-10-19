import { lerLinha, comando } from './protocolo.js';
import { PADRAO, avaliarPeso } from './pesos.js';
import * as banco from './banco.js';
import { criarBle } from './ble.js';
import { ArduinoFalso } from './arduino-falso.js';
import { montarPainelSimulador } from './simulador.js';
import { reduzirFoto } from './foto.js';
import { h } from './dom.js';
import { telaInicio, telaDetalhe, telaCadastro, telaAjustes } from './telas.js';

const MAX_CACHORROS = 10;           // o Arduino guarda no maximo 10 tags
const DURACAO_CADASTRO_MS = 30000;  // igual ao firmware
const modoSimulador = new URLSearchParams(location.search).has('sim');

function novoCadastro() {
  // fase: 'parado' | 'aguardando' (esperando o Arduino) | 'ouvindo' | 'esgotado' | 'lido'
  return { fase: 'parado', fimEm: 0, uidLido: null, mensagem: '' };
}

export const estado = {
  conexao: 'desconectado',   // 'conectando' | 'conectado' | 'desconectado'
  bomba: 'desligada',
  reservatorioVazio: false,
  cachorros: [],
  visitas: {},               // uid -> lista de visitas em ordem cronologica
  config: { ...PADRAO },
  cadastro: novoCadastro(),
};

let ble = null;
let falso = null;

const conteudo = document.getElementById('conteudo');
const alertasEl = document.getElementById('alertas');

// ---------- envio para o Arduino ----------
async function enviar(texto) {
  if (falso) { falso.receberComando(texto); return true; }
  return ble ? ble.enviar(texto) : false;
}

// ---------- chegada de linhas ----------
function receberLinha(texto) {
  const ev = lerLinha(texto);
  if (!ev || typeof ev.evento !== 'string') return;

  if (ev.evento === 'visita') registrarVisita(ev);
  else if (ev.evento === 'agua') {
    estado.bomba = ev.bomba;
    if (ev.bomba === 'ligada') estado.reservatorioVazio = false;
  } else if (ev.evento === 'alerta' && ev.tipo === 'reservatorio_vazio') {
    estado.reservatorioVazio = true;
  } else if (ev.evento === 'modo_cadastro') {
    if (ev.ativo) estado.cadastro = { ...novoCadastro(), fase: 'ouvindo', fimEm: Date.now() + DURACAO_CADASTRO_MS };
    else if (estado.cadastro.fase === 'ouvindo') estado.cadastro.fase = 'esgotado';
  } else if (ev.evento === 'tag_lida') {
    estado.cadastro.fase = 'lido';
    estado.cadastro.uidLido = ev.uid;
  } else if (ev.evento === 'cadastros') {
    reconciliar(ev.uids ?? []);
  }
  render();
}

async function registrarVisita(ev) {
  if (!estado.cachorros.some(c => c.uid === ev.uid)) return;   // tag que o app nao conhece: ignora
  const visita = {
    uid: ev.uid,
    quando: new Date().toISOString(),   // o Arduino nao tem relogio: o app carimba
    peso_kg: typeof ev.peso_kg === 'number' ? ev.peso_kg : null,
    racao: ev.racao === true,
  };
  await banco.adicionarVisita(visita);
  (estado.visitas[ev.uid] ||= []).push(visita);
  render();
}

// O app e a fonte da verdade: faz a lista do Arduino ficar igual a do app.
let reconciliando = false;   // impede duas reconciliacoes ao mesmo tempo (cada remocao faz o Arduino responder de novo)

async function reconciliar(uidsDoArduino) {
  if (reconciliando) return;
  reconciliando = true;
  try {
    const conhecidos = new Set(estado.cachorros.map(c => c.uid));
    const noArduino = new Set(uidsDoArduino);
    const soNoArduino = uidsDoArduino.filter(uid => !conhecidos.has(uid));
    const soNoApp = estado.cachorros.filter(c => !noArduino.has(c.uid));

    // Tablet novo (sem cachorros) ligado a um totem que ja tem tags: nao apaga sem perguntar.
    if (soNoArduino.length > 0 && estado.cachorros.length === 0) {
      const apagar = confirm(`O Arduino tem ${soNoArduino.length} tag(s) que este tablet não conhece. Apagar do Arduino?`);
      if (!apagar) return;
    }
    for (const uid of soNoArduino) await enviar(comando.remover(uid));
    for (const c of soNoApp) await enviar(comando.permitir(c.uid, c.nome));
  } finally {
    reconciliando = false;
  }
}

// ---------- ações chamadas pelas telas ----------
export const acoes = {
  async conectar() {
    if (modoSimulador) return;
    try {
      await ble.conectar();
    } catch (erro) {
      if (erro.name !== 'NotFoundError') alert('Não consegui conectar: ' + erro.message);
    }
  },

  iniciarCadastro() {
    estado.cadastro = novoCadastro();
    if (estado.conexao !== 'conectado') {
      estado.cadastro.mensagem = 'Conecte o totem primeiro (botão Conectar).';
    } else if (estado.cachorros.length >= MAX_CACHORROS) {
      estado.cadastro.mensagem = `O totem guarda no máximo ${MAX_CACHORROS} cachorros. Remova um nos Ajustes.`;
    } else {
      estado.cadastro.fase = 'aguardando';
      enviar(comando.cadastrar());
    }
    render();
  },

  cancelarCadastro() {
    if (['aguardando', 'ouvindo'].includes(estado.cadastro.fase)) enviar(comando.cancelar());
    estado.cadastro = novoCadastro();
  },

  async salvarCachorro(nome, arquivoFoto) {
    const uid = estado.cadastro.uidLido;
    if (!uid || !nome.trim()) return;
    const cachorro = {
      uid,
      nome: nome.trim(),
      foto: arquivoFoto ? await reduzirFoto(arquivoFoto) : null,
      criadoEm: new Date().toISOString(),
    };
    await banco.salvarCachorro(cachorro);
    estado.cachorros = await banco.listarCachorros();
    estado.visitas[uid] = [];
    await enviar(comando.permitir(uid, cachorro.nome));
    estado.cadastro = novoCadastro();
    location.hash = '#/';
  },

  async removerCachorro(uid) {
    await banco.removerCachorro(uid);
    estado.cachorros = await banco.listarCachorros();
    delete estado.visitas[uid];
    await enviar(comando.remover(uid));
    render();
  },

  async salvarConfig(valores) {
    estado.config = { ...PADRAO, ...valores };
    await banco.salvarConfig(estado.config);
    render();
  },

  async exportar() {
    const dados = await banco.exportarTudo();
    const link = h('a', {
      href: URL.createObjectURL(new Blob([JSON.stringify(dados)], { type: 'application/json' })),
      download: `amicao-backup-${new Date().toISOString().slice(0, 10)}.json`,
    });
    link.click();
  },

  async importar(arquivo) {
    let dados;
    try {
      dados = JSON.parse(await arquivo.text());
    } catch {
      alert('Esse arquivo não é um backup válido.');
      return;
    }
    if (!Array.isArray(dados.cachorros) || !Array.isArray(dados.visitas)) {
      alert('Esse arquivo não é um backup do Amicão.');
      return;
    }
    if (!confirm('Importar vai SUBSTITUIR todos os cachorros e visitas deste tablet. Continuar?')) return;
    await banco.importarTudo(dados);
    await carregarDados();
    await enviar(comando.listar());
    render();
  },
};

// ---------- desenho ----------
function atualizarTopo() {
  const selo = document.getElementById('status-conexao');
  selo.textContent = { conectado: 'Conectado', conectando: 'Conectando…', desconectado: 'Desconectado' }[estado.conexao];
  selo.className = 'selo ' + (estado.conexao === 'conectado' ? 'ok' : 'perigo');

  const bomba = document.getElementById('status-bomba');
  bomba.hidden = estado.conexao !== 'conectado';
  bomba.textContent = estado.bomba === 'ligada' ? '💧 Bomba ligada' : '💧 Bomba desligada';
  bomba.className = 'selo ' + (estado.bomba === 'ligada' ? 'aviso' : 'neutro');

  document.getElementById('btn-conectar').hidden = modoSimulador || estado.conexao === 'conectado';
}

function atualizarAlertas() {
  const faixas = [];
  if (estado.conexao !== 'conectado') {
    faixas.push(h('div', { class: 'faixa aviso' }, 'Desconectado: visitas não estão sendo registradas.'));
  }
  if (estado.reservatorioVazio) {
    faixas.push(h('div', { class: 'faixa perigo' },
      '⚠ Reservatório de água vazio. ',
      h('button', { onclick: () => { estado.reservatorioVazio = false; render(); } }, 'Entendi')));
  }
  for (const cachorro of estado.cachorros) {
    const r = avaliarPeso(estado.visitas[cachorro.uid] ?? [], estado.config);
    if (r.alerta) {
      faixas.push(h('div', { class: 'faixa perigo' },
        `⚠ ${cachorro.nome} perdeu peso: a média das últimas visitas caiu ${r.quedaPercentual.toFixed(0)}%.`));
    }
  }
  alertasEl.replaceChildren(...faixas);
}

function rotaAtual() {
  const [, tipo, arg] = location.hash.split('/');
  return { tipo: tipo || 'inicio', arg: arg ? decodeURIComponent(arg) : null };
}

let rotaAnterior = 'inicio';
let chaveCadastro = '';

export function render() {
  atualizarTopo();
  atualizarAlertas();
  const { tipo, arg } = rotaAtual();

  // Na tela de cadastro, so redesenha quando algo relevante muda (senao apaga o que a pessoa digitou).
  if (tipo === 'cadastro') {
    const chave = `${estado.cadastro.fase}|${estado.cadastro.uidLido}|${estado.cadastro.mensagem}|${estado.cachorros.length}`;
    if (rotaAnterior === 'cadastro' && chave === chaveCadastro) return;
    chaveCadastro = chave;
  }

  let tela;
  if (tipo === 'cachorro') tela = telaDetalhe(estado, arg, acoes);
  else if (tipo === 'cadastro') tela = telaCadastro(estado, acoes);
  else if (tipo === 'ajustes') tela = telaAjustes(estado, acoes);
  else tela = telaInicio(estado, acoes);
  conteudo.replaceChildren(tela);
  rotaAnterior = tipo;
}

function aoMudarRota() {
  const { tipo } = rotaAtual();
  if (tipo === 'cadastro' && rotaAnterior !== 'cadastro') acoes.iniciarCadastro();
  if (tipo !== 'cadastro' && rotaAnterior === 'cadastro') acoes.cancelarCadastro();
  render();
}

// Contagem regressiva do cadastro: mexe so no numero, sem redesenhar a tela.
setInterval(() => {
  const el = document.getElementById('contagem');
  if (!el || estado.cadastro.fase !== 'ouvindo') return;
  el.textContent = Math.max(0, Math.ceil((estado.cadastro.fimEm - Date.now()) / 1000));
}, 250);

// ---------- inicio ----------
async function carregarDados() {
  estado.config = await banco.lerConfig();
  estado.cachorros = await banco.listarCachorros();
  estado.visitas = {};
  for (const c of estado.cachorros) estado.visitas[c.uid] = await banco.listarVisitas(c.uid);
}

function aoMudarEstadoBle(novo) {
  estado.conexao = novo;
  if (novo === 'conectado') enviar(comando.listar());
  render();
}

async function iniciar() {
  await carregarDados();

  if (modoSimulador) {
    falso = new ArduinoFalso({ aoLinha: receberLinha });
    montarPainelSimulador(document.getElementById('painel-simulador'), falso);
    estado.conexao = 'conectado';
  } else {
    ble = criarBle({ aoLinha: receberLinha, aoEstado: aoMudarEstadoBle });
  }

  window.addEventListener('hashchange', aoMudarRota);
  document.getElementById('btn-conectar').addEventListener('click', acoes.conectar);
  aoMudarRota();

  if (modoSimulador) {
    falso.ligar();
    enviar(comando.listar());
  }
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js');
  }
}

iniciar();
