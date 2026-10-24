/*
  TESTE DO SENSOR DE CHUVA FC-37 — Anjos da Estrada (B2)
  Le a saida analogica (AO) e escreve no Monitor Serial (9600 baud).

  Como testar: veja o valor com a placa seca, depois pingue uma gota
  de agua em cima da placa e veja o valor CAIR.
  Anote os dois valores: o LIMITE_CHUVA do sketch principal fica
  no meio deles.
*/

const int PINO_CHUVA = A0;     // AO do modulo FC-37
const int LIMITE_CHUVA = 500;  // mesmo valor do sketch principal: abaixo disso = molhado

void setup() {
  Serial.begin(9600);
  Serial.println(F("Teste do sensor de chuva"));
  Serial.println(F("Seco = valor alto (perto de 1000). Molhado = valor baixo."));
  Serial.println();
}

void loop() {
  int valor = analogRead(PINO_CHUVA);   // 0 a 1023

  Serial.print(F("Chuva: "));
  Serial.print(valor);
  Serial.println(valor < LIMITE_CHUVA ? F("  -> MOLHADO") : F("  -> seco"));

  delay(500);
}
