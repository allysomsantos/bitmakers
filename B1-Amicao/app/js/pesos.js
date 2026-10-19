// Regras do alerta "perdeu peso". Funcoes puras.

export const PADRAO = {
  quedaPercentual: 5,   // alerta se a media recente cair 5% ou mais
  janelaRecente: 3,     // quantas visitas recentes entram na media
  janelaAnterior: 5,    // quantas visitas antes dessas servem de referencia
  minimoVisitas: 4,     // minimo de visitas com peso valido
};

function media(lista) {
  return lista.reduce((soma, n) => soma + n, 0) / lista.length;
}

// visitas: em ordem cronologica (a mais antiga primeiro). Visita com peso_kg null nao conta.
export function avaliarPeso(visitas, config = PADRAO) {
  const pesos = visitas.map(v => v.peso_kg).filter(p => typeof p === 'number');
  if (pesos.length < config.minimoVisitas) return { alerta: false, motivo: 'poucas_visitas' };

  const recentes = pesos.slice(-config.janelaRecente);
  const anteriores = pesos.slice(-(config.janelaRecente + config.janelaAnterior), -config.janelaRecente);
  if (anteriores.length === 0) return { alerta: false, motivo: 'sem_anteriores' };

  const mediaRecente = media(recentes);
  const mediaAnterior = media(anteriores);
  const quedaPercentual = ((mediaAnterior - mediaRecente) / mediaAnterior) * 100;
  return { alerta: quedaPercentual >= config.quedaPercentual, quedaPercentual, mediaRecente, mediaAnterior };
}

// Compara os dois ultimos pesos para mostrar a setinha no card.
export function tendencia(pesos) {
  if (pesos.length < 2) return null;
  const diferenca = pesos[pesos.length - 1] - pesos[pesos.length - 2];
  if (Math.abs(diferenca) < 0.1) return 'igual';
  return diferenca > 0 ? 'subiu' : 'desceu';
}
