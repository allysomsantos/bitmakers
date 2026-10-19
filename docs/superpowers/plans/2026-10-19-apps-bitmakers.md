# Apps BITMAKERS (B1 Amicão e B2 Anjos da Estrada) — Plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar este plano tarefa por tarefa. Os passos usam checkbox (`- [ ]`).

**Objetivo:** Entregar dois apps PWA para tablet Android (B1 cadastro/histórico/peso dos cachorros; B2 painel de sensores do caminhão) e ajustar os dois firmwares para o protocolo novo com HM-10 (BLE).

**Arquitetura:** Cada app é HTML/CSS/JS puro (ES modules) numa pasta `app/` dentro do projeto. A lógica fica em módulos puros (sem DOM, sem Bluetooth) testados com `node --test`. O BLE (`ble.js`) e um "Arduino falso" (`arduino-falso.js`, usado pelo simulador `?sim=1`) entregam texto à mesma função `receberLinha()`, então o que se testa no navegador é o mesmo caminho do tablet.

**Stack:** HTML, CSS, JavaScript (ES modules), Web Bluetooth, IndexedDB (só B1), Web Audio e Wake Lock (só B2), Service Worker. Node 24 para testes. Arduino C++ (Uno) para firmware. Sem bibliotecas de terceiros nos apps.

**Spec:** `docs/superpowers/specs/2026-10-19-apps-bitmakers-design.md` (leia antes de executar). Onde este plano refina a spec, a Tarefa 16 atualiza a spec.

## Restrições globais

- HTML, CSS e JS puros, ES modules, **sem build e sem biblioteca externa** nos apps.
- Código e comentários em **português**, nomes de variáveis em português, sem truques desnecessários (regra do `CLAUDE.md`).
- **Sem acento no LCD**; nome do cachorro enviado ao Arduino passa por `nomeParaLcd` (sem acento, máx. 10 caracteres).
- Tablet **Android + Chrome**; Web Bluetooth só em HTTPS (ou `localhost` no desenvolvimento).
- HM-10: serviço `0xFFE0`, característica `0xFFE1`, 9600 baud, escrita em blocos de **20 bytes**, uma linha JSON por evento terminada em `\n`.
- Uno tem **2 KB de RAM**: `F()` em textos fixos do Serial, sem biblioteca JSON no firmware.
- Um app por projeto, dentro da pasta dele; `ble.js` duplicado de propósito. **Nunca misturar projetos.**
- Limiares nas constantes do topo do arquivo: `DIST_ATENCAO = 15`, `DIST_CRITICO = 5`, `DIST_MINIMA_VALIDA = 2` (cm); peso: queda 5%, janela recente 3, janela anterior até 5, mínimo 4 visitas.
- Comando de teste (dentro de cada pasta `app/`): `node --test "teste/*.test.js"`.
- Servidor local de desenvolvimento: `.claude/launch.json` (Tarefa 0). O Service Worker só é registrado em `https:`, então não interfere no desenvolvimento.
- **Commits:** a pasta ainda **não é um repositório git**. Antes da Tarefa 0, confirme com o Allysom se ele quer `git init`. Se não quiser, pule todos os passos de commit. Ao commitar, siga a atribuição padrão da sessão.
- O Bluetooth real **não é testável aqui**: só no tablet com o HM-10 montado.

---

## Mapa de arquivos

```
B1-Amicao/app/
  package.json            {"type":"module"} (só para os testes em Node)
  index.html  estilo.css  manifest.webmanifest  sw.js  icone.svg  icone-192.png  icone-512.png  README.md
  js/dom.js               h() cria elementos; formatadores
  js/protocolo.js         PURO: lerLinha, LinhaBuffer, quebrarEmBlocos, uidValido, nomeParaLcd, comando
  js/pesos.js             PURO: avaliarPeso, tendencia
  js/arduino-falso.js     PURO: Arduino simulado (mesmas regras do firmware)
  js/ble.js               Web Bluetooth + reconexão
  js/banco.js             IndexedDB: cachorros, visitas, config, exportar/importar
  js/foto.js              reduz foto da câmera para ~200 px
  js/telas.js             telas: início, detalhe, cadastro, ajustes, gráfico
  js/simulador.js         painel do simulador (?sim=1)
  js/app.js               estado, rotas, receberLinha, ações
  teste/protocolo.test.js  teste/pesos.test.js  teste/arduino-falso.test.js

B2-AnjosDaEstrada/app/
  package.json  index.html  estilo.css  manifest.webmanifest  sw.js  icone.svg  icone-192.png  icone-512.png  README.md
  js/dom.js  js/protocolo.js (lerLinha, LinhaBuffer, quebrarEmBlocos, lerLeitura)
  js/faixas.js            PURO: classificarDistancia, menorDistancia, intervaloBipe, decidirSom, alertasAtivos
  js/caminhao-falso.js    PURO: gera as linhas do simulador
  js/ble.js  js/caminhao.js (SVG)  js/tela.js (cards + banners)  js/som.js  js/simulador.js  js/app.js
  teste/protocolo.test.js  teste/faixas.test.js  teste/caminhao-falso.test.js

ferramentas/gerar_icones.py     gera os PNG de ícone dos dois apps
.claude/launch.json             servidores locais (8081 = B1, 8082 = B2)
docs/PUBLICAR.md                como publicar no GitHub Pages
```

---

### Tarefa 0: Preparação do ambiente

**Arquivos:**
- Criar: `.claude/launch.json`

**Interfaces:**
- Produz: servidores `amicao` (porta 8081) e `anjos` (porta 8082) para `preview_start`.

- [ ] **Passo 1: Confirmar ferramentas**

Rodar: `node --version` (esperado: v22 ou maior) e `python --version` (esperado: 3.x).

- [ ] **Passo 2: Criar `.claude/launch.json`**

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "amicao",
      "runtimeExecutable": "python",
      "runtimeArgs": ["-m", "http.server", "8081", "--directory", "B1-Amicao/app"],
      "port": 8081
    },
    {
      "name": "anjos",
      "runtimeExecutable": "python",
      "runtimeArgs": ["-m", "http.server", "8082", "--directory", "B2-AnjosDaEstrada/app"],
      "port": 8082
    }
  ]
}
```

- [ ] **Passo 3: (só se o Allysom aprovou) iniciar o git**

```bash
git init
git add -A
git commit -m "chore: estado inicial do projeto"
```

---

## PARTE 1 — App B1 Amicão

### Tarefa 1: B1 `protocolo.js` com testes

**Arquivos:**
- Criar: `B1-Amicao/app/package.json`, `B1-Amicao/app/js/protocolo.js`, `B1-Amicao/app/teste/protocolo.test.js`

**Interfaces:**
- Produz (`js/protocolo.js`):
  - `lerLinha(texto: string): object | null`
  - `class LinhaBuffer { adicionar(pedaco: string): string[] }`
  - `quebrarEmBlocos(texto: string, tamanho = 20): Uint8Array[]`
  - `semAcento(texto): string`, `nomeParaLcd(nome): string`, `uidValido(uid): boolean` (4 ou 7 bytes, maiúsculo)
  - `comando.cadastrar() / cancelar() / listar(): string`, `comando.permitir(uid, nome): string`, `comando.remover(uid): string` (todos terminam em `\n`)

- [ ] **Passo 1: Criar `package.json`**

```json
{ "type": "module", "private": true }
```

- [ ] **Passo 2: Escrever o teste que falha** em `teste/protocolo.test.js`

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { lerLinha, LinhaBuffer, quebrarEmBlocos, nomeParaLcd, uidValido, comando } from '../js/protocolo.js';

test('lerLinha aceita JSON de objeto', () => {
  assert.deepEqual(lerLinha('{"evento":"ligado"}'), { evento: 'ligado' });
});

test('lerLinha ignora lixo', () => {
  assert.equal(lerLinha('APP> oi'), null);
  assert.equal(lerLinha('{quebrado'), null);
  assert.equal(lerLinha(''), null);
  assert.equal(lerLinha('[1,2]'), null);
});

test('LinhaBuffer junta pedacos ate o \\n', () => {
  const buffer = new LinhaBuffer();
  assert.deepEqual(buffer.adicionar('{"evento":'), []);
  assert.deepEqual(buffer.adicionar('"ligado"}\r\n{"a":'), ['{"evento":"ligado"}']);
  assert.deepEqual(buffer.adicionar('1}\n'), ['{"a":1}']);
});

test('quebrarEmBlocos corta em 20 bytes', () => {
  const blocos = quebrarEmBlocos('x'.repeat(45));
  assert.deepEqual(blocos.map(b => b.length), [20, 20, 5]);
});

test('nomeParaLcd tira acento, simbolos e corta em 10', () => {
  assert.equal(nomeParaLcd('José Ávila Longo'), 'Jose Avila');
  assert.equal(nomeParaLcd('Rex!!'), 'Rex');
});

test('uidValido aceita 4 ou 7 bytes em maiusculo', () => {
  assert.equal(uidValido('0A:0B:0C:0D'), true);
  assert.equal(uidValido('04:A1:B2:C3:D4:E5:F6'), true);
  assert.equal(uidValido('0A:0B:0C'), false);
  assert.equal(uidValido('0A:0B:0C:0D:0E'), false);
  assert.equal(uidValido('0a:0b:0c:0d'), false);
  assert.equal(uidValido('ZZ:0B:0C:0D'), false);
});

test('comandos terminam em \\n e usam nome sem acento', () => {
  assert.equal(comando.cadastrar(), '{"cmd":"cadastrar"}\n');
  assert.equal(comando.cancelar(), '{"cmd":"cancelar"}\n');
  assert.equal(comando.listar(), '{"cmd":"listar"}\n');
  assert.equal(comando.permitir('0A:0B:0C:0D', 'José'), '{"cmd":"permitir","uid":"0A:0B:0C:0D","nome":"Jose"}\n');
  assert.equal(comando.remover('0A:0B:0C:0D'), '{"cmd":"remover","uid":"0A:0B:0C:0D"}\n');
});
```

- [ ] **Passo 3: Rodar e ver falhar**

Rodar (em `B1-Amicao/app`): `node --test "teste/*.test.js"`
Esperado: FALHA com `Cannot find module '../js/protocolo.js'`.

- [ ] **Passo 4: Implementar `js/protocolo.js`**

```js
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
```

- [ ] **Passo 5: Rodar e ver passar**

Rodar: `node --test "teste/*.test.js"`
Esperado: 7 testes passando.

- [ ] **Passo 6: Commit**

```bash
git add B1-Amicao/app
git commit -m "feat(b1-app): protocolo puro com testes"
```

---

### Tarefa 2: B1 `pesos.js` com testes

**Arquivos:**
- Criar: `B1-Amicao/app/js/pesos.js`, `B1-Amicao/app/teste/pesos.test.js`

**Interfaces:**
- Produz:
  - `PADRAO = { quedaPercentual: 5, janelaRecente: 3, janelaAnterior: 5, minimoVisitas: 4 }`
  - `avaliarPeso(visitas, config = PADRAO): { alerta: boolean, quedaPercentual?: number, mediaRecente?: number, mediaAnterior?: number, motivo?: string }` — `visitas` em ordem cronológica, cada uma com `peso_kg: number | null`.
  - `tendencia(pesos: number[]): 'subiu' | 'desceu' | 'igual' | null`

- [ ] **Passo 1: Escrever o teste que falha** em `teste/pesos.test.js`

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { avaliarPeso, tendencia, PADRAO } from '../js/pesos.js';

const v = (...pesos) => pesos.map(p => ({ peso_kg: p }));

test('menos de 4 visitas validas: sem alerta', () => {
  assert.equal(avaliarPeso(v(7, 6, 6)).alerta, false);
});

test('demonstracao da pelucia: 7, 6, 6, 6 dispara alerta de ~14%', () => {
  const r = avaliarPeso(v(7, 6, 6, 6));
  assert.equal(r.alerta, true);
  assert.ok(Math.abs(r.quedaPercentual - 14.285) < 0.01);
});

test('queda de 4%: sem alerta', () => {
  assert.equal(avaliarPeso(v(100, 96, 96, 96)).alerta, false);
});

test('visitas sem peso (null) nao contam', () => {
  assert.equal(avaliarPeso(v(7, null, 6, null, 6, 6)).alerta, true);
  assert.equal(avaliarPeso(v(null, null, null, null)).alerta, false);
});

test('alerta some quando a media se recupera', () => {
  assert.equal(avaliarPeso(v(7, 6, 6, 6, 7, 7, 7)).alerta, false);
});

test('usa so as 5 visitas anteriores as 3 recentes', () => {
  // 3 recentes = 6,6,6. As 5 anteriores = 9,9,9,9,9 (a de 1 kg, mais antiga, fica de fora)
  assert.equal(avaliarPeso(v(1, 9, 9, 9, 9, 9, 6, 6, 6)).alerta, true);
});

test('tendencia compara os dois ultimos pesos', () => {
  assert.equal(tendencia([7.0, 6.5]), 'desceu');
  assert.equal(tendencia([6.5, 7.0]), 'subiu');
  assert.equal(tendencia([7.0, 7.05]), 'igual');
  assert.equal(tendencia([7.0]), null);
});

test('PADRAO tem os valores da spec', () => {
  assert.deepEqual(PADRAO, { quedaPercentual: 5, janelaRecente: 3, janelaAnterior: 5, minimoVisitas: 4 });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Rodar: `node --test "teste/pesos.test.js"`
Esperado: FALHA com `Cannot find module '../js/pesos.js'`.

- [ ] **Passo 3: Implementar `js/pesos.js`**

```js
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
```

- [ ] **Passo 4: Rodar e ver passar**

Rodar: `node --test "teste/*.test.js"`
Esperado: todos passando (protocolo + pesos).

- [ ] **Passo 5: Commit**

```bash
git add B1-Amicao/app
git commit -m "feat(b1-app): regra do alerta de perda de peso"
```

---

### Tarefa 3: B1 `arduino-falso.js` com testes

**Arquivos:**
- Criar: `B1-Amicao/app/js/arduino-falso.js`, `B1-Amicao/app/teste/arduino-falso.test.js`

**Interfaces:**
- Consome: `lerLinha`, `uidValido` de `./protocolo.js`.
- Produz: `class ArduinoFalso` com construtor `({ aoLinha(texto), duracaoCadastroMs = 30000, intervaloRacaoMs = 15000, relogio = Date.now })` e métodos `receberComando(texto)`, `passarTag(uid, pesoKg)`, `ligar()`, `agua(ligada: boolean)`, `reservatorioVazio()`, `enviarCadastros()`. Segue as regras do firmware: tag fora da lista e fora do modo cadastro **não gera nada**; modo cadastro termina ao ler a tag, ao cancelar ou ao expirar; lista com no máximo 10 tags.

- [ ] **Passo 1: Escrever o teste que falha** em `teste/arduino-falso.test.js`

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { ArduinoFalso } from '../js/arduino-falso.js';
import { comando } from '../js/protocolo.js';

function criar(opcoes = {}) {
  const linhas = [];
  let agora = 0;
  const falso = new ArduinoFalso({
    aoLinha: texto => linhas.push(JSON.parse(texto)),
    relogio: () => agora,
    ...opcoes,
  });
  return { falso, linhas, avancar: ms => { agora += ms; } };
}

const REX = '0A:0B:0C:0D';

test('tag desconhecida fora do modo cadastro nao gera nada', () => {
  const { falso, linhas } = criar();
  falso.passarTag('99:99:99:99', 7);
  assert.deepEqual(linhas, []);
});

test('modo cadastro: a proxima tag vira tag_lida e o modo termina', () => {
  const { falso, linhas } = criar();
  falso.receberComando(comando.cadastrar());
  falso.passarTag(REX, 7);
  assert.deepEqual(linhas, [
    { evento: 'modo_cadastro', ativo: true },
    { evento: 'tag_lida', uid: REX },
    { evento: 'modo_cadastro', ativo: false },
  ]);
});

test('permitir cadastra e responde com a lista', () => {
  const { falso, linhas } = criar();
  falso.receberComando(comando.permitir(REX, 'Rex'));
  assert.deepEqual(linhas, [{ evento: 'cadastros', uids: [REX] }]);
});

test('visita: racao na primeira vez, sem racao dentro do intervalo, com racao depois', () => {
  const { falso, linhas, avancar } = criar();
  falso.receberComando(comando.permitir(REX, 'Rex'));
  linhas.length = 0;
  falso.passarTag(REX, 7);
  falso.passarTag(REX, 7);
  avancar(16000);
  falso.passarTag(REX, 7);
  assert.deepEqual(linhas.map(l => l.racao), [true, false, true]);
});

test('peso abaixo de 1 kg vira null e o peso sai com 1 casa', () => {
  const { falso, linhas } = criar();
  falso.receberComando(comando.permitir(REX, 'Rex'));
  linhas.length = 0;
  falso.passarTag(REX, 0.4);
  falso.passarTag(REX, 7.04);
  assert.equal(linhas[0].peso_kg, null);
  assert.equal(linhas[1].peso_kg, 7);
});

test('remover volta a ignorar a tag', () => {
  const { falso, linhas } = criar();
  falso.receberComando(comando.permitir(REX, 'Rex'));
  falso.receberComando(comando.remover(REX));
  linhas.length = 0;
  falso.passarTag(REX, 7);
  assert.deepEqual(linhas, []);
});

test('uid invalido nao e gravado', () => {
  const { falso, linhas } = criar();
  falso.receberComando('{"cmd":"permitir","uid":"xx","nome":"Rex"}\n');
  assert.deepEqual(linhas, [{ evento: 'cadastros', uids: [] }]);
});

test('lista cheia: a 11a tag nao entra', () => {
  const { falso, linhas } = criar();
  for (let n = 0; n < 11; n++) {
    const uid = '0A:0B:0C:' + n.toString(16).toUpperCase().padStart(2, '0');
    falso.receberComando(comando.permitir(uid, 'C' + n));
  }
  assert.equal(linhas.at(-1).uids.length, 10);
});

test('modo cadastro expira sozinho', async () => {
  const { falso, linhas } = criar({ duracaoCadastroMs: 10 });
  falso.receberComando(comando.cadastrar());
  await new Promise(ok => setTimeout(ok, 40));
  assert.deepEqual(linhas.at(-1), { evento: 'modo_cadastro', ativo: false });
});

test('cancelar encerra o modo cadastro', () => {
  const { falso, linhas } = criar();
  falso.receberComando(comando.cadastrar());
  falso.receberComando(comando.cancelar());
  assert.deepEqual(linhas.at(-1), { evento: 'modo_cadastro', ativo: false });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Rodar: `node --test "teste/arduino-falso.test.js"`
Esperado: FALHA com `Cannot find module '../js/arduino-falso.js'`.

- [ ] **Passo 3: Implementar `js/arduino-falso.js`**

```js
import { lerLinha, uidValido } from './protocolo.js';

const MAX_TAGS = 10;

// Faz o papel do Arduino dentro do navegador, seguindo as mesmas regras do firmware.
// Serve para testar o app sem hardware (modo ?sim=1).
export class ArduinoFalso {
  constructor({ aoLinha, duracaoCadastroMs = 30000, intervaloRacaoMs = 15000, relogio = Date.now }) {
    this.aoLinha = aoLinha;
    this.duracaoCadastroMs = duracaoCadastroMs;
    this.intervaloRacaoMs = intervaloRacaoMs;
    this.relogio = relogio;
    this.tags = new Map();            // uid -> nome (faz o papel da EEPROM)
    this.ultimaPorcao = new Map();    // uid -> momento da ultima racao
    this.modoCadastro = false;
    this.temporizador = null;
  }

  emitir(objeto) {
    this.aoLinha(JSON.stringify(objeto));
  }

  // Texto que o app mandaria pelo Bluetooth.
  receberComando(texto) {
    const c = lerLinha(texto);
    if (!c) return;
    if (c.cmd === 'cadastrar') this.ligarModoCadastro();
    else if (c.cmd === 'cancelar') this.desligarModoCadastro();
    else if (c.cmd === 'listar') this.enviarCadastros();
    else if (c.cmd === 'permitir') this.permitir(c.uid, c.nome);
    else if (c.cmd === 'remover') this.remover(c.uid);
  }

  permitir(uid, nome) {
    const cabe = this.tags.has(uid) || this.tags.size < MAX_TAGS;
    if (uidValido(uid) && cabe) {
      this.tags.set(uid, String(nome ?? '').slice(0, 10));
      this.ultimaPorcao.delete(uid);
    }
    this.enviarCadastros();
  }

  remover(uid) {
    this.tags.delete(uid);
    this.ultimaPorcao.delete(uid);
    this.enviarCadastros();
  }

  enviarCadastros() {
    this.emitir({ evento: 'cadastros', uids: [...this.tags.keys()] });
  }

  ligarModoCadastro() {
    clearTimeout(this.temporizador);
    this.modoCadastro = true;
    this.emitir({ evento: 'modo_cadastro', ativo: true });
    this.temporizador = setTimeout(() => this.desligarModoCadastro(), this.duracaoCadastroMs);
  }

  desligarModoCadastro() {
    if (!this.modoCadastro) return;
    clearTimeout(this.temporizador);
    this.modoCadastro = false;
    this.emitir({ evento: 'modo_cadastro', ativo: false });
  }

  // Alguem encostou uma tag no leitor.
  passarTag(uid, pesoKg) {
    if (this.modoCadastro) {
      this.emitir({ evento: 'tag_lida', uid });
      this.desligarModoCadastro();
      return;
    }
    if (!this.tags.has(uid)) return;   // tag desconhecida: nada acontece

    const agora = this.relogio();
    const ultima = this.ultimaPorcao.get(uid);
    const racao = ultima === undefined || agora - ultima >= this.intervaloRacaoMs;
    if (racao) this.ultimaPorcao.set(uid, agora);

    const pesoValido = pesoKg >= 1;
    this.emitir({
      evento: 'visita',
      uid,
      peso_kg: pesoValido ? Math.round(pesoKg * 10) / 10 : null,
      racao,
    });
  }

  ligar() {
    this.emitir({ evento: 'ligado' });
  }

  agua(ligada) {
    this.emitir({ evento: 'agua', bomba: ligada ? 'ligada' : 'desligada' });
  }

  reservatorioVazio() {
    this.emitir({ evento: 'alerta', tipo: 'reservatorio_vazio' });
  }
}
```

- [ ] **Passo 4: Rodar e ver passar**

Rodar: `node --test "teste/*.test.js"`
Esperado: todos passando (protocolo, pesos, arduino-falso).

- [ ] **Passo 5: Commit**

```bash
git add B1-Amicao/app
git commit -m "feat(b1-app): arduino falso para o simulador"
```

---

### Tarefa 4: B1 base do app (banco, BLE, DOM, tela inicial, simulador)

**Arquivos:**
- Criar: `B1-Amicao/app/index.html`, `estilo.css`, `js/dom.js`, `js/banco.js`, `js/ble.js`, `js/foto.js`, `js/telas.js`, `js/simulador.js`, `js/app.js`

**Interfaces:**
- Consome: `lerLinha`, `comando` (protocolo); `avaliarPeso`, `tendencia`, `PADRAO` (pesos); `ArduinoFalso`.
- Produz:
  - `dom.js`: `h(tag, atributos, ...filhos): HTMLElement`, `formatarQuando(iso): string`, `mesmoDia(iso, data): boolean`
  - `banco.js`: `listarCachorros()`, `salvarCachorro(c)`, `removerCachorro(uid)` (apaga também as visitas), `adicionarVisita(v)`, `listarVisitas(uid)`, `lerConfig()`, `salvarConfig(cfg)`, `exportarTudo()`, `importarTudo(dados)`
  - `ble.js`: `criarBle({ aoLinha(texto), aoEstado(estado) }): { conectar(), enviar(texto): Promise<boolean>, desconectar() }` com `estado` em `'conectando' | 'conectado' | 'desconectado'`
  - `foto.js`: `reduzirFoto(arquivo, lado = 200): Promise<string>` (data URL JPEG)
  - `telas.js`: `telaInicio(estado, acoes)`, e (nas tarefas 5 a 7) `telaDetalhe`, `telaCadastro`, `telaAjustes`. Nesta tarefa as três últimas devolvem um texto provisório que as próximas tarefas substituem.
  - `simulador.js`: `montarPainelSimulador(elemento, falso)`
  - `app.js`: objeto `estado` e objeto `acoes` (formato descrito no código abaixo)

- [ ] **Passo 1: Criar `js/dom.js`**

```js
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
```

- [ ] **Passo 2: Criar `js/banco.js`**

```js
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
```

- [ ] **Passo 3: Criar `js/ble.js`** (este arquivo é copiado igual para o B2)

```js
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
  const decodificador = new TextDecoder();

  function aoChegarDados(evento) {
    const texto = decodificador.decode(evento.target.value);
    for (const linha of buffer.adicionar(texto)) aoLinha(linha);
  }

  async function ligar() {
    aoEstado('conectando');
    const servidor = await dispositivo.gatt.connect();
    const servico = await servidor.getPrimaryService(SERVICO);
    caracteristica = await servico.getCharacteristic(CARACTERISTICA);
    await caracteristica.startNotifications();
    caracteristica.addEventListener('characteristicvaluechanged', aoChegarDados);
    buffer = new LinhaBuffer();
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
  async function enviar(texto) {
    if (!caracteristica) return false;
    for (const bloco of quebrarEmBlocos(texto)) {
      await caracteristica.writeValueWithoutResponse(bloco);
      await esperar(ESPERA_ENTRE_BLOCOS_MS);
    }
    return true;
  }

  function desconectar() {
    querConectado = false;
    if (dispositivo && dispositivo.gatt.connected) dispositivo.gatt.disconnect();
  }

  return { conectar, enviar, desconectar };
}
```

- [ ] **Passo 4: Criar `js/foto.js`**

```js
// Reduz a foto da camera para um quadrado pequeno (guardar a foto inteira encheria o tablet).
export async function reduzirFoto(arquivo, lado = 200) {
  const imagem = await createImageBitmap(arquivo);
  const corte = Math.min(imagem.width, imagem.height);
  const quadro = document.createElement('canvas');
  quadro.width = lado;
  quadro.height = lado;
  quadro.getContext('2d').drawImage(
    imagem,
    (imagem.width - corte) / 2, (imagem.height - corte) / 2, corte, corte,
    0, 0, lado, lado,
  );
  return quadro.toDataURL('image/jpeg', 0.7);
}
```

- [ ] **Passo 5: Criar `js/telas.js`** (início completo; as outras telas são provisórias)

```js
import { h, mesmoDia } from './dom.js';
import { avaliarPeso, tendencia } from './pesos.js';

const SETAS = { subiu: '↑', desceu: '↓', igual: '→' };

function foto(cachorro) {
  return cachorro.foto
    ? h('img', { class: 'foto', src: cachorro.foto, alt: 'Foto de ' + cachorro.nome })
    : h('div', { class: 'foto sem-foto' }, '🐶');
}

function cardCachorro(estado, cachorro) {
  const visitas = estado.visitas[cachorro.uid] ?? [];
  const pesos = visitas.filter(v => typeof v.peso_kg === 'number').map(v => v.peso_kg);
  const ultimo = pesos.length ? pesos[pesos.length - 1] : null;
  const seta = SETAS[tendencia(pesos)] ?? '';
  const comeuHoje = visitas.some(v => v.racao && mesmoDia(v.quando, new Date()));
  const perdeuPeso = avaliarPeso(visitas, estado.config).alerta;

  return h('a', {
      class: 'card' + (perdeuPeso ? ' alerta' : ''),
      href: '#/cachorro/' + encodeURIComponent(cachorro.uid),
    },
    foto(cachorro),
    h('strong', {}, cachorro.nome),
    h('span', { class: comeuHoje ? 'ok' : 'neutro' }, comeuHoje ? '✔ Já comeu hoje' : 'Ainda não comeu hoje'),
    h('span', {}, ultimo !== null ? `${ultimo.toFixed(1)} kg ${seta}` : 'Sem peso ainda'),
    perdeuPeso ? h('span', { class: 'selo perigo' }, '⚠ Perdeu peso') : '',
  );
}

export function telaInicio(estado, acoes) {
  const cards = estado.cachorros.map(c => cardCachorro(estado, c));
  return h('section', { class: 'inicio' },
    h('div', { class: 'grade' },
      cards.length ? cards : h('p', { class: 'vazio' }, 'Nenhum cachorro cadastrado ainda. Toque em "Cadastrar cachorro".')),
    h('a', { class: 'botao grande', href: '#/cadastro' }, '＋ Cadastrar cachorro'),
  );
}

// Provisorias: as tarefas 5, 6 e 7 trocam estas funcoes pelas telas de verdade.
export function telaDetalhe() { return h('p', {}, 'Detalhe: em construção'); }
export function telaCadastro() { return h('p', {}, 'Cadastro: em construção'); }
export function telaAjustes() { return h('p', {}, 'Ajustes: em construção'); }
```

- [ ] **Passo 6: Criar `js/simulador.js`**

```js
import { h } from './dom.js';

// Tags de teste: uma de 4 bytes, uma de 7 bytes (como NTAG) e uma que nunca sera cadastrada.
const TAGS_DE_TESTE = [
  ['0A:0B:0C:0D', 'Tag A (4 bytes)'],
  ['11:22:33:44', 'Tag B (4 bytes)'],
  ['04:A1:B2:C3:D4:E5:F6', 'Tag C (7 bytes)'],
  ['99:99:99:99', 'Tag intrusa'],
];

export function montarPainelSimulador(elemento, falso) {
  const tag = h('select', {}, TAGS_DE_TESTE.map(([uid, nome]) => h('option', { value: uid }, nome)));
  const peso = h('input', { type: 'number', step: '0.1', value: '7.0', min: '0' });

  elemento.hidden = false;
  elemento.replaceChildren(
    h('strong', {}, 'Simulador (Arduino falso)'),
    h('label', {}, 'Tag ', tag),
    h('label', {}, 'Peso (kg) ', peso),
    h('button', { onclick: () => falso.passarTag(tag.value, parseFloat(peso.value)) }, 'Encostar tag na balança'),
    h('button', { onclick: () => falso.agua(true) }, 'Bomba ligou'),
    h('button', { onclick: () => falso.agua(false) }, 'Bomba desligou'),
    h('button', { onclick: () => falso.reservatorioVazio() }, 'Reservatório vazio'),
    h('button', { onclick: () => falso.ligar() }, 'Arduino reiniciou'),
  );
}
```

- [ ] **Passo 7: Criar `js/app.js`**

```js
import { lerLinha, comando } from './protocolo.js';
import { PADRAO, avaliarPeso } from './pesos.js';
import * as banco from './banco.js';
import { criarBle } from './ble.js';
import { ArduinoFalso } from './arduino-falso.js';
import { montarPainelSimulador } from './simulador.js';
import { reduzirFoto } from './foto.js';
import { h } from './dom.js';
import { telaInicio, telaDetalhe, telaCadastro, telaAjustes } from './telas.js';

const MAX_CACHORROS = 10;           // o Arduino guarda no maximo 10 tags
const DURACAO_CADASTRO_MS = 30000;  // igual ao firmware
const modoSimulador = new URLSearchParams(location.search).has('sim');

function novoCadastro() {
  // fase: 'parado' | 'aguardando' (esperando o Arduino) | 'ouvindo' | 'esgotado' | 'lido'
  return { fase: 'parado', fimEm: 0, uidLido: null, mensagem: '' };
}

export const estado = {
  conexao: 'desconectado',   // 'conectando' | 'conectado' | 'desconectado'
  bomba: 'desligada',
  reservatorioVazio: false,
  cachorros: [],
  visitas: {},               // uid -> lista de visitas em ordem cronologica
  config: { ...PADRAO },
  cadastro: novoCadastro(),
};

let ble = null;
let falso = null;

const conteudo = document.getElementById('conteudo');
const alertasEl = document.getElementById('alertas');

// ---------- envio para o Arduino ----------
async function enviar(texto) {
  if (falso) { falso.receberComando(texto); return true; }
  return ble ? ble.enviar(texto) : false;
}

// ---------- chegada de linhas ----------
function receberLinha(texto) {
  const ev = lerLinha(texto);
  if (!ev || typeof ev.evento !== 'string') return;

  if (ev.evento === 'visita') registrarVisita(ev);
  else if (ev.evento === 'agua') {
    estado.bomba = ev.bomba;
    if (ev.bomba === 'ligada') estado.reservatorioVazio = false;
  } else if (ev.evento === 'alerta' && ev.tipo === 'reservatorio_vazio') {
    estado.reservatorioVazio = true;
  } else if (ev.evento === 'modo_cadastro') {
    if (ev.ativo) estado.cadastro = { ...novoCadastro(), fase: 'ouvindo', fimEm: Date.now() + DURACAO_CADASTRO_MS };
    else if (estado.cadastro.fase === 'ouvindo') estado.cadastro.fase = 'esgotado';
  } else if (ev.evento === 'tag_lida') {
    estado.cadastro.fase = 'lido';
    estado.cadastro.uidLido = ev.uid;
  } else if (ev.evento === 'cadastros') {
    reconciliar(ev.uids ?? []);
  }
  render();
}

async function registrarVisita(ev) {
  if (!estado.cachorros.some(c => c.uid === ev.uid)) return;   // tag que o app nao conhece: ignora
  const visita = {
    uid: ev.uid,
    quando: new Date().toISOString(),   // o Arduino nao tem relogio: o app carimba
    peso_kg: typeof ev.peso_kg === 'number' ? ev.peso_kg : null,
    racao: ev.racao === true,
  };
  await banco.adicionarVisita(visita);
  (estado.visitas[ev.uid] ||= []).push(visita);
  render();
}

// O app e a fonte da verdade: faz a lista do Arduino ficar igual a do app.
async function reconciliar(uidsDoArduino) {
  const conhecidos = new Set(estado.cachorros.map(c => c.uid));
  const noArduino = new Set(uidsDoArduino);
  const soNoArduino = uidsDoArduino.filter(uid => !conhecidos.has(uid));
  const soNoApp = estado.cachorros.filter(c => !noArduino.has(c.uid));

  // Tablet novo (sem cachorros) ligado a um totem que ja tem tags: nao apaga sem perguntar.
  if (soNoArduino.length > 0 && estado.cachorros.length === 0) {
    const apagar = confirm(`O Arduino tem ${soNoArduino.length} tag(s) que este tablet não conhece. Apagar do Arduino?`);
    if (!apagar) return;
  }
  for (const uid of soNoArduino) await enviar(comando.remover(uid));
  for (const c of soNoApp) await enviar(comando.permitir(c.uid, c.nome));
}

// ---------- ações chamadas pelas telas ----------
export const acoes = {
  async conectar() {
    if (modoSimulador) return;
    try {
      await ble.conectar();
    } catch (erro) {
      if (erro.name !== 'NotFoundError') alert('Não consegui conectar: ' + erro.message);
    }
  },

  iniciarCadastro() {
    estado.cadastro = novoCadastro();
    if (estado.conexao !== 'conectado') {
      estado.cadastro.mensagem = 'Conecte o totem primeiro (botão Conectar).';
    } else if (estado.cachorros.length >= MAX_CACHORROS) {
      estado.cadastro.mensagem = `O totem guarda no máximo ${MAX_CACHORROS} cachorros. Remova um nos Ajustes.`;
    } else {
      estado.cadastro.fase = 'aguardando';
      enviar(comando.cadastrar());
    }
    render();
  },

  cancelarCadastro() {
    if (['aguardando', 'ouvindo'].includes(estado.cadastro.fase)) enviar(comando.cancelar());
    estado.cadastro = novoCadastro();
  },

  async salvarCachorro(nome, arquivoFoto) {
    const uid = estado.cadastro.uidLido;
    if (!uid || !nome.trim()) return;
    const cachorro = {
      uid,
      nome: nome.trim(),
      foto: arquivoFoto ? await reduzirFoto(arquivoFoto) : null,
      criadoEm: new Date().toISOString(),
    };
    await banco.salvarCachorro(cachorro);
    estado.cachorros = await banco.listarCachorros();
    estado.visitas[uid] = [];
    await enviar(comando.permitir(uid, cachorro.nome));
    estado.cadastro = novoCadastro();
    location.hash = '#/';
  },

  async removerCachorro(uid) {
    await banco.removerCachorro(uid);
    estado.cachorros = await banco.listarCachorros();
    delete estado.visitas[uid];
    await enviar(comando.remover(uid));
    render();
  },

  async salvarConfig(valores) {
    estado.config = { ...PADRAO, ...valores };
    await banco.salvarConfig(estado.config);
    render();
  },

  async exportar() {
    const dados = await banco.exportarTudo();
    const link = h('a', {
      href: URL.createObjectURL(new Blob([JSON.stringify(dados)], { type: 'application/json' })),
      download: `amicao-backup-${new Date().toISOString().slice(0, 10)}.json`,
    });
    link.click();
  },

  async importar(arquivo) {
    let dados;
    try {
      dados = JSON.parse(await arquivo.text());
    } catch {
      alert('Esse arquivo não é um backup válido.');
      return;
    }
    if (!Array.isArray(dados.cachorros) || !Array.isArray(dados.visitas)) {
      alert('Esse arquivo não é um backup do Amicão.');
      return;
    }
    if (!confirm('Importar vai SUBSTITUIR todos os cachorros e visitas deste tablet. Continuar?')) return;
    await banco.importarTudo(dados);
    await carregarDados();
    await enviar(comando.listar());
    render();
  },
};

// ---------- desenho ----------
function atualizarTopo() {
  const selo = document.getElementById('status-conexao');
  selo.textContent = { conectado: 'Conectado', conectando: 'Conectando…', desconectado: 'Desconectado' }[estado.conexao];
  selo.className = 'selo ' + (estado.conexao === 'conectado' ? 'ok' : 'perigo');

  const bomba = document.getElementById('status-bomba');
  bomba.hidden = estado.conexao !== 'conectado';
  bomba.textContent = estado.bomba === 'ligada' ? '💧 Bomba ligada' : '💧 Bomba desligada';
  bomba.className = 'selo ' + (estado.bomba === 'ligada' ? 'aviso' : 'neutro');

  document.getElementById('btn-conectar').hidden = modoSimulador || estado.conexao === 'conectado';
}

function atualizarAlertas() {
  const faixas = [];
  if (estado.conexao !== 'conectado') {
    faixas.push(h('div', { class: 'faixa aviso' }, 'Desconectado: visitas não estão sendo registradas.'));
  }
  if (estado.reservatorioVazio) {
    faixas.push(h('div', { class: 'faixa perigo' },
      '⚠ Reservatório de água vazio. ',
      h('button', { onclick: () => { estado.reservatorioVazio = false; render(); } }, 'Entendi')));
  }
  for (const cachorro of estado.cachorros) {
    const r = avaliarPeso(estado.visitas[cachorro.uid] ?? [], estado.config);
    if (r.alerta) {
      faixas.push(h('div', { class: 'faixa perigo' },
        `⚠ ${cachorro.nome} perdeu peso: a média das últimas visitas caiu ${r.quedaPercentual.toFixed(0)}%.`));
    }
  }
  alertasEl.replaceChildren(...faixas);
}

function rotaAtual() {
  const [, tipo, arg] = location.hash.split('/');
  return { tipo: tipo || 'inicio', arg: arg ? decodeURIComponent(arg) : null };
}

let rotaAnterior = 'inicio';
let chaveCadastro = '';

export function render() {
  atualizarTopo();
  atualizarAlertas();
  const { tipo, arg } = rotaAtual();

  // Na tela de cadastro, so redesenha quando algo relevante muda (senao apaga o que a pessoa digitou).
  if (tipo === 'cadastro') {
    const chave = `${estado.cadastro.fase}|${estado.cadastro.uidLido}|${estado.cadastro.mensagem}|${estado.cachorros.length}`;
    if (rotaAnterior === 'cadastro' && chave === chaveCadastro) return;
    chaveCadastro = chave;
  }

  let tela;
  if (tipo === 'cachorro') tela = telaDetalhe(estado, arg, acoes);
  else if (tipo === 'cadastro') tela = telaCadastro(estado, acoes);
  else if (tipo === 'ajustes') tela = telaAjustes(estado, acoes);
  else tela = telaInicio(estado, acoes);
  conteudo.replaceChildren(tela);
  rotaAnterior = tipo;
}

function aoMudarRota() {
  const { tipo } = rotaAtual();
  if (tipo === 'cadastro' && rotaAnterior !== 'cadastro') acoes.iniciarCadastro();
  if (tipo !== 'cadastro' && rotaAnterior === 'cadastro') acoes.cancelarCadastro();
  render();
}

// Contagem regressiva do cadastro: mexe so no numero, sem redesenhar a tela.
setInterval(() => {
  const el = document.getElementById('contagem');
  if (!el || estado.cadastro.fase !== 'ouvindo') return;
  el.textContent = Math.max(0, Math.ceil((estado.cadastro.fimEm - Date.now()) / 1000));
}, 250);

// ---------- inicio ----------
async function carregarDados() {
  estado.config = await banco.lerConfig();
  estado.cachorros = await banco.listarCachorros();
  estado.visitas = {};
  for (const c of estado.cachorros) estado.visitas[c.uid] = await banco.listarVisitas(c.uid);
}

function aoMudarEstadoBle(novo) {
  estado.conexao = novo;
  if (novo === 'conectado') enviar(comando.listar());
  render();
}

async function iniciar() {
  await carregarDados();

  if (modoSimulador) {
    falso = new ArduinoFalso({ aoLinha: receberLinha });
    montarPainelSimulador(document.getElementById('painel-simulador'), falso);
    estado.conexao = 'conectado';
  } else {
    ble = criarBle({ aoLinha: receberLinha, aoEstado: aoMudarEstadoBle });
  }

  window.addEventListener('hashchange', aoMudarRota);
  document.getElementById('btn-conectar').addEventListener('click', acoes.conectar);
  aoMudarRota();

  if (modoSimulador) {
    falso.ligar();
    enviar(comando.listar());
  }
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js');
  }
}

iniciar();
```

- [ ] **Passo 8: Criar `index.html`**

```html
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#2f7d4f">
  <title>Amicão</title>
  <link rel="manifest" href="manifest.webmanifest">
  <link rel="icon" href="icone.svg">
  <link rel="stylesheet" href="estilo.css">
</head>
<body>
  <header id="topo">
    <a href="#/" class="logo">🐾 Amicão</a>
    <span id="status-conexao" class="selo perigo">Desconectado</span>
    <span id="status-bomba" class="selo neutro" hidden></span>
    <span class="espaco"></span>
    <button id="btn-conectar" class="botao">Conectar</button>
    <a href="#/ajustes" class="botao claro" aria-label="Ajustes">⚙ Ajustes</a>
  </header>
  <div id="alertas" role="alert"></div>
  <main id="conteudo"></main>
  <aside id="painel-simulador" hidden></aside>
  <script type="module" src="js/app.js"></script>
</body>
</html>
```

- [ ] **Passo 9: Criar `estilo.css`**

```css
:root {
  --fundo: #fff8ee; --texto: #2b2b2b; --verde: #2f7d4f; --verde-claro: #e3f3e8;
  --vermelho: #c0392b; --amarelo: #b7791f; --cinza: #6b6b6b; --borda: #e6d9c3;
}
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, sans-serif; font-size: 18px; background: var(--fundo); color: var(--texto); }
#topo { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: var(--verde); color: #fff; flex-wrap: wrap; }
#topo .logo { color: #fff; font-size: 1.5rem; font-weight: 700; text-decoration: none; }
.espaco { flex: 1; }
.selo { padding: 4px 12px; border-radius: 999px; font-size: 0.9rem; font-weight: 600; background: #fff; }
.selo.ok { color: var(--verde); }
.selo.perigo { color: var(--vermelho); }
.selo.aviso { color: var(--amarelo); }
.selo.neutro { color: var(--cinza); }
.botao, button { font: inherit; padding: 10px 18px; border: 0; border-radius: 10px; background: var(--verde); color: #fff; text-decoration: none; cursor: pointer; min-height: 44px; display: inline-flex; align-items: center; }
#topo .botao { background: #fff; color: var(--verde); font-weight: 600; }
.botao.claro { background: var(--verde-claro); color: var(--verde); }
.botao.grande { font-size: 1.2rem; padding: 14px 24px; margin: 16px 0; }
.botao.perigo, button.perigo { background: var(--vermelho); }
#alertas { display: flex; flex-direction: column; gap: 6px; padding: 0 16px; }
.faixa { padding: 12px 16px; border-radius: 10px; margin-top: 8px; display: flex; gap: 12px; align-items: center; font-weight: 600; }
.faixa.perigo { background: #fdecea; color: var(--vermelho); border: 2px solid var(--vermelho); }
.faixa.aviso { background: #fff4d6; color: var(--amarelo); border: 2px solid var(--amarelo); }
.faixa button { padding: 4px 14px; min-height: 36px; }
main { padding: 16px; max-width: 1100px; margin: 0 auto; }
.grade { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
.card { display: flex; flex-direction: column; gap: 6px; align-items: center; padding: 16px; background: #fff; border: 2px solid var(--borda); border-radius: 16px; text-decoration: none; color: inherit; text-align: center; }
.card.alerta { border-color: var(--vermelho); }
.card strong { font-size: 1.3rem; }
.foto { width: 110px; height: 110px; border-radius: 50%; object-fit: cover; background: var(--verde-claro); display: flex; align-items: center; justify-content: center; font-size: 3rem; }
.ok { color: var(--verde); } .neutro { color: var(--cinza); }
.vazio { color: var(--cinza); grid-column: 1 / -1; }
.detalhe-topo { display: flex; align-items: center; gap: 16px; margin-bottom: 12px; }
.detalhe-topo .foto { width: 90px; height: 90px; }
.grafico { width: 100%; max-width: 640px; background: #fff; border: 2px solid var(--borda); border-radius: 12px; }
.grafico .linha { fill: none; stroke: var(--verde); stroke-width: 3; }
.grafico .ponto { fill: var(--verde); }
.grafico text { font-size: 12px; fill: var(--cinza); }
table.visitas { width: 100%; border-collapse: collapse; background: #fff; border-radius: 12px; overflow: hidden; }
table.visitas th, table.visitas td { padding: 10px 12px; text-align: left; border-bottom: 1px solid var(--borda); }
form label { display: block; margin: 12px 0 4px; font-weight: 600; }
input, select { font: inherit; padding: 10px; border: 2px solid var(--borda); border-radius: 10px; min-height: 44px; }
.cadastro .instrucao { font-size: 1.3rem; }
.cadastro .contagem { font-size: 3rem; font-weight: 700; color: var(--verde); }
.aviso-texto { color: var(--amarelo); font-weight: 600; }
#painel-simulador { position: fixed; right: 8px; bottom: 8px; width: 260px; background: #222; color: #fff; padding: 12px; border-radius: 12px; display: flex; flex-direction: column; gap: 8px; font-size: 0.85rem; z-index: 10; }
#painel-simulador[hidden] { display: none; }
#painel-simulador button { font-size: 0.85rem; min-height: 36px; padding: 6px 10px; }
#painel-simulador input, #painel-simulador select { min-height: 32px; padding: 4px; width: 100%; }
.lista-ajustes { list-style: none; padding: 0; }
.lista-ajustes li { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--borda); }
```

- [ ] **Passo 10: Subir o servidor e verificar no navegador**

Usar `preview_start` com `name: "amicao"`; navegar para `http://localhost:8081/?sim=1`. Conferir:
- O painel escuro "Simulador (Arduino falso)" aparece no canto, o selo mostra **Conectado** e o botão Conectar fica escondido.
- A tela inicial mostra "Nenhum cachorro cadastrado ainda" e o botão "＋ Cadastrar cachorro".
- `read_console_messages` com `onlyErrors: true` não traz erros.
- Clicar em "Encostar tag na balança" com a tag "Tag intrusa" **não muda nada na tela** (tag desconhecida é ignorada).

- [ ] **Passo 11: Commit**

```bash
git add B1-Amicao/app .claude/launch.json
git commit -m "feat(b1-app): base do app, banco, BLE, simulador e tela inicial"
```

---

### Tarefa 5: B1 tela de detalhe com gráfico de peso

**Arquivos:**
- Modificar: `B1-Amicao/app/js/telas.js` (trocar `telaDetalhe` provisória; adicionar `graficoPeso`)

**Interfaces:**
- Consome: `h`, `formatarQuando` de `dom.js`; `avaliarPeso`; `estado.visitas[uid]`, `estado.cachorros`.
- Produz: `telaDetalhe(estado, uid, acoes): HTMLElement`, `graficoPeso(pesos: number[]): SVGElement`.

- [ ] **Passo 1: Ajustar a importação no topo de `js/telas.js`**

Trocar a primeira linha de importação por:

```js
import { h, mesmoDia, formatarQuando } from './dom.js';
```

- [ ] **Passo 2: Substituir `telaDetalhe` provisória e adicionar o gráfico**

Remover a linha `export function telaDetalhe() { ... }` e acrescentar ao arquivo:

```js
const NS_SVG = 'http://www.w3.org/2000/svg';

function noSvg(tag, atributos = {}, texto = null) {
  const elemento = document.createElementNS(NS_SVG, tag);
  for (const [nome, valor] of Object.entries(atributos)) elemento.setAttribute(nome, valor);
  if (texto !== null) elemento.textContent = texto;
  return elemento;
}

// Grafico de linha do peso, um ponto por pesagem valida.
export function graficoPeso(pesos) {
  const largura = 600, altura = 240, margem = 40;
  const svg = noSvg('svg', { viewBox: `0 0 ${largura} ${altura}`, class: 'grafico', role: 'img', 'aria-label': 'Gráfico de peso' });
  if (pesos.length < 2) {
    svg.append(noSvg('text', { x: largura / 2, y: altura / 2, 'text-anchor': 'middle' }, 'Precisa de pelo menos 2 pesagens'));
    return svg;
  }
  const minimo = Math.min(...pesos) - 0.5;
  const maximo = Math.max(...pesos) + 0.5;
  const x = i => margem + (i * (largura - 2 * margem)) / (pesos.length - 1);
  const y = p => altura - margem - ((p - minimo) * (altura - 2 * margem)) / (maximo - minimo);

  svg.append(
    noSvg('text', { x: 4, y: y(maximo) + 4 }, maximo.toFixed(1)),
    noSvg('text', { x: 4, y: y(minimo) + 4 }, minimo.toFixed(1)),
    noSvg('polyline', { class: 'linha', points: pesos.map((p, i) => `${x(i)},${y(p)}`).join(' ') }),
  );
  pesos.forEach((p, i) => {
    svg.append(noSvg('circle', { class: 'ponto', cx: x(i), cy: y(p), r: 5 }));
    svg.append(noSvg('text', { x: x(i), y: y(p) - 10, 'text-anchor': 'middle' }, p.toFixed(1)));
  });
  return svg;
}

export function telaDetalhe(estado, uid) {
  const cachorro = estado.cachorros.find(c => c.uid === uid);
  if (!cachorro) return h('p', {}, 'Cachorro não encontrado. ', h('a', { href: '#/' }, 'Voltar'));

  const visitas = estado.visitas[uid] ?? [];
  const pesos = visitas.filter(v => typeof v.peso_kg === 'number').map(v => v.peso_kg);
  const avaliacao = avaliarPeso(visitas, estado.config);
  const linhas = [...visitas].reverse().map(v => h('tr', {},
    h('td', {}, formatarQuando(v.quando)),
    h('td', {}, v.peso_kg !== null ? v.peso_kg.toFixed(1) + ' kg' : 'sem peso'),
    h('td', {}, v.racao ? 'Comeu' : 'Só passou'),
  ));

  return h('section', { class: 'detalhe' },
    h('a', { href: '#/', class: 'botao claro' }, '← Voltar'),
    h('div', { class: 'detalhe-topo' },
      foto(cachorro),
      h('div', {},
        h('h2', {}, cachorro.nome),
        avaliacao.alerta
          ? h('span', { class: 'selo perigo' }, `⚠ Perdeu peso (${avaliacao.quedaPercentual.toFixed(0)}%)`)
          : h('span', { class: 'selo ok' }, 'Peso estável'))),
    h('h3', {}, 'Peso'),
    graficoPeso(pesos),
    h('h3', {}, 'Visitas'),
    linhas.length
      ? h('table', { class: 'visitas' },
          h('thead', {}, h('tr', {}, h('th', {}, 'Quando'), h('th', {}, 'Peso'), h('th', {}, 'Ração'))),
          h('tbody', {}, linhas))
      : h('p', { class: 'vazio' }, 'Nenhuma visita registrada ainda.'),
  );
}
```

- [ ] **Passo 2b: Cadastrar um cachorro direto no banco para testar** (a tela de cadastro só chega na Tarefa 6)

No navegador (`javascript_tool`, página `?sim=1`), rodar:

```js
const banco = await import('/js/banco.js');
await banco.salvarCachorro({ uid: '0A:0B:0C:0D', nome: 'Rex', foto: null, criadoEm: new Date().toISOString() });
location.reload();
```

- [ ] **Passo 3: Verificar no navegador**

Em `?sim=1`, escolher "Tag A (4 bytes)" e passar 4 visitas com pesos 7, 6, 6, 6 (botão "Encostar tag na balança", trocando o peso a cada vez). Conferir:
- O card do Rex mostra "6.0 kg ↓", e depois da 4ª visita aparece o selo "⚠ Perdeu peso" e a faixa vermelha no topo.
- Tocar no card abre o detalhe com gráfico de 4 pontos e tabela de 4 visitas (a mais recente primeiro).
- Recarregar a página mantém os dados (IndexedDB). Passar 7, 7, 7 depois faz o alerta sumir.
- Sem erros no console.

- [ ] **Passo 4: Commit**

```bash
git add B1-Amicao/app
git commit -m "feat(b1-app): detalhe do cachorro com grafico de peso"
```

---

### Tarefa 6: B1 cadastro de cachorro

**Arquivos:**
- Modificar: `B1-Amicao/app/js/telas.js` (trocar `telaCadastro` provisória)

**Interfaces:**
- Consome: `estado.cadastro { fase, fimEm, uidLido, mensagem }`, `estado.cachorros`, `acoes.iniciarCadastro()`, `acoes.salvarCachorro(nome, arquivo)`.
- Produz: `telaCadastro(estado, acoes): HTMLElement`. O `<strong id="contagem">` é atualizado pelo temporizador do `app.js`.

- [ ] **Passo 1: Substituir `telaCadastro` provisória** (remover a linha `export function telaCadastro() { ... }`)

```js
function formularioCadastro(estado, acoes) {
  const uid = estado.cadastro.uidLido;
  const jaCadastrado = estado.cachorros.find(c => c.uid === uid);
  if (jaCadastrado) {
    return h('section', { class: 'cadastro' },
      h('h2', {}, 'Tag já cadastrada'),
      h('p', {}, `Esta tag já pertence ao ${jaCadastrado.nome}.`),
      h('a', { class: 'botao', href: '#/' }, 'Voltar'));
  }

  const entradaNome = h('input', { type: 'text', maxlength: '10', required: true, placeholder: 'Ex.: Rex', autocomplete: 'off' });
  const entradaFoto = h('input', { type: 'file', accept: 'image/*', capture: 'environment' });
  return h('section', { class: 'cadastro' },
    h('h2', {}, 'Tag lida! Agora o nome e a foto'),
    h('p', { class: 'neutro' }, 'Tag: ' + uid),
    h('form', {
        id: 'form-cadastro',
        onsubmit: (evento) => {
          evento.preventDefault();
          acoes.salvarCachorro(entradaNome.value, entradaFoto.files[0]);
        },
      },
      h('label', {}, 'Nome (até 10 letras)'), entradaNome,
      h('label', {}, 'Foto (opcional)'), entradaFoto,
      h('p', {}, h('button', { type: 'submit' }, 'Salvar cachorro'), ' ',
        h('a', { class: 'botao claro', href: '#/' }, 'Cancelar'))));
}

export function telaCadastro(estado, acoes) {
  const c = estado.cadastro;
  if (c.fase === 'lido') return formularioCadastro(estado, acoes);

  const segundos = Math.max(0, Math.ceil((c.fimEm - Date.now()) / 1000));
  return h('section', { class: 'cadastro' },
    h('h2', {}, 'Cadastrar cachorro'),
    c.mensagem ? h('p', { class: 'aviso-texto' }, c.mensagem) : '',
    c.fase === 'aguardando' ? h('p', {}, 'Avisando o totem…') : '',
    c.fase === 'ouvindo'
      ? h('div', {},
          h('p', { class: 'instrucao' }, 'Encoste a tag da coleira no leitor do totem.'),
          h('p', {}, 'Tempo restante: ', h('strong', { id: 'contagem', class: 'contagem' }, segundos), ' s'))
      : '',
    c.fase === 'esgotado'
      ? h('div', {}, h('p', { class: 'aviso-texto' }, 'O tempo acabou e nenhuma tag foi lida.'),
          h('button', { onclick: acoes.iniciarCadastro }, 'Tentar de novo'))
      : '',
    h('p', {}, h('a', { class: 'botao claro', href: '#/' }, 'Cancelar')),
  );
}
```

- [ ] **Passo 2: Verificar no navegador** (limpar o banco antes: `indexedDB.deleteDatabase('amicao')` no console e recarregar `?sim=1`)

Conferir, nesta ordem:
- Tocar em "＋ Cadastrar cachorro": aparece "Encoste a tag…" com contagem regressiva descendo a partir de 30.
- No simulador, "Tag intrusa" **durante o modo cadastro** gera o formulário (qualquer tag vira `tag_lida`). Digitar "José Ávila Longo" aceita só 10 letras. Salvar volta para o início com o card.
- Repetir o cadastro com a mesma tag mostra "Tag já cadastrada".
- Depois de cadastrado, encostar a tag fora do modo cadastro registra visita; uma tag não cadastrada continua sem efeito.
- Deixar a contagem chegar a 0: aparece "O tempo acabou…" e "Tentar de novo".
- Sair da tela no meio (botão Cancelar) e conferir no console do simulador que o modo cadastro foi encerrado: `falso.modoCadastro` não é acessível, então encoste a tag intrusa e confirme que **nada** acontece.
- Recarregar a página com o cachorro cadastrado: o simulador reinicia sem tags e o app reenvia `permitir` (a tag cadastrada volta a gerar visitas).

- [ ] **Passo 3: Commit**

```bash
git add B1-Amicao/app
git commit -m "feat(b1-app): fluxo de cadastro com modo cadastro de 30 s"
```

---

### Tarefa 7: B1 ajustes e backup

**Arquivos:**
- Modificar: `B1-Amicao/app/js/telas.js` (trocar `telaAjustes` provisória)

**Interfaces:**
- Consome: `acoes.conectar`, `acoes.salvarConfig(valores)`, `acoes.removerCachorro(uid)`, `acoes.exportar()`, `acoes.importar(arquivo)`; `estado.config`, `estado.cachorros`, `estado.conexao`.
- Produz: `telaAjustes(estado, acoes): HTMLElement`.

- [ ] **Passo 1: Substituir `telaAjustes` provisória** (remover a linha `export function telaAjustes() { ... }`)

```js
function campoNumero(rotulo, valor, minimo, maximo, passo = 1) {
  const entrada = h('input', { type: 'number', value: valor, min: minimo, max: maximo, step: passo, required: true });
  return { entrada, linha: h('label', {}, rotulo, entrada) };
}

export function telaAjustes(estado, acoes) {
  const queda = campoNumero('Alerta de peso: queda de (%) ', estado.config.quedaPercentual, 1, 50);
  const recente = campoNumero('Visitas recentes na média ', estado.config.janelaRecente, 1, 10);
  const anterior = campoNumero('Visitas de referência ', estado.config.janelaAnterior, 1, 20);
  const minimo = campoNumero('Mínimo de visitas com peso ', estado.config.minimoVisitas, 2, 30);
  const entradaBackup = h('input', { type: 'file', accept: 'application/json' });

  return h('section', { class: 'ajustes' },
    h('a', { href: '#/', class: 'botao claro' }, '← Voltar'),
    h('h2', {}, 'Ajustes'),

    h('h3', {}, 'Totem'),
    estado.conexao === 'conectado'
      ? h('p', { class: 'ok' }, '✔ Conectado ao totem')
      : h('p', {}, h('button', { onclick: acoes.conectar }, 'Conectar ao totem')),

    h('h3', {}, 'Alerta de perda de peso'),
    h('form', {
        onsubmit: (evento) => {
          evento.preventDefault();
          acoes.salvarConfig({
            quedaPercentual: Number(queda.entrada.value),
            janelaRecente: Number(recente.entrada.value),
            janelaAnterior: Number(anterior.entrada.value),
            minimoVisitas: Number(minimo.entrada.value),
          });
        },
      },
      queda.linha, recente.linha, anterior.linha, minimo.linha,
      h('p', {}, h('button', { type: 'submit' }, 'Salvar'))),

    h('h3', {}, 'Cachorros cadastrados'),
    estado.cachorros.length
      ? h('ul', { class: 'lista-ajustes' }, estado.cachorros.map(c => h('li', {},
          c.nome,
          h('button', {
            class: 'perigo',
            onclick: () => { if (confirm(`Remover ${c.nome} e todo o histórico dele?`)) acoes.removerCachorro(c.uid); },
          }, 'Remover'))))
      : h('p', { class: 'vazio' }, 'Nenhum cachorro cadastrado.'),

    h('h3', {}, 'Backup'),
    h('p', {}, h('button', { onclick: acoes.exportar }, 'Exportar backup')),
    h('label', {}, 'Importar backup (substitui tudo)'), entradaBackup,
    h('p', {}, h('button', { onclick: () => { if (entradaBackup.files[0]) acoes.importar(entradaBackup.files[0]); } }, 'Importar')),
  );
}
```

- [ ] **Passo 2: Verificar no navegador**

Em `?sim=1` com um cachorro cadastrado e algumas visitas:
- Abrir Ajustes, mudar "queda de (%)" para 20 e salvar. Com a queda de 14% (7,6,6,6) o alerta **some**; voltar para 5 e ele reaparece.
- "Exportar backup" baixa um `amicao-backup-AAAA-MM-DD.json` (confirmar a ação de download com o Allysom se o navegador pedir). Remover o cachorro (confirmar o diálogo) e importar o arquivo: cachorro e visitas voltam.
- Importar um arquivo qualquer que não seja o backup mostra o alerta "não é um backup válido".
- Remover um cachorro também faz o app mandar `remover` (a tag deixa de gerar visitas no simulador).

- [ ] **Passo 3: Commit**

```bash
git add B1-Amicao/app
git commit -m "feat(b1-app): ajustes, remocao e backup"
```

---

### Tarefa 8: B1 PWA (manifest, Service Worker, ícones)

**Arquivos:**
- Criar: `ferramentas/gerar_icones.py`, `B1-Amicao/app/manifest.webmanifest`, `B1-Amicao/app/sw.js`, `B1-Amicao/app/icone.svg`, `B1-Amicao/app/icone-192.png`, `B1-Amicao/app/icone-512.png`
- Modificar nada além disso (o `index.html` já aponta para `manifest.webmanifest` e `icone.svg`; o registro do SW já está no `app.js`).

**Interfaces:**
- Produz: PWA instalável. `ferramentas/gerar_icones.py` gera os PNG dos **dois** apps (a parte do B2 é usada na Tarefa 13).

- [ ] **Passo 1: Criar `ferramentas/gerar_icones.py`**

```python
"""Gera os icones PNG dos dois apps, so com a biblioteca padrao do Python.
Uso (na raiz do repositorio):  python -I ferramentas/gerar_icones.py
"""
import struct
import zlib


def escrever_png(caminho, lado, cor_do_pixel):
    linhas = bytearray()
    for y in range(lado):
        linhas.append(0)  # filtro "nenhum" da linha
        for x in range(lado):
            linhas.extend(cor_do_pixel(x / lado, y / lado))

    def bloco(tipo, dados):
        corpo = struct.pack('>I', len(dados)) + tipo + dados
        return corpo + struct.pack('>I', zlib.crc32(tipo + dados) & 0xFFFFFFFF)

    cabecalho = struct.pack('>IIBBBBB', lado, lado, 8, 2, 0, 0, 0)  # 8 bits, RGB
    png = b'\x89PNG\r\n\x1a\n' + bloco(b'IHDR', cabecalho) + bloco(b'IDAT', zlib.compress(bytes(linhas), 9)) + bloco(b'IEND', b'')
    with open(caminho, 'wb') as arquivo:
        arquivo.write(png)


def dentro_do_circulo(x, y, cx, cy, raio):
    return (x - cx) ** 2 + (y - cy) ** 2 <= raio ** 2


def dentro_do_retangulo(x, y, x0, y0, x1, y1):
    return x0 <= x <= x1 and y0 <= y <= y1


def pixel_amicao(x, y):
    """Patinha branca sobre fundo verde."""
    branco, verde = (255, 255, 255), (47, 125, 79)
    almofada = dentro_do_circulo(x, y, 0.5, 0.64, 0.2)
    dedos = any(dentro_do_circulo(x, y, cx, cy, 0.09) for cx, cy in [(0.28, 0.42), (0.42, 0.3), (0.58, 0.3), (0.72, 0.42)])
    return branco if almofada or dedos else verde


def pixel_anjos(x, y):
    """Caminhao visto de cima, sobre fundo azul escuro."""
    fundo, cabine, carroceria = (30, 41, 59), (245, 158, 11), (226, 232, 240)
    if dentro_do_retangulo(x, y, 0.36, 0.2, 0.64, 0.38):
        return cabine
    if dentro_do_retangulo(x, y, 0.33, 0.4, 0.67, 0.8):
        return carroceria
    return fundo


if __name__ == '__main__':
    for lado in (192, 512):
        escrever_png(f'B1-Amicao/app/icone-{lado}.png', lado, pixel_amicao)
        escrever_png(f'B2-AnjosDaEstrada/app/icone-{lado}.png', lado, pixel_anjos)
    print('icones gerados')
```

- [ ] **Passo 2: Gerar só os do B1 por enquanto**

A pasta `B2-AnjosDaEstrada/app/` ainda não existe. Criar a pasta vazia primeiro:

```bash
mkdir -p B2-AnjosDaEstrada/app
python -I ferramentas/gerar_icones.py
```
Esperado: imprime `icones gerados` e existem `icone-192.png` e `icone-512.png` nas duas pastas `app/`. Abrir um dos PNG com a ferramenta Read para conferir que a patinha aparece.

- [ ] **Passo 3: Criar `B1-Amicao/app/icone.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="20" fill="#2f7d4f"/>
  <circle cx="50" cy="64" r="20" fill="#fff"/>
  <circle cx="28" cy="42" r="9" fill="#fff"/>
  <circle cx="42" cy="30" r="9" fill="#fff"/>
  <circle cx="58" cy="30" r="9" fill="#fff"/>
  <circle cx="72" cy="42" r="9" fill="#fff"/>
</svg>
```

- [ ] **Passo 4: Criar `B1-Amicao/app/manifest.webmanifest`**

```json
{
  "name": "Amicão",
  "short_name": "Amicão",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "orientation": "any",
  "background_color": "#fff8ee",
  "theme_color": "#2f7d4f",
  "icons": [
    { "src": "icone-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icone-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

- [ ] **Passo 5: Criar `B1-Amicao/app/sw.js`**

```js
// Guarda os arquivos do app para abrir sem internet.
// Ao publicar uma versao nova, troque o numero em VERSAO.
const VERSAO = 'amicao-v1';
const ARQUIVOS = [
  './', 'index.html', 'estilo.css', 'manifest.webmanifest', 'icone.svg', 'icone-192.png', 'icone-512.png',
  'js/app.js', 'js/ble.js', 'js/banco.js', 'js/dom.js', 'js/foto.js', 'js/pesos.js',
  'js/protocolo.js', 'js/arduino-falso.js', 'js/simulador.js', 'js/telas.js',
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(caches.open(VERSAO).then(cache => cache.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then(nomes => Promise.all(nomes.filter(n => n !== VERSAO).map(n => caches.delete(n))))
      .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (evento) => {
  if (evento.request.method !== 'GET') return;
  evento.respondWith(caches.match(evento.request).then(guardado => guardado || fetch(evento.request)));
});
```

- [ ] **Passo 6: Verificar**

Recarregar `http://localhost:8081/?sim=1`: sem erros no console (o SW **não** registra em `http://`, isso é esperado). Conferir com `read_network_requests` que `manifest.webmanifest` e `icone.svg` retornam 200. A verificação do SW e da instalação só acontece depois de publicar em HTTPS (Tarefa 16).

- [ ] **Passo 7: Commit**

```bash
git add B1-Amicao/app ferramentas
git commit -m "feat(b1-app): PWA instalavel (manifest, service worker, icones)"
```


---

## PARTE 2 — App B2 Anjos da Estrada

### Tarefa 9: B2 `protocolo.js` e `faixas.js` com testes

**Arquivos:**
- Criar: `B2-AnjosDaEstrada/app/package.json`, `js/protocolo.js`, `js/faixas.js`, `teste/protocolo.test.js`, `teste/faixas.test.js`

**Interfaces:**
- Produz (`protocolo.js`): `lerLinha`, `LinhaBuffer`, `quebrarEmBlocos` (iguais aos do B1, copiados) e `lerLeitura(objeto): Leitura | null`, onde
  `Leitura = { frente_esq, frente_dir, tras_esq, tras_dir: number|null, chuva: boolean, farol_e, farol_d: 'desligado'|'ok'|'queimado' }`.
- Produz (`faixas.js`):
  - constantes `DIST_ATENCAO = 15`, `DIST_CRITICO = 5`, `DIST_MINIMA_VALIDA = 2`, `BIPE_LENTO_MS = 600`, `BIPE_RAPIDO_MS = 200`, `CAMPOS_DISTANCIA`
  - `classificarDistancia(cm: number|null): 'livre'|'atencao'|'critico'`
  - `menorDistancia(leitura): number|null`
  - `intervaloBipe(cm): number` (ms)
  - `decidirSom(leitura): { tipo: 'silencio' } | { tipo: 'continuo' } | { tipo: 'bipe', intervaloMs: number }`
  - `alertasAtivos(leitura): { id: 'chuva'|'farol_e'|'farol_d', texto: string }[]`

- [ ] **Passo 1: Criar `package.json`** (igual ao do B1)

```json
{ "type": "module", "private": true }
```

- [ ] **Passo 2: Escrever os testes que falham**

`teste/protocolo.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { lerLinha, LinhaBuffer, quebrarEmBlocos, lerLeitura } from '../js/protocolo.js';

const LINHA = '{"frente_esq":12,"frente_dir":null,"tras_esq":4,"tras_dir":30,"chuva":true,"farol_e":"ok","farol_d":"queimado"}';

test('lerLeitura le a linha completa do Arduino', () => {
  assert.deepEqual(lerLeitura(lerLinha(LINHA)), {
    frente_esq: 12, frente_dir: null, tras_esq: 4, tras_dir: 30,
    chuva: true, farol_e: 'ok', farol_d: 'queimado',
  });
});

test('lerLeitura rejeita linha incompleta ou com valor invalido', () => {
  assert.equal(lerLeitura(null), null);
  assert.equal(lerLeitura({ frente_esq: 1 }), null);
  const semChuva = JSON.parse(LINHA); delete semChuva.chuva;
  assert.equal(lerLeitura(semChuva), null);
  assert.equal(lerLeitura({ ...JSON.parse(LINHA), farol_e: 'quebrou' }), null);
});

test('distancia negativa ou nao numerica vira null', () => {
  const l = lerLeitura({ ...JSON.parse(LINHA), frente_esq: -3, tras_dir: 'x' });
  assert.equal(l.frente_esq, null);
  assert.equal(l.tras_dir, null);
});

test('LinhaBuffer junta pedacos ate o \\n', () => {
  const buffer = new LinhaBuffer();
  assert.deepEqual(buffer.adicionar('{"a":'), []);
  assert.deepEqual(buffer.adicionar('1}\r\n{"b":2}\n'), ['{"a":1}', '{"b":2}']);
});

test('quebrarEmBlocos corta em 20 bytes', () => {
  assert.deepEqual(quebrarEmBlocos('x'.repeat(45)).map(b => b.length), [20, 20, 5]);
});

test('lerLinha ignora lixo', () => {
  assert.equal(lerLinha('APP> oi'), null);
  assert.equal(lerLinha('{quebrado'), null);
});
```

`teste/faixas.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { classificarDistancia, menorDistancia, intervaloBipe, decidirSom, alertasAtivos } from '../js/faixas.js';

const base = { frente_esq: null, frente_dir: null, tras_esq: null, tras_dir: null, chuva: false, farol_e: 'ok', farol_d: 'ok' };

test('limites das faixas: 15 e 5 sao atencao, 4 e critico, 16 e livre', () => {
  assert.equal(classificarDistancia(16), 'livre');
  assert.equal(classificarDistancia(15), 'atencao');
  assert.equal(classificarDistancia(5), 'atencao');
  assert.equal(classificarDistancia(4), 'critico');
  assert.equal(classificarDistancia(1), 'critico');
  assert.equal(classificarDistancia(0), 'critico');
  assert.equal(classificarDistancia(null), 'livre');
});

test('menorDistancia ignora null', () => {
  assert.equal(menorDistancia(base), null);
  assert.equal(menorDistancia({ ...base, frente_esq: 30, tras_dir: 12 }), 12);
});

test('intervaloBipe vai de 600 ms (15 cm) a 200 ms (5 cm)', () => {
  assert.equal(intervaloBipe(15), 600);
  assert.equal(intervaloBipe(10), 400);
  assert.equal(intervaloBipe(5), 200);
});

test('decidirSom segue o sensor mais proximo', () => {
  assert.deepEqual(decidirSom(base), { tipo: 'silencio' });
  assert.deepEqual(decidirSom({ ...base, tras_esq: 40 }), { tipo: 'silencio' });
  assert.deepEqual(decidirSom({ ...base, tras_esq: 10 }), { tipo: 'bipe', intervaloMs: 400 });
  assert.deepEqual(decidirSom({ ...base, tras_esq: 10, frente_dir: 3 }), { tipo: 'continuo' });
});

test('alertasAtivos: chuva e farol queimado, com o nome do item', () => {
  assert.deepEqual(alertasAtivos(base), []);
  const ativos = alertasAtivos({ ...base, chuva: true, farol_d: 'queimado' });
  assert.deepEqual(ativos.map(a => a.id), ['chuva', 'farol_d']);
  assert.equal(ativos[1].texto, 'Farol direito queimado');
});

test('farol desligado nao e alerta', () => {
  assert.deepEqual(alertasAtivos({ ...base, farol_e: 'desligado' }), []);
});
```

- [ ] **Passo 3: Rodar e ver falhar**

Rodar (em `B2-AnjosDaEstrada/app`): `node --test "teste/*.test.js"`
Esperado: FALHA com `Cannot find module`.

- [ ] **Passo 4: Implementar `js/protocolo.js`**

```js
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
```

- [ ] **Passo 5: Implementar `js/faixas.js`**

```js
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
```

- [ ] **Passo 6: Rodar e ver passar**

Rodar: `node --test "teste/*.test.js"`
Esperado: todos os testes passando.

- [ ] **Passo 7: Commit**

```bash
git add B2-AnjosDaEstrada/app
git commit -m "feat(b2-app): protocolo e faixas de proximidade com testes"
```

---

### Tarefa 10: B2 `caminhao-falso.js` com testes

**Arquivos:**
- Criar: `B2-AnjosDaEstrada/app/js/caminhao-falso.js`, `teste/caminhao-falso.test.js`

**Interfaces:**
- Produz: `class CaminhaoFalso` com construtor `({ aoLinha(texto), periodoMs = 500 })`; campos públicos `distancias` (`{frente_esq, frente_dir, tras_esq, tras_dir}`, cada um `number|null`), `chuva`, `chaveEsq`, `chaveDir`, `semLedEsq`, `semLedDir` (booleans); métodos `linha(): string`, `iniciar()`, `pausar()`, `retomar()`, `rodando: boolean`.
  Regra do farol: chave desligada = `'desligado'`; chave ligada + LED removido = `'queimado'`; chave ligada = `'ok'`.

- [ ] **Passo 1: Escrever o teste que falha** em `teste/caminhao-falso.test.js`

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { CaminhaoFalso } from '../js/caminhao-falso.js';
import { lerLinha, lerLeitura } from '../js/protocolo.js';

test('linha do estado inicial e uma leitura valida', () => {
  const falso = new CaminhaoFalso({ aoLinha: () => {} });
  assert.deepEqual(lerLeitura(lerLinha(falso.linha())), {
    frente_esq: null, frente_dir: null, tras_esq: null, tras_dir: null,
    chuva: false, farol_e: 'desligado', farol_d: 'desligado',
  });
});

test('regra do farol: chave desligada, ligada e ligada sem LED', () => {
  const falso = new CaminhaoFalso({ aoLinha: () => {} });
  falso.chaveEsq = true;
  falso.chaveDir = true;
  falso.semLedDir = true;
  const leitura = lerLeitura(lerLinha(falso.linha()));
  assert.equal(leitura.farol_e, 'ok');
  assert.equal(leitura.farol_d, 'queimado');
  falso.chaveDir = false;
  assert.equal(lerLeitura(lerLinha(falso.linha())).farol_d, 'desligado');
});

test('distancias e chuva aparecem na linha', () => {
  const falso = new CaminhaoFalso({ aoLinha: () => {} });
  falso.distancias.tras_esq = 4;
  falso.chuva = true;
  const leitura = lerLeitura(lerLinha(falso.linha()));
  assert.equal(leitura.tras_esq, 4);
  assert.equal(leitura.chuva, true);
});

test('iniciar emite linhas no periodo e pausar para', async () => {
  const linhas = [];
  const falso = new CaminhaoFalso({ aoLinha: l => linhas.push(l), periodoMs: 10 });
  falso.iniciar();
  await new Promise(ok => setTimeout(ok, 55));
  falso.pausar();
  const total = linhas.length;
  assert.ok(total >= 3, 'esperava varias linhas, veio ' + total);
  await new Promise(ok => setTimeout(ok, 40));
  assert.equal(linhas.length, total);
  assert.equal(falso.rodando, false);
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Rodar: `node --test "teste/caminhao-falso.test.js"`
Esperado: FALHA com `Cannot find module`.

- [ ] **Passo 3: Implementar `js/caminhao-falso.js`**

```js
// Faz o papel do Arduino do B2 no navegador: gera uma linha JSON a cada periodo.
// Serve para testar o app sem hardware (modo ?sim=1).
export class CaminhaoFalso {
  constructor({ aoLinha, periodoMs = 500 }) {
    this.aoLinha = aoLinha;
    this.periodoMs = periodoMs;
    this.distancias = { frente_esq: null, frente_dir: null, tras_esq: null, tras_dir: null };
    this.chuva = false;
    this.chaveEsq = false;    // chave "farol ligado"
    this.chaveDir = false;
    this.semLedEsq = false;   // LED tirado da protoboard
    this.semLedDir = false;
    this.rodando = false;
    this.temporizador = null;
  }

  static estadoDoFarol(chaveLigada, semLed) {
    if (!chaveLigada) return 'desligado';
    return semLed ? 'queimado' : 'ok';
  }

  linha() {
    return JSON.stringify({
      ...this.distancias,
      chuva: this.chuva,
      farol_e: CaminhaoFalso.estadoDoFarol(this.chaveEsq, this.semLedEsq),
      farol_d: CaminhaoFalso.estadoDoFarol(this.chaveDir, this.semLedDir),
    });
  }

  iniciar() {
    this.pausar();
    this.rodando = true;
    this.aoLinha(this.linha());
    this.temporizador = setInterval(() => this.aoLinha(this.linha()), this.periodoMs);
  }

  pausar() {
    clearInterval(this.temporizador);
    this.rodando = false;
  }

  retomar() {
    this.iniciar();
  }
}
```

- [ ] **Passo 4: Rodar e ver passar**

Rodar: `node --test "teste/*.test.js"`
Esperado: todos passando.

- [ ] **Passo 5: Commit**

```bash
git add B2-AnjosDaEstrada/app
git commit -m "feat(b2-app): caminhao falso para o simulador"
```

---

### Tarefa 11: B2 tela do caminhão, banners e simulador

**Arquivos:**
- Criar: `B2-AnjosDaEstrada/app/index.html`, `estilo.css`, `js/dom.js`, `js/ble.js`, `js/caminhao.js`, `js/tela.js`, `js/simulador.js`, `js/app.js`

**Interfaces:**
- Consome: `lerLinha`, `lerLeitura` (protocolo); `classificarDistancia`, `alertasAtivos`, `CAMPOS_DISTANCIA` (faixas); `CaminhaoFalso`.
- Produz:
  - `dom.js`: `h(tag, atributos, ...filhos)` (igual ao do B1)
  - `ble.js`: igual ao do B1 (copiar o arquivo sem alterações)
  - `caminhao.js`: `criarSvgCaminhao(): SVGElement` — contém `g#zona-<campo>` (classes `zona livre|atencao|critico|semsinal`) para os 4 campos de distância e `rect#farol_e` / `rect#farol_d` (classes `farol desligado|ok|queimado|semsinal`)
  - `tela.js`: `montarTela(raiz): { atualizar(leitura | null) }` — `null` significa sem sinal
  - `simulador.js`: `montarPainelSimulador(elemento, falso)`
  - `app.js`: liga tudo. Nesta tarefa o som ainda não existe (Tarefa 12).

- [ ] **Passo 1: Copiar `ble.js` e criar `js/dom.js`**

Copiar `B1-Amicao/app/js/ble.js` para `B2-AnjosDaEstrada/app/js/ble.js` **sem alterar nada**. Criar `js/dom.js`:

```js
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
```

- [ ] **Passo 2: Criar `js/caminhao.js`**

```js
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
```

- [ ] **Passo 3: Criar `js/tela.js`**

```js
import { h } from './dom.js';
import { criarSvgCaminhao } from './caminhao.js';
import { classificarDistancia, CAMPOS_DISTANCIA } from './faixas.js';

const TEXTO_DISTANCIA = { livre: '✔ Livre', atencao: '⚠ Atenção', critico: '⛔ CRÍTICO', semsinal: 'Sem sinal' };
const TEXTO_FAROL = { desligado: '○ Desligado', ok: '💡 Aceso', queimado: '⛔ Queimado', semsinal: 'Sem sinal' };
const TITULOS = {
  frente_esq: 'Frente esquerda', frente_dir: 'Frente direita',
  tras_esq: 'Trás esquerda', tras_dir: 'Trás direita',
};

// Cria um card com titulo, valor grande e estado (cor + icone + texto).
function criarCard(titulo) {
  const valor = h('span', { class: 'valor' }, '—');
  const estado = h('span', { class: 'estado' }, '');
  const raiz = h('div', { class: 'card semsinal' }, h('span', { class: 'titulo' }, titulo), valor, estado);
  return { raiz, valor, estado };
}

export function montarTela(raiz) {
  const svg = criarSvgCaminhao();
  const cards = {};
  for (const campo of CAMPOS_DISTANCIA) cards[campo] = criarCard(TITULOS[campo]);
  cards.farol_e = criarCard('Farol esquerdo');
  cards.farol_d = criarCard('Farol direito');
  cards.chuva = criarCard('Pista');

  raiz.replaceChildren(
    h('div', { class: 'coluna esquerda' }, cards.frente_esq.raiz, cards.farol_e.raiz, cards.tras_esq.raiz),
    h('div', { class: 'centro' }, cards.chuva.raiz, svg),
    h('div', { class: 'coluna direita' }, cards.frente_dir.raiz, cards.farol_d.raiz, cards.tras_dir.raiz),
  );

  function pintar(card, classe, textoValor, textoEstado) {
    card.raiz.className = 'card ' + classe;
    card.valor.textContent = textoValor;
    card.estado.textContent = textoEstado;
  }

  // leitura === null significa "sem sinal do caminhao".
  function atualizar(leitura) {
    for (const campo of CAMPOS_DISTANCIA) {
      const zona = svg.querySelector('#zona-' + campo);
      if (!leitura) {
        zona.setAttribute('class', 'zona semsinal');
        pintar(cards[campo], 'semsinal', '—', TEXTO_DISTANCIA.semsinal);
        continue;
      }
      const faixa = classificarDistancia(leitura[campo]);
      zona.setAttribute('class', 'zona ' + faixa);
      pintar(cards[campo], faixa, leitura[campo] === null ? '—' : leitura[campo] + ' cm', TEXTO_DISTANCIA[faixa]);
    }
    for (const [campo, lado] of [['farol_e', 'farol_e'], ['farol_d', 'farol_d']]) {
      const estado = leitura ? leitura[lado] : 'semsinal';
      svg.querySelector('#' + campo).setAttribute('class', 'farol ' + estado);
      pintar(cards[campo], estado, '', TEXTO_FAROL[estado]);
    }
    if (!leitura) pintar(cards.chuva, 'semsinal', '', 'Sem sinal');
    else if (leitura.chuva) pintar(cards.chuva, 'critico', '', '💧 MOLHADA');
    else pintar(cards.chuva, 'livre', '', '✔ Seca');
  }

  atualizar(null);
  return { atualizar };
}
```

- [ ] **Passo 4: Criar `js/simulador.js`**

```js
import { h } from './dom.js';

const CAMPOS = [
  ['frente_esq', 'Frente esq'], ['frente_dir', 'Frente dir'],
  ['tras_esq', 'Trás esq'], ['tras_dir', 'Trás dir'],
];

export function montarPainelSimulador(elemento, falso) {
  function controleDistancia([campo, rotulo]) {
    const numero = h('output', {}, 'livre');
    const barra = h('input', { type: 'range', min: '0', max: '40', value: '40' });
    barra.addEventListener('input', () => {
      const cm = Number(barra.value);
      falso.distancias[campo] = cm >= 40 ? null : cm;       // 40 = sem eco
      numero.textContent = cm >= 40 ? 'livre' : cm + ' cm';
    });
    return h('label', {}, rotulo + ' ', numero, barra);
  }

  function caixa(rotulo, campo) {
    const entrada = h('input', { type: 'checkbox' });
    entrada.addEventListener('change', () => { falso[campo] = entrada.checked; });
    return h('label', { class: 'linha' }, entrada, ' ' + rotulo);
  }

  const pausa = h('input', { type: 'checkbox' });
  pausa.addEventListener('change', () => (pausa.checked ? falso.pausar() : falso.retomar()));

  elemento.hidden = false;
  elemento.replaceChildren(
    h('strong', {}, 'Simulador (caminhão falso)'),
    ...CAMPOS.map(controleDistancia),
    caixa('Pista molhada', 'chuva'),
    caixa('Chave farol esquerdo ligada', 'chaveEsq'),
    caixa('LED esquerdo removido', 'semLedEsq'),
    caixa('Chave farol direito ligada', 'chaveDir'),
    caixa('LED direito removido', 'semLedDir'),
    h('label', { class: 'linha' }, pausa, ' Pausar (simula sem sinal)'),
  );
}
```

- [ ] **Passo 5: Criar `js/app.js`** (sem som ainda)

```js
import { lerLinha, lerLeitura } from './protocolo.js';
import { alertasAtivos } from './faixas.js';
import { criarBle } from './ble.js';
import { CaminhaoFalso } from './caminhao-falso.js';
import { montarPainelSimulador } from './simulador.js';
import { montarTela } from './tela.js';
import { h } from './dom.js';

const SEM_SINAL_MS = 3000;   // sem linha por mais de 3 s = sem comunicacao
const modoSimulador = new URLSearchParams(location.search).has('sim');

let ultimaLeitura = null;
let ultimaChegada = 0;           // 0 = nunca chegou nada
let chaveBanners = '';

const tela = montarTela(document.getElementById('painel'));
const bannersEl = document.getElementById('banners');
const botaoConectar = document.getElementById('btn-conectar');

function receberLinha(texto) {
  const leitura = lerLeitura(lerLinha(texto));
  if (!leitura) return;
  ultimaLeitura = leitura;
  ultimaChegada = performance.now();
}

function desenharBanners(lista) {
  const chave = JSON.stringify(lista);
  if (chave === chaveBanners) return;   // so redesenha se mudou (evita piscar)
  chaveBanners = chave;
  bannersEl.replaceChildren(...lista.map(item => h('div', { class: 'banner ' + item.tipo }, item.texto)));
}

// Roda varias vezes por segundo: decide o que mostrar com a ultima leitura.
function ciclo() {
  const semSinal = ultimaChegada === 0 || performance.now() - ultimaChegada > SEM_SINAL_MS;
  const leitura = semSinal ? null : ultimaLeitura;
  tela.atualizar(leitura);

  const banners = [];
  if (leitura) {
    for (const alerta of alertasAtivos(leitura)) banners.push({ tipo: 'perigo', texto: '⚠ ' + alerta.texto });
  } else if (ultimaChegada === 0) {
    banners.push({ tipo: 'aviso', texto: 'Toque em Conectar para ligar ao caminhão.' });
  } else {
    banners.push({ tipo: 'aviso', texto: 'Sem comunicação com o caminhão' });
  }
  desenharBanners(banners);
}

let falso = null;
let ble = null;

botaoConectar.addEventListener('click', async () => {
  if (modoSimulador) {
    falso.iniciar();
    botaoConectar.hidden = true;
    return;
  }
  try {
    await ble.conectar();
  } catch (erro) {
    if (erro.name !== 'NotFoundError') alert('Não consegui conectar: ' + erro.message);
  }
});

if (modoSimulador) {
  falso = new CaminhaoFalso({ aoLinha: receberLinha });
  montarPainelSimulador(document.getElementById('painel-simulador'), falso);
} else {
  ble = criarBle({
    aoLinha: receberLinha,
    aoEstado: (novo) => {
      botaoConectar.hidden = novo === 'conectado';
    },
  });
}

setInterval(ciclo, 50);
ciclo();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js');
}
```

- [ ] **Passo 6: Criar `index.html`**

```html
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#1e293b">
  <title>Anjos da Estrada</title>
  <link rel="manifest" href="manifest.webmanifest">
  <link rel="icon" href="icone.svg">
  <link rel="stylesheet" href="estilo.css">
</head>
<body>
  <header id="topo">
    <strong>🚚 Anjos da Estrada</strong>
    <span class="espaco"></span>
    <button id="btn-mudo" type="button" aria-pressed="false">🔊 Som ligado</button>
    <button id="btn-conectar" type="button">Conectar</button>
  </header>
  <div id="banners" role="alert"></div>
  <main id="painel"></main>
  <aside id="painel-simulador" hidden></aside>
  <script type="module" src="js/app.js"></script>
</body>
</html>
```

- [ ] **Passo 7: Criar `estilo.css`**

```css
:root {
  --fundo: #0f172a; --painel: #1e293b; --texto: #f1f5f9;
  --livre: #22c55e; --atencao: #f59e0b; --critico: #ef4444; --apagado: #64748b;
}
* { box-sizing: border-box; }
html, body { height: 100%; margin: 0; }
body { display: flex; flex-direction: column; font-family: system-ui, sans-serif; background: var(--fundo); color: var(--texto); }
#topo { display: flex; align-items: center; gap: 12px; padding: 8px 16px; background: var(--painel); font-size: 1.2rem; }
.espaco { flex: 1; }
button { font: inherit; padding: 10px 18px; border: 0; border-radius: 10px; background: #3b82f6; color: #fff; min-height: 44px; cursor: pointer; }
#banners { display: flex; flex-direction: column; gap: 6px; padding: 0 16px; }
.banner { margin-top: 8px; padding: 14px 18px; border-radius: 12px; font-size: 1.5rem; font-weight: 700; }
.banner.perigo { background: var(--critico); color: #fff; }
.banner.aviso { background: #78350f; color: #fde68a; }
#painel { flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr minmax(220px, 30vw) 1fr; gap: 16px; padding: 12px 16px; }
.coluna { display: flex; flex-direction: column; justify-content: space-between; gap: 12px; }
.centro { display: flex; flex-direction: column; align-items: center; gap: 8px; min-height: 0; }
.centro .card { width: 100%; }
.caminhao { flex: 1; min-height: 0; width: 100%; }
.card { background: var(--painel); border-left: 10px solid var(--apagado); border-radius: 14px; padding: 12px 16px; display: flex; flex-direction: column; gap: 2px; }
.card .titulo { font-size: 1.1rem; opacity: 0.85; }
.card .valor { font-size: 2.4rem; font-weight: 800; line-height: 1.1; }
.card .estado { font-size: 1.3rem; font-weight: 700; }
.card.livre, .card.ok { border-color: var(--livre); }
.card.atencao { border-color: var(--atencao); }
.card.critico, .card.queimado { border-color: var(--critico); }
.card.desligado, .card.semsinal { border-color: var(--apagado); opacity: 0.7; }
.coluna.direita .card { border-left: 0; border-right: 10px solid var(--apagado); text-align: right; }
.coluna.direita .card.livre, .coluna.direita .card.ok { border-right-color: var(--livre); }
.coluna.direita .card.atencao { border-right-color: var(--atencao); }
.coluna.direita .card.critico, .coluna.direita .card.queimado { border-right-color: var(--critico); }
.coluna.direita .card.desligado, .coluna.direita .card.semsinal { border-right-color: var(--apagado); }
.caminhao .carroceria { fill: #94a3b8; } .caminhao .cabine { fill: #cbd5e1; }
.caminhao .para-brisa { fill: #334155; } .caminhao .roda { fill: #0b1220; }
.caminhao .farol { fill: #475569; }
.caminhao .farol.ok { fill: #fde047; }
.caminhao .farol.queimado { fill: var(--critico); animation: piscar 0.8s infinite; }
.caminhao .zona path { fill: none; stroke-width: 8; stroke-linecap: round; stroke: var(--apagado); opacity: 0.35; }
.caminhao .zona.livre path { stroke: var(--livre); opacity: 0.35; }
.caminhao .zona.atencao path { stroke: var(--atencao); opacity: 1; }
.caminhao .zona.critico path { stroke: var(--critico); opacity: 1; animation: piscar 0.5s infinite; }
@keyframes piscar { 50% { opacity: 0.25; } }
#painel-simulador { position: fixed; right: 8px; bottom: 8px; width: 270px; background: #000c; color: #fff; padding: 12px; border-radius: 12px; display: flex; flex-direction: column; gap: 6px; font-size: 0.85rem; z-index: 10; }
#painel-simulador[hidden] { display: none; }
#painel-simulador input[type=range] { width: 100%; }
#painel-simulador .linha { display: flex; align-items: center; gap: 6px; }
@media (max-width: 700px) { #painel { grid-template-columns: 1fr 1fr; } .centro { grid-column: 1 / -1; order: -1; } }
```

- [ ] **Passo 8: Verificar no navegador**

`preview_start` com `name: "anjos"`; navegar para `http://localhost:8082/?sim=1` (janela larga, tipo tablet em paisagem: `resize_window` 1280×800). Conferir:
- Antes de conectar: faixa amarela "Toque em Conectar…" e cards cinzas "Sem sinal".
- Clicar em Conectar: cards viram verde "Livre"; arrastar "Trás esq" para 12 cm: card amarelo "⚠ Atenção 12 cm" e a zona do canto traseiro esquerdo do caminhão acende amarela; para 3 cm: vermelho piscando "⛔ CRÍTICO".
- "Pista molhada": banner vermelho "⚠ Pista molhada: reduza a velocidade", card "💧 MOLHADA"; desmarcar: o banner some.
- Chave esquerda ligada: "💡 Aceso" e farol amarelo; marcar "LED esquerdo removido": banner "⚠ Farol esquerdo queimado" e farol vermelho piscando; desmarcar a chave: volta a "Desligado" sem alerta.
- "Pausar": depois de 3 s aparece "Sem comunicação com o caminhão" e todos os cards ficam cinza.
- Sem erros no console. (O botão "Som ligado" ainda não faz nada; é a Tarefa 12.)

- [ ] **Passo 9: Commit**

```bash
git add B2-AnjosDaEstrada/app
git commit -m "feat(b2-app): tela do caminhao em SVG, cards, banners e simulador"
```

---

### Tarefa 12: B2 som (Web Audio) e tela sempre ligada

**Arquivos:**
- Criar: `B2-AnjosDaEstrada/app/js/som.js`
- Modificar: `B2-AnjosDaEstrada/app/js/app.js`

**Interfaces:**
- Consome: `decidirSom`, `alertasAtivos` (faixas).
- Produz: `criarSom(): { liberar(), atualizar(leitura | null), alternarMudo(): boolean }`. `atualizar` deve ser chamado a cada ciclo (50 ms) com a leitura atual (ou `null` sem sinal); toda a decisão de **quando** tocar fica em `decidirSom`/`alertasAtivos` (já testadas).

- [ ] **Passo 1: Criar `js/som.js`**

```js
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
```

- [ ] **Passo 2: Ligar o som, o botão mudo e o Wake Lock no `js/app.js`**

Acrescentar `import { criarSom } from './som.js';` junto dos outros imports. Depois da linha `const botaoConectar = ...` acrescentar:

```js
const som = criarSom();
const botaoMudo = document.getElementById('btn-mudo');
let travaTela = null;

// Mantem a tela do tablet acesa (sem isso o Android suspende o app e o som para).
async function manterTelaLigada() {
  try {
    travaTela = await navigator.wakeLock?.request('screen');
  } catch {
    travaTela = null;   // sem suporte ou negado: segue sem a trava
  }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') manterTelaLigada();
});

botaoMudo.addEventListener('click', () => {
  const mudo = som.alternarMudo();
  botaoMudo.textContent = mudo ? '🔇 Som desligado' : '🔊 Som ligado';
  botaoMudo.setAttribute('aria-pressed', String(mudo));
});
```

No início do tratador do clique de `botaoConectar` (a função `async () => { ... }`), antes do `if (modoSimulador)`, acrescentar:

```js
  som.liberar();            // o toque em "Conectar" libera o audio
  manterTelaLigada();
```

E na função `ciclo()`, logo depois de `tela.atualizar(leitura);`, acrescentar:

```js
  som.atualizar(leitura);
```

- [ ] **Passo 3: Verificar no navegador**

Em `http://localhost:8082/?sim=1`:
- Não há API pública para "ouvir" o som, então conte os osciladores criados. Com a página já aberta (sem recarregar), antes de clicar em Conectar, rodar no `javascript_tool`:

```js
window.__tons = [];
const original = AudioContext.prototype.createOscillator;
AudioContext.prototype.createOscillator = function () {
  window.__tons.push(performance.now());
  return original.call(this);
};
```
  Depois clicar em Conectar e mexer nos controles do simulador; `window.__tons.length` mostra quantos tons foram criados.
- Distância tras_esq = 12 cm: `__tons` ganha uma entrada a cada ~420 ms. 4 cm: **apenas um** oscilador novo (tom contínuo) e depois nenhum crescimento. Voltar para livre: o contínuo para.
- Marcar "Pista molhada": 2 tons imediatos e mais 2 depois de 10 s (confirmar relógio). Desmarcar e marcar de novo: toca de novo na hora.
- Botão "🔊 Som ligado" alterna para "🔇 Som desligado": nenhum oscilador novo é criado.
- Confirmar também de ouvido com o Allysom no tablet na hora do teste real (volume de mídia alto e fora do silencioso). **Isto não foi testado aqui.**

- [ ] **Passo 4: Commit**

```bash
git add B2-AnjosDaEstrada/app
git commit -m "feat(b2-app): som de alerta e proximidade, botao mudo e tela sempre ligada"
```

---

### Tarefa 13: B2 PWA (manifest, Service Worker, ícones)

**Arquivos:**
- Criar: `B2-AnjosDaEstrada/app/manifest.webmanifest`, `sw.js`, `icone.svg`
- Gerar: `icone-192.png`, `icone-512.png` (já gerados na Tarefa 8; se não existirem, rodar `python -I ferramentas/gerar_icones.py` na raiz)

- [ ] **Passo 1: Criar `B2-AnjosDaEstrada/app/icone.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="20" fill="#1e293b"/>
  <rect x="36" y="20" width="28" height="18" rx="4" fill="#f59e0b"/>
  <rect x="33" y="40" width="34" height="40" rx="3" fill="#e2e8f0"/>
</svg>
```

- [ ] **Passo 2: Criar `manifest.webmanifest`**

```json
{
  "name": "Anjos da Estrada",
  "short_name": "Anjos",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "orientation": "landscape",
  "background_color": "#0f172a",
  "theme_color": "#1e293b",
  "icons": [
    { "src": "icone-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icone-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

- [ ] **Passo 3: Criar `sw.js`**

```js
// Guarda os arquivos do app para abrir sem internet.
// Ao publicar uma versao nova, troque o numero em VERSAO.
const VERSAO = 'anjos-v1';
const ARQUIVOS = [
  './', 'index.html', 'estilo.css', 'manifest.webmanifest', 'icone.svg', 'icone-192.png', 'icone-512.png',
  'js/app.js', 'js/ble.js', 'js/dom.js', 'js/protocolo.js', 'js/faixas.js', 'js/caminhao.js',
  'js/caminhao-falso.js', 'js/tela.js', 'js/som.js', 'js/simulador.js',
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(caches.open(VERSAO).then(cache => cache.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then(nomes => Promise.all(nomes.filter(n => n !== VERSAO).map(n => caches.delete(n))))
      .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (evento) => {
  if (evento.request.method !== 'GET') return;
  evento.respondWith(caches.match(evento.request).then(guardado => guardado || fetch(evento.request)));
});
```

- [ ] **Passo 4: Verificar**

Recarregar `http://localhost:8082/?sim=1`: sem erros no console; `manifest.webmanifest` e `icone.svg` com status 200 (`read_network_requests`). Abrir `icone-512.png` com Read: caminhão laranja e cinza sobre fundo azul. A instalação no tablet só se verifica depois de publicar em HTTPS (Tarefa 16).

- [ ] **Passo 5: Rodar todos os testes dos dois apps**

```bash
cd B1-Amicao/app && node --test "teste/*.test.js"
cd ../../B2-AnjosDaEstrada/app && node --test "teste/*.test.js"
```
Esperado: tudo passando nos dois.

- [ ] **Passo 6: Commit**

```bash
git add B2-AnjosDaEstrada/app
git commit -m "feat(b2-app): PWA instalavel"
```

---

## PARTE 3 — Firmware

> `arduino-cli` **não estava no PATH** quando este plano foi escrito (os `build/` existem, então já funcionou nesta máquina). Antes das Tarefas 14 e 15, localizar o executável seguindo o `SETUP.md` (ex.: pasta de instalação do Arduino CLI) e usar o caminho completo, ou abrir um terminal novo. `wokwi-cli` versão 0.28.1 está disponível. Bibliotecas já usadas pelo B1: MFRC522, HX711, Stepper, LiquidCrystal_I2C, SoftwareSerial (padrão). O B2 passa a usar também `SoftwareSerial`; **nenhuma biblioteca nova** (o INA219 é lido direto pelo I2C).

### Tarefa 14: Firmware B1 (HM-10, EEPROM, modo cadastro)

**Arquivos:**
- Modificar: `B1-Amicao/B1-Amicao.ino`, `B1-Amicao/diagram.json` (só o rótulo do módulo Bluetooth, se existir), `B1-Amicao/cenario.yaml`

**Interfaces:**
- Consome (do app): `{"cmd":"cadastrar"}`, `{"cmd":"cancelar"}`, `{"cmd":"listar"}`, `{"cmd":"permitir","uid":"..","nome":".."}`, `{"cmd":"remover","uid":".."}` — uma por linha, pelo HM-10 (e, só com `SIMULACAO 1`, também pelo Serial USB, para testar no Wokwi).
- Produz (para o app): os eventos da spec, incluindo `modo_cadastro`, `tag_lida` e `cadastros`.
- Regras: tag fora da lista e fora do modo cadastro **não gera nada** (nem LCD, nem ração, nem Serial). Modo cadastro: 30 s, termina ao ler uma tag, ao receber `cancelar` ou ao expirar.

- [ ] **Passo 1: Compilar o estado atual (linha de base)**

```bash
cd B1-Amicao
arduino-cli compile --fqbn arduino:avr:uno --output-dir build .
```
Esperado: compila. Anotar "Global variables use N bytes" para comparar depois.

- [ ] **Passo 2: Cabeçalho, include e comentários do HM-10**

Em `B1-Amicao.ino`:
- Na linha do comentário `- Bluetooth HC-06 .... manda cada evento pro app no tablet` trocar por `- Bluetooth HM-10 .... (BLE) manda cada evento pro app no tablet e recebe comandos do app`.
- Depois de `#include <SoftwareSerial.h>` acrescentar `#include <EEPROM.h>`.
- Nos pinos, trocar os comentários: `const int PINO_BT_RX = 2;   // recebe do TXD do HM-10` e `const int PINO_BT_TX = A3;  // envia pro RXD do HM-10 (com divisor de tensao 1k/2k!)`.
- Em `setup()`, trocar o comentário `// velocidade padrao do HC-06` por `// velocidade padrao do HM-10`.

- [ ] **Passo 3: Trocar a lista fixa de cachorros pela lista na EEPROM**

Apagar todo o bloco de `// ---------------- CACHORROS CONHECIDOS ----------------` até a linha `Cachorro desconhecido = { "", "Novo amigo", 0, false };` (inclusive: `struct Cachorro`, `cachorros[]`, `TOTAL_CACHORROS`, `desconhecido`) e colocar no lugar:

```cpp
// ---------------- TAGS AUTORIZADAS (EEPROM) ----------------
// Quem cadastra e o app. O Arduino so guarda a lista pra saber quem pode comer.
// Cada "slot" da EEPROM: [tamanho do UID][UID, ate 7 bytes][nome, ate 10 letras]
const int MAX_TAGS   = 10;
const int TAM_UID    = 7;                          // tags NFC tem UID de 4 ou 7 bytes
const int TAM_NOME   = 10;                         // aparece no LCD (sem acento)
const int TAM_SLOT   = 1 + TAM_UID + TAM_NOME;     // 18 bytes por tag
const int END_MAGICA = 0;                          // endereco do marcador "EEPROM preparada"
const int END_SLOTS  = 1;                          // onde comecam os slots
const byte MAGICA    = 0xA5;
const unsigned long DURACAO_CADASTRO = 30000UL;    // o modo cadastro dura 30 s

unsigned long ultimaPorcao[MAX_TAGS];
bool jaComeu[MAX_TAGS];
bool modoCadastro = false;
unsigned long inicioCadastro = 0;
```

- [ ] **Passo 4: Declarar os objetos antes das funções novas e escrever as funções da EEPROM**

Logo depois do bloco `// ---------------- OBJETOS ----------------` e das variáveis `bombaLigada` ... `momentoUltimoUid`, e **depois** da função `enviarParaApp` (que já existe), acrescentar:

```cpp
// ---------------- LISTA DE TAGS NA EEPROM ----------------
int enderecoSlot(int i) { return END_SLOTS + i * TAM_SLOT; }

bool slotOcupado(int i) {
  byte tamanho = EEPROM.read(enderecoSlot(i));
  return tamanho == 4 || tamanho == 7;
}

// Na primeira vez que o Arduino liga, a EEPROM vem cheia de 0xFF: marca todos os slots como livres.
void prepararEeprom() {
  if (EEPROM.read(END_MAGICA) == MAGICA) return;
  for (int i = 0; i < MAX_TAGS; i++) EEPROM.update(enderecoSlot(i), 0);
  EEPROM.update(END_MAGICA, MAGICA);
}

String uidDoSlot(int i) {
  int inicio = enderecoSlot(i);
  byte tamanho = EEPROM.read(inicio);
  String uid = "";
  for (byte b = 0; b < tamanho; b++) {
    byte valor = EEPROM.read(inicio + 1 + b);
    if (valor < 0x10) uid += "0";
    uid += String(valor, HEX);
    if (b < tamanho - 1) uid += ":";
  }
  uid.toUpperCase();
  return uid;
}

String nomeDoSlot(int i) {
  String nome = "";
  int inicio = enderecoSlot(i) + 1 + TAM_UID;
  for (int b = 0; b < TAM_NOME; b++) {
    char letra = EEPROM.read(inicio + b);
    if (letra == 0) break;
    nome += letra;
  }
  return nome;
}

int procurarSlot(const String& uid) {
  for (int i = 0; i < MAX_TAGS; i++) {
    if (slotOcupado(i) && uidDoSlot(i) == uid) return i;
  }
  return -1;
}

int slotLivre() {
  for (int i = 0; i < MAX_TAGS; i++) {
    if (!slotOcupado(i)) return i;
  }
  return -1;
}

// Converte "0A:0B:0C:0D" em bytes. Devolve o tamanho (4 ou 7), ou 0 se o texto for invalido.
byte textoParaUid(const char* texto, byte* bytes) {
  byte quantos = 0;
  const char* p = texto;
  while (quantos < TAM_UID) {
    if (!isxdigit(p[0]) || !isxdigit(p[1])) return 0;
    char dupla[3] = { p[0], p[1], 0 };
    bytes[quantos++] = (byte) strtol(dupla, NULL, 16);
    p += 2;
    if (*p == ':') p++;
    else break;
  }
  if (*p != 0) return 0;
  return (quantos == 4 || quantos == 7) ? quantos : 0;
}

void gravarTag(const char* uidTexto, const char* nome) {
  byte bytes[TAM_UID];
  byte tamanho = textoParaUid(uidTexto, bytes);
  if (tamanho == 0) return;

  String uid = String(uidTexto);
  uid.toUpperCase();
  int slot = procurarSlot(uid);
  if (slot < 0) slot = slotLivre();
  if (slot < 0) return;   // lista cheia

  int inicio = enderecoSlot(slot);
  int tamanhoNome = strlen(nome);
  EEPROM.update(inicio, tamanho);
  for (byte b = 0; b < TAM_UID; b++) EEPROM.update(inicio + 1 + b, b < tamanho ? bytes[b] : 0);
  for (int b = 0; b < TAM_NOME; b++) EEPROM.update(inicio + 1 + TAM_UID + b, b < tamanhoNome ? nome[b] : 0);
  jaComeu[slot] = false;
  ultimaPorcao[slot] = 0;
}

void apagarTag(const char* uidTexto) {
  String uid = String(uidTexto);
  uid.toUpperCase();
  int slot = procurarSlot(uid);
  if (slot >= 0) EEPROM.update(enderecoSlot(slot), 0);
}

// Manda a lista inteira pro app, aos pedacos (montar tudo numa String gastaria a RAM).
void escrever(const __FlashStringHelper* texto) { Serial.print(texto); bluetooth.print(texto); }
void escrever(const String& texto) { Serial.print(texto); bluetooth.print(texto); }

void enviarCadastros() {
  Serial.print(F("APP> "));
  escrever(F("{\"evento\":\"cadastros\",\"uids\":["));
  bool primeiro = true;
  for (int i = 0; i < MAX_TAGS; i++) {
    if (!slotOcupado(i)) continue;
    if (!primeiro) escrever(F(","));
    primeiro = false;
    escrever(F("\""));
    escrever(uidDoSlot(i));
    escrever(F("\""));
  }
  Serial.println(F("]}"));
  bluetooth.println(F("]}"));
}
```

- [ ] **Passo 5: Remover `procurarCachorro` e acrescentar modo cadastro e leitura de comandos**

Apagar a função antiga `Cachorro* procurarCachorro(String uid) { ... }`. Depois de `telaInicial()` acrescentar (e antes de `atenderCachorro`):

```cpp
// ---------------- MODO CADASTRO ----------------
void ligarModoCadastro() {
  modoCadastro = true;
  inicioCadastro = millis();
  enviarParaApp(F("{\"evento\":\"modo_cadastro\",\"ativo\":true}"));
  mostrar("Modo cadastro", "Encoste a tag");
}

void desligarModoCadastro() {
  if (!modoCadastro) return;
  modoCadastro = false;
  enviarParaApp(F("{\"evento\":\"modo_cadastro\",\"ativo\":false}"));
}

// ---------------- COMANDOS DO APP ----------------
// Cada comando e uma linha JSON. Nao usamos biblioteca de JSON (a RAM do Uno e pequena):
// procuramos o texto  "chave":"valor"  direto na linha.
bool extrairTexto(const char* linha, const char* chave, char* saida, int maximo) {
  char procurado[16];
  snprintf(procurado, sizeof(procurado), "\"%s\":\"", chave);
  const char* inicio = strstr(linha, procurado);
  if (!inicio) return false;
  inicio += strlen(procurado);
  int n = 0;
  while (*inicio && *inicio != '"' && n < maximo - 1) saida[n++] = *inicio++;
  saida[n] = 0;
  return true;
}

void tratarComando(const char* linha) {
  char comando[12], uid[24], nome[TAM_NOME + 1];
  if (!extrairTexto(linha, "cmd", comando, sizeof(comando))) return;

  if (strcmp(comando, "cadastrar") == 0) {
    ligarModoCadastro();
  } else if (strcmp(comando, "cancelar") == 0) {
    desligarModoCadastro();
  } else if (strcmp(comando, "listar") == 0) {
    enviarCadastros();
  } else if (strcmp(comando, "permitir") == 0 && extrairTexto(linha, "uid", uid, sizeof(uid))) {
    if (!extrairTexto(linha, "nome", nome, sizeof(nome))) nome[0] = 0;
    gravarTag(uid, nome);
    enviarCadastros();
  } else if (strcmp(comando, "remover") == 0 && extrairTexto(linha, "uid", uid, sizeof(uid))) {
    apagarTag(uid);
    enviarCadastros();
  }
}

char linhaApp[80];
int tamanhoLinhaApp = 0;
#if SIMULACAO
char linhaUsb[80];          // no Wokwi os comandos chegam pelo Serial, ja que nao ha HM-10
int tamanhoLinhaUsb = 0;
#endif

// Le caracteres ate o \n e entrega a linha pronta pra tratarComando.
void juntarLinha(Stream& origem, char* buffer, int& tamanho) {
  while (origem.available()) {
    char c = origem.read();
    if (c == '\n') {
      buffer[tamanho] = 0;
      if (tamanho > 0) tratarComando(buffer);
      tamanho = 0;
    } else if (c != '\r') {
      if (tamanho < 79) buffer[tamanho++] = c;
      else tamanho = 0;     // linha grande demais: joga fora
    }
  }
}

void lerComandos() {
  juntarLinha(bluetooth, linhaApp, tamanhoLinhaApp);
#if SIMULACAO
  juntarLinha(Serial, linhaUsb, tamanhoLinhaUsb);
#endif
}
```

Em `telaInicial()`, na primeira linha da função acrescentar:

```cpp
  if (modoCadastro) {
    mostrar("Modo cadastro", "Encoste a tag");
    return;
  }
```

- [ ] **Passo 6: Trocar `atenderCachorro` para usar o slot**

Substituir a função inteira por:

```cpp
void atenderCachorro(int slot, String uid) {
  String nome = nomeDoSlot(slot);

  mostrar("Ola, " + nome + "!", "Pesando...");
  delay(TEMPO_PESAGEM);  // espera o cachorro se acomodar na balanca

  float peso = balanca.get_units(10);  // media de 10 leituras
  bool pesoValido = peso >= PESO_MINIMO_KG;

  bool podeComer = !jaComeu[slot] || (millis() - ultimaPorcao[slot] >= INTERVALO_RACAO);
  if (podeComer) {
    mostrar(nome + " " + (pesoValido ? String(peso, 1) + "kg" : "?kg"), "Soltando racao");
    soltarRacao();
    ultimaPorcao[slot] = millis();
    jaComeu[slot] = true;
  } else {
    mostrar(nome + " " + (pesoValido ? String(peso, 1) + "kg" : "?kg"), "Ja comeu, volte!");
  }

  String json = "{\"evento\":\"visita\",\"uid\":\"" + uid + "\"";
  json += ",\"peso_kg\":" + (pesoValido ? String(peso, 1) : String("null"));
  json += ",\"racao\":" + String(podeComer ? "true" : "false") + "}";
  enviarParaApp(json);

  delay(TEMPO_MENSAGEM);
}
```

- [ ] **Passo 7: `setup()` e `loop()`**

Em `setup()`, depois de `bluetooth.begin(9600);` acrescentar `prepararEeprom();`.

Substituir `loop()` inteiro por:

```cpp
void loop() {
  controlarAgua();
  lerComandos();

  if (modoCadastro && millis() - inicioCadastro > DURACAO_CADASTRO) {
    desligarModoCadastro();
  }

  if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
    String uid = lerUid();
    rfid.PICC_HaltA();

    if (modoCadastro) {
      // Qualquer tag vale: o app decide o nome e manda "permitir"
      enviarParaApp("{\"evento\":\"tag_lida\",\"uid\":\"" + uid + "\"}");
      desligarModoCadastro();
    } else {
      int slot = procurarSlot(uid);
      // ignora a mesma tag lida de novo logo em seguida
      bool repetida = (uid == ultimoUid) && (millis() - momentoUltimoUid < JANELA_TAG_REPETIDA);
      if (slot >= 0 && !repetida) {
        atenderCachorro(slot, uid);
        ultimoUid = uid;
        momentoUltimoUid = millis();
      }
      // tag que nao esta na lista: nada acontece
    }
  }

  telaInicial();
  delay(200);
}
```

- [ ] **Passo 8: Compilar e conferir a RAM**

```bash
arduino-cli compile --fqbn arduino:avr:uno --output-dir build .
```
Esperado: compila sem erros. Conferir `Global variables use N bytes (X%)`: se passar de **~75%** da RAM (1536 bytes), reduzir `linhaUsb`/`linhaApp` para 64 bytes e `MAX_TAGS` não muda (é da spec). Anotar o número final na mensagem de commit.

- [ ] **Passo 9: Atualizar `cenario.yaml` e simular no Wokwi**

Ler `B1-Amicao/cenario.yaml` para seguir o formato do cenário existente (passos de `set-control`, `write-serial`, `wait-serial`, `delay`). Acrescentar cenários que verifiquem, **nesta ordem**:
1. Passar a tag `0A:0B:0C:0D` (Blue Card) sem cadastro: **nenhuma** linha `APP>` nova aparece e o LCD continua em "AMICAO" (esperar ~2 s sem `wait-serial` bem-sucedido).
2. Escrever no Serial `{"cmd":"cadastrar"}` + `\n`: sai `APP> {"evento":"modo_cadastro","ativo":true}`.
3. Passar a tag: sai `{"evento":"tag_lida","uid":"0A:0B:0C:0D"}` e depois `{"evento":"modo_cadastro","ativo":false}`.
4. Escrever `{"cmd":"permitir","uid":"0A:0B:0C:0D","nome":"Rex"}`: sai `{"evento":"cadastros","uids":["0A:0B:0C:0D"]}`.
5. Passar a tag: sai `{"evento":"visita","uid":"0A:0B:0C:0D","peso_kg":...,"racao":true}` e o LCD mostra "Ola, Rex!".
6. Escrever `{"cmd":"remover","uid":"0A:0B:0C:0D"}`: sai `cadastros` com `uids` vazio; passar a tag de novo não gera nada.

Rodar: `wokwi-cli --timeout 60000 .` (aumentar o timeout para o cenário completo) e conferir que cada `wait-serial` passa. Se o Wokwi não permitir injetar a tag pelo cenário, usar as ferramentas `mcp__wokwi__wokwi_set_control` e `mcp__wokwi__wokwi_write_serial` para repetir os seis passos manualmente e registrar o resultado. Salvar um print em `B1-Amicao/prints/b1-5-cadastro.png` com `wokwi_take_screenshot`.

- [ ] **Passo 10: Atualizar o `diagram.json` se houver módulo Bluetooth**

Procurar por `hc-06`/`HC-06` em `diagram.json`. Se houver só um `wokwi-text` de dublê, trocar o texto para `HM-10 (Serial: APP>)`. Nenhuma conexão muda (mesmos pinos D2/A3).

- [ ] **Passo 11: Commit**

```bash
git add B1-Amicao
git commit -m "feat(b1-firmware): HM-10, lista de tags na EEPROM e modo cadastro"
```

---

### Tarefa 15: Firmware B2 (4 sensores, lâmpadas com corrente, JSON)

**Arquivos:**
- Modificar (reescrever): `B2-AnjosDaEstrada/B2-AnjosDaEstrada.ino`
- Modificar: `B2-AnjosDaEstrada/diagram.json`, `B2-AnjosDaEstrada/cenario.yaml`, `B2-AnjosDaEstrada/cenario-distancia.yaml`

**Interfaces:**
- Produz: uma linha a cada ~500 ms, no Serial (com prefixo `APP> `) e no HM-10 (sem prefixo):
  `{"frente_esq":12,"frente_dir":null,"tras_esq":4,"tras_dir":30,"chuva":true,"farol_e":"ok","farol_d":"queimado"}`
- Plano de pinos (da spec): HM-10 RX D2 / TX D3; HC-SR04 frente esq TRIG 4 ECHO 5, frente dir 6/7, trás esq 8/9, trás dir 10/11; LED de alerta D12; FC-37 A0; chave esquerda A1; chave direita A2; I2C A4/A5 (LCD 0x27, INA219 0x40 e 0x41). Livres: D13 e A3. **No Wokwi** (`SIMULACAO 1`) D13 e A3 viram as chaves "LED removido", porque o Wokwi não tem INA219.

- [ ] **Passo 1: Compilar o estado atual (linha de base)**

```bash
cd B2-AnjosDaEstrada
arduino-cli compile --fqbn arduino:avr:uno --output-dir build .
```
Esperado: compila.

- [ ] **Passo 2: Substituir o arquivo inteiro `B2-AnjosDaEstrada.ino`**

```cpp
/*
  ANJOS DA ESTRADA — BITMAKERS B2
  Console de seguranca para veiculos antigos.

  Sensores:
    - 4 x HC-SR04 ........ proximidade: frente esquerda/direita e tras esquerda/direita
    - FC-37 .............. pista molhada   (no Wokwi: potenciometro)
    - 2 x chave + LED + INA219 .. farois. Chave ligada e sem corrente no LED = farol queimado
  Saidas:
    - LCD 16x2 I2C ....... console do motorista
    - LED ................ alerta
    - Bluetooth HM-10 .... manda tudo pro app no tablet (o som fica no app)

  O codigo e o MESMO no Wokwi e na montagem real; so muda SIMULACAO.
  Na montagem real, abra o Monitor Serial e ajuste os LIMITES abaixo
  olhando os valores que os sensores de verdade mostram.
*/

#define SIMULACAO 1   // 1 = Wokwi   |   0 = montagem real

#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <SoftwareSerial.h>

// ---------------- PINOS ----------------
const int PINO_BT_RX = 2;   // TXD do HM-10 (o B2 so envia, mas o pino fica reservado)
const int PINO_BT_TX = 3;   // RXD do HM-10 (com divisor de tensao 1k/2k!)

// Sensores de proximidade, na ordem: 0 frente esq, 1 frente dir, 2 tras esq, 3 tras dir
const int PINOS_TRIG[4] = { 4, 6, 8, 10 };
const int PINOS_ECHO[4] = { 5, 7, 9, 11 };

const int PINO_LED       = 12;  // LED de alerta
const int PINO_CHUVA     = A0;  // FC-37 AO
const int PINO_CHAVE_ESQ = A1;  // chave do farol esquerdo (HIGH = ligada)
const int PINO_CHAVE_DIR = A2;  // chave do farol direito  (HIGH = ligada)

#if SIMULACAO
  const int PINO_SEM_LED_ESQ = 13;  // Wokwi: chave "LED esquerdo removido" (LOW = removido)
  const int PINO_SEM_LED_DIR = A3;  // Wokwi: chave "LED direito removido"  (LOW = removido)
#else
  const byte ENDERECO_INA_ESQ = 0x40;  // INA219 do farol esquerdo
  const byte ENDERECO_INA_DIR = 0x41;  // INA219 do farol direito (jumper A0 soldado)
#endif

// ---------------- AJUSTES ----------------
const int   DIST_ATENCAO_CM = 15;    // de 15 a 5 cm: atencao (escala de prototipo; no caminhao real, x10)
const int   DIST_CRITICO_CM = 5;     // abaixo de 5 cm: critico
const int   LIMITE_CHUVA    = 500;   // FC-37: valor CAI quando molha. Abaixo = molhado
const float LIMIAR_CORRENTE_MA = 3.0;  // chave ligada e corrente abaixo disso = LED queimado/removido
const int   LEITURAS_PARA_QUEIMADO = 3;  // leituras seguidas sem corrente antes de avisar
const unsigned long TEMPO_ECO_US = 25000UL;  // espera o eco por 25 ms (cerca de 4 m)

const char* NOMES_CURTOS[4] = { "F.Esq", "F.Dir", "T.Esq", "T.Dir" };
const char* CHAVES_JSON[4]  = { "frente_esq", "frente_dir", "tras_esq", "tras_dir" };

LiquidCrystal_I2C lcd(0x27, 16, 2);
SoftwareSerial bluetooth(PINO_BT_RX, PINO_BT_TX);

int distancia[4];                  // em cm; -1 = sem eco
int leiturasSemCorrente[2] = { 0, 0 };
float correnteMa[2] = { 0, 0 };    // so para mostrar no Serial

// ---------------- DISTANCIA ----------------
// Mede a distancia em cm. Retorna -1 se nao voltou eco.
int medirCm(int sensor) {
  digitalWrite(PINOS_TRIG[sensor], LOW);
  delayMicroseconds(2);
  digitalWrite(PINOS_TRIG[sensor], HIGH);
  delayMicroseconds(10);
  digitalWrite(PINOS_TRIG[sensor], LOW);
  long duracao = pulseIn(PINOS_ECHO[sensor], HIGH, TEMPO_ECO_US);
  if (duracao == 0) return -1;
  return duracao / 58;
}

// Indice do sensor com o objeto mais perto, ou -1 se nenhum viu nada.
int sensorMaisPerto() {
  int melhor = -1;
  for (int i = 0; i < 4; i++) {
    if (distancia[i] >= 0 && (melhor < 0 || distancia[i] < distancia[melhor])) melhor = i;
  }
  return melhor;
}

// ---------------- FAROIS ----------------
// Corrente do LED do farol, em mA. lado: 0 = esquerdo, 1 = direito.
float lerCorrenteMa(int lado) {
#if SIMULACAO
  // O Wokwi nao tem INA219: uma chave faz o papel do LED tirado da protoboard.
  bool removido = digitalRead(lado == 0 ? PINO_SEM_LED_ESQ : PINO_SEM_LED_DIR) == LOW;
  return removido ? 0.0 : 13.0;
#else
  byte endereco = (lado == 0) ? ENDERECO_INA_ESQ : ENDERECO_INA_DIR;
  Wire.beginTransmission(endereco);
  Wire.write(0x01);                                // registrador da tensao no resistor shunt
  if (Wire.endTransmission() != 0) return 0.0;     // INA219 nao respondeu: trata como sem corrente
  if (Wire.requestFrom(endereco, (byte)2) != 2) return 0.0;
  byte alto = Wire.read();
  byte baixo = Wire.read();
  int bruto = (int16_t)((alto << 8) | baixo);
  return bruto * 0.1;   // cada unidade = 10 uV; com shunt de 0,1 ohm isso vale 0,1 mA
#endif
}

// "desligado", "ok" ou "queimado". Queimado = chave ligada e sem corrente varias leituras seguidas.
const char* estadoFarol(int lado) {
  bool ligada = digitalRead(lado == 0 ? PINO_CHAVE_ESQ : PINO_CHAVE_DIR) == HIGH;
  if (!ligada) {
    leiturasSemCorrente[lado] = 0;
    correnteMa[lado] = 0;
    return "desligado";
  }
  correnteMa[lado] = lerCorrenteMa(lado);
  if (correnteMa[lado] < LIMIAR_CORRENTE_MA) {
    if (leiturasSemCorrente[lado] < 100) leiturasSemCorrente[lado]++;
  } else {
    leiturasSemCorrente[lado] = 0;
  }
  return leiturasSemCorrente[lado] >= LEITURAS_PARA_QUEIMADO ? "queimado" : "ok";
}

// ---------------- LCD ----------------
// Escreve uma linha inteira no LCD (completa com espacos pra apagar o resto)
void escreverLinha(int linha, String texto) {
  while (texto.length() < 16) texto += " ";
  lcd.setCursor(0, linha);
  lcd.print(texto);
}

void mostrar(String linha1, String linha2) {
  escreverLinha(0, linha1);
  escreverLinha(1, linha2);
}

// ---------------- ENVIO PRO APP ----------------
// Imprime a leitura como UMA linha de JSON. Funciona com Serial e com o Bluetooth.
void imprimirLeitura(Print& saida, bool chuva, const char* farolE, const char* farolD) {
  saida.print('{');
  for (int i = 0; i < 4; i++) {
    saida.print('"');
    saida.print(CHAVES_JSON[i]);
    saida.print(F("\":"));
    if (distancia[i] < 0) saida.print(F("null"));
    else saida.print(distancia[i]);
    saida.print(',');
  }
  saida.print(F("\"chuva\":"));
  saida.print(chuva ? F("true") : F("false"));
  saida.print(F(",\"farol_e\":\""));
  saida.print(farolE);
  saida.print(F("\",\"farol_d\":\""));
  saida.print(farolD);
  saida.println(F("\"}"));
}

void setup() {
  Serial.begin(9600);
  bluetooth.begin(9600);   // velocidade padrao do HM-10
  Wire.begin();

  for (int i = 0; i < 4; i++) {
    pinMode(PINOS_TRIG[i], OUTPUT);
    pinMode(PINOS_ECHO[i], INPUT);
  }
  pinMode(PINO_LED, OUTPUT);
  pinMode(PINO_CHAVE_ESQ, INPUT);   // a chave tem resistor de 10k pro GND
  pinMode(PINO_CHAVE_DIR, INPUT);
#if SIMULACAO
  pinMode(PINO_SEM_LED_ESQ, INPUT_PULLUP);
  pinMode(PINO_SEM_LED_DIR, INPUT_PULLUP);
#endif

  lcd.init();
  lcd.backlight();
  mostrar("ANJOS DA ESTRADA", "Iniciando...");
  delay(1500);
}

void loop() {
  // 1. LER OS SENSORES (um de cada vez, pra um sensor nao ouvir o eco do outro)
  for (int i = 0; i < 4; i++) {
    distancia[i] = medirCm(i);
    delay(50);
  }
  int chuvaBruto = analogRead(PINO_CHUVA);
  bool chuva = chuvaBruto < LIMITE_CHUVA;
  const char* farolE = estadoFarol(0);
  const char* farolD = estadoFarol(1);
  bool queimadoE = strcmp(farolE, "queimado") == 0;
  bool queimadoD = strcmp(farolD, "queimado") == 0;

  int perto = sensorMaisPerto();
  bool critico = perto >= 0 && distancia[perto] < DIST_CRITICO_CM;
  bool atencao = perto >= 0 && distancia[perto] <= DIST_ATENCAO_CM && !critico;

  // 2. DECIDIR O QUE MOSTRAR (do mais urgente pro menos urgente)
  if (critico) {
    mostrar("!! CRITICO !!", String(NOMES_CURTOS[perto]) + " " + String(distancia[perto]) + " cm");
  } else if (atencao) {
    mostrar("ATENCAO", String(NOMES_CURTOS[perto]) + " " + String(distancia[perto]) + " cm");
  } else if (queimadoE || queimadoD) {
    mostrar("FAROL QUEIMADO", queimadoE && queimadoD ? "Esq e Dir" : (queimadoE ? "Esquerdo" : "Direito"));
  } else if (chuva) {
    mostrar("PISTA MOLHADA", "Reduza velocidade");
  } else {
    mostrar("ANJOS DA ESTRADA", "Tudo OK");
  }

  // 3. LED DE ALERTA (o som e feito pelo app no tablet)
  digitalWrite(PINO_LED, (critico || atencao || queimadoE || queimadoD || chuva) ? HIGH : LOW);

  // 4. ENVIAR PRO APP (Serial com "APP> " e Bluetooth)
  Serial.print(F("APP> "));
  imprimirLeitura(Serial, chuva, farolE, farolD);
  imprimirLeitura(bluetooth, chuva, farolE, farolD);

  // 5. VALORES BRUTOS NO MONITOR SERIAL (pra calibrar na montagem real)
  Serial.print(F("DEBUG chuva=")); Serial.print(chuvaBruto);
  Serial.print(F("  mA_esq="));    Serial.print(correnteMa[0], 1);
  Serial.print(F("  mA_dir="));    Serial.println(correnteMa[1], 1);
}
```

- [ ] **Passo 3: Compilar**

```bash
arduino-cli compile --fqbn arduino:avr:uno --output-dir build .
```
Esperado: compila. Conferir o uso de RAM (deve sobrar bem mais de 50%).

- [ ] **Passo 4: Atualizar o `diagram.json`**

Ler `B2-AnjosDaEstrada/diagram.json` e seguir o formato das peças existentes. Fazer as mudanças:
- **Remover:** potenciômetro/LDR (`photoresistor-sensor`), botão de vibração, buzzer.
- **HC-SR04:** manter o existente como "frente esq" e **acrescentar 3** (`wokwi-hc-sr04`): TRIG/ECHO nos pinos da tabela do plano (4/5, 6/7, 8/9, 10/11), VCC em 5V, GND em GND. Atenção: o HC-SR04 atual estava em 9/10; mudar para 4/5.
- **LED de alerta:** passar para D12 (era D7), mantendo o resistor de 220Ω.
- **Chuva:** potenciômetro em A0 (como estava).
- **Chaves de farol:** 2 × `wokwi-slide-switch`; cada uma liga 5V ao pino (A1 e A2) e tem um `wokwi-resistor` de 10k entre o pino e GND. Para ficar visual, cada chave também pode alimentar um LED (220Ω → LED → GND), só estético.
- **Chaves "LED removido":** 2 × `wokwi-slide-switch` ligando D13 e A3 ao GND (em cada chave, o pino comum no GND e uma saída no pino do Arduino). Etiquetar com `wokwi-text` ("LED esq removido", "LED dir removido") e etiquetar as duas chaves de farol ("Farol esq", "Farol dir") e o dublê do FC-37.
- **Bluetooth:** `wokwi-text` "HM-10 (Serial: APP>)" como no B1.
- Reposicionar para nada ficar sobreposto (checar com `wokwi_take_screenshot`).

- [ ] **Passo 5: Simular e conferir cada regra**

Ler os cenários existentes (`cenario.yaml` e `cenario-distancia.yaml`) para seguir o formato e **reescrevê-los** para o comportamento novo. Rodar `wokwi-cli --timeout 30000 .` e conferir no Serial (`APP> ...`):
1. Tudo parado: `"frente_esq":null` etc. (HC-SR04 no Wokwi sem objeto), `"chuva":false`, `"farol_e":"desligado"`, `"farol_d":"desligado"`, LCD "Tudo OK".
2. Distância de um sensor em 12 cm: JSON com `12` naquele campo e LCD "ATENCAO F.Esq 12 cm"; em 3 cm: "!! CRITICO !!".
3. Chave do farol esquerdo ligada: `"farol_e":"ok"`; ligar a chave "LED esq removido": depois de ~3 leituras `"farol_e":"queimado"` e LCD "FAROL QUEIMADO / Esquerdo"; desligar a chave do farol: `"desligado"` (sem alerta).
4. Potenciômetro abaixo de 500: `"chuva":true` e LCD "PISTA MOLHADA".
5. Cada linha `APP>` tem 4 distâncias, `chuva`, `farol_e` e `farol_d` (confirmar com `lerLeitura` do app: colar uma linha real no `node -e` com `import('./B2-AnjosDaEstrada/app/js/protocolo.js')` e conferir que não devolve `null`).
Salvar prints novos em `B2-AnjosDaEstrada/prints/` (nomes `b2-7-...png`) e apagar do disco os prints antigos que mostram impacto/pouca luz (`b2-4-...`, `b2-5-...`) **só depois de confirmar com o Allysom**.

- [ ] **Passo 6: Commit**

```bash
git add B2-AnjosDaEstrada
git commit -m "feat(b2-firmware): 4 sensores de proximidade, farois com corrente e JSON pro app"
```

---

## PARTE 4 — Documentação e publicação

### Tarefa 16: Documentação, spec e publicação

**Arquivos:**
- Criar: `docs/PUBLICAR.md`, `B1-Amicao/app/README.md`, `B2-AnjosDaEstrada/app/README.md`
- Modificar: `CLAUDE.md`, `B1-Amicao/README.md`, `B2-AnjosDaEstrada/README.md`, `SETUP.md` (só se mencionar HC-06), `docs/superpowers/specs/2026-10-19-apps-bitmakers-design.md`

- [ ] **Passo 1: Atualizar a spec com o que o plano refinou**

Editar `docs/superpowers/specs/2026-10-19-apps-bitmakers-design.md`:
- Seção 4.2 e 6 (B1): trocar "UID de 4 bytes + nome" por "UID de **4 ou 7 bytes** (NTAG tem 7) + nome, 18 bytes por slot (10 slots)".
- Seção 4.1: em `modo_cadastro`, o `ativo:false` vem "ao expirar, ao cancelar **ou depois de ler uma tag**".
- Seção 4.2: acrescentar "Tablet sem cachorros ligado a um totem que já tem tags: o app **pergunta** antes de apagar as tags do Arduino."
- Seção 3.1: "`requestDevice` com `acceptAllDevices` e `optionalServices: [0xFFE0]` (o HM-10 nem sempre anuncia o serviço)."
- Seção 6 (B2): ordem do LCD = "proximidade crítica > proximidade em atenção > farol queimado > pista molhada > Tudo OK". No Wokwi, D13 e A3 viram chaves "LED removido" porque não há INA219.
- Seção "Estrutura": acrescentar `js/dom.js`, `js/foto.js` (B1), `js/arduino-falso.js` (B1), `js/caminhao-falso.js`, `js/tela.js` (B2) e `ferramentas/gerar_icones.py`; `app/package.json` só serve para os testes.

- [ ] **Passo 2: Atualizar o `CLAUDE.md`**

- Estrutura: acrescentar `app/` dentro de B1 e B2 e a pasta `docs/`.
- B1, tabela: linha "Comunicação | HM-10 (BLE)", nada no Wokwi, pinos iguais. Em "Decisões já tomadas", trocar "Tag desconhecida aparece como 'Novo amigo'…" por: "Tag fora da lista **não gera nada**. O cadastro é feito no app pelo **modo cadastro** (30 s): o app manda `cadastrar`, lê o `tag_lida`, pede nome e foto e manda `permitir`. O Arduino guarda até 10 tags (UID de 4 ou 7 bytes + nome) na EEPROM."
- B1, protocolo: acrescentar os eventos `modo_cadastro`, `tag_lida`, `cadastros` e os comandos `cadastrar`, `cancelar`, `listar`, `permitir`, `remover` (copiar da spec, seção 4.1).
- Substituir **toda** a seção "B2 — Anjos da Estrada" por:

```
## B2 — Anjos da Estrada
Kit de sensores de baixo custo para caminhões antigos, com painel num tablet na cabine (app PWA, Bluetooth HM-10). Ligado aos ODS 3 e 9.

| Função | Peça real | Dublê no Wokwi | Pinos Uno |
|---|---|---|---|
| Proximidade (4 cantos) | 4 × HC-SR04 | hc-sr04 | frente esq TRIG 4/ECHO 5, frente dir 6/7, trás esq 8/9, trás dir 10/11 |
| Pista molhada | FC-37 (AO) | potenciômetro | A0 |
| Farol esquerdo / direito | chave que trava + LED 220Ω + INA219 | chave de farol + chave "LED removido" (D13 e A3) | chaves A1 e A2; INA219 0x40 e 0x41 no I2C |
| Alerta visual | LED + 220Ω | LED | D12 |
| Console | LCD I2C | lcd1602 i2c | A4, A5 |
| Comunicação | HM-10 | nenhum (sai no Serial com `APP> `) | RX D2 ← TXD, TX D3 → RXD com divisor 1k/2k |

O som é do app (não há buzzer). Prioridade do LCD: proximidade crítica > proximidade em atenção > farol queimado > pista molhada > "Tudo OK". Faixas: atenção ≤ 15 cm, crítico < 5 cm (escala de protótipo; no caminhão real, ×10). Farol queimado = chave ligada e corrente < 3 mA em 3 leituras seguidas (teste: tirar o LED da protoboard).

Protocolo (uma linha a cada ~500 ms): `{"frente_esq":12,"frente_dir":null,"tras_esq":4,"tras_dir":30,"chuva":true,"farol_e":"ok","farol_d":"queimado"}` — distância `null` = sem eco; farol `desligado`, `ok` ou `queimado`.
```

- "Pendências": item 1 (compilar/simular) fica **concluído** se as Tarefas 14 e 15 passaram; item 2 vira "Lista de compras: B2 sem SW-18010P, LDR e buzzer; com 3 HC-SR04 e 2 INA219 a mais, 2 chaves, 2 LEDs e 1 HM-10 por projeto"; item 3 vira "App entregue em `B1-Amicao/app` e `B2-AnjosDaEstrada/app` (PWA; ver `docs/PUBLICAR.md`)"; item 4 acrescenta `LIMIAR_CORRENTE_MA` e as faixas de distância; item 5 (briefing com Wi-Fi) continua.

- [ ] **Passo 3: READMEs dos projetos**

Ler `B1-Amicao/README.md` e `B2-AnjosDaEstrada/README.md` e atualizar, sem apagar o que continua valendo:
- Troca de HC-06 por HM-10 (lista de peças, ligação do RXD com divisor 1k/2k, alimentação 3.3 V ou 5 V conforme o módulo).
- **Nomear o HM-10** para distinguir os dois no pareamento: ligar o módulo ao Arduino com o programa de passagem serial a 9600 baud e enviar `AT+NAMEAMICAO` (B1) ou `AT+NAMEANJOS` (B2); a resposta esperada é `OK+Set:AMICAO` (ou `ANJOS`). Desligar e ligar de novo para o nome valer.
- B1: como cadastrar um cachorro (botão Cadastrar no app, tag no leitor em 30 s) e a demonstração com a pelúcia (leituras 7, 6, 6, 6 kg).
- B2: ligação das chaves e dos INA219 (esquema do `CLAUDE.md`), os 4 sensores nos cantos apontados para fora, e o teste do farol queimado (chave ligada, tirar o LED).
- B2: remover as instruções do buzzer, do LDR e do sensor de vibração.

- [ ] **Passo 4: READMEs dos apps** (`B1-Amicao/app/README.md` e `B2-AnjosDaEstrada/app/README.md`)

Cada um com: o que o app faz (2 linhas); como abrir no tablet (URL publicada, Chrome, "Instalar app"); como usar o simulador (`?sim=1`); como rodar os testes (`node --test "teste/*.test.js"`); como atualizar (alterar `VERSAO` no `sw.js` e republicar); e o **checklist de teste com hardware** (marcar cada item quando feito no tablet):

```
[ ] Pareia com o HM-10 (aparece AMICAO / ANJOS na lista)
[ ] Conecta e o selo/faixa mostra "Conectado"
[ ] Desligar o Arduino: o app mostra desconectado e tenta reconectar sozinho (3 s)
[ ] Linhas chegam inteiras (sem JSON cortado) — conferir que os cards atualizam
[ ] Tela do tablet não apaga com o app aberto (Wake Lock)
[ ] Som sai no volume de mídia do tablet (B2)
[ ] B1: cadastrar um cachorro de verdade e conferir que o LCD mostra o nome
[ ] B1: tag que não está na lista não faz nada
[ ] B2: tirar o LED da protoboard com a chave ligada dispara "Farol ... queimado"
```

- [ ] **Passo 5: Criar `docs/PUBLICAR.md`**

```markdown
# Publicar os apps (GitHub Pages)

O Chrome só libera Bluetooth em HTTPS. O jeito mais simples e gratuito é o GitHub Pages.

1. Crie um repositório **público** só para os apps, por exemplo `bitmakers-apps` (o repositório com manual, fotos e firmware não precisa ficar público).
2. Copie as pastas:
   - `B1-Amicao/app/`  para  `amicao/`
   - `B2-AnjosDaEstrada/app/`  para  `anjos/`
   (não precisa copiar a pasta `teste/` nem o `package.json`)
3. No GitHub: Settings → Pages → Source: branch `main`, pasta `/ (root)`.
4. Os endereços ficam `https://<usuario>.github.io/bitmakers-apps/amicao/` e `.../anjos/`.
5. No tablet (Chrome): abra o endereço, confirme que o app abre, depois menu ⋮ → **Instalar app**. Abrir uma vez com internet; depois funciona offline.
6. Para atualizar: mude o número de `VERSAO` no `sw.js`, copie os arquivos de novo e faça commit. O app instalado troca de versão na próxima abertura.

Conferir depois de publicar: no Chrome do computador, DevTools → Application → Service Workers (registrado) e Manifest (sem erros, ícones carregam).
```

- [ ] **Passo 6: Publicação (só com aval do Allysom)**

Criar o repositório, enviar os arquivos e ativar o Pages publica conteúdo na internet. **Não fazer** sem o Allysom confirmar conta, nome do repositório e que pode ser público. Se confirmar, seguir `docs/PUBLICAR.md` e testar o PWA em HTTPS (Service Worker registrado, offline funcionando, "Instalar app" aparecendo).

- [ ] **Passo 7: Verificação final**

```bash
cd B1-Amicao/app && node --test "teste/*.test.js"
cd ../../B2-AnjosDaEstrada/app && node --test "teste/*.test.js"
```
Esperado: tudo passando. Repetir uma volta rápida no navegador em `?sim=1` nos dois apps (porta 8081 e 8082) e conferir que não há erros no console. Informar ao Allysom, com clareza, o que **não** foi testado: Bluetooth real com o HM-10, som no tablet e Wake Lock no tablet.

- [ ] **Passo 8: Commit**

```bash
git add CLAUDE.md docs B1-Amicao B2-AnjosDaEstrada SETUP.md
git commit -m "docs: spec, CLAUDE.md, READMEs, guia de publicacao e checklist de hardware"
```

---

## Autoavaliação do plano (feita contra a spec)

**Cobertura da spec:** base comum (T1–T4, T9–T13); BLE e simulador (T3, T4, T10, T11); B1 protocolo, cadastro, telas, dados, alertas, desconexão (T1–T7); B2 protocolo, faixas, alertas, sem sinal, tela, som, mudo, Wake Lock (T9–T12); firmware B1 e B2 (T14, T15); testes automáticos, navegador e checklist de hardware (T1–T3, T9–T10, verificações de cada tarefa, T16); pendências abertas (T16, passos 2 e 6).

**Pontos em que o plano refina a spec (a Tarefa 16 atualiza a spec):** UID de 4 ou 7 bytes; modo cadastro termina ao ler a tag; confirmação antes de apagar tags de um totem num tablet vazio; `acceptAllDevices` no BLE; atenção também aparece no LCD do B2; D13/A3 viram chaves "LED removido" no Wokwi.

**Consistência de nomes:** `lerLinha`, `LinhaBuffer`, `quebrarEmBlocos` (protocolo dos dois apps, mesma assinatura); `comando.*` e `uidValido` só no B1; `lerLeitura` só no B2; `avaliarPeso`/`tendencia`/`PADRAO` (B1); `decidirSom`/`alertasAtivos`/`classificarDistancia` (B2); `ArduinoFalso`/`CaminhaoFalso` entregam texto a `receberLinha`; `criarBle` igual nos dois apps; campos de leitura do B2 iguais em protocolo, faixas, tela, simulador e firmware (`frente_esq`, `frente_dir`, `tras_esq`, `tras_dir`, `chuva`, `farol_e`, `farol_d`).
