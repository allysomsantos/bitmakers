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
Sempre compile e simule depois de mudar código. **Situação real:** os dois sketches compilam (arduino-cli v1.5.1 que vem com a Arduino IDE: `C:\Program Files\Arduino IDE\resources\app\lib\backend\resources\arduino-cli.exe`; B1 usa 57% da RAM, B2 41%), mas **nenhuma simulação no Wokwi foi executada**: o `wokwi-cli` responde "API Error: Unauthorized" (token inválido). Os `cenario.yaml` foram reescritos e nunca rodaram. Veja "Pendências".

Os apps (`app/` de cada projeto) têm testes automáticos: `node --test "teste/*.test.js"` dentro de `B1-Amicao/app` (25 testes) e `B2-AnjosDaEstrada/app` (16 testes).

## Regras que valem para os dois projetos
- Placa: **Arduino Uno** (ATmega328P, 2 KB de RAM — cuidado com `String` e memória; use `F()` em textos fixos do Serial).
- LCD 16x2 I2C, endereço 0x27 (na placa real pode ser 0x3F). **Sem acentos no LCD** (a fonte não tem).
- O mesmo código roda no Wokwi e na placa real. Peças que o Wokwi não tem são substituídas por "dublês" e identificadas com `wokwi-text` no `diagram.json`.
- Limiares de sensores ficam em constantes no topo do arquivo, e o Serial mostra as leituras para calibrar na montagem real.
- Motores e bomba usam fonte 5V externa com GND comum. RC522 e RXD do HM-10 são 3.3V.
- Os dois sketches vêm com `#define SIMULACAO 1`. **Troque para 0 antes de gravar na placa real** (no B2, é isso que liga a leitura dos INA219 e desliga as chaves "LED removido").
- Rádio: **HM-10 (BLE)** nos dois projetos. O HC-06 é Bluetooth Classic e o Chrome não conecta nele.

---

## B1 — Amicão
Totem comedouro/bebedouro para cachorros de rua. Cada cachorro tem uma tag NFC na coleira; o totem identifica, pesa, libera ração e manda os dados para um **app (PWA no Chrome do tablet Android)**, via **Bluetooth HM-10 (BLE)**, e recebe comandos do app (cadastro de tags). Ligado aos ODS 11, 12 e 15.

| Função | Peça real | Dublê no Wokwi | Pinos Uno |
|---|---|---|---|
| Identificação | RC522 | board-mfrc522 (Blue Card uid `0A:0B:0C:0D` = Rex) | SS 10, RST 9, MOSI 11, MISO 12, SCK 13, 3.3V |
| Balança | Célula 20 kg + HX711 | wokwi-hx711 type 50kg | DT A1, SCK A0 |
| Dosador de ração | 28BYJ-48 + ULN2003 | motor de passo bipolar ligado direto | IN1 4, IN2 5, IN3 6, IN4 7 |
| Bomba d'água | Mini bomba + L9110S | LED azul | A-IA 3, A-IB 8 |
| Nível do pote | FC-37 (AO) | potenciômetro | A2 |
| Display | LCD I2C | lcd1602 i2c | A4, A5 |
| Comunicação | HM-10 (BLE) | nenhum (sai no Serial com `APP> `) | RX D2 ← TXD, TX A3 → RXD com divisor 1k/2k |

Decisões já tomadas:
- `#define SIMULACAO 1/0` troca passos por volta (200 no Wokwi, 2048 no 28BYJ-48), fator da balança (420 no Wokwi; real precisa calibrar) e tempos.
- Stepper declarado como `Stepper(passos, 4, 6, 5, 7)` (ordem IN1-IN3-IN2-IN4). No Wokwi a fiação é D4→A+, D6→A−, D5→B+, D7→B−, então o mesmo código funciona nos dois.
- Peso < 1 kg vai como `null` (cachorro fora da balança).
- Intervalo mínimo entre porções por cachorro (30 s na simulação, 4 h no real).
- Bomba com tempo máximo: se estourar, desliga e manda alerta `reservatorio_vazio`.
- O Arduino **não tem relógio**: o app carimba data/hora ao receber. Alertas de "sumiu" e "perdeu peso" são calculados no app, não no Arduino.
- Tag fora da lista **não gera nada**. O cadastro é feito no app pelo **modo cadastro** (30 s): o app manda `cadastrar`, lê o `tag_lida`, pede nome e foto e manda `permitir`. O Arduino guarda até 10 tags (UID de 4 ou 7 bytes + nome) na EEPROM, 18 bytes por slot.
- No Wokwi não há HM-10: os comandos do app chegam pelo Serial (só com `SIMULACAO 1`) e os eventos saem com `APP> `.

Protocolo (uma linha JSON por evento, 9600 baud):
```
Arduino -> app
{"evento":"ligado"}
{"evento":"visita","uid":"0A:0B:0C:0D","peso_kg":7.0,"racao":true}      // peso_kg pode ser null
{"evento":"agua","bomba":"ligada"}  /  {"evento":"agua","bomba":"desligada"}
{"evento":"alerta","tipo":"reservatorio_vazio"}
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
| Farol esquerdo / direito | chave que trava + LED 220Ω + INA219 | chave de farol + chave "LED removido" (D13 e A3) | chaves A1 e A2; INA219 0x40 e 0x41 no I2C |
| Alerta visual | LED + 220Ω | LED | D12 |
| Console | LCD I2C | lcd1602 i2c | A4, A5 |
| Comunicação | HM-10 | nenhum (sai no Serial com `APP> `) | RX D2 ← TXD, TX D3 → RXD com divisor 1k/2k |

O som é do app (não há buzzer). Prioridade do LCD: proximidade crítica > proximidade em atenção > farol queimado > pista molhada > "Tudo OK". Faixas: atenção ≤ 15 cm, crítico < 5 cm (escala de protótipo; no caminhão real, ×10). Farol queimado = chave ligada e corrente < 3 mA em 3 leituras seguidas (teste: tirar o LED da protoboard).

Detalhes que já foram decididos:
- Cada farol: 5V → chave → (derivação para o pino A1/A2, com 10k para GND) → INA219 (VIN+ → VIN−) → 220Ω → LED → GND. **A orientação do INA219 importa:** VIN+ e VIN− invertidos leem corrente negativa e dão "farol queimado" falso.
- O INA219 da direita precisa do endereço 0x41 (jumper A0 soldado). O sketch lê o registrador de tensão do shunt direto (sem biblioteca); com shunt de 0,1 Ω, 1 unidade = 0,1 mA.
- Com `SIMULACAO 1`, D13 e A3 são duas chaves "LED removido" (chave na direita = LED tirado). O Wokwi não tem INA219.
- Os 4 HC-SR04 são lidos um por vez (50 ms entre eles) para um não ouvir o eco do outro. Apontar todos para fora do caminhão.
- O app toca os sons (bipes de proximidade, tom contínuo no crítico, tons de alerta repetidos a cada 10 s). A 12 cm o intervalo calculado é 480 ms (observado ~500 ms, porque o app confere o som a cada 50 ms).

Protocolo (uma linha a cada ~500 ms): `{"frente_esq":12,"frente_dir":null,"tras_esq":4,"tras_dir":30,"chuva":true,"farol_e":"ok","farol_d":"queimado"}` — distância `null` = sem eco; farol `desligado`, `ok` ou `queimado`.

---

## Pendências
1. **Simulação no Wokwi nunca foi executada** (nem B1, nem B2). Os dois sketches compilam, mas o `wokwi-cli` responde "API Error: Unauthorized": o `WOKWI_CLI_TOKEN` é inválido. O Allysom precisa gerar um token novo (ver `SETUP.md`, seção 3b) e depois rodar, dentro de cada pasta de projeto: `wokwi-cli --timeout 90000 --scenario cenario.yaml --serial-log-file serial.log .` (o B2 também tem `cenario-distancia.yaml`). Os `cenario.yaml` foram reescritos para o firmware novo, mas nunca rodaram. As posições das peças no `diagram.json` do B2 também não foram conferidas visualmente. Os prints antigos do B2 (`prints/b2-*.png`) são do projeto anterior (impacto, pouca luz, ponto cego); não foram apagados, a decisão é do Allysom.
2. Lista de compras: B2 sem SW-18010P, LDR e buzzer; com 3 HC-SR04 e 2 INA219 a mais, 2 chaves, 2 LEDs e 1 HM-10 por projeto. Continua valendo: um LCD e um FC-37 na lista, e os dois projetos usam ambos.
3. App entregue em `B1-Amicao/app` e `B2-AnjosDaEstrada/app` (PWA; ver `docs/PUBLICAR.md`). **Ainda não publicado** (precisa de conta, nome do repositório e aval do Allysom). **Não testado com hardware:** Bluetooth real com o HM-10, som no tablet, Wake Lock no tablet (checklist no README de cada app).
4. Calibração na montagem real: fator da balança, `LIMITE_AGUA`, `LIMITE_CHUVA`, `LIMIAR_CORRENTE_MA` e as faixas de distância (`DIST_ATENCAO_CM`, `DIST_CRITICO_CM`; no caminhão real, ×10).
5. Briefing do B1 ainda fala em Wi-Fi e notificações; a equipe deve ajustar para "Bluetooth para tablet no protótipo".
6. Questões físicas do B1 para discutir com a equipe: o RC522 lê só a 2–5 cm (posição do leitor no totem) e o cachorro precisa ficar inteiro sobre a balança.
7. Problemas conhecidos no firmware (não corrigidos, fora do escopo desta tarefa): no B2, a linha do LCD "Reduza velocidade" tem 17 caracteres e só cabem 16 (o último some). No B1, enquanto atende um cachorro (pesagem, ração, mensagem: vários segundos) o Arduino não lê comandos do app.
