/*
  TESTE DO BLUETOOTH HM-10 — Anjos da Estrada (B2)
  Faz duas coisas:
    1) PONTE: tudo que voce digita no Monitor Serial vai para o HM-10,
       e tudo que o HM-10 responde aparece no Monitor Serial.
       Serve para mandar comandos AT (ex.: AT, AT+NAME?, AT+NAMEAnjos).
    2) DEMO: digite # para ligar/desligar o envio de dados falsos
       (no mesmo formato do kit) a cada 500 ms para o app.

  Monitor Serial: 9600 baud e "Nenhum final de linha"
  (o HM-10 nao aceita comando AT terminado com Enter).

  Comandos AT so funcionam com NINGUEM conectado ao HM-10.
  Desligue o demo (#) antes de digitar comandos AT.
*/

#include <SoftwareSerial.h>

const int PINO_BT_RX = 2;   // TXD do HM-10
const int PINO_BT_TX = 3;   // RXD do HM-10 (com divisor de tensao 1k/2k!)

SoftwareSerial bluetooth(PINO_BT_RX, PINO_BT_TX);

bool enviandoDemo = false;
unsigned long ultimoEnvio = 0;
int contador = 0;

void setup() {
  Serial.begin(9600);
  bluetooth.begin(9600);   // velocidade de fabrica do HM-10
  Serial.println(F("Teste do Bluetooth HM-10"));
  Serial.println(F("Digite AT: o HM-10 deve responder OK (sem ninguem conectado)."));
  Serial.println(F("Digite # para ligar/desligar os dados falsos."));
  Serial.println();
}

void loop() {
  // HM-10 -> Monitor Serial
  while (bluetooth.available()) {
    Serial.write(bluetooth.read());
  }

  // Monitor Serial -> HM-10 (o # liga/desliga o demo)
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '#') {
      enviandoDemo = !enviandoDemo;
      Serial.println(enviandoDemo ? F("[demo LIGADO]") : F("[demo DESLIGADO]"));
    } else {
      bluetooth.write(c);
    }
  }

  // Dados falsos no formato real do kit (uma linha a cada 500 ms)
  if (enviandoDemo && millis() - ultimoEnvio >= 500) {
    ultimoEnvio = millis();
    contador = (contador + 1) % 30;   // faz a distancia da frente esquerda variar de 4 a 33 cm

    bluetooth.print(F("{\"frente_esq\":"));
    bluetooth.print(4 + contador);
    bluetooth.println(F(",\"frente_dir\":null,\"tras_esq\":4,\"tras_dir\":30,\"chuva\":false,\"farol_e\":\"ok\",\"farol_d\":\"ok\"}"));
  }
}
