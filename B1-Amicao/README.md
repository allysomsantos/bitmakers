# Amicão — BITMAKERS B1

## Como abrir no Wokwi (navegador)
1. Entre em wokwi.com e crie um projeto novo com **Arduino Uno**.
2. Cole o conteúdo de `B1-Amicao.ino` na aba `sketch.ino`.
3. Cole o conteúdo de `diagram.json` na aba `diagram.json`.
4. Clique na seta ao lado das abas, crie o arquivo `libraries.txt` e cole o conteúdo do `libraries.txt` desta pasta.
5. Aperte o play e salve o projeto. O link salvo é o que os alunos vão consultar.

## Como rodar no computador
Veja o `SETUP.md` na pasta principal. Resumo, de dentro desta pasta:
```
arduino-cli compile --fqbn arduino:avr:uno --output-dir build .
wokwi-cli --timeout 10000 .
```

## Testando a simulação
1. Clique na balança (HX711) e coloque um peso, por exemplo 7 kg.
2. Clique no leitor RC522 e escolha o **Blue Card**: é o Rex.
3. O LCD cumprimenta, pesa e o motor gira soltando a ração.
4. Passe o Rex de novo depois de 3 s e antes de 15 s: ele "já comeu".
5. Escolha outra tag: aparece "Novo amigo" e o código dela sai no Monitor Serial. Copie e cadastre na lista `cachorros[]`.
6. Gire o potenciômetro ao máximo (pote seco): o LED azul (bomba) acende. Gire de volta pra desligar. Se deixar seco por 5 s, o sistema entende que o reservatório acabou, desliga a bomba e manda um alerta.

## Peças "dublês" no Wokwi
| No Wokwi | Na montagem real |
|---|---|
| Motor de passo comum | 28BYJ-48 + ULN2003 |
| LED azul | Bomba d'água + L9110S |
| Potenciômetro | FC-37 colado na parede do pote, na altura do nível desejado |
| Balança 50 kg | Célula de carga 20 kg + HX711 |
| (nada) | Bluetooth HC-06 — no Wokwi os dados aparecem no Monitor Serial com `APP>` |

Antes de gravar na placa real, troque `#define SIMULACAO 1` para `0`.

## Ligação na montagem real
| Componente | Pino do componente | Arduino |
|---|---|---|
| LCD I2C | VCC / GND / SDA / SCL | 5V / GND / A4 / A5 |
| RC522 | 3.3V / GND / RST / SDA / MOSI / MISO / SCK | **3.3V** / GND / 9 / 10 / 11 / 12 / 13 |
| HX711 | VCC / GND / DT / SCK | 5V / GND / A1 / A0 |
| ULN2003 | IN1 / IN2 / IN3 / IN4 | 4 / 5 / 6 / 7 |
| L9110S (motor A = bomba) | A-IA / A-IB | 3 / 8 |
| FC-37 (módulo) | VCC / GND / AO | 5V / GND / A2 |
| Bluetooth HC-06 | VCC / GND / TXD / RXD | 5V / GND / 2 / A3 (com divisor de tensão) |

**Alimentação:** o motor e a bomba NÃO podem ser alimentados pelo 5V do Arduino. Use uma fonte 5V separada no ULN2003 e no L9110S, ligando o GND da fonte no GND do Arduino.

**RC522 no 3.3V**, nunca no 5V.

**Bluetooth HC-06:** o RXD do módulo trabalha em 3.3V. O fio que sai do Arduino (A3) até o RXD precisa de um divisor de tensão: A3 → resistor 1kΩ → RXD, e do RXD → resistor 2kΩ → GND. O TXD do módulo vai direto no pino 2.

Pra conectar: no tablet, abra as configurações de Bluetooth e pareie com o **HC-06** (a senha costuma ser `1234` ou `0000`). Depois, o app conecta nele. Com o módulo pareado mas sem conexão, o LED dele pisca rápido. Conectado, fica aceso direto. O alcance é de uns 10 metros.

## Calibrando a balança
1. Deixe `FATOR_BALANCA = 1.0` e grave.
2. Coloque um peso conhecido (ex.: uma garrafa de 2 L ≈ 2 kg).
3. Adicione `Serial.println(balanca.get_units(10));` no `loop` e veja o número.
4. `FATOR_BALANCA = número / peso em kg`. Grave de novo e confira.

A balança precisa estar vazia quando o Arduino liga (é quando ela zera).

## O que o Amicão manda pro aplicativo
Cada evento é uma linha de JSON:

```json
{"evento":"ligado"}
{"evento":"visita","uid":"0A:0B:0C:0D","peso_kg":7.0,"racao":true}
{"evento":"visita","uid":"0A:0B:0C:0D","peso_kg":null,"racao":false}
{"evento":"agua","bomba":"ligada"}
{"evento":"agua","bomba":"desligada"}
{"evento":"alerta","tipo":"reservatorio_vazio"}
```

- `peso_kg` é `null` quando a leitura deu menos de 1 kg (cachorro fora da balança).
- O Arduino **não sabe a data nem a hora**: quem anota o horário de cada evento é o app/servidor quando recebe.
- Alertas de "sumiu há 3 dias" ou "perdeu peso" são calculados no app, comparando com o histórico. O totem só registra.
