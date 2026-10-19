/*
  ANJOS DA ESTRADA — BITMAKERS B2
  Console de seguranca para veiculos antigos.

  Sensores:
    - HC-SR04 ............ ponto cego
    - FC-37 .............. pista molhada   (no Wokwi: potenciometro)
    - LDR ................ pouca luz / noite
    - SW-18010P .......... impacto/vibracao (no Wokwi: botao)
  Saidas:
    - LCD 16x2 I2C ....... console do motorista
    - Buzzer + LED ....... alertas

  O codigo e o MESMO no Wokwi e na montagem real.
  Na montagem real, abra o Monitor Serial e ajuste os LIMITES abaixo
  olhando os valores que os sensores de verdade mostram.
*/

#include <Wire.h>
#include <LiquidCrystal_I2C.h>

// ---------------- PINOS ----------------
const int PINO_TRIG     = 9;   // HC-SR04 TRIG
const int PINO_ECHO     = 10;  // HC-SR04 ECHO
const int PINO_CHUVA    = A0;  // FC-37 AO
const int PINO_LUZ      = A1;  // LDR AO
const int PINO_VIBRACAO = 2;   // SW-18010P DO
const int PINO_LED      = 7;   // LED de alerta
const int PINO_BUZZER   = 8;   // buzzer

// ---------------- AJUSTES ----------------
const int DISTANCIA_ALERTA_CM = 100; // abaixo disso: algo no ponto cego
const int DISTANCIA_PERIGO_CM = 40;  // abaixo disso: bip continuo
const int LIMITE_CHUVA  = 500;       // FC-37: valor CAI quando molha. Abaixo = molhado
const int LIMITE_ESCURO = 800;       // LDR: valor SOBE quando escurece. Acima = escuro
const int NIVEL_VIBRACAO = LOW;      // nivel do pino quando vibra (teste no modulo real!)
const unsigned long TEMPO_ALERTA_IMPACTO = 4000; // ms que o alerta de impacto fica na tela

LiquidCrystal_I2C lcd(0x27, 16, 2);

bool teveImpacto = false;
unsigned long momentoImpacto = 0;
unsigned long ultimoBip = 0;
unsigned long ultimoSerial = 0;

// Mede a distancia em cm. Retorna 999 se nao achou nada.
long medirDistanciaCm() {
  digitalWrite(PINO_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(PINO_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PINO_TRIG, LOW);
  long duracao = pulseIn(PINO_ECHO, HIGH, 30000);
  if (duracao == 0) return 999;
  return duracao / 58;
}

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

// Bip estilo sensor de estacionamento: quanto mais perto, mais rapido
void biparPontoCego(long distancia) {
  if (distancia <= DISTANCIA_PERIGO_CM) {
    tone(PINO_BUZZER, 2000);
    return;
  }
  unsigned long intervalo = map(distancia, DISTANCIA_PERIGO_CM, DISTANCIA_ALERTA_CM, 100, 600);
  if (millis() - ultimoBip >= intervalo) {
    tone(PINO_BUZZER, 2000, 50);
    ultimoBip = millis();
  }
}

void setup() {
  Serial.begin(9600);
  pinMode(PINO_TRIG, OUTPUT);
  pinMode(PINO_ECHO, INPUT);
  pinMode(PINO_VIBRACAO, INPUT_PULLUP);
  pinMode(PINO_LED, OUTPUT);
  pinMode(PINO_BUZZER, OUTPUT);

  lcd.init();
  lcd.backlight();
  mostrar("ANJOS DA ESTRADA", "Iniciando...");
  delay(1500);
}

void loop() {
  // 1. LER OS SENSORES
  long distancia = medirDistanciaCm();
  int chuva = analogRead(PINO_CHUVA);
  int luz   = analogRead(PINO_LUZ);

  bool pontoCego    = distancia <= DISTANCIA_ALERTA_CM;
  bool pistaMolhada = chuva < LIMITE_CHUVA;
  bool escuro       = luz > LIMITE_ESCURO;

  // Vibracao e um pulso rapido: guardamos o momento pra o alerta durar alguns segundos
  if (digitalRead(PINO_VIBRACAO) == NIVEL_VIBRACAO) {
    if (!teveImpacto) tone(PINO_BUZZER, 800, 400);
    teveImpacto = true;
    momentoImpacto = millis();
  }
  if (teveImpacto && millis() - momentoImpacto > TEMPO_ALERTA_IMPACTO) {
    teveImpacto = false;
  }

  // 2. DECIDIR O QUE MOSTRAR (do mais urgente pro menos urgente)
  if (pontoCego) {
    mostrar("!! PONTO CEGO !!", "Objeto a " + String(distancia) + " cm");
  } else if (teveImpacto) {
    mostrar("!!  IMPACTO   !!", "Cheque o veiculo");
  } else if (pistaMolhada) {
    mostrar("PISTA MOLHADA", "Reduza velocidade");
  } else if (escuro) {
    mostrar("POUCA LUZ", "Acenda os farois");
  } else {
    mostrar("ANJOS DA ESTRADA", "Tudo OK");
  }

  // 3. ALERTAS DE SOM E LUZ
  digitalWrite(PINO_LED, (pontoCego || teveImpacto) ? HIGH : LOW);
  if (pontoCego) {
    biparPontoCego(distancia);
  } else if (!teveImpacto) {
    noTone(PINO_BUZZER);
  }

  // 4. VALORES NO MONITOR SERIAL (pra calibrar na montagem real)
  if (millis() - ultimoSerial > 500) {
    Serial.print(F("distancia="));  Serial.print(distancia);
    Serial.print(F("cm  chuva="));  Serial.print(chuva);
    Serial.print(F("  luz="));      Serial.print(luz);
    Serial.print(F("  impacto="));  Serial.println(teveImpacto ? "sim" : "nao");
    ultimoSerial = millis();
  }

  delay(50);
}
