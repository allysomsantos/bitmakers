/*
  TESTE DOS SENSORES DE PROXIMIDADE — Anjos da Estrada (B2)
  Le os 4 HC-SR04 e escreve no Monitor Serial (9600 baud).
  Nao usa Bluetooth, LCD nem INA219: serve so para conferir a fiacao.

  Como testar: ponha a mao (ou um papelao) na frente de UM sensor
  por vez e veja qual coluna muda. Se mudar a coluna errada,
  TRIG/ECHO desse sensor estao trocados na protoboard.
*/

// Ordem dos sensores: 0 frente esq, 1 frente dir, 2 tras esq, 3 tras dir
// (na montagem, os sensores dos pinos 8 a 11 ficaram na frente e os dos pinos 4 a 7 atras)
const int PINOS_TRIG[4] = { 8, 10, 4, 6 };
const int PINOS_ECHO[4] = { 9, 11, 5, 7 };
const char* NOMES[4]    = { "F.Esq", "F.Dir", "T.Esq", "T.Dir" };

const int DIST_ATENCAO_CM = 20;   // mesmas faixas do app (app/js/faixas.js)
const int DIST_CRITICO_CM = 10;
const unsigned long TEMPO_ECO_US = 25000UL;  // espera o eco por 25 ms (cerca de 4 m)

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

void setup() {
  Serial.begin(9600);
  for (int i = 0; i < 4; i++) {
    pinMode(PINOS_TRIG[i], OUTPUT);
    pinMode(PINOS_ECHO[i], INPUT);
  }
  Serial.println(F("Teste dos sensores de proximidade"));
  Serial.println(F("Distancia em cm. 'sem eco' = nada na frente (ou fio errado)."));
  Serial.println();
}

void loop() {
  for (int i = 0; i < 4; i++) {
    int cm = medirCm(i);

    Serial.print(NOMES[i]);
    Serial.print(F(": "));
    if (cm < 0) {
      Serial.print(F("sem eco"));
    } else {
      Serial.print(cm);
      Serial.print(F(" cm"));
      if (cm < DIST_CRITICO_CM) Serial.print(F(" CRITICO"));
      else if (cm <= DIST_ATENCAO_CM) Serial.print(F(" atencao"));
    }
    Serial.print(F("   |   "));

    delay(75);  // um sensor por vez, para um nao ouvir o eco do outro
  }
  Serial.println();
  delay(450);
}
