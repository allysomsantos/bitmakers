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
│   ├── libraries.txt    ← só para o wokwi.com no navegador
│   └── README.md        ← guia para os alunos (simulação + montagem real)
└── B2-AnjosDaEstrada/   ← mesma estrutura
```
Tudo que for de um projeto fica dentro da pasta dele. Nunca misture.

## Comandos
De dentro da pasta do projeto:
```
arduino-cli compile --fqbn arduino:avr:uno --output-dir build .
wokwi-cli --timeout 10000 .                      # simula e mostra o Serial
arduino-cli upload --fqbn arduino:avr:uno -p <PORTA> --input-dir build .
arduino-cli monitor -p <PORTA> -c baudrate=9600
```
Sempre compile e simule depois de mudar código. **Os dois projetos ainda não foram compilados nem simulados nenhuma vez** — o primeiro passo é validar os dois.

## Regras que valem para os dois projetos
- Placa: **Arduino Uno** (ATmega328P, 2 KB de RAM — cuidado com `String` e memória; use `F()` em textos fixos do Serial).
- LCD 16x2 I2C, endereço 0x27 (na placa real pode ser 0x3F). **Sem acentos no LCD** (a fonte não tem).
- O mesmo código roda no Wokwi e na placa real. Peças que o Wokwi não tem são substituídas por "dublês" e identificadas com `wokwi-text` no `diagram.json`.
- Limiares de sensores ficam em constantes no topo do arquivo, e o Serial mostra as leituras para calibrar na montagem real.
- Motores e bomba usam fonte 5V externa com GND comum. RC522 e RXD do HC-06 são 3.3V.

---

## B1 — Amicão
Totem comedouro/bebedouro para cachorros de rua. Cada cachorro tem uma tag NFC na coleira; o totem identifica, pesa, libera ração e manda os dados para um **app Android rodando num tablet**, via **Bluetooth HC-06**. Ligado aos ODS 11, 12 e 15.

| Função | Peça real | Dublê no Wokwi | Pinos Uno |
|---|---|---|---|
| Identificação | RC522 | board-mfrc522 (Blue Card uid `0A:0B:0C:0D` = Rex) | SS 10, RST 9, MOSI 11, MISO 12, SCK 13, 3.3V |
| Balança | Célula 20 kg + HX711 | wokwi-hx711 type 50kg | DT A1, SCK A0 |
| Dosador de ração | 28BYJ-48 + ULN2003 | motor de passo bipolar ligado direto | IN1 4, IN2 5, IN3 6, IN4 7 |
| Bomba d'água | Mini bomba + L9110S | LED azul | A-IA 3, A-IB 8 |
| Nível do pote | FC-37 (AO) | potenciômetro | A2 |
| Display | LCD I2C | lcd1602 i2c | A4, A5 |
| Comunicação | HC-06 | nenhum (sai no Serial com `APP> `) | RX D2 ← TXD, TX A3 → RXD com divisor 1k/2k |

Decisões já tomadas:
- `#define SIMULACAO 1/0` troca passos por volta (200 no Wokwi, 2048 no 28BYJ-48), fator da balança (420 no Wokwi; real precisa calibrar) e tempos.
- Stepper declarado como `Stepper(passos, 4, 6, 5, 7)` (ordem IN1-IN3-IN2-IN4). No Wokwi a fiação é D4→A+, D6→A−, D5→B+, D7→B−, então o mesmo código funciona nos dois.
- Peso < 1 kg vai como `null` (cachorro fora da balança).
- Intervalo mínimo entre porções por cachorro (30 s na simulação, 4 h no real).
- Bomba com tempo máximo: se estourar, desliga e manda alerta `reservatorio_vazio`.
- O Arduino **não tem relógio**: o app carimba data/hora ao receber. Alertas de "sumiu" e "perdeu peso" são calculados no app, não no Arduino.
- Tag desconhecida aparece como "Novo amigo" e o UID sai no Serial para cadastro. O cadastro oficial é do app; a lista `cachorros[]` no Arduino serve só para o nome no LCD.

Protocolo para o app (uma linha JSON por evento, 9600 baud):
```
{"evento":"ligado"}
{"evento":"visita","uid":"0A:0B:0C:0D","peso_kg":7.0,"racao":true}
{"evento":"agua","bomba":"ligada"} / {"evento":"agua","bomba":"desligada"}
{"evento":"alerta","tipo":"reservatorio_vazio"}
```

---

## B2 — Anjos da Estrada
Kit de sensores de baixo custo para caminhões antigos, com console na cabine. Ligado aos ODS 3 e 9.

| Função | Peça real | Dublê no Wokwi | Pinos Uno |
|---|---|---|---|
| Ponto cego | HC-SR04 | hc-sr04 | TRIG 9, ECHO 10 |
| Pista molhada | FC-37 (AO) | potenciômetro | A0 |
| Pouca luz | LDR 4 pinos (AO) | photoresistor-sensor | A1 |
| Impacto/vibração | SW-18010P (DO) | botão (INPUT_PULLUP) | D2 |
| Alerta sonoro | buzzer | buzzer | D8 |
| Alerta visual | LED + 220Ω | LED | D7 |
| Console | LCD I2C | lcd1602 i2c | A4, A5 |

Prioridade da tela: ponto cego > impacto > pista molhada > pouca luz > "Tudo OK". Bip de ponto cego estilo sensor de estacionamento. `NIVEL_VIBRACAO` precisa ser confirmado no módulo real (LOW ou HIGH).

---

## Pendências
1. Compilar e simular B1 e B2 (nunca foi feito). Ajustar posições das peças no `diagram.json` se ficarem sobrepostas.
2. **Confirmar quantidades**: a lista de compras tem um LCD e um FC-37, mas os dois projetos usam ambos. O buzzer do B2 não está na lista.
3. App Android do B1 (tablet): ambiente ainda não definido (MIT App Inventor foi sugerido). Precisa conectar no HC-06 e interpretar os JSONs.
4. Calibração na montagem real: fator da balança, `LIMITE_AGUA`, `LIMITE_CHUVA`, `LIMITE_ESCURO`, `NIVEL_VIBRACAO`.
5. Briefing do B1 ainda fala em Wi-Fi e notificações; a equipe deve ajustar para "Bluetooth para tablet no protótipo".
6. Questões físicas do B1 para discutir com a equipe: o RC522 lê só a 2–5 cm (posição do leitor no totem) e o cachorro precisa ficar inteiro sobre a balança.
