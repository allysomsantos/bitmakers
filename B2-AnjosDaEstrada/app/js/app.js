import { lerLinha, lerLeitura } from './protocolo.js';
import { alertasAtivos } from './faixas.js';
import { criarBle } from './ble.js';
import { CaminhaoFalso } from './caminhao-falso.js';
import { montarPainelSimulador } from './simulador.js';
import { montarTela } from './tela.js';
import { h } from './dom.js';

const SEM_SINAL_MS = 3000;   // sem linha por mais de 3 s = sem comunicacao
const modoSimulador = new URLSearchParams(location.search).has('sim');

let ultimaLeitura = null;
let ultimaChegada = 0;           // 0 = nunca chegou nada
let chaveBanners = '';

const tela = montarTela(document.getElementById('painel'));
const bannersEl = document.getElementById('banners');
const botaoConectar = document.getElementById('btn-conectar');

function receberLinha(texto) {
  const leitura = lerLeitura(lerLinha(texto));
  if (!leitura) return;
  ultimaLeitura = leitura;
  ultimaChegada = performance.now();
}

function desenharBanners(lista) {
  const chave = JSON.stringify(lista);
  if (chave === chaveBanners) return;   // so redesenha se mudou (evita piscar)
  chaveBanners = chave;
  bannersEl.replaceChildren(...lista.map(item => h('div', { class: 'banner ' + item.tipo }, item.texto)));
}

// Roda varias vezes por segundo: decide o que mostrar com a ultima leitura.
function ciclo() {
  const semSinal = ultimaChegada === 0 || performance.now() - ultimaChegada > SEM_SINAL_MS;
  const leitura = semSinal ? null : ultimaLeitura;
  tela.atualizar(leitura);

  const banners = [];
  if (leitura) {
    for (const alerta of alertasAtivos(leitura)) banners.push({ tipo: 'perigo', texto: '⚠ ' + alerta.texto });
  } else if (ultimaChegada === 0) {
    banners.push({ tipo: 'aviso', texto: 'Toque em Conectar para ligar ao caminhão.' });
  } else {
    banners.push({ tipo: 'aviso', texto: 'Sem comunicação com o caminhão' });
  }
  desenharBanners(banners);
}

let falso = null;
let ble = null;

botaoConectar.addEventListener('click', async () => {
  if (modoSimulador) {
    falso.iniciar();
    botaoConectar.hidden = true;
    return;
  }
  try {
    await ble.conectar();
  } catch (erro) {
    if (erro.name !== 'NotFoundError') alert('Não consegui conectar: ' + erro.message);
  }
});

if (modoSimulador) {
  falso = new CaminhaoFalso({ aoLinha: receberLinha });
  montarPainelSimulador(document.getElementById('painel-simulador'), falso);
} else {
  ble = criarBle({
    aoLinha: receberLinha,
    aoEstado: (novo) => {
      botaoConectar.hidden = novo === 'conectado';
    },
  });
}

setInterval(ciclo, 50);
ciclo();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js');
}
