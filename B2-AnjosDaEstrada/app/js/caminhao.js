const NS = 'http://www.w3.org/2000/svg';

function no(tag, atributos = {}) {
  const elemento = document.createElementNS(NS, tag);
  for (const [nome, valor] of Object.entries(atributos)) elemento.setAttribute(nome, valor);
  return elemento;
}

// Tres ondas em arco em volta de um canto do caminhao.
// cantos: 'fe' (frente esq), 'fd' (frente dir), 'te' (tras esq), 'td' (tras dir)
function ondas(campo, canto, cx, cy) {
  const grupo = no('g', { id: 'zona-' + campo, class: 'zona livre' });
  for (const raio of [26, 42, 58]) {
    let d;
    if (canto === 'fe') d = `M ${cx - raio} ${cy} A ${raio} ${raio} 0 0 1 ${cx} ${cy - raio}`;
    if (canto === 'fd') d = `M ${cx} ${cy - raio} A ${raio} ${raio} 0 0 1 ${cx + raio} ${cy}`;
    if (canto === 'te') d = `M ${cx} ${cy + raio} A ${raio} ${raio} 0 0 1 ${cx - raio} ${cy}`;
    if (canto === 'td') d = `M ${cx + raio} ${cy} A ${raio} ${raio} 0 0 1 ${cx} ${cy + raio}`;
    grupo.append(no('path', { d }));
  }
  return grupo;
}

// Caminhao visto de cima, com a frente virada para cima.
export function criarSvgCaminhao() {
  const svg = no('svg', { viewBox: '-10 -60 320 700', class: 'caminhao', role: 'img', 'aria-label': 'Caminhão visto de cima' });
  svg.append(
    // rodas
    no('rect', { x: 46, y: 70, width: 14, height: 44, rx: 4, class: 'roda' }),
    no('rect', { x: 240, y: 70, width: 14, height: 44, rx: 4, class: 'roda' }),
    no('rect', { x: 46, y: 410, width: 14, height: 44, rx: 4, class: 'roda' }),
    no('rect', { x: 240, y: 410, width: 14, height: 44, rx: 4, class: 'roda' }),
    no('rect', { x: 46, y: 464, width: 14, height: 44, rx: 4, class: 'roda' }),
    no('rect', { x: 240, y: 464, width: 14, height: 44, rx: 4, class: 'roda' }),
    // carroceria e cabine
    no('rect', { x: 58, y: 160, width: 184, height: 380, rx: 10, class: 'carroceria' }),
    no('rect', { x: 62, y: 30, width: 176, height: 120, rx: 18, class: 'cabine' }),
    no('rect', { x: 74, y: 48, width: 152, height: 30, rx: 8, class: 'para-brisa' }),
    // farois na frente
    no('rect', { id: 'farol_e', x: 70, y: 22, width: 34, height: 12, rx: 4, class: 'farol desligado' }),
    no('rect', { id: 'farol_d', x: 196, y: 22, width: 34, height: 12, rx: 4, class: 'farol desligado' }),
    // zonas dos 4 sensores
    ondas('frente_esq', 'fe', 62, 30),
    ondas('frente_dir', 'fd', 238, 30),
    ondas('tras_esq', 'te', 58, 540),
    ondas('tras_dir', 'td', 242, 540),
  );
  return svg;
}
