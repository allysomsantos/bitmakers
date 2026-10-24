/*
  TESTE DO MOTOR DE PASSO - Amicao (B1)
  Gira 1 volta para um lado, espera, gira 1 volta para o outro, espera. Repete.
  Serve so para conferir a fiacao do 28BYJ-48 + ULN2003. Nao usa RFID, balanca nem bluetooth.

  Ligacao (igual ao projeto):
    ULN2003 IN1 -> D4
    ULN2003 IN2 -> D5
    ULN2003 IN3 -> D6
    ULN2003 IN4 -> D7
    ULN2003 +   -> 5V do Arduino (so para este teste!)
    ULN2003 -   -> GND do Arduino

  O que esperar:
    - Gira uma volta inteira (uns 12 segundos) num sentido, pausa, volta no outro.
    - Se so vibra ou zumbe: confira a ordem dos fios IN1..IN4 (deve ser 4,5,6,7 em ordem).
    - Se gira ao contrario do que o Serial diz: nao tem problema, e so o motor virado.
    - Se o Arduino reinicia (aparece "TESTE DO MOTOR" de novo): o 5V nao aguentou,
      use o LM2596 em 5,0V como no projeto.
*/

#include <Stepper.h>

const int PASSOS_POR_VOLTA = 2048;  // 28BYJ-48 (no Wokwi seriam 200)
const int VELOCIDADE_RPM   = 10;    // o 28BYJ-48 e fraco: acima de ~15 rpm ele perde passo

const int PINO_MOTOR_IN1 = 4;
const int PINO_MOTOR_IN2 = 5;
const int PINO_MOTOR_IN3 = 6;
const int PINO_MOTOR_IN4 = 7;

// A biblioteca espera a ordem IN1, IN3, IN2, IN4 para esse motor (mesma do projeto).
Stepper motor(PASSOS_POR_VOLTA, PINO_MOTOR_IN1, PINO_MOTOR_IN3, PINO_MOTOR_IN2, PINO_MOTOR_IN4);

// Solta as bobinas para o motor e o ULN2003 nao esquentarem parados.
void desligarMotor() {
  digitalWrite(PINO_MOTOR_IN1, LOW);
  digitalWrite(PINO_MOTOR_IN2, LOW);
  digitalWrite(PINO_MOTOR_IN3, LOW);
  digitalWrite(PINO_MOTOR_IN4, LOW);
}

void setup() {
  Serial.begin(9600);
  Serial.println(F("TESTE DO MOTOR"));
  motor.setSpeed(VELOCIDADE_RPM);
}

void loop() {
  Serial.println(F("Girando 1 volta (sentido A)..."));
  motor.step(PASSOS_POR_VOLTA);
  desligarMotor();
  delay(2000);

  Serial.println(F("Girando 1 volta (sentido B)..."));
  motor.step(-PASSOS_POR_VOLTA);
  desligarMotor();
  delay(2000);
}
