# Briefing: como escrever uma página do Manual de Componentes

Público: alunos de 12 a 17 anos (Futebol de Rua, programa BITMAKERS). Português do Brasil, simples,
sem enrolação, mas **sem perder conteúdo técnico**. Material de estudo impresso em A4, **uma página por peça**.

## O que você entrega por peça (3 arquivos)
1. `componentes/NN-slug.json` — textos da página.
2. `figuras/NN-slug-peca.svg` — desenho da peça, com os pinos/partes rotulados.
3. `figuras/NN-slug-funciona.svg` — desenho de **como funciona por dentro** (princípio físico/elétrico).

`NN-slug` é o id que o chefe te passou (ex.: `03-resistor`). **Modelo pronto para copiar a estrutura e o estilo:**
`componentes/08-hc-sr04.json`, `figuras/08-hc-sr04-peca.svg`, `figuras/08-hc-sr04-funciona.svg`.
Leia esses três antes de começar. Leia também `montar.py` (função `pagina`, `bloco_projeto`, `svg_ligacao`).

## Esquema do JSON (todas as chaves, mesma ordem do modelo)
```
nome            título da página (único no manual; aparece no topo)
nome_curto      nome curto, aparece na caixa do diagrama de ligação (<= 12 caracteres)
apelido         frase curta e divertida logo abaixo do título (<= 60 caracteres)
categoria       sensor | atuador | comunicacao | energia | interface | controle | montagem
projetos        ["B1"], ["B2"] ou ["B1","B2"]  (só os projetos em que a peça é USADA de verdade)
o_que_e         <= 230 caracteres
pra_que_serve   <= 200 caracteres
onde_vive       3 a 4 itens, cada um <= 100 caracteres: onde a peça aparece no mundo real
legenda_peca    <= 70 caracteres (legenda do desenho da peça)
ficha           objeto com no máximo 5 linhas "rótulo": "valor" (rótulos curtos, <= 18 caracteres)
passos          4 a 5 itens, cada um <= 75 caracteres (como funciona, em ordem)
formula         <= 170 caracteres: a conta/regra principal em destaque (pode ser uma regra em palavras)
no_projeto      objeto por projeto usado: { "B1": {...}, "B2": {...} } — cada um com:
                  texto   aplicação no projeto. Projeto único: <= 330 caracteres. Os DOIS projetos: <= 190 cada.
                  pinos   lista de [rótulo, valor] — até 4 linhas (se os dois projetos: até 3)
                  ligacao (opcional) lista de [pino da peça, destino, cor do fio]; até 4 linhas (2 projetos: até 4)
                  ligacao_destino (opcional) nome da placa de destino na caixa da direita; padrão "Arduino Uno"
cuidados        3 a 4 itens, cada um <= 95 caracteres
desafio         <= 220 caracteres (pergunta/mini-experimento com conta ou raciocínio)
resposta        <= 190 caracteres
```
Cores de fio aceitas: vermelho, preto, laranja, verde, azul, amarelo, roxo, branco, marrom, cinza, rosa.
Se a peça não tem fio direto pro Arduino (ex.: resistor, fonte, tag), **omita `ligacao`** ou ligue ao destino real
(ex.: célula de carga → `ligacao_destino: "HX711"`). Omitir `pinos` também é permitido (use lista vazia `[]`).

## Regras de conteúdo
- **Só afirme o que é verdade para a peça** (valores típicos de datasheet). Se não tiver certeza de um número,
  escreva "cerca de" ou "tipicamente". Nunca invente número específico de modelo.
- Sem emojis. Sem caracteres Unicode de subscrito/sobrescrito (₂ ² etc.); escreva "µs", "kΩ", "Ω", "V", "mA", "3,3 V" normal.
- Sem acentos NÃO é regra aqui (o PDF aceita acentos). Use acentuação correta.
- Cada página responde: **o que faz, pra que serve, onde vive (mundo real), como funciona por dentro,
  qual a aplicação no B1/B2, como liga, cuidados, desafio**.
- `desafio` deve ter resposta calculável ou raciocínio verificável, e `resposta` deve estar CERTA (confira a conta).

## Regras dos SVG
- Pastas: `figuras/`. Escreva SVG puro (sem script, sem imagem externa, sem fonte externa).
  `font-family="Segoe UI, Arial, sans-serif"`.
- **peca.svg**: `viewBox="0 0 300 190"` (a figura é mostrada com ~75 mm de largura, altura máx 35 mm).
  Texto >= 8 unidades (rótulos importantes 10–11, em negrito). Mostre a peça reconhecível, com cores realistas,
  e rotule pinos/partes principais (com cor igual à do fio quando fizer sentido: VCC vermelho #c62828, GND preto #202124).
- **funciona.svg**: `viewBox="0 0 420 200"` (mostrada com ~110 mm de largura). Texto >= 8.6 unidades.
  Desenhe o princípio: setas, ondas, correntes, blocos. Poucos elementos, bem legível, com rótulos numerados que combinem
  com os `passos` quando fizer sentido.
- **IDs únicos**: se usar `<defs>`/`marker`/`gradient`, prefixe os ids com o slug da peça (ex.: `id="seta-ldr"`),
  porque todos os SVG vão para o mesmo HTML.
- Paleta sugerida: azul #1a73e8/#0d47a1, laranja #d9640a, verde #188038, vermelho #c62828, cinza #5b6770/#90a4ae, amarelo #ffd54f.

## Fatos dos projetos (use exatamente; não invente pinagem)

### B1 — Amicão (totem comedouro/bebedouro, cachorros de rua)
Cada cachorro tem uma tag NFC na coleira. O totem identifica (RC522), pesa (célula + HX711), solta ração (28BYJ-48 + ULN2003),
mantém água no pote (bomba + L9110S, nível pelo FC-37) e manda cada evento em JSON, por Bluetooth HC-06, pro app de um tablet Android.
Lê a tag a 2–5 cm. O cachorro precisa ficar inteiro sobre a balança. Peso menor que 1 kg = "cachorro fora da balança".
- Uno: tudo abaixo.
- RC522 (3,3 V, nunca 5 V): SDA(SS) D10, RST D9, MOSI D11, MISO D12, SCK D13, 3.3V, GND.
- HX711: DT A1, SCK A0, VCC 5V, GND. Célula de carga 20 kg (recomendação: 50 kg para cães maiores) ligada ao HX711 (E+ E− A+ A−).
  Fator de calibração: peso conhecido; zera ao ligar (balança vazia).
- ULN2003 + 28BYJ-48: IN1 D4, IN2 D5, IN3 D6, IN4 D7; 2048 passos por volta; 10 rpm; 0,5 volta por porção; alimentado por fonte 5 V externa.
- L9110S + bomba: A-IA D3, A-IB D8; fonte 5 V externa. A bomba liga quando o pote está seco e tem tempo máximo (30 s no real):
  estourou, desliga e manda alerta "reservatório vazio".
- FC-37: AO A2, VCC 5V, GND. O valor CAI quando molha. Abaixo de 500 = tem água.
- LCD 16x2 I2C, endereço 0x27 (às vezes 0x3F): SDA A4, SCL A5, 5V, GND. Sem acentos no LCD.
- HC-06: TXD do módulo -> D2; RXD do módulo <- A3 por divisor de tensão (A3 -> 1 kΩ -> RXD, e RXD -> 2 kΩ -> GND), porque o RXD é 3,3 V;
  VCC 5V, GND; 9600 baud; senha de pareamento 1234 ou 0000; alcance ~10 m; só envia (sem confirmação).
- Fonte 5 V (2 A) externa para motor e bomba, com GND ligado ao GND do Arduino. Nunca alimente motor/bomba pelo 5V do Arduino.
- Intervalo mínimo entre porções por cachorro: 4 h (real).
- O Arduino não tem relógio; o app carimba data e hora ao receber.
- Protocolo: uma linha JSON por evento, ex.: `{"evento":"visita","uid":"0A:0B:0C:0D","peso_kg":7.0,"racao":true}`.

### B2 — Anjos da Estrada (kit de segurança pra caminhões antigos; console na cabine) — PINAGEM NOVA (prevista)
Ponto cego (4 HC-SR04), setas com diagnóstico de lâmpada queimada (2 INA219), chuva, luz, impacto, LCD, buzzer, LED, tudo mandado
por JSON via HC-06 pro app. A USB do computador alimenta tudo (sem fonte externa).
- HC-SR04 ×4: frente TRIG D4/ECHO D5; traseira D6/D7; lateral esquerda D9/D10; lateral direita D11/D12. Leitura em sequência, 30 ms entre eles.
  Alerta abaixo de 100 cm; perigo (bipe contínuo) abaixo de 40 cm.
- HC-06: TXD -> D2; RXD <- D3 (divisor 1 kΩ + 2 kΩ). Mesmo protocolo JSON do B1; manda só quando algo muda + um resumo "status" a cada 5 s.
- Buzzer D8 (bipe estilo sensor de estacionamento: mais perto, mais rápido; 2 bipes curtos quando seta queimada). LED de alerta D13 + resistor 220 Ω.
- Vibração SW-18010P: saída digital DO no pino A0 (usado como entrada digital; INPUT_PULLUP). Alerta de impacto fica 4 s na tela.
- FC-37 (chuva): AO A1. Abaixo de 500 = molhado = "PISTA MOLHADA, reduza velocidade". (Mede chuva na placa; é um sensor de gotas.)
- LDR (módulo 4 pinos): AO A2. Valor SOBE no escuro; acima de 800 = "POUCA LUZ, acenda os faróis".
- LCD 16x2 I2C 0x27: A4/A5. INA219 da seta esquerda 0x40 e da seta direita 0x41 no MESMO barramento I2C (A4/A5). A3 livre.
- INA219: mede tensão e corrente na linha da seta. Seta acionada (tensão > ~2 V) com corrente abaixo do limite = lâmpada QUEIMADA.
  Protótipo: "lâmpada" = LED 5 mm + resistor 220 Ω no 5 V (~14 mA, limite de queimada ~5 mA); interruptor/botão = "acionar a seta";
  tirar o LED do protoboard = queimar a lâmpada. Endereço 0x41 exige ponte de solda no pad A0 do segundo módulo.
  Faixa do módulo: até 26 V e ~3,2 A (resistor shunt de 0,1 Ω). Diagnóstico leva ~1,5 s de janela porque a seta de verdade pisca.
- Prioridade da tela: ponto cego > impacto > seta queimada > pista molhada > pouca luz > Tudo OK.
- Botão/interruptor: 2, um por seta (esquerda e direita), levam o 5 V à seta; INA219 em série.

## Como conferir a sua página (OBRIGATÓRIO)
Dentro de `C:\claude\BITMAKERS\manual`:
```
python montar.py --apenas 03-resistor,04-led --verificar
```
Ele mede, no Chrome, se cada página cabe em 1 folha A4. Saída esperada: `ok  03-resistor (folga X mm)` com folga >= 1 mm.
`ESTOUROU` significa que passou do fim: **corte texto** (de preferência `onde_vive`, `cuidados`, texto do projeto), não aumente a página.
Páginas com dois projetos são as mais apertadas: use os limites menores.
Depois olhe o resultado: converta a página em imagem e CONFIRA com os olhos (textos cortados, figuras mal posicionadas, rótulos sobrepostos):
```
python -c "import pymupdf; d=pymupdf.open(r'saida/previa-03_04.pdf'); [d[i].get_pixmap(dpi=100).save(rf'saida/ver-03_04-{i+1}.png') for i in range(len(d))]"
```
(use os números das suas peças no nome do arquivo; `saida/previa-<números separados por _>.pdf` é o nome que o `montar.py` gera.)
Abra as PNG com a ferramenta de leitura de imagens. Corrija até ficar bom. Não edite `montar.py`, `estilo.css` nem arquivos de outras peças.
Se achar um defeito no template (ex.: layout quebra), **não conserte**: descreva no relatório final.

## O que reportar no final (curto)
Lista de arquivos criados, folga de cada página em mm, e qualquer dúvida/risco de conteúdo técnico que o professor deva conferir
(ex.: "valor X é típico, confirmar no datasheet do módulo comprado").
