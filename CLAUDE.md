# Projetos Arduino BITMAKERS — contexto para o Claude Code

## Quem e para quê
Allysom é instrutor do programa BITMAKERS (Futebol de Rua — FDR), com alunos de 12 a 17 anos. Estes são os protótipos de duas equipes para apresentação. O código precisa ser **legível para os alunos**: comentários em português, nomes de variáveis em português, sem truques de C++ desnecessários.

Allysom prefere crítica direta a validação: aponte problemas de projeto, não só de código.

## Estrutura
```
bitmakers-arduino/
├── CLAUDE.md            ← este arquivo
├── SETUP.md             ← como preparar o computador
├── .mcp.json            ← MCP do Wokwi (wokwi-cli mcp)
├── B1-Amicao/
│   ├── B1-Amicao.ino    ← nome do .ino = nome da pasta (exigência do arduino-cli)
│   ├── diagram.json     ← circuito do Wokwi (nome fixo)
│   ├── wokwi.toml       ← aponta para build/B1-Amicao.ino.hex/.elf
│   ├── cenario.yaml     ← roteiro da simulação (wokwi-cli --scenario)
│   ├── libraries.txt    ← só para o wokwi.com no navegador
│   ├── README.md        ← guia para os alunos (simulação + montagem real)
│   ├── leitor-rfid/     ← sketch do 2º Arduino (só RC522), fala com o principal por I2C (A4/A5, endereço 0x30)
│   ├── testes/teste-geral/ ← sketch que valida cada peça (r, t, b, k, m, p, h; ver cabeçalho)
│   ├── ligacoes/        ← diagramas SVG de ligação (0-ligacao-completa.svg = tudo junto)
│   └── app/             ← app PWA do tablet (HTML/CSS/JS puros, sem build; README próprio)
├── B2-AnjosDaEstrada/   ← mesma estrutura (app/ = painel da cabine)
├── ferramentas/gerar_icones.py ← gera os ícones PNG dos apps
└── docs/
    ├── PUBLICAR.md      ← como publicar os apps no GitHub Pages (HTTPS, exigência do Bluetooth)
    └── superpowers/     ← spec e plano dos apps
```
Tudo que for de um projeto fica dentro da pasta dele. Nunca misture.

## Comandos
De dentro da pasta do projeto:
```
arduino-cli compile --fqbn arduino:avr:uno --output-dir build .
wokwi-cli --timeout 10000 .                      # simula e mostra o Serial
wokwi-cli --timeout 90000 --scenario cenario.yaml --serial-log-file serial.log .   # roda o roteiro do projeto
arduino-cli upload --fqbn arduino:avr:uno -p <PORTA> --input-dir build .
arduino-cli monitor -p <PORTA> -c baudrate=9600
```
Sempre compile e simule depois de mudar código. **Situação real:** os dois sketches compilam (arduino-cli v1.5.1 que vem com a Arduino IDE: `C:\Program Files\Arduino IDE\resources\app\lib\backend\resources\arduino-cli.exe`; B1 usa 43% da RAM, B2 41%), mas **nenhuma simulação no Wokwi foi executada**: o `wokwi-cli` responde "API Error: Unauthorized" (token inválido). Os `cenario.yaml` foram reescritos e nunca rodaram. Veja "Pendências".

Os apps (`app/` de cada projeto) têm testes automáticos: `node --test "teste/*.test.js"` dentro de `B1-Amicao/app` (36 testes) e `B2-AnjosDaEstrada/app` (16 testes).

## Regras que valem para os dois projetos
- Placa: **Arduino Uno** (ATmega328P, 2 KB de RAM — cuidado com `String` e memória; use `F()` em textos fixos do Serial).
- LCD 16x2 I2C, endereço 0x27 (na placa real pode ser 0x3F). **Sem acentos no LCD** (a fonte não tem).
- O mesmo código roda no Wokwi e na placa real. Peças que o Wokwi não tem são substituídas por "dublês" e identificadas com `wokwi-text` no `diagram.json`.
- Limiares de sensores ficam em constantes no topo do arquivo, e o Serial mostra as leituras para calibrar na montagem real.
- **Alimentação:** o B2 usa fonte de tomada **12V 2A** (plugue P4 5,5×2,1, centro positivo). B1: **fonte de 5V separada, 2A ou mais** → tudo que é 5V (motor de passo/ULN2003, relé, bomba e HX711), com GND comum com o Uno; o RC522 fica no 3,3V do Uno do leitor (o HM-10 vai no 5V da fonte, o módulo precisa ter regulador); o Uno é alimentado à parte (USB ou jack) e **nunca** se liga o +5V da fonte no pino 5V do Uno. B2: 12V → jack do Uno, ou LM2596 em 5V → pino 5V do Uno (esquenta menos; não ligar o USB junto). Nunca ligar motor/bomba no 5V do Uno (regulador linear, resseta). RC522 e RXD do HM-10 são 3.3V.
- O B1 está com `#define SIMULACAO 0` (placa real, pronto para o app; para o Wokwi, troque para 1). O B2 também está com `0` (placa real); para o Wokwi, troque para 1 (no B2, o `1` liga as chaves "LED removido" no lugar da leitura dos faróis).
- Rádio: **HM-10 (BLE)** nos dois projetos. O HC-06 é Bluetooth Classic e o Chrome não conecta nele.

---

## B1 — Amicão
Totem comedouro/bebedouro para cachorros de rua. Cada cachorro tem uma tag NFC na coleira; o totem identifica, pesa, libera ração e manda os dados para um **app (PWA no Chrome do tablet Android)**, via **Bluetooth HM-10 (BLE)**, e recebe comandos do app (cadastro de tags). Ligado aos ODS 11, 12 e 15.

| Função | Peça real | Dublê no Wokwi | Pinos Uno |
|---|---|---|---|
| Identificação | RC522 | board-mfrc522 (Blue Card uid `0A:0B:0C:0D` = Rex) | SS 10, RST 9, MOSI 11, MISO 12, SCK 13, 3.3V |
| Balança | Célula 20 kg + HX711 | wokwi-hx711 type 50kg | DT A1, SCK A0 |
| Dosador de ração | 28BYJ-48 + ULN2003 | motor de passo bipolar ligado direto | IN1 4, IN2 5, IN3 6, IN4 7 |
| Bomba d'água | Mini bomba + módulo relé (diodo 1N4007 em paralelo) | LED azul | IN 3 |
| Comunicação | HM-10 (BLE) | nenhum (sai no Serial com `APP> `) | RX D2 ← TXD, TX A3 → RXD com divisor 1k/2k |

Decisões já tomadas:
- `#define SIMULACAO 1/0` troca passos por volta (200 no Wokwi, 2048 no 28BYJ-48), fator da balança (420 no Wokwi; real precisa calibrar) e tempos.
- Stepper declarado como `Stepper(passos, 4, 6, 5, 7)` (ordem IN1-IN3-IN2-IN4). No Wokwi a fiação é D4→A+, D6→A−, D5→B+, D7→B−, então o mesmo código funciona nos dois.
- Peso < 1 kg vai como `null` (cachorro fora da balança).
- Intervalo mínimo entre porções por cachorro (15 s na simulação, 1 minuto no real, para a apresentação).
- RFID em Arduino separado (por causa de falha do RC522 com tudo ligado): `#define RFID_EXTERNO 1` no `B1-Amicao.ino` faz o principal perguntar o UID por I2C (A4=SDA, A5=SCL, GND comum) ao Arduino com `leitor-rfid/leitor-rfid.ino`. Com `RFID_EXTERNO 0` volta a usar o RC522 ligado no próprio Arduino.
- Totem ocupado: enquanto pesa, solta ração e enche a água (`ocupado`), o principal continua lendo o leitor (para a fila não travar), mas **descarta** qualquer tag nova. Ela só vale depois que o processo terminar.
- O leitor (2º Arduino) responde por I2C com 10 bytes: `[novo][tamanho][UID de 7 bytes][chip ok]`. O principal só vê o leitor como funcionando se ele respondeu há menos de 3 s **e** o RC522 dele está vivo.
- Sem display (LCD): as mensagens do totem saem só no Serial, com o prefixo `MSG> ` (função `mostrar`).
- Sem sensor de nível: a cada tag cadastrada a bomba liga por tempo fixo (`TEMPO_BOMBA`, 8 s no real), junto com a ração, e só repete depois de `INTERVALO_AGUA` (1 minuto no real, igual à ração). `NIVEL_BOMBA_LIGADA` é `HIGH` (módulo relé de 3 pinos com transistor; se o seu for com optoacoplador, `LOW`). Não existe mais o alerta `reservatorio_vazio` (nem no Arduino, nem no app).
- O Arduino **não tem relógio**: o app carimba data/hora ao receber. O alerta de peso é calculado no app: cada pesagem é comparada com a média de todas as anteriores do cachorro, e **20% ou mais para mais ou para menos** sinaliza (vale a partir da 2ª pesagem; o limite é fixo, sem ajuste).
- Tag fora da lista **não gera nada**. O cadastro é feito no app pelo **modo cadastro** (30 s): o app manda `cadastrar`, lê o `tag_lida`, pede nome e foto e manda `permitir`. O Arduino guarda até 10 tags (UID de 4 ou 7 bytes + nome) na EEPROM, 18 bytes por slot.
- No Wokwi não há HM-10: os comandos do app chegam pelo Serial (só com `SIMULACAO 1`) e os eventos saem com `APP> `.

Protocolo (uma linha JSON por evento, 9600 baud):
```
Arduino -> app
{"evento":"ligado"}
{"evento":"status","leitor":true,"balanca":true}   // a cada 5 s e quando muda; o app mostra ícones verde/vermelho
{"evento":"visita","uid":"0A:0B:0C:0D","peso_kg":7.0,"racao":true}      // peso_kg pode ser null
{"evento":"agua","bomba":"ligada"}  /  {"evento":"agua","bomba":"desligada"}
{"evento":"racao","motor":"ligado"}  /  {"evento":"racao","motor":"desligado"}   // o app mostra o motor ativo; nao ha sensor de retorno
{"evento":"modo_cadastro","ativo":true}    // ativo:false ao expirar (30 s), ao cancelar ou depois de ler uma tag
{"evento":"tag_lida","uid":"0A:0B:0C:0D"}  // só dentro do modo cadastro
{"evento":"cadastros","uids":["0A:0B:0C:0D"]}   // resposta a listar, permitir e remover

App -> Arduino
{"cmd":"cadastrar"}   {"cmd":"cancelar"}   {"cmd":"listar"}
{"cmd":"permitir","uid":"0A:0B:0C:0D","nome":"Rex"}   // nome sem acento, até 10 caracteres
{"cmd":"remover","uid":"0A:0B:0C:0D"}
```
O app é a fonte da verdade: ao conectar manda `listar` e acerta a lista do Arduino. Tablet sem cachorros ligado a um totem que já tem tags: o app pergunta antes de apagar. Detalhes em `docs/superpowers/specs/2026-10-19-apps-bitmakers-design.md`.

---

## B2 — Anjos da Estrada
Kit de sensores de baixo custo para caminhões antigos, com painel num tablet na cabine (app PWA, Bluetooth HM-10). Ligado aos ODS 3 e 9.

| Função | Peça real | Dublê no Wokwi | Pinos Uno |
|---|---|---|---|
| Proximidade (4 cantos) | 4 × HC-SR04 | hc-sr04 | frente esq TRIG 4/ECHO 5, frente dir 6/7, trás esq 8/9, trás dir 10/11 |
| Pista molhada | FC-37 (AO) | potenciômetro | A0 |
| Farol esquerdo / direito (sempre ligados) | LED 220Ω + INA219 | LED 220Ω + chave "LED removido" (D13 e A3) | INA219 0x40 e 0x41 no I2C |
| Console | LCD I2C | lcd1602 i2c | A4, A5 |
| Comunicação | HM-10 | nenhum (sai no Serial com `APP> `) | RX D2 ← TXD, TX D3 → RXD com divisor 1k/2k |

O som é do app (não há buzzer). Prioridade do LCD: proximidade crítica > proximidade em atenção > farol queimado > pista molhada > "Tudo OK". Faixas (ficam no app, `app/js/faixas.js`): atenção ≤ 20 cm, crítico < 10 cm (escala de protótipo; no caminhão real, ×10). Farol queimado = corrente < 3 mA em 3 leituras seguidas (teste: tirar o LED da protoboard). Não há chave de farol nem LED de alerta; pinos A1, A2 e D12 ficam livres.

Detalhes que já foram decididos:
- Cada farol (sempre ligado): 5V → INA219 (VIN+ → VIN−) → 220Ω → LED → GND. **A orientação do INA219 importa:** VIN+ e VIN− invertidos leem corrente negativa e dão "farol queimado" falso.
- `#define MODO_FAROL` no sketch do B2 (só vale com `SIMULACAO 0`): `0` = faróis não montados (manda `"desligado"`), `1` = INA219, `2` (atual) = sem INA219, lê a tensão do LED em A1 (esquerdo) e A2 (direito). No modo 2 há um fio do ponto entre o resistor e o LED até o pino analógico, e `LED_NO_LADO_DO_5V` diz a ordem das peças: `1` = 5V → LED → 220Ω → GND, LED aceso lê ~650 e queimado/removido cai a ~30 (`LIMITE_TENSAO_LED` = 300); `0` (atual, igual ao desenho) = 5V → 220Ω → LED → GND, aceso lê ~400 a 650 e queimado sobe a ~1023 (`LIMITE_TENSAO_LED_ALTO` = 900). Não mede corrente: no caminhão real (faróis de amperes) o certo é o INA219. O Serial mostra `led_esq` e `led_dir` para calibrar.
- Modo 1: o INA219 da direita precisa do endereço 0x41 (jumper A0 soldado). O sketch lê o registrador de tensão do shunt direto (sem biblioteca); com shunt de 0,1 Ω, 1 unidade = 0,1 mA.
- Com `SIMULACAO 1`, D13 e A3 são duas chaves "LED removido" (chave na direita = LED tirado). O Wokwi não tem INA219.
- Os 4 HC-SR04 são lidos um por vez (75 ms entre eles) para um não ouvir o eco do outro. Apontar todos para fora do caminhão.
- O app toca os sons (bipes de proximidade, tom contínuo no crítico, tons de alerta repetidos a cada 10 s). O intervalo vai de 600 ms a 20 cm até 200 ms a 10 cm (a 12 cm são 280 ms).

Protocolo (uma linha a cada ~600 ms): `{"frente_esq":12,"frente_dir":null,"tras_esq":4,"tras_dir":30,"chuva":true,"farol_e":"ok","farol_d":"queimado"}` — distância `null` = sem eco; farol `ok` ou `queimado` (o app ainda aceita `desligado`, mas o kit não manda).

---

## Pendências
1. **Simulação no Wokwi nunca foi executada** (nem B1, nem B2). Os dois sketches compilam, mas o `wokwi-cli` responde "API Error: Unauthorized": o `WOKWI_CLI_TOKEN` é inválido. O Allysom precisa gerar um token novo (ver `SETUP.md`, seção 3b) e depois rodar, dentro de cada pasta de projeto: `wokwi-cli --timeout 90000 --scenario cenario.yaml --serial-log-file serial.log .` (o B2 também tem `cenario-distancia.yaml`). Os `cenario.yaml` foram reescritos para o firmware novo, mas nunca rodaram. As posições das peças no `diagram.json` do B2 também não foram conferidas visualmente. Os prints antigos do B2 (`prints/b2-*.png`) são do projeto anterior (impacto, pouca luz, ponto cego); não foram apagados, a decisão é do Allysom.
2. Lista de compras: B2 sem SW-18010P, LDR e buzzer; com 3 HC-SR04 e 2 INA219 a mais, 2 LEDs e 1 HM-10 por projeto (sem chaves de farol). O LCD e o FC-37 agora só no B2 (o B1 não tem display). B1: módulo relé, diodo 1N4007 e fonte de 5V 2A separada.
3. App entregue em `B1-Amicao/app` e `B2-AnjosDaEstrada/app` (PWA; ver `docs/PUBLICAR.md`). **Ainda não publicado** (precisa de conta, nome do repositório e aval do Allysom). **Não testado com hardware:** Bluetooth real com o HM-10, som no tablet, Wake Lock no tablet (checklist no README de cada app).
4. Calibração na montagem real: fator da balança, `TEMPO_BOMBA`, `LIMITE_CHUVA`, `LIMIAR_CORRENTE_MA` e as faixas de distância (`DIST_ATENCAO` e `DIST_CRITICO` em `app/js/faixas.js`; no caminhão real, ×10).
5. Briefing do B1 ainda fala em Wi-Fi e notificações; a equipe deve ajustar para "Bluetooth para tablet no protótipo".
6. Questões físicas do B1 para discutir com a equipe: o RC522 lê só a 2–5 cm (posição do leitor no totem) e o cachorro precisa ficar inteiro sobre a balança.
7. Problemas conhecidos no firmware (não corrigidos, fora do escopo desta tarefa): no B2, a linha do LCD "Reduza velocidade" tem 17 caracteres e só cabem 16 (o último some). No B1, o Arduino lê os comandos do app durante as esperas (`esperarLendo`, pois o buffer do SoftwareSerial guarda só 63 bytes), mas o movimento do motor de passo da ração ainda bloqueia por alguns segundos; por isso o app manda um comando por vez e espera a resposta do Arduino (até 1,5 s).
