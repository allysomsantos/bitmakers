import { PADRAO } from './pesos.js';

const NOME_BANCO = 'amicao';
let bancoAberto = null;

function abrir() {
  if (bancoAberto) return bancoAberto;
  bancoAberto = new Promise((ok, erro) => {
    const pedido = indexedDB.open(NOME_BANCO, 1);
    pedido.onupgradeneeded = () => {
      const db = pedido.result;
      db.createObjectStore('cachorros', { keyPath: 'uid' });
      const visitas = db.createObjectStore('visitas', { keyPath: 'id', autoIncrement: true });
      visitas.createIndex('uid', 'uid');
      db.createObjectStore('config', { keyPath: 'chave' });
    };
    pedido.onsuccess = () => ok(pedido.result);
    pedido.onerror = () => erro(pedido.error);
  });
  return bancoAberto;
}

// Executa uma operacao em uma loja e devolve o resultado quando a transacao termina.
function operar(loja, modo, fazer) {
  return abrir().then(db => new Promise((ok, erro) => {
    const transacao = db.transaction(loja, modo);
    const resultado = fazer(transacao.objectStore(loja));
    transacao.oncomplete = () => ok(resultado.result);
    transacao.onerror = () => erro(transacao.error);
  }));
}

export async function listarCachorros() {
  const lista = await operar('cachorros', 'readonly', loja => loja.getAll());
  return lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export function salvarCachorro(cachorro) {
  return operar('cachorros', 'readwrite', loja => loja.put(cachorro));
}

export async function removerCachorro(uid) {
  await operar('cachorros', 'readwrite', loja => loja.delete(uid));
  const visitas = await listarVisitas(uid);
  for (const v of visitas) await operar('visitas', 'readwrite', loja => loja.delete(v.id));
}

export function adicionarVisita(visita) {
  return operar('visitas', 'readwrite', loja => loja.add(visita));
}

// Em ordem cronologica (o id cresce a cada visita).
export async function listarVisitas(uid) {
  const lista = await operar('visitas', 'readonly', loja => loja.index('uid').getAll(uid));
  return lista.sort((a, b) => a.id - b.id);
}

export async function lerConfig() {
  const registro = await operar('config', 'readonly', loja => loja.get('principal'));
  return { ...PADRAO, ...(registro ? registro.valores : {}) };
}

export function salvarConfig(valores) {
  return operar('config', 'readwrite', loja => loja.put({ chave: 'principal', valores }));
}

export async function exportarTudo() {
  const cachorros = await operar('cachorros', 'readonly', loja => loja.getAll());
  const visitas = await operar('visitas', 'readonly', loja => loja.getAll());
  const config = await lerConfig();
  return { versao: 1, cachorros, visitas, config };
}

// Troca TUDO que existe pelo conteudo do backup.
export async function importarTudo(dados) {
  const db = await abrir();
  await new Promise((ok, erro) => {
    const transacao = db.transaction(['cachorros', 'visitas', 'config'], 'readwrite');
    transacao.objectStore('cachorros').clear();
    transacao.objectStore('visitas').clear();
    for (const c of dados.cachorros) transacao.objectStore('cachorros').put(c);
    for (const v of dados.visitas) transacao.objectStore('visitas').put(v);
    transacao.objectStore('config').put({ chave: 'principal', valores: dados.config ?? {} });
    transacao.oncomplete = ok;
    transacao.onerror = () => erro(transacao.error);
  });
}
