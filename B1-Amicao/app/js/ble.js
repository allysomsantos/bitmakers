import { LinhaBuffer, quebrarEmBlocos } from './protocolo.js';

// HM-10: servico 0xFFE0, caracteristica 0xFFE1 (uma so serve para ler e escrever).
const SERVICO = 0xFFE0;
const CARACTERISTICA = 0xFFE1;
const ESPERA_ENTRE_BLOCOS_MS = 20;
const ESPERA_RECONEXAO_MS = 3000;

const esperar = (ms) => new Promise(ok => setTimeout(ok, ms));

export function criarBle({ aoLinha, aoEstado }) {
  let dispositivo = null;
  let caracteristica = null;
  let buffer = new LinhaBuffer();
  let querConectado = false;
  let reconectando = false;
  let fila = Promise.resolve();
  const decodificador = new TextDecoder();

  function aoChegarDados(evento) {
    const texto = decodificador.decode(evento.target.value);
    for (const linha of buffer.adicionar(texto)) aoLinha(linha);
  }

  async function ligar() {
    aoEstado('conectando');
    try {
      const servidor = await dispositivo.gatt.connect();
      const servico = await servidor.getPrimaryService(SERVICO);
      const nova = await servico.getCharacteristic(CARACTERISTICA);
      await nova.startNotifications();
      nova.addEventListener('characteristicvaluechanged', aoChegarDados);
      // So guarda a caracteristica depois que tudo deu certo (enviar() usa isso para saber se ha link).
      caracteristica = nova;
      buffer = new LinhaBuffer();
    } catch (erro) {
      caracteristica = null;
      aoEstado('desconectado');
      throw erro;   // quem chamou (conectar ou tentarReconectar) continua sabendo do erro
    }
    aoEstado('conectado');
  }

  async function tentarReconectar() {
    if (reconectando) return;
    reconectando = true;
    while (querConectado && !caracteristica) {
      await esperar(ESPERA_RECONEXAO_MS);
      try {
        await ligar();
      } catch {
        aoEstado('desconectado');
      }
    }
    reconectando = false;
  }

  function aoCair() {
    caracteristica = null;
    aoEstado('desconectado');
    if (querConectado) tentarReconectar();
  }

  // Precisa ser chamado por um toque do usuario (exigencia do Chrome).
  async function conectar() {
    querConectado = true;
    dispositivo = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [SERVICO],
    });
    dispositivo.addEventListener('gattserverdisconnected', aoCair);
    await ligar();
  }

  // Quebra em blocos de 20 bytes, que e o que o HM-10 aceita por vez.
  async function escrever(texto) {
    if (!caracteristica) return false;
    for (const bloco of quebrarEmBlocos(texto)) {
      await caracteristica.writeValueWithoutResponse(bloco);
      await esperar(ESPERA_ENTRE_BLOCOS_MS);
    }
    return true;
  }

  // Fila: um envio so comeca quando o anterior termina (senao os blocos de linhas diferentes se misturam).
  function enviar(texto) {
    const resultado = fila.then(() => escrever(texto));
    fila = resultado.catch(() => {});   // um envio que falhou nao trava os proximos
    return resultado;
  }

  function desconectar() {
    querConectado = false;
    if (dispositivo && dispositivo.gatt.connected) dispositivo.gatt.disconnect();
  }

  return { conectar, enviar, desconectar };
}
