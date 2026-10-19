/*
  ANJOS DA ESTRADA — BITMAKERS B2
  Console de seguranca para veiculos antigos.

  Sensores:
    - 4 x HC-SR04 ........ proximidade: frente esquerda/direita e tras esquerda/direita
    - FC-37 .............. pista molhada   (no Wokwi: potenciometro)
    - 2 x chave + LED + INA219 .. farois. Chave ligada e sem corrente no LED = farol queimado
  Saidas:
    - LCD 16x2 I2C ....... console do motorista
    - LED ................ alerta
    - Bluetooth HM-10 .... manda tudo pro app no tablet (o som fica no app)

  O codigo e o MESMO no Wokwi e na montagem real; so muda SIMULACAO.
  Na montagem real, abra o Monitor Serial e ajuste os LIMITES abaixo
  olhando os valores que os sensores de verdade mostram.
*/

#define SIMULACAO 1   // 1 = Wokwi   |   0 = montagem real

#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <SoftwareSerial.h>

// ---------------- PINOS ----------------
const int PINO_BT_RX = 2;   // TXD do HM-10 (o B2 so envia, mas o pino fica reservado)
const int PINO_BT_TX = 3;   // RXD do HM-10 (com divisor de tensao 1k/2k!)

// Sensores de proximidade, na ordem: 0 frente esq, 1 frente dir, 2 tras esq, 3 tras dir
const int PINOS_TRIG[4] = { 4, 6, 8, 10 };
const int PINOS_ECHO[4] = { 5, 7, 9, 11 };

const int PINO_LED       = 12;  // LED de alerta
const int PINO_CHUVA     = A0;  // FC-37 AO
const int PINO_CHAVE_ESQ = A1;  // chave do farol esquerdo (HIGH = ligada)
const int PINO_CHAVE_DIR = A2;  // chave do farol direito  (HIGH = ligada)

#if SIMULACAO
  const int PINO_SEM_LED_ESQ = 13;  // Wokwi: chave "LED esquerdo removido" (LOW = removido)
  const int PINO_SEM_LED_DIR = A3;  // Wokwi: chave "LED direito removido"  (LOW = removido)
#else
  const byte ENDERECO_INA_ESQ = 0x40;  // INA219 do farol esquerdo
  const byte ENDERECO_INA_DIR = 0x41;  // INA219 do farol direito (jumper A0 soldado)
#endif

// ---------------- AJUSTES ----------------
const int   DIST_ATENCAO_CM = 15;    // de 15 a 5 cm: atencao (escala de prototipo; no caminhao real, x10)
const int   DIST_CRITICO_CM = 5;     // abaixo de 5 cm: critico
const int   LIMITE_CHUVA    = 500;   // FC-37: valor CAI quando molha. Abaixo = molhado
const float LIMIAR_CORRENTE_MA = 3.0;  // chave ligada e corrente abaixo disso = LED queimado/removido
const int   LEITURAS_PARA_QUEIMADO = 3;  // leituras seguidas sem corrente antes de avisar
const unsigned long TEMPO_ECO_US = 25000UL;  // espera o eco por 25 ms (cerca de 4 m)

const char* NOMES_CURTOS[4] = { "F.Esq", "F.Dir", "T.Esq", "T.Dir" };
const char* CHAVES_JSON[4]  = { "frente_esq", "frente_dir", "tras_esq", "tras_dir" };

LiquidCrystal_I2C lcd(0x27, 16, 2);
SoftwareSerial bluetooth(PINO_BT_RX, PINO_BT_TX);

int distancia[4];                  // em cm; -1 = sem eco
int leiturasSemCorrente[2] = { 0, 0 };
float correnteMa[2] = { 0, 0 };    // so para mostrar no Serial

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

// Indice do sensor com o objeto mais perto, ou -1 se nenhum viu nada.
int sensorMaisPerto() {
  int melhor = -1;
  for (int i = 0; i < 4; i++) {
    if (distancia[i] >= 0 && (melhor < 0 || distancia[i] < distancia[melhor])) melhor = i;
  }
  return melhor;
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

// "desligado", "ok" ou "queimado". Queimado = chave ligada e sem corrente varias leituras seguidas.
const char* estadoFarol(int lado) {
  bool ligada = digitalRead(lado == 0 ? PINO_CHAVE_ESQ : PINO_CHAVE_DIR) == HIGH;
  if (!ligada) {
    leiturasSemCorrente[lado] = 0;
    correnteMa[lado] = 0;
    return "desligado";
  }
  correnteMa[lado] = lerCorrenteMa(lado);
  if (correnteMa[lado] < LIMIAR_CORRENTE_MA) {
    if (leiturasSemCorrente[lado] < 100) leiturasSemCorrente[lado]++;
  } else {
    leiturasSemCorrente[lado] = 0;
  }
  return leiturasSemCorrente[lado] >= LEITURAS_PARA_QUEIMADO ? "queimado" : "ok";
}

// ---------------- LCD ----------------
// Escreve uma linha inteira no LCD (completa com espacos pra apagar o resto)
void escreverLinha(int linha, String texto) {
  while (texto.length() < 16) texto += " ";
  lcd.setCursor(0, linha);
  lcd.print(texto);
}

void mostrar(String linha1, String linha2) {
  escreverLinha(0, linha1);
  escreverLinha(1, linha2);
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
  pinMode(PINO_LED, OUTPUT);
  pinMode(PINO_CHAVE_ESQ, INPUT);   // a chave tem resistor de 10k pro GND
  pinMode(PINO_CHAVE_DIR, INPUT);
#if SIMULACAO
  pinMode(PINO_SEM_LED_ESQ, INPUT_PULLUP);
  pinMode(PINO_SEM_LED_DIR, INPUT_PULLUP);
#endif

  lcd.init();
  lcd.backlight();
  mostrar("ANJOS DA ESTRADA", "Iniciando...");
  delay(1500);
}

void loop() {
  // 1. LER OS SENSORES (um de cada vez, pra um sensor nao ouvir o eco do outro)
  for (int i = 0; i < 4; i++) {
    distancia[i] = medirCm(i);
    delay(50);
  }
  int chuvaBruto = analogRead(PINO_CHUVA);
  bool chuva = chuvaBruto < LIMITE_CHUVA;
  const char* farolE = estadoFarol(0);
  const char* farolD = estadoFarol(1);
  bool queimadoE = strcmp(farolE, "queimado") == 0;
  bool queimadoD = strcmp(farolD, "queimado") == 0;

  int perto = sensorMaisPerto();
  bool critico = perto >= 0 && distancia[perto] < DIST_CRITICO_CM;
  bool atencao = perto >= 0 && distancia[perto] <= DIST_ATENCAO_CM && !critico;

  // 2. DECIDIR O QUE MOSTRAR (do mais urgente pro menos urgente)
  if (critico) {
    mostrar("!! CRITICO !!", String(NOMES_CURTOS[perto]) + " " + String(distancia[perto]) + " cm");
  } else if (atencao) {
    mostrar("ATENCAO", String(NOMES_CURTOS[perto]) + " " + String(distancia[perto]) + " cm");
  } else if (queimadoE || queimadoD) {
    mostrar("FAROL QUEIMADO", queimadoE && queimadoD ? "Esq e Dir" : (queimadoE ? "Esquerdo" : "Direito"));
  } else if (chuva) {
    mostrar("PISTA MOLHADA", "Reduza velocidade");
  } else {
    mostrar("ANJOS DA ESTRADA", "Tudo OK");
  }

  // 3. LED DE ALERTA (o som e feito pelo app no tablet)
  digitalWrite(PINO_LED, (critico || atencao || queimadoE || queimadoD || chuva) ? HIGH : LOW);

  // 4. ENVIAR PRO APP (Serial com "APP> " e Bluetooth)
  Serial.print(F("APP> "));
  imprimirLeitura(Serial, chuva, farolE, farolD);
  imprimirLeitura(bluetooth, chuva, farolE, farolD);

  // 5. VALORES BRUTOS NO MONITOR SERIAL (pra calibrar na montagem real)
  Serial.print(F("DEBUG chuva=")); Serial.print(chuvaBruto);
  Serial.print(F("  mA_esq="));    Serial.print(correnteMa[0], 1);
  Serial.print(F("  mA_dir="));    Serial.println(correnteMa[1], 1);
}
