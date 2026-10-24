import { lerLinha, comando, uidValido, nomeParaLcd, backupValido } from './protocolo.js';
import { avaliarPeso, formatarVariacao } from './pesos.js';
import * as banco from './banco.js';
import { criarBle } from './ble.js';
import { ArduinoFalso } from './arduino-falso.js';
import { montarPainelSimulador } from './simulador.js';
import { reduzirFoto } from './foto.js';
import { h } from './dom.js';
import { telaInicio, telaDetalhe, telaCadastro, telaAjustes } from './telas.js';

const MAX_CACHORROS = 10;           // o Arduino guarda no maximo 10 tags
const DURACAO_CADASTRO_MS = 30000;  // igual ao firmware
const ESPERA_RESPOSTA_MS = 1500;    // quanto o app espera o Arduino responder a um comando
const modoSimulador = new URLSearchParams(location.search).has('sim');

function novoCadastro() {
  // fase: 'parado' | 'aguardando' (esperando o Arduino) | 'ouvindo' | 'esgotado' | 'lido'
  return { fase: 'parado', fimEm: 0, uidLido: null, mensagem: '' };
}

export const estado = {
  conexao: 'desconectado',   // 'conectando' | 'conectado' | 'desconectado'
  bomba: 'desligada',
  motor: 'desligado',
  armazenamento: { protegido: null, ultimoBackup: null },   // protegido: o Chrome nao apaga os dados sozinho
  cachorros: [],
  visitas: {},               // uid -> lista de visitas em ordem cronologica
  sensores: { leitor: false, balanca: false, vistoEm: 0 },   // o totem avisa a cada 5 s (evento "status")
  cadastro: novoCadastro(),
};

let ble = null;
let falso = null;
let travaTela = null;

const conteudo = document.getElementById('conteudo');
const alertasEl = document.getElementById('alertas');

// ---------- envio para o Arduino ----------
async function enviar(texto) {
  if (falso) { falso.receberComando(texto); return true; }
  return ble ? ble.enviar(texto) : false;
}

// O Arduino responde a "permitir" e "remover" com a lista de tags ("cadastros").
// Para nao entupir o buffer dele (so 63 bytes), o app manda UM comando por vez
// e espera essa resposta antes de mandar o proximo.
let acordarEspera = null;   // funcao que termina a espera atual (null = ninguem esperando)

function enviarEEsperarCadastros(texto) {
  return new Promise((pronto) => {
    function terminar() {
      clearTimeout(temporizador);
      if (acordarEspera === terminar) acordarEspera = null;
      pronto();
    }
    // Registra a espera ANTES de enviar: o simulador responde no meio do enviar().
    const temporizador = setTimeout(terminar, ESPERA_RESPOSTA_MS);
    acordarEspera = terminar;
    // Se nao deu para enviar (sem conexao) ou deu erro, nao adianta esperar a resposta.
    enviar(texto).then((enviou) => { if (!enviou) terminar(); }, terminar);
  });
}

// Pede a lista de tags ao Arduino. A resposta a ESTE pedido (e so ela) dispara a reconciliacao.
let esperandoListar = false;

function pedirListar() {
  esperandoListar = true;
  enviar(comando.listar());
}

// Tags do Arduino que a pessoa decidiu manter, mesmo o tablet nao conhecendo (vale ate fechar o app).
const tagsMantidas = new Set();

// Mantem a tela do tablet acesa (o totem registra visitas sozinho; se a tela apagar, o Bluetooth cai).
async function manterTelaLigada() {
  try {
    travaTela = await navigator.wakeLock?.request('screen');
  } catch {
    travaTela = null;   // sem suporte ou negado: segue sem a trava
  }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') manterTelaLigada();
});

// ---------- chegada de linhas ----------
function receberLinha(texto) {
  const ev = lerLinha(texto);
  if (!ev || typeof ev.evento !== 'string') return;

  if (ev.evento === 'visita') registrarVisita(ev);
  else if (ev.evento === 'agua') {
    estado.bomba = ev.bomba;
  } else if (ev.evento === 'racao') {
    estado.motor = ev.motor;
  } else if (ev.evento === 'status') {
    estado.sensores = { leitor: ev.leitor === true, balanca: ev.balanca === true, vistoEm: Date.now() };
  } else if (ev.evento === 'modo_cadastro') {
    if (ev.ativo) estado.cadastro = { ...novoCadastro(), fase: 'ouvindo', fimEm: Date.now() + DURACAO_CADASTRO_MS };
    else if (estado.cadastro.fase === 'ouvindo') estado.cadastro.fase = 'esgotado';
  } else if (ev.evento === 'tag_lida') {
    if (uidValido(ev.uid)) {
      estado.cadastro.fase = 'lido';
      estado.cadastro.uidLido = ev.uid;
    } else {
      estado.cadastro.fase = 'esgotado';
      estado.cadastro.mensagem = 'Tag com formato não suportado.';
    }
  } else if (ev.evento === 'ligado') {
    // O Arduino reiniciou: se estava no modo cadastro, ele nao esta mais.
    if (['aguardando', 'ouvindo'].includes(estado.cadastro.fase)) {
      estado.cadastro.fase = 'esgotado';
      estado.cadastro.mensagem = 'O totem reiniciou. Tente de novo.';
      pedirListar();
    }
  } else if (ev.evento === 'cadastros') {
    if (acordarEspera) acordarEspera();   // alguem esperava esta resposta para mandar o proximo comando
    if (esperandoListar) {                // so reconcilia a resposta ao "listar" que o app pediu
      esperandoListar = false;
      reconciliar(ev.uids ?? []);
    }
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
    const soNoArduino = uidsDoArduino.filter(uid => !conhecidos.has(uid) && !tagsMantidas.has(uid));
    const soNoApp = estado.cachorros.filter(c => !noArduino.has(c.uid));

    // Tablet novo (sem cachorros) ligado a um totem que ja tem tags: nao apaga sem perguntar.
    if (soNoArduino.length > 0 && estado.cachorros.length === 0) {
      const apagar = confirm(`O Arduino tem ${soNoArduino.length} tag(s) que este tablet não conhece. Apagar do Arduino?`);
      if (!apagar) {
        for (const uid of soNoArduino) tagsMantidas.add(uid);   // nao pergunta de novo nesta sessao
        return;
      }
    }
    for (const uid of soNoArduino) await enviarEEsperarCadastros(comando.remover(uid));
    for (const c of soNoApp) await enviarEEsperarCadastros(comando.permitir(c.uid, c.nome));
  } finally {
    reconciliando = false;
  }
}

// ---------- ações chamadas pelas telas ----------
export const acoes = {
  async conectar() {
    manterTelaLigada();   // o toque em "Conectar" e o gesto que o navegador exige
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
    if (!uid) return;
    if (!nomeParaLcd(nome)) {   // so simbolos: o LCD do totem ficaria sem nome
      estado.cadastro.mensagem = 'Use pelo menos uma letra ou número no nome.';
      render();
      return;
    }
    const cachorro = {
      uid,
      nome: nome.trim(),
      foto: arquivoFoto ? await reduzirFoto(arquivoFoto) : null,
      criadoEm: new Date().toISOString(),
    };
    await banco.salvarCachorro(cachorro);
    estado.cachorros = await banco.listarCachorros();
    estado.visitas[uid] = [];
    await enviarEEsperarCadastros(comando.permitir(uid, cachorro.nome));
    estado.cadastro = novoCadastro();
    location.hash = '#/';
  },

  async removerCachorro(uid) {
    await banco.removerCachorro(uid);
    estado.cachorros = await banco.listarCachorros();
    delete estado.visitas[uid];
    await enviarEEsperarCadastros(comando.remover(uid));
    render();
  },

  async exportar() {
    const dados = await banco.exportarTudo();
    const link = h('a', {
      href: URL.createObjectURL(new Blob([JSON.stringify(dados)], { type: 'application/json' })),
      download: `amicao-backup-${new Date().toISOString().slice(0, 10)}.json`,
    });
    link.click();
    estado.armazenamento.ultimoBackup = new Date().toISOString();
    try { localStorage.setItem('amicao-ultimo-backup', estado.armazenamento.ultimoBackup); } catch { /* sem localStorage: segue */ }
    render();
  },

  async importar(arquivo) {
    let dados;
    try {
      dados = JSON.parse(await arquivo.text());
    } catch {
      alert('Esse arquivo não é um backup válido.');
      return;
    }
    if (!backupValido(dados)) {
      alert('Esse backup tem dados inválidos.');
      return;
    }
    if (!confirm('Importar vai SUBSTITUIR todos os cachorros e visitas deste tablet. Continuar?')) return;
    try {
      await banco.importarTudo(dados);
    } catch {
      alert('Não consegui importar o backup. Os dados do tablet não foram alterados.');
      return;
    }
    tagsMantidas.clear();   // o backup e a nova verdade: as escolhas anteriores nao valem mais
    await carregarDados();
    pedirListar();
    render();
  },
};

// ---------- desenho ----------
const SENSORES_VALIDADE_MS = 15000;   // sem "status" por mais que isso, o sensor aparece como falha

// Pinta o icone de verde (funcionando) ou vermelho (com problema).
function marcarSensor(id, funcionando, nome, situacao) {
  const el = document.getElementById(id);
  el.classList.toggle('ok', funcionando);
  el.classList.toggle('falha', !funcionando);
  const texto = `${nome}: ${situacao}`;
  el.title = texto;
  el.setAttribute('aria-label', texto);
}

function marcarAtuador(id, ativo, nome) {
  const el = document.getElementById(id);
  el.classList.toggle('ativo', ativo);
  el.classList.toggle('parado', !ativo);
  const texto = `${nome}: ${ativo ? 'ligado agora' : 'parado'} (sem sensor de retorno)`;
  el.title = texto;
  el.setAttribute('aria-label', texto);
}

function atualizarTopo() {
  const conectado = estado.conexao === 'conectado';
  const recente = Date.now() - estado.sensores.vistoEm < SENSORES_VALIDADE_MS;

  const textoBle = { conectado: 'conectado', conectando: 'conectando…', desconectado: 'desconectado' }[estado.conexao];
  marcarSensor('sensor-ble', conectado, 'Bluetooth', textoBle);
  const leitorOk = conectado && recente && estado.sensores.leitor;
  const balancaOk = conectado && recente && estado.sensores.balanca;
  marcarSensor('sensor-leitor', leitorOk, 'Leitor de tags', leitorOk ? 'funcionando' : 'com problema');
  marcarSensor('sensor-balanca', balancaOk, 'Balança', balancaOk ? 'funcionando' : 'com problema');

  // Motor e bomba nao tem sensor de retorno: o icone so mostra se o totem MANDOU ligar (azul) ou nao (cinza).
  marcarAtuador('sensor-motor', conectado && estado.motor === 'ligado', 'Motor da ração');
  marcarAtuador('sensor-bomba', conectado && estado.bomba === 'ligada', "Bomba d'água");

  document.getElementById('btn-conectar').hidden = modoSimulador || conectado;
}

function atualizarAlertas() {
  const faixas = [];
  if (estado.conexao !== 'conectado') {
    faixas.push(h('div', { class: 'faixa aviso' }, 'Desconectado: visitas não estão sendo registradas.'));
  }
  for (const cachorro of estado.cachorros) {
    const r = avaliarPeso(estado.visitas[cachorro.uid] ?? []);
    if (r.alerta) {
      const sentido = r.direcao === 'mais' ? 'mais pesado' : 'mais leve';
      faixas.push(h('div', { class: 'faixa perigo' },
        `⚠ ${cachorro.nome} está ${formatarVariacao(r).replace(/^[+−]/, '')} ${sentido} que a média ` +
        `(agora ${r.ultimoKg.toFixed(1)} kg, média ${r.mediaAnterior.toFixed(1)} kg).`));
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
  estado.cachorros = await banco.listarCachorros();
  estado.visitas = {};
  for (const c of estado.cachorros) estado.visitas[c.uid] = await banco.listarVisitas(c.uid);
}

function aoMudarEstadoBle(novo) {
  estado.conexao = novo;
  if (novo !== 'conectado') {
    estado.sensores = { leitor: false, balanca: false, vistoEm: 0 };
    estado.motor = 'desligado';
    estado.bomba = 'desligada';
  }
  if (novo === 'conectado') pedirListar();
  render();
}

// Pede ao Chrome para NAO apagar os dados do app sozinho (o historico fica so no tablet).
async function protegerArmazenamento() {
  try {
    if (navigator.storage?.persisted && await navigator.storage.persisted()) estado.armazenamento.protegido = true;
    else if (navigator.storage?.persist) estado.armazenamento.protegido = await navigator.storage.persist();
  } catch {
    estado.armazenamento.protegido = null;
  }
  try { estado.armazenamento.ultimoBackup = localStorage.getItem('amicao-ultimo-backup'); } catch { /* sem localStorage */ }
}

async function iniciar() {
  await carregarDados();
  await protegerArmazenamento();

  if (modoSimulador) {
    falso = new ArduinoFalso({ aoLinha: receberLinha, duracaoProcessoMs: 8000, animarProcesso: true });
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
    falso.iniciarStatusPeriodico();
    pedirListar();
  }
  setInterval(atualizarTopo, 3000);   // para o icone ficar vermelho se o totem parar de avisar
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js');
  }
}

iniciar();
