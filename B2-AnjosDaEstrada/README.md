# Anjos da Estrada — BITMAKERS B2

## Como abrir no Wokwi (navegador)
1. Entre em wokwi.com e crie um projeto novo com **Arduino Uno**.
2. Cole o conteúdo de `B2-AnjosDaEstrada.ino` na aba `sketch.ino`.
3. Cole o conteúdo de `diagram.json` na aba `diagram.json`.
4. Clique na seta ao lado das abas, crie o arquivo `libraries.txt` e cole o conteúdo do `libraries.txt` desta pasta.
5. Aperte o play e salve o projeto. O link salvo é o que os alunos vão consultar.

## Como rodar no computador
Veja o `SETUP.md` na pasta principal. Resumo, de dentro desta pasta:
```
arduino-cli compile --fqbn arduino:avr:uno --output-dir build .
wokwi-cli --timeout 10000 .
```

## Peças "dublês" no Wokwi
| No Wokwi | Na montagem real | Como testar |
|---|---|---|
| Potenciômetro | Sensor de chuva FC-37 | Gire pra baixo = pista molhada |
| Botão amarelo | Sensor de vibração SW-18010P | Aperte = impacto |
| HC-SR04 | HC-SR04 | Clique nele e mude a distância |
| LDR | LDR | Clique nele e diminua a luz |

O código é o mesmo nas duas versões.

## Ligação na montagem real
| Componente | Pino do componente | Arduino |
|---|---|---|
| LCD I2C | VCC / GND / SDA / SCL | 5V / GND / A4 / A5 |
| HC-SR04 | VCC / GND / TRIG / ECHO | 5V / GND / 9 / 10 |
| FC-37 (módulo) | VCC / GND / AO | 5V / GND / A0 |
| LDR (módulo) | VCC / GND / AO | 5V / GND / A1 |
| SW-18010P (módulo) | VCC / GND / DO | 5V / GND / 2 |
| Buzzer | + / − | 8 / GND |
| LED + resistor 220Ω | ânodo / cátodo | 7 / GND |

## Calibrando na montagem real
Abra o Monitor Serial (9600). Ele mostra `distancia`, `chuva` e `luz` a cada meio segundo.
- Molhe a placa do FC-37 e veja o valor. Ajuste `LIMITE_CHUVA` entre o valor seco e o molhado.
- Cubra o LDR e ajuste `LIMITE_ESCURO` do mesmo jeito.
- Bata no sensor de vibração. Se o alerta ficar ligado direto (ou nunca aparecer), troque `NIVEL_VIBRACAO` de `LOW` para `HIGH`.
- Se o LCD não mostrar nada, gire o parafusinho azul atrás dele (contraste) e, se precisar, troque o endereço `0x27` por `0x3F`.
