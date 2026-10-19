import { decidirSom, alertasAtivos } from './faixas.js';

const REPETIR_ALERTA_MS = 10000;      // alerta repete a cada 10 s enquanto durar
const ESPACO_ENTRE_ALERTAS_MS = 700;  // dois alertas ao mesmo tempo tocam um depois do outro
const SONS_ALERTA = {                 // pista molhada: sobe; farol queimado: desce
  chuva: [660, 880],
  farol_e: [880, 440],
  farol_d: [880, 440],
};

export function criarSom() {
  let contexto = null;
  let mudo = false;
  let oscilador = null;               // tom continuo (perigo)
  let ganho = null;
  let ultimoBipe = 0;
  const ultimoAlerta = {};            // id do alerta -> quando tocou pela ultima vez

  // O Chrome so libera som depois de um toque do usuario: chamar dentro do clique em "Conectar".
  function liberar() {
    if (!contexto) contexto = new (window.AudioContext || window.webkitAudioContext)();
    if (contexto.state === 'suspended') contexto.resume();
  }

  function tom(frequencia, duracaoMs, atrasoMs = 0) {
    const inicio = contexto.currentTime + atrasoMs / 1000;
    const osc = contexto.createOscillator();
    const volume = contexto.createGain();
    osc.frequency.value = frequencia;
    volume.gain.setValueAtTime(0.25, inicio);
    volume.gain.exponentialRampToValueAtTime(0.0001, inicio + duracaoMs / 1000);
    osc.connect(volume).connect(contexto.destination);
    osc.start(inicio);
    osc.stop(inicio + duracaoMs / 1000 + 0.02);
  }

  function iniciarContinuo() {
    if (oscilador) return;
    oscilador = contexto.createOscillator();
    ganho = contexto.createGain();
    oscilador.frequency.value = 1000;
    ganho.gain.value = 0.2;
    oscilador.connect(ganho).connect(contexto.destination);
    oscilador.start();
  }

  function pararContinuo() {
    if (!oscilador) return;
    oscilador.stop();
    oscilador.disconnect();
    ganho.disconnect();
    oscilador = null;
    ganho = null;
  }

  function atualizar(leitura) {
    if (!contexto || mudo || !leitura) {
      pararContinuo();
      return;
    }
    const agora = performance.now();
    const som = decidirSom(leitura);

    if (som.tipo === 'continuo') iniciarContinuo();
    else pararContinuo();

    if (som.tipo === 'bipe' && agora - ultimoBipe >= som.intervaloMs) {
      tom(880, 80);
      ultimoBipe = agora;
    }

    // Alertas: tocam ao aparecer e depois a cada 10 s. Nao tocam por cima do tom continuo.
    const ativos = alertasAtivos(leitura);
    for (const id of Object.keys(ultimoAlerta)) {
      if (!ativos.some(a => a.id === id)) delete ultimoAlerta[id];
    }
    if (som.tipo === 'continuo') return;
    let atraso = 0;
    for (const alerta of ativos) {
      const vencido = !(alerta.id in ultimoAlerta) || agora - ultimoAlerta[alerta.id] >= REPETIR_ALERTA_MS;
      if (!vencido) continue;
      SONS_ALERTA[alerta.id].forEach((frequencia, i) => tom(frequencia, 250, atraso + i * 280));
      atraso += ESPACO_ENTRE_ALERTAS_MS;
      ultimoAlerta[alerta.id] = agora;
    }
  }

  function alternarMudo() {
    mudo = !mudo;
    if (mudo) pararContinuo();
    return mudo;
  }

  return { liberar, atualizar, alternarMudo };
}
