// Funcoes puras do protocolo: nao mexem em tela nem em Bluetooth.

// Transforma uma linha de texto em objeto. Devolve null se nao for um JSON de objeto.
export function lerLinha(texto) {
  const limpo = String(texto).trim();
  if (!limpo.startsWith('{')) return null;
  try {
    const objeto = JSON.parse(limpo);
    return objeto && typeof objeto === 'object' && !Array.isArray(objeto) ? objeto : null;
  } catch {
    return null;
  }
}

// O Bluetooth entrega pedacos de ate 20 bytes. Esta classe junta os pedacos
// e devolve so as linhas completas (terminadas em \n).
export class LinhaBuffer {
  constructor() {
    this.resto = '';
  }

  adicionar(pedaco) {
    this.resto += pedaco;
    const partes = this.resto.split('\n');
    this.resto = partes.pop();
    return partes.map(linha => linha.replace(/\r$/, '')).filter(linha => linha.length > 0);
  }
}

// Para enviar ao HM-10: corta o texto em blocos de 20 bytes.
export function quebrarEmBlocos(texto, tamanho = 20) {
  const bytes = new TextEncoder().encode(texto);
  const blocos = [];
  for (let i = 0; i < bytes.length; i += tamanho) {
    blocos.push(bytes.slice(i, i + tamanho));
  }
  return blocos;
}

// Tira os acentos: "é" vira "e", "ç" vira "c" etc.
// Os caracteres ̀ a ͯ são os acentos combinantes do Unicode.
export function semAcento(texto) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// O LCD nao tem acento e o Arduino guarda so 10 caracteres.
export function nomeParaLcd(nome) {
  return semAcento(nome).replace(/[^A-Za-z0-9 ]/g, '').trim().slice(0, 10);
}

// UID de tag NFC: 4 ou 7 bytes em hexadecimal maiusculo, separados por ":".
export function uidValido(uid) {
  return /^[0-9A-F]{2}(?::[0-9A-F]{2}){3}(?:(?::[0-9A-F]{2}){3})?$/.test(String(uid));
}

// Comandos do app para o Arduino (uma linha JSON cada).
export const comando = {
  cadastrar: () => '{"cmd":"cadastrar"}\n',
  cancelar: () => '{"cmd":"cancelar"}\n',
  listar: () => '{"cmd":"listar"}\n',
  permitir: (uid, nome) => JSON.stringify({ cmd: 'permitir', uid, nome: nomeParaLcd(nome) }) + '\n',
  remover: (uid) => JSON.stringify({ cmd: 'remover', uid }) + '\n',
};
