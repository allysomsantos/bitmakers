/*
  ANJOS DA ESTRADA — BITMAKERS B2
  Kit de seguranca para veiculos antigos. Manda tudo pro app no tablet.

  Sensores:
    - 4 x HC-SR04 ........ proximidade: frente esquerda/direita e tras esquerda/direita
    - FC-37 .............. pista molhada   (no Wokwi: potenciometro)
    - 2 x LED ............ farois (sempre ligados). LED sem corrente = farol queimado
                           (medido pelo INA219 ou pela tensao do LED, veja MODO_FAROL)
  Saida:
    - Bluetooth HM-10 .... manda as leituras pro app (o som e as telas ficam no app)

  O codigo e o MESMO no Wokwi e na montagem real; so mudam SIMULACAO e MODO_FAROL.
  Na montagem real, abra o Monitor Serial e ajuste os LIMITES abaixo
  olhando os valores que os sensores de verdade mostram.
*/

#define SIMULACAO 0          // 1 = Wokwi   |   0 = montagem real
#define MODO_FAROL 2         // como saber se o LED queimou (so vale com SIMULACAO 0):
                             //   0 = farois nao montados (manda "desligado")
                             //   1 = INA219 mede a corrente do LED (I2C: A4 e A5)
                             //   2 = le a tensao do LED direto no Arduino (A1 e A2), sem INA219
#define LED_NO_LADO_DO_5V 0  // so no MODO_FAROL 2: ordem das pecas em cada farol
                             //   1 = 5V -> LED -> 220 ohms -> GND   (fio do A1/A2 no ponto entre os dois)
                             //   0 = 5V -> 220 ohms -> LED -> GND   (fio do A1/A2 no ponto entre os dois)

#include <Wire.h>
#include <SoftwareSerial.h>

// ---------------- PINOS ----------------
const int PINO_BT_RX = 2;   // TXD do HM-10 (o B2 so envia, mas o pino fica reservado)
const int PINO_BT_TX = 3;   // RXD do HM-10 (com divisor de tensao 1k/2k!)

// Sensores de proximidade, na ordem: 0 frente esq, 1 frente dir, 2 tras esq, 3 tras dir
// (na montagem, os sensores dos pinos 8 a 11 ficaram na frente e os dos pinos 4 a 7 atras)
const int PINOS_TRIG[4] = { 8, 10, 4, 6 };
const int PINOS_ECHO[4] = { 9, 11, 5, 7 };

const int PINO_CHUVA = A0;  // FC-37 AO

#if SIMULACAO
  const int PINO_SEM_LED_ESQ = 13;  // Wokwi: chave "LED esquerdo removido" (LOW = removido)
  const int PINO_SEM_LED_DIR = A3;  // Wokwi: chave "LED direito removido"  (LOW = removido)
#else
  const byte ENDERECO_INA_ESQ = 0x40;  // MODO_FAROL 1: INA219 do farol esquerdo
  const byte ENDERECO_INA_DIR = 0x41;  // MODO_FAROL 1: INA219 do farol direito (jumper A0 soldado)
  const int PINOS_LED[2] = { A1, A2 };  // MODO_FAROL 2: ponto entre o resistor 220 e o LED (A1 = esquerdo, A2 = direito)
#endif

// ---------------- AJUSTES ----------------
// As faixas de distancia (atencao / critico) ficam no app.
const int   LIMITE_CHUVA    = 500;   // FC-37: valor CAI quando molha. Abaixo = molhado
const float LIMIAR_CORRENTE_MA = 3.0;  // MODO_FAROL 1: corrente abaixo disso = LED queimado/removido
const int   LIMITE_TENSAO_LED = 300;   // MODO_FAROL 2, LED_NO_LADO_DO_5V 1: LED aceso le ~650; queimado/removido cai a ~30. Abaixo disso = queimado
const int   LIMITE_TENSAO_LED_ALTO = 900;  // MODO_FAROL 2, LED_NO_LADO_DO_5V 0: LED aceso le ~400 a 650; queimado/removido sobe a ~1023. Acima disso = queimado
const int   LEITURAS_PARA_QUEIMADO = 3;  // leituras seguidas sem corrente antes de avisar
const unsigned long TEMPO_ECO_US = 25000UL;  // espera o eco por 25 ms (cerca de 4 m)
const int   INTERVALO_SENSORES_MS = 75;    // pausa entre um sensor e o proximo (o som do anterior precisa sumir)

const char* CHAVES_JSON[4]  = { "frente_esq", "frente_dir", "tras_esq", "tras_dir" };

SoftwareSerial bluetooth(PINO_BT_RX, PINO_BT_TX);

int distancia[4];                  // em cm; -1 = sem eco
int leiturasSemCorrente[2] = { 0, 0 };
float correnteMa[2] = { 0, 0 };    // so para mostrar no Serial (MODO_FAROL 1)
int leituraLed[2] = { 0, 0 };      // so para mostrar no Serial (MODO_FAROL 2)

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

// true se o LED do farol esta queimado/removido nesta leitura. lado: 0 = esquerdo, 1 = direito.
bool ledSemCorrente(int lado) {
#if !SIMULACAO && MODO_FAROL == 2
  // O pino le o ponto entre o resistor e o LED.
  leituraLed[lado] = analogRead(PINOS_LED[lado]);
#if LED_NO_LADO_DO_5V
  // 5V -> LED -> 220 ohms -> GND. LED aceso: o ponto fica em 5 V menos a tensao do LED (~3 V).
  // LED aberto: sem corrente, o resistor puxa o ponto para 0 V.
  return leituraLed[lado] < LIMITE_TENSAO_LED;
#else
  // 5V -> 220 ohms -> LED -> GND. LED aceso: o ponto fica na tensao do LED (~2 V).
  // LED aberto: sem corrente, o ponto sobe a 5 V.
  return leituraLed[lado] > LIMITE_TENSAO_LED_ALTO;
#endif
#else
  correnteMa[lado] = lerCorrenteMa(lado);
  return correnteMa[lado] < LIMIAR_CORRENTE_MA;
#endif
}

// "ok" ou "queimado". O farol fica sempre ligado: queimado = sem corrente varias leituras seguidas.
// Sem os farois montados (MODO_FAROL 0), manda "desligado" (o app mostra "Desligado" em vez de dar alarme falso).
const char* estadoFarol(int lado) {
#if !SIMULACAO && MODO_FAROL == 0
  return "desligado";
#else
  if (ledSemCorrente(lado)) {
    if (leiturasSemCorrente[lado] < 100) leiturasSemCorrente[lado]++;
  } else {
    leiturasSemCorrente[lado] = 0;
  }
  return leiturasSemCorrente[lado] >= LEITURAS_PARA_QUEIMADO ? "queimado" : "ok";
#endif
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
#if SIMULACAO
  pinMode(PINO_SEM_LED_ESQ, INPUT_PULLUP);
  pinMode(PINO_SEM_LED_DIR, INPUT_PULLUP);
#endif
}

void loop() {
  // 1. LER OS SENSORES (um de cada vez, pra um sensor nao ouvir o eco do outro)
  for (int i = 0; i < 4; i++) {
    distancia[i] = medirCm(i);
    delay(INTERVALO_SENSORES_MS);
  }
  int chuvaBruto = analogRead(PINO_CHUVA);
  bool chuva = chuvaBruto < LIMITE_CHUVA;
  const char* farolE = estadoFarol(0);
  const char* farolD = estadoFarol(1);

  // 2. ENVIAR PRO APP (o som e as telas sao do app no tablet) (Serial com "APP> " e Bluetooth)
  Serial.print(F("APP> "));
  imprimirLeitura(Serial, chuva, farolE, farolD);
  imprimirLeitura(bluetooth, chuva, farolE, farolD);

  // 3. VALORES BRUTOS NO MONITOR SERIAL (pra calibrar na montagem real)
  Serial.print(F("DEBUG chuva=")); Serial.print(chuvaBruto);
#if !SIMULACAO && MODO_FAROL == 2
  Serial.print(F("  led_esq="));   Serial.print(leituraLed[0]);
  Serial.print(F("  led_dir="));   Serial.println(leituraLed[1]);
#else
  Serial.print(F("  mA_esq="));    Serial.print(correnteMa[0], 1);
  Serial.print(F("  mA_dir="));    Serial.println(correnteMa[1], 1);
#endif
}
