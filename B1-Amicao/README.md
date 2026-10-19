# Amicão — BITMAKERS B1

O totem fica no código `B1-Amicao.ino`. O app do tablet fica em `app/` (veja `app/README.md`).

> **Situação (seja honesto com a plateia):** o sketch compila, mas a simulação no Wokwi **ainda não foi executada** (o token do Wokwi CLI estava inválido) e o Bluetooth com o HM-10 de verdade **ainda não foi testado**. O que está abaixo é o que o código faz, não o que já foi visto funcionando.

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
wokwi-cli --timeout 90000 --scenario cenario.yaml --serial-log-file serial.log .
```
O `cenario.yaml` é o roteiro da simulação (cadastro, visita, intervalo, remoção, água). Ele foi escrito, mas nunca rodou: precisa de um token novo do Wokwi CLI.

## Testando a simulação
No Wokwi não existe HM-10 e a EEPROM começa vazia: **ninguém está cadastrado**. Por isso o Rex precisa ser cadastrado antes. No Wokwi (com `SIMULACAO 1`) os comandos do app podem ser digitados no Monitor Serial.

1. Clique na balança (HX711) e coloque um peso, por exemplo 7 kg.
2. Clique no leitor RC522 e escolha o **Blue Card**: é o Rex. Encoste a tag: **nada acontece**, porque ele não está cadastrado. Tag fora da lista não gera mensagem, ração nem Serial.
3. Cadastre o Rex: no Monitor Serial, envie `{"cmd":"permitir","uid":"0A:0B:0C:0D","nome":"Rex"}` e aperte Enter. O Arduino responde com a lista (`APP> {"evento":"cadastros",...}`).
   - Para testar o fluxo completo do app, envie `{"cmd":"cadastrar"}`: o LCD mostra "Modo cadastro" por 30 s, e a próxima tag encostada vira um `tag_lida` no Serial.
4. Encoste o Blue Card de novo: o LCD cumprimenta, pesa e o motor gira soltando a ração.
5. Passe o Rex de novo depois de 3 s e antes de 15 s: ele "já comeu".
6. Gire o potenciômetro ao máximo (pote seco): o LED azul (bomba) acende. Gire de volta pra desligar. Se deixar seco por 5 s, o sistema entende que o reservatório acabou, desliga a bomba e manda um alerta.

## Peças "dublês" no Wokwi
| No Wokwi | Na montagem real |
|---|---|
| Motor de passo comum | 28BYJ-48 + ULN2003 |
| LED azul | Bomba d'água + L9110S |
| Potenciômetro | FC-37 colado na parede do pote, na altura do nível desejado |
| Balança 50 kg | Célula de carga 20 kg + HX711 |
| (nada) | Bluetooth HM-10 (BLE) — no Wokwi os dados aparecem no Monitor Serial com `APP>` |

**Antes de gravar na placa real, troque `#define SIMULACAO 1` para `0`.** O sketch sai com `1`: se você esquecer, o motor gira com os passos do Wokwi (200 em vez de 2048), a balança usa o fator 420 (dá peso errado) e o intervalo de ração é de 15 s em vez de 4 h.

## Ligação na montagem real
| Componente | Pino do componente | Arduino |
|---|---|---|
| LCD I2C | VCC / GND / SDA / SCL | 5V / GND / A4 / A5 |
| RC522 | 3.3V / GND / RST / SDA / MOSI / MISO / SCK | **3.3V** / GND / 9 / 10 / 11 / 12 / 13 |
| HX711 | VCC / GND / DT / SCK | 5V / GND / A1 / A0 |
| ULN2003 | IN1 / IN2 / IN3 / IN4 | 4 / 5 / 6 / 7 |
| L9110S (motor A = bomba) | A-IA / A-IB | 3 / 8 |
| FC-37 (módulo) | VCC / GND / AO | 5V / GND / A2 |
| Bluetooth HM-10 | VCC / GND / TXD / RXD | 3.3V ou 5V (veja abaixo) / GND / 2 / A3 (com divisor de tensão) |

**Alimentação:** o motor e a bomba NÃO podem ser alimentados pelo 5V do Arduino. Use uma fonte 5V separada no ULN2003 e no L9110S, ligando o GND da fonte no GND do Arduino.

**RC522 no 3.3V**, nunca no 5V.

**Bluetooth HM-10 (BLE):** o HM-10 NÃO é igual ao HC-06. O HC-06 é Bluetooth "clássico" e o Chrome do tablet não consegue conectar nele; o HM-10 é BLE e consegue.
- **Alimentação:** olhe a sua placa. Módulo "pelado" (só o chip) é 3.3V. Módulo com plaquinha e regulador costuma aceitar 5V. Na dúvida, use 3.3V.
- **RXD:** o RXD do módulo trabalha em 3.3V. O fio que sai do Arduino (A3) até o RXD precisa de um divisor de tensão: A3 → resistor 1kΩ → RXD, e do RXD → resistor 2kΩ → GND. O TXD do módulo vai direto no pino 2.

### Dando nome ao HM-10 (faça antes de montar no totem)
Os dois projetos usam HM-10. Para o tablet saber qual é qual na hora de parear, cada módulo recebe um nome.
1. Grave este programa de passagem no Arduino e ligue o HM-10 do jeito acima (pinos 2 e A3):
   ```cpp
   #include <SoftwareSerial.h>
   SoftwareSerial bluetooth(2, A3);   // RX no 2, TX no A3 (os mesmos pinos do Amicao)
   void setup() { Serial.begin(9600); bluetooth.begin(9600); }
   void loop() {
     if (bluetooth.available()) Serial.write(bluetooth.read());
     if (Serial.available()) bluetooth.write(Serial.read());
   }
   ```
2. Abra o Monitor Serial a **9600 baud**, com **"Sem final de linha"** (o HM-10 não gosta de `\r\n` nos comandos AT).
3. Digite `AT`: a resposta esperada é `OK`.
4. Digite `AT+NAMEAMICAO`: a resposta esperada é `OK+Set:AMICAO`.
5. Desligue e ligue o módulo de novo para o nome valer. Depois grave o `B1-Amicao.ino` de volta (com `SIMULACAO 0`).

(Os comandos acima são os do HM-10 original; clones podem responder diferente. Isso ainda não foi testado com o módulo de vocês.)

## Cadastrando um cachorro (montagem real)
O totem só atende tags que estão na lista. Quem cadastra é o app:
1. No app (tablet conectado ao AMICAO), toque em **Cadastrar cachorro**.
2. Em até **30 segundos**, encoste a tag da coleira no leitor RC522 (2 a 5 cm).
3. O app mostra "Tag lida!": digite o nome (sem acento, até 10 letras) e tire a foto.
4. Salve. O app manda o nome para o Arduino, que guarda na EEPROM (até 10 cachorros). O LCD passa a mostrar o nome.

Se o tempo de 30 s acabar, a tela avisa e dá o botão "Tentar de novo".

## Demonstração com a pelúcia
Para mostrar o alerta de "perdeu peso" sem esperar semanas: cadastre uma tag e use a pelúcia sempre com **a mesma tag**, mudando o peso na balança. Quatro visitas com 7, 6, 6 e 6 kg disparam o alerta (queda de ~14% na média das últimas visitas). Dá para repetir a demonstração tocando em **Remover** nos Ajustes do app (isso apaga o histórico do cachorro) e cadastrando de novo.

## Calibrando a balança
1. Deixe `FATOR_BALANCA = 1.0` e grave.
2. Coloque um peso conhecido (ex.: uma garrafa de 2 L ≈ 2 kg).
3. Adicione `Serial.println(balanca.get_units(10));` no `loop` e veja o número.
4. `FATOR_BALANCA = número / peso em kg`. Grave de novo e confira.

A balança precisa estar vazia quando o Arduino liga (é quando ela zera).

## O que o Amicão manda pro aplicativo
Cada evento é uma linha de JSON (9600 baud):

```json
{"evento":"ligado"}
{"evento":"visita","uid":"0A:0B:0C:0D","peso_kg":7.0,"racao":true}
{"evento":"visita","uid":"0A:0B:0C:0D","peso_kg":null,"racao":false}
{"evento":"agua","bomba":"ligada"}
{"evento":"agua","bomba":"desligada"}
{"evento":"alerta","tipo":"reservatorio_vazio"}
{"evento":"modo_cadastro","ativo":true}
{"evento":"tag_lida","uid":"0A:0B:0C:0D"}
{"evento":"cadastros","uids":["0A:0B:0C:0D"]}
```

- `peso_kg` é `null` quando a leitura deu menos de 1 kg (cachorro fora da balança).
- `modo_cadastro` com `ativo:false` vem quando o tempo acaba, quando o app cancela ou logo depois de ler uma tag.
- O Arduino **não sabe a data nem a hora**: quem anota o horário de cada evento é o app quando recebe. Se o tablet estiver desconectado, a visita **se perde**.
- Alertas de "perdeu peso" são calculados no app, comparando com o histórico. O totem só registra.

## O que o app manda pro Amicão
```json
{"cmd":"cadastrar"}
{"cmd":"cancelar"}
{"cmd":"listar"}
{"cmd":"permitir","uid":"0A:0B:0C:0D","nome":"Rex"}
{"cmd":"remover","uid":"0A:0B:0C:0D"}
```
O app é a fonte da verdade: toda vez que conecta, manda `listar` e acerta a lista do Arduino. Se o tablet novo não tem cachorros e o totem já tem tags, o app **pergunta** antes de apagar.

## Limites que você precisa saber
- Enquanto o totem atende um cachorro (pesar, soltar ração, mostrar mensagem: alguns segundos), ele **não lê comandos** do app. Um comando enviado nessa hora pode se perder.
- O RC522 lê só a 2 a 5 cm: a posição do leitor no totem precisa ser pensada junto com a balança, porque o cachorro tem que ficar inteiro sobre ela.
