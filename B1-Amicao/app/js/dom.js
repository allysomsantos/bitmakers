// Cria um elemento: h('div', { class: 'card', onclick: fn }, 'texto', outroElemento)
export function h(tag, atributos = {}, ...filhos) {
  const elemento = document.createElement(tag);
  for (const [nome, valor] of Object.entries(atributos)) {
    if (nome.startsWith('on')) elemento.addEventListener(nome.slice(2), valor);
    else if (nome === 'class') elemento.className = valor;
    else if (valor === true) elemento.setAttribute(nome, '');
    else if (valor !== false && valor != null) elemento.setAttribute(nome, valor);
  }
  for (const filho of filhos.flat()) {
    elemento.append(filho instanceof Node ? filho : document.createTextNode(String(filho ?? '')));
  }
  return elemento;
}

export function formatarQuando(iso) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

export function mesmoDia(iso, data) {
  const a = new Date(iso);
  return a.getFullYear() === data.getFullYear() && a.getMonth() === data.getMonth() && a.getDate() === data.getDate();
}
