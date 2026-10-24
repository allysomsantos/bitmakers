// Regras do alerta de peso. Funcoes puras.
//
// Cada pesagem e comparada com a MEDIA de todos os pesos anteriores do mesmo cachorro.
// Se a diferenca for de 20% ou mais (para mais ou para menos), o app sinaliza.
// Vale a partir da segunda pesagem: a primeira so serve de referencia.

export const LIMITE_VARIACAO_PERCENTUAL = 20;

function media(lista) {
  return lista.reduce((soma, n) => soma + n, 0) / lista.length;
}

// Compara um peso com os pesos anteriores. Devolve null se nao ha nada para comparar.
export function compararComAnteriores(pesosAnteriores, peso) {
  if (typeof peso !== 'number' || pesosAnteriores.length === 0) return null;
  const mediaAnterior = media(pesosAnteriores);
  const variacaoPercentual = ((peso - mediaAnterior) / mediaAnterior) * 100;
  return {
    mediaAnterior,
    variacaoPercentual,
    alerta: Math.abs(variacaoPercentual) >= LIMITE_VARIACAO_PERCENTUAL,
    direcao: variacaoPercentual > 0 ? 'mais' : 'menos',
  };
}

// visitas: em ordem cronologica (a mais antiga primeiro).
// Devolve a mesma lista, cada visita com o campo "comparacao" (ou null).
// Visita sem peso (peso_kg null) nao entra na conta.
export function anotarVisitas(visitas) {
  const pesos = [];
  return visitas.map((visita) => {
    if (typeof visita.peso_kg !== 'number') return { ...visita, comparacao: null };
    const comparacao = compararComAnteriores(pesos, visita.peso_kg);
    pesos.push(visita.peso_kg);
    return { ...visita, comparacao };
  });
}

// Situacao atual do cachorro: olha a ultima visita que teve peso.
export function avaliarPeso(visitas) {
  const comPeso = anotarVisitas(visitas).filter(v => typeof v.peso_kg === 'number');
  const ultima = comPeso.at(-1);
  if (!ultima || !ultima.comparacao) return { alerta: false, motivo: 'sem_anteriores' };
  return { ...ultima.comparacao, ultimoKg: ultima.peso_kg };
}

// Texto curto da variacao: "+12%" ou "−11%".
export function formatarVariacao(comparacao) {
  const n = Math.round(comparacao.variacaoPercentual);
  return (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n) + '%';
}

// Compara os dois ultimos pesos para mostrar a setinha no card.
export function tendencia(pesos) {
  if (pesos.length < 2) return null;
  const diferenca = pesos[pesos.length - 1] - pesos[pesos.length - 2];
  if (Math.abs(diferenca) < 0.1) return 'igual';
  return diferenca > 0 ? 'subiu' : 'desceu';
}
