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
O `cenario.yaml` é o roteiro da simulação (cadastro, visita com ração e água, intervalo, remoção). Ele foi escrito, mas nunca rodou: precisa de um token novo do Wokwi CLI.

## Testando a simulação
No Wokwi não existe HM-10 e a EEPROM começa vazia: **ninguém está cadastrado**. Por isso o Rex precisa ser cadastrado antes. No Wokwi (com `SIMULACAO 1`) os comandos do app podem ser digitados no Monitor Serial.

1. Clique na balança (HX711) e coloque um peso, por exemplo 7 kg.
2. Clique no leitor RC522 e escolha o **Blue Card**: é o Rex. Encoste a tag: **nada acontece**, porque ele não está cadastrado. Tag fora da lista não gera mensagem, ração nem Serial.
3. Cadastre o Rex: no Monitor Serial, envie `{"cmd":"permitir","uid":"0A:0B:0C:0D","nome":"Rex"}` e aperte Enter. O Arduino responde com a lista (`APP> {"evento":"cadastros",...}`).
   - Para testar o fluxo completo do app, envie `{"cmd":"cadastrar"}`: o Serial mostra "MSG> Modo cadastro" e ele fica 30 s esperando, e a próxima tag encostada vira um `tag_lida` no Serial.
4. Encoste o Blue Card de novo: o Serial mostra a saudação ("MSG> Ola, Rex!"), pesa e o motor gira soltando a ração.
5. Passe o Rex de novo depois de 3 s e antes de 15 s: ele "já comeu" (no totem real o intervalo é de 1 minuto).
6. A água vem junto com a ração: a cada visita de uma tag cadastrada, o LED azul (bomba) acende por 2 s. Se outro cachorro passar em menos de 8 s, a bomba não liga de novo (intervalo da água).

## Peças "dublês" no Wokwi
| No Wokwi | Na montagem real |
|---|---|
| Motor de passo comum | 28BYJ-48 + ULN2003 |
| LED azul | Bomba d'água + módulo relé |
| Balança 50 kg | Célula de carga 20 kg + HX711 |
| (nada) | Bluetooth HM-10 (BLE) — no Wokwi os dados aparecem no Monitor Serial com `APP>` |

**O `B1-Amicao.ino` está com `#define SIMULACAO 0` (montagem real), pronto para o app.** Para simular no Wokwi, troque para `1` (e volte para `0` antes de gravar na placa). Com `1` na placa real, o motor gira com os passos do Wokwi (200 em vez de 2048), a balança usa o fator 420 (dá peso errado) e o intervalo de ração é de 15 s em vez de 4 h. Antes do primeiro uso, calibre a balança com o `testes/teste-geral` e cole o número em `FATOR_BALANCA`; enquanto estiver 1.0, o Serial avisa "balanca sem calibrar".

## Ligação na montagem real
| Componente | Pino do componente | Arduino |
|---|---|---|
| RC522 | 3.3V / GND / RST / SDA / MOSI / MISO / SCK | **3.3V** / GND / 9 / 10 / 11 / 12 / 13 |
| HX711 | VCC / GND / DT / SCK | 5V / GND / A1 / A0 |
| ULN2003 | IN1 / IN2 / IN3 / IN4 | 4 / 5 / 6 / 7 |
| Módulo relé (bomba) | IN / GND / VCC | 3 / GND / 5V da fonte separada |
| Bluetooth HM-10 | VCC / GND / TXD / RXD | **5V da fonte** (módulo com regulador; veja abaixo) / GND / 2 / A3 (com divisor de tensão) |

**Alimentação:** o motor, o relé e a bomba NÃO podem ser alimentados pelo 5V do Arduino. Use uma **fonte de 5V separada, de 2A ou mais** (motor 0,25 A + relé 0,08 A + bomba 0,3 a 0,7 A, com pico maior na partida). O +5V dela vai no `+` do ULN2003, no VCC e no COM do relé e no VCC do HX711 e no VCC do HM-10 (tudo que é 5V); o GND dela é ligado no GND do Arduino (GND comum, obrigatório). **Nunca ligue o +5V da fonte no pino 5V do Arduino**: são duas fontes e elas brigam. O Arduino é alimentado à parte (USB ou jack). O RC522 fica no 3,3V do Arduino do leitor (segundo Arduino, ver abaixo); no Arduino principal, nem o 5V nem o 3,3V são usados. Ligue a fonte e o Arduino juntos (régua com interruptor): o HX711 e o HM-10 trocam sinais com o Arduino e, ligados sozinhos, podem puxar energia por esses fios. Se o peso oscilar quando o motor ou a bomba ligam, ponha um capacitor de 100 µF perto do HX711 (entre VCC e GND): a pesagem é feita antes do motor e da bomba, então normalmente não atrapalha. O diagrama está em `ligacoes/5-alimentacao.svg`. Com a bomba ligada por **relé**, ponha um diodo 1N4007 em paralelo com ela (faixa no lado do +): evita que o pico de desligamento trave ou resete o Arduino. Capacitor é opcional: só use (470 µF na saída da fonte de 5V, ou 100 nF cerâmico nos terminais da bomba) se algo falhar quando a bomba ligar.

**Relé:** o módulo de 3 pinos (IN, GND, VCC) com transistor liga com sinal `HIGH`, e o sketch já está assim. Se o relé ligar sozinho quando o Arduino liga (LED vermelho aceso), o seu liga com `LOW`: troque `NIVEL_BOMBA_LIGADA` no sketch. Teste a bomba sem água antes de ligar o totem.

**Água sem sensor:** não há sensor de nível. A cada tag cadastrada a bomba liga por `TEMPO_BOMBA` (8 s na montagem real; calibre pelo tamanho do pote) e só repete depois de `INTERVALO_AGUA` (1 minuto, igual ao da ração). Com intervalos curtos, cuidado para o pote não transbordar. Por isso o app não recebe mais o alerta `reservatorio_vazio`.

**RC522 no 3.3V**, nunca no 5V.

**Bluetooth HM-10 (BLE):** o HM-10 NÃO é igual ao HC-06. O HC-06 é Bluetooth "clássico" e o Chrome do tablet não consegue conectar nele; o HM-10 é BLE e consegue.
- **Alimentação:** no projeto o VCC vai no 5V da fonte separada. Isso só vale se a plaquinha tem regulador (serigrafia "3.3V-6V" ou chip de regulador perto do VCC). Módulo "pelado" (só o chip CC2541) é 3,3V e queima com 5V: nesse caso use o 3,3V do Arduino. Na dúvida, comece pelo 3,3V.
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
2. Abra o Monitor Serial a **9600 baud**, com **"Sem final de linha"** (o HM-10 não gosta de `\r\n` nos comandos AT). Os comandos AT só funcionam **enquanto nenhum celular ou tablet estiver conectado** ao módulo.
3. Digite `AT`: a resposta esperada é `OK`.
4. Digite `AT+NAMEAMICAO`: a resposta esperada é `OK+Set:AMICAO`.
5. Desligue e ligue o módulo de novo para o nome valer. Depois grave o `B1-Amicao.ino` de volta (com `SIMULACAO 0`).

(Os comandos acima são os do HM-10 original; clones podem responder diferente. Isso ainda não foi testado com o módulo de vocês.)

## RFID em um segundo Arduino (opcional)
Se o RC522 falhar quando está ligado junto com o resto, use um **segundo Arduino só para ele**:
1. Grave `leitor-rfid/leitor-rfid.ino` no segundo Arduino e ligue o RC522 nele (SDA 10, SCK 13, MOSI 11, MISO 12, RST 9, 3.3V, GND). Teste sozinho: o Serial Monitor mostra cada tag lida.
2. Ligue os dois Arduinos por **3 fios**: A4 com A4 (SDA), A5 com A5 (SCL) e GND com GND. Nunca ligue o 5V de um no 5V do outro. O segundo Arduino tem a própria alimentação (USB).
3. No `B1-Amicao.ino`, `#define RFID_EXTERNO 1` (padrão). O principal não usa mais o RC522 e pergunta o UID ao leitor. Se não tiver o segundo Arduino, mude para `0` e ligue o RC522 no próprio Arduino.
4. Se a comunicação falhar, ponha um resistor de 4,7 kΩ de A4 e de A5 para o 5V (resistores de pull-up) e mantenha os fios curtos.

## Cadastrando um cachorro (montagem real)
O totem só atende tags que estão na lista. Quem cadastra é o app:
1. No app (tablet conectado ao AMICAO), toque em **Cadastrar cachorro**.
2. Em até **30 segundos**, encoste a tag da coleira no leitor RC522 (2 a 5 cm).
3. O app mostra "Tag lida!": digite o nome (sem acento, até 10 letras) e tire a foto.
4. Salve. O app manda o nome para o Arduino, que guarda na EEPROM (até 10 cachorros). O nome aparece no app (o totem não tem display).

Se o tempo de 30 s acabar, a tela avisa e dá o botão "Tentar de novo".

## Demonstração com a pelúcia
Para mostrar o alerta de peso: cadastre uma tag e use a pelúcia sempre com **a mesma tag**, mudando o peso na balança. Cada pesagem é comparada com a média das anteriores, e **20% ou mais de diferença, para mais ou para menos**, aciona o alerta (vale a partir da segunda pesagem). Exemplo: 10 kg e depois 7 kg dispara (−30%). Dá para repetir a demonstração tocando em **Remover** nos Ajustes do app (isso apaga o histórico do cachorro) e cadastrando de novo.

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
{"evento":"modo_cadastro","ativo":true}
{"evento":"tag_lida","uid":"0A:0B:0C:0D"}
{"evento":"cadastros","uids":["0A:0B:0C:0D"]}
```

- `peso_kg` é `null` quando a leitura deu menos de 1 kg (cachorro fora da balança).
- `modo_cadastro` com `ativo:false` vem quando o tempo acaba, quando o app cancela ou logo depois de ler uma tag.
- O Arduino **não sabe a data nem a hora**: quem anota o horário de cada evento é o app quando recebe. Se o tablet estiver desconectado, a visita **se perde**.
- O alerta de peso (20% para mais ou para menos) é calculado no app, comparando com o histórico. O totem só registra.
- `racao` (`motor` ligado/desligado) e `agua` (`bomba` ligada/desligada) acendem os ícones do motor e da bomba.
- `status` (a cada 5 s): `{"evento":"status","leitor":true,"balanca":true}`. O app mostra no topo um ícone verde ou vermelho para o Bluetooth, o leitor de tags e a balança. O motor da ração (ícone de motor) e a bomba d'água (ícone de bomba) também aparecem, mas **sem verde/vermelho**: não têm sensor de retorno, então o ícone só fica cinza (parado) ou azul piscando (o totem mandou ligar). Para saber se funcionaram de verdade seria preciso um sensor de corrente (INA219).

## O que o app manda pro Amicão
```json
{"cmd":"cadastrar"}
{"cmd":"cancelar"}
{"cmd":"listar"}
{"cmd":"permitir","uid":"0A:0B:0C:0D","nome":"Rex"}
{"cmd":"remover","uid":"0A:0B:0C:0D"}
```
O app é a fonte da verdade: toda vez que conecta, manda `listar` e acerta a lista do Arduino. Se o tablet novo não tem cachorros e o totem já tem tags, o app **pergunta** antes de apagar.

## Regra do totem ocupado
Enquanto o totem pesa, solta a ração e enche a água, ele **lê e descarta** qualquer tag nova (no Serial aparece `MSG> Tag ignorada (totem ocupado)`). A tag só volta a valer depois que o processo termina; o cachorro precisa encostar de novo.

## Limites que você precisa saber
- O totem lê os comandos do app durante as esperas (pesagem e mensagem), mas o **movimento do motor da ração continua bloqueando** por alguns segundos. O app manda **um comando por vez** e espera a resposta do Arduino (até 1,5 s) antes de mandar o próximo, para não encher o buffer do módulo Bluetooth (63 bytes).
- O RC522 lê só a 2 a 5 cm: a posição do leitor no totem precisa ser pensada junto com a balança, porque o cachorro tem que ficar inteiro sobre ela.
