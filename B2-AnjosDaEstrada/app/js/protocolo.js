// Funcoes puras do protocolo do B2: nao mexem em tela nem em Bluetooth.

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

// Junta os pedacos de 20 bytes do Bluetooth e devolve so as linhas completas.
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

export function quebrarEmBlocos(texto, tamanho = 20) {
  const bytes = new TextEncoder().encode(texto);
  const blocos = [];
  for (let i = 0; i < bytes.length; i += tamanho) {
    blocos.push(bytes.slice(i, i + tamanho));
  }
  return blocos;
}

const CAMPOS_DISTANCIA = ['frente_esq', 'frente_dir', 'tras_esq', 'tras_dir'];
const ESTADOS_FAROL = ['desligado', 'ok', 'queimado'];

// Confere se a linha tem todos os campos e normaliza. Devolve null se algo estiver faltando.
export function lerLeitura(objeto) {
  if (!objeto || typeof objeto !== 'object') return null;
  const leitura = {};
  for (const campo of CAMPOS_DISTANCIA) {
    if (!(campo in objeto)) return null;
    const valor = objeto[campo];
    leitura[campo] = typeof valor === 'number' && valor >= 0 ? valor : null;   // null = sem eco
  }
  if (typeof objeto.chuva !== 'boolean') return null;
  if (!ESTADOS_FAROL.includes(objeto.farol_e) || !ESTADOS_FAROL.includes(objeto.farol_d)) return null;
  leitura.chuva = objeto.chuva;
  leitura.farol_e = objeto.farol_e;
  leitura.farol_d = objeto.farol_d;
  return leitura;
}
