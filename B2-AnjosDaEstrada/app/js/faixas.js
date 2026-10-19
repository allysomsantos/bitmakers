// Regras de proximidade e de alerta do B2. Funcoes puras.
// Escala de prototipo; no caminhao de verdade, multiplique os limites por 10.

export const DIST_ATENCAO = 15;        // cm: de 15 a 5 cm e atencao
export const DIST_CRITICO = 5;         // cm: abaixo de 5 cm e critico
export const DIST_MINIMA_VALIDA = 2;   // cm: o HC-SR04 nao le com confianca abaixo disso (conta como critico)
export const BIPE_LENTO_MS = 600;      // intervalo entre bipes a 15 cm
export const BIPE_RAPIDO_MS = 200;     // intervalo entre bipes a 5 cm
export const CAMPOS_DISTANCIA = ['frente_esq', 'frente_dir', 'tras_esq', 'tras_dir'];

// cm null = sem eco, ou seja, nada por perto.
export function classificarDistancia(cm) {
  if (cm === null || cm === undefined) return 'livre';
  if (cm < DIST_CRITICO) return 'critico';   // inclui valores abaixo de DIST_MINIMA_VALIDA
  if (cm <= DIST_ATENCAO) return 'atencao';
  return 'livre';
}

export function menorDistancia(leitura) {
  const validas = CAMPOS_DISTANCIA.map(campo => leitura[campo]).filter(v => typeof v === 'number');
  return validas.length ? Math.min(...validas) : null;
}

// Entre 15 cm (600 ms) e 5 cm (200 ms) o intervalo diminui em linha reta.
export function intervaloBipe(cm) {
  const limitado = Math.min(DIST_ATENCAO, Math.max(DIST_CRITICO, cm));
  const fracao = (limitado - DIST_CRITICO) / (DIST_ATENCAO - DIST_CRITICO);
  return Math.round(BIPE_RAPIDO_MS + fracao * (BIPE_LENTO_MS - BIPE_RAPIDO_MS));
}

// O som de proximidade segue o sensor mais perto.
export function decidirSom(leitura) {
  const menor = menorDistancia(leitura);
  const faixa = classificarDistancia(menor);
  if (faixa === 'critico') return { tipo: 'continuo' };
  if (faixa === 'atencao') return { tipo: 'bipe', intervaloMs: intervaloBipe(menor) };
  return { tipo: 'silencio' };
}

// Alertas que ficam num banner vermelho enquanto a condicao existir.
export function alertasAtivos(leitura) {
  const alertas = [];
  if (leitura.chuva) alertas.push({ id: 'chuva', texto: 'Pista molhada: reduza a velocidade' });
  if (leitura.farol_e === 'queimado') alertas.push({ id: 'farol_e', texto: 'Farol esquerdo queimado' });
  if (leitura.farol_d === 'queimado') alertas.push({ id: 'farol_d', texto: 'Farol direito queimado' });
  return alertas;
}
