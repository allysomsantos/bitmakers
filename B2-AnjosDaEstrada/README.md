# Anjos da Estrada — BITMAKERS B2

O kit fica no código `B2-AnjosDaEstrada.ino`. O painel da cabine (app no tablet) fica em `app/` (veja `app/README.md`).

> **Situação (seja honesto com a plateia):** o sketch compila, mas a simulação no Wokwi **ainda não foi executada** (o token do Wokwi CLI estava inválido), as posições das peças no `diagram.json` **não foram conferidas visualmente**, e o Bluetooth com o HM-10 de verdade **ainda não foi testado**. O que está abaixo é o que o código faz, não o que já foi visto funcionando.

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
wokwi-cli --timeout 90000 --scenario cenario.yaml --serial-log-file serial.log .
```
O `cenario.yaml` (e o `cenario-distancia.yaml`) são roteiros da simulação. Foram escritos para o firmware novo, mas nunca rodaram: precisam de um token novo do Wokwi CLI. As imagens antigas em `prints/` são do projeto anterior (impacto, pouca luz, ponto cego) e não valem mais.

## Peças "dublês" no Wokwi
| No Wokwi | Na montagem real | Como testar |
|---|---|---|
| 4 × HC-SR04 | 4 × HC-SR04 | Clique em cada um e mude a distância |
| Potenciômetro | Sensor de chuva FC-37 | Gire pra baixo = pista molhada |
| LED + 220 Ω (esq e dir), sempre acesos | LED + 220 Ω + INA219 medindo a corrente | Os faróis ficam sempre ligados |
| Chave deslizante "LED removido" (D13 e A3) | Tirar o LED da protoboard | Chave na direita = LED tirado (corrente zero) = farol queimado |
| (nada) | Bluetooth HM-10 (BLE) | Os dados aparecem no Monitor Serial com `APP>` |

O Wokwi **não tem INA219**. Por isso, com `SIMULACAO 1`, os pinos D13 e A3 viram as chaves "LED removido". O resto do código é o mesmo nas duas versões.

**Antes de gravar na placa real, troque `#define SIMULACAO 1` para `0`.** O sketch sai com `1`: se você esquecer, o sketch lê os pinos D13 e A3 (as chaves "LED removido", que na montagem real não existem) no lugar dos INA219, acha que sempre há corrente, e o farol **nunca** aparece como queimado.

## Ligação na montagem real
**Alimentação:** fonte de tomada **12V 2A** no jack do Arduino. Se o regulador do Arduino esquentar (12V na entrada), use um step-down **LM2596** ajustado em **5,0V** (multímetro, antes de ligar) e ligue a saída no pino **5V** do Arduino, sem o USB do computador ao mesmo tempo.

| Componente | Pino do componente | Arduino |
|---|---|---|
| LCD I2C | VCC / GND / SDA / SCL | 5V / GND / A4 / A5 |
| HC-SR04 frente esquerda | VCC / GND / TRIG / ECHO | 5V / GND / 8 / 9 |
| HC-SR04 frente direita | VCC / GND / TRIG / ECHO | 5V / GND / 10 / 11 |
| HC-SR04 trás esquerda | VCC / GND / TRIG / ECHO | 5V / GND / 4 / 5 |
| HC-SR04 trás direita | VCC / GND / TRIG / ECHO | 5V / GND / 6 / 7 |
| FC-37 (módulo) | VCC / GND / AO | 5V / GND / A0 |
| INA219 esquerdo | VCC / GND / SDA / SCL | 5V / GND / A4 / A5 (endereço 0x40) |
| INA219 direito | VCC / GND / SDA / SCL | 5V / GND / A4 / A5 (endereço 0x41) |
| Bluetooth HM-10 | VCC / GND / TXD / RXD | 3.3V ou 5V (veja abaixo) / GND / 2 / 3 (com divisor de tensão) |

O LCD e os dois INA219 ficam todos no mesmo par SDA/SCL (A4/A5). Cada um tem um endereço diferente, por isso funciona. Não há LED de alerta nem chave de farol: o aviso é o LCD e o som do app.

### Os 4 sensores de distância
Um em cada canto do caminhão, **apontados para fora**: frente esquerda, frente direita, trás esquerda, trás direita. O sketch lê um sensor de cada vez (75 ms entre eles) para um não "ouvir" o eco do outro. O sensor tem que ver o obstáculo de frente: ângulo muito inclinado devolve eco errado ou nenhum eco.

### Faróis (INA219 + LED, sempre ligados)
O farol esquerdo e o direito ficam sempre acesos. Cada um é um pequeno circuito, e a **ordem das peças importa**:

```
5V → INA219 VIN+  →  INA219 VIN−  → resistor 220Ω → LED → GND
```
- Um INA219 por farol: cada um mede a corrente do seu LED e por isso o sketch sabe qual farol queimou.
- **Atenção à orientação do INA219:** a corrente tem que entrar por **VIN+** e sair por **VIN−**. Se você trocar os dois, o INA219 lê corrente **negativa**, o sketch entende "sem corrente" e dá **"farol queimado" falso** com o LED aceso. Se isso acontecer, confira esse ponto antes de procurar outro defeito.
- O INA219 do **farol direito** precisa do endereço **0x41**: solde o jumper **A0** da placa. O do esquerdo fica com o endereço padrão 0x40.
- O sketch conversa com o INA219 direto (sem biblioteca). Com o resistor de shunt de 0,1 Ω que vem na placa, cada unidade lida vale 0,1 mA.

### Teste do farol queimado
1. Ligue o kit: os dois LEDs acendem. No Monitor Serial, `mA_esq` (ou `mA_dir`) mostra uns 10 a 15 mA, e o JSON mostra `"farol_e":"ok"`.
2. Tire um LED da protoboard.
3. Depois de 3 leituras seguidas abaixo de 3 mA (cerca de 1 segundo), o JSON passa para `"queimado"`, o LCD mostra "FAROL QUEIMADO" e o app avisa.
4. Se ligar o kit com o LED já tirado, também dá "queimado". Recolocou o LED: volta para `"ok"` e o alerta some.

### Bluetooth HM-10 (BLE)
O HM-10 NÃO é igual ao HC-06. O HC-06 é Bluetooth "clássico" e o Chrome do tablet não conecta nele; o HM-10 é BLE e conecta.
- **Alimentação:** módulo "pelado" (só o chip) é 3.3V. Módulo com plaquinha e regulador costuma aceitar 5V. Na dúvida, use 3.3V.
- **RXD:** o RXD do módulo trabalha em 3.3V. O fio que sai do Arduino (pino 3) até o RXD precisa de um divisor: pino 3 → resistor 1kΩ → RXD, e do RXD → resistor 2kΩ → GND. O TXD do módulo vai direto no pino 2.

### Dando nome ao HM-10 (faça antes de montar no caminhão)
Os dois projetos usam HM-10. Para o tablet saber qual é qual na hora de parear, cada módulo recebe um nome.
1. Grave este programa de passagem no Arduino e ligue o HM-10 do jeito acima (pinos 2 e 3):
   ```cpp
   #include <SoftwareSerial.h>
   SoftwareSerial bluetooth(2, 3);   // RX no 2, TX no 3 (os mesmos pinos do Anjos da Estrada)
   void setup() { Serial.begin(9600); bluetooth.begin(9600); }
   void loop() {
     if (bluetooth.available()) Serial.write(bluetooth.read());
     if (Serial.available()) bluetooth.write(Serial.read());
   }
   ```
2. Abra o Monitor Serial a **9600 baud**, com **"Sem final de linha"** (o HM-10 não gosta de `\r\n` nos comandos AT). Os comandos AT só funcionam **enquanto nenhum celular ou tablet estiver conectado** ao módulo.
3. Digite `AT`: a resposta esperada é `OK`.
4. Digite `AT+NAMEANJOS`: a resposta esperada é `OK+Set:ANJOS`.
5. Desligue e ligue o módulo de novo para o nome valer. Depois grave o `B2-AnjosDaEstrada.ino` de volta (com `SIMULACAO 0`).

(Os comandos acima são os do HM-10 original; clones podem responder diferente. Isso ainda não foi testado com o módulo de vocês.)

## Como o console decide o que mostrar
O LCD mostra uma coisa de cada vez, da mais urgente para a menos urgente:
1. Proximidade **crítica** (menos de 10 cm)
2. Proximidade em **atenção** (de 20 a 10 cm)
3. Farol queimado
4. Pista molhada
5. "Tudo OK"

O **som é do app** no tablet: não existe buzzer no kit. As distâncias são de **protótipo**; num caminhão de verdade, multiplique por 10.

## O que o Anjos da Estrada manda pro aplicativo
Uma linha de JSON a cada 0,6 segundo, mais ou menos (9600 baud):

```json
{"frente_esq":12,"frente_dir":null,"tras_esq":4,"tras_dir":30,"chuva":true,"farol_e":"ok","farol_d":"queimado"}
```
- Distância em cm. `null` = sem eco (nada à frente do sensor).
- `chuva`: `true` ou `false`.
- `farol_e` e `farol_d`: `"ok"` ou `"queimado"` (o farol fica sempre ligado; o app ainda aceita `"desligado"`, mas o kit não manda).
- O app não manda nada de volta para o Arduino.

## Calibrando na montagem real
Abra o Monitor Serial (9600). Ele mostra o JSON (`APP> ...`) e uma linha `DEBUG chuva=... mA_esq=... mA_dir=...` a cada leitura.
- Molhe a placa do FC-37 e veja o valor `chuva`. Ajuste `LIMITE_CHUVA` entre o valor seco e o molhado.
- Veja a corrente (`mA_esq`, `mA_dir`) com o LED aceso e com o LED tirado. Ajuste `LIMIAR_CORRENTE_MA` (hoje 3 mA) entre os dois valores.
- Confira as distâncias com uma régua. As faixas (atenção e crítico) ficam em `app/js/faixas.js`; o Arduino só manda a distância medida.
- Se o LCD não mostrar nada, gire o parafusinho azul atrás dele (contraste) e, se precisar, troque o endereço `0x27` por `0x3F`.
- Sem acentos no LCD: a fonte dele não tem.
