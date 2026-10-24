/*
  TESTE DOS FAROIS — Anjos da Estrada (B2), sem INA219
  Le a tensao do ponto entre o resistor de 220 ohms e o LED:
    farol esquerdo  -> A1
    farol direito   -> A2
  Escreve no Monitor Serial (9600 baud).

  Escolha a ordem das pecas que voce montou (LED_NO_LADO_DO_5V):
    1 = 5V -> LED -> 220 ohms -> GND   (LED aceso le ~650; sem LED cai para perto de 0)
    0 = 5V -> 220 ohms -> LED -> GND   (LED aceso le ~400 a 650; sem LED sobe para perto de 1023)
  O fio do A1 / A2 fica sempre no ponto entre o LED e o resistor.

  Como testar: com o LED aceso, anote o valor. Tire o LED: o valor deve ir
  para o outro extremo e aparecer QUEIMADO.
  Um pino sem nada ligado (ex.: A2 sem LED) mostra valores "fantasma": ignore.
*/

#define LED_NO_LADO_DO_5V 0

const int PINOS_LED[2] = { A1, A2 };
const char* NOMES[2]   = { "Esq", "Dir" };

const int LIMITE_BAIXO = 300;  // ordem 1: abaixo disso = LED queimado/removido
const int LIMITE_ALTO  = 900;  // ordem 0: acima disso  = LED queimado/removido

void setup() {
  Serial.begin(9600);
  Serial.println(F("Teste dos farois (A1 = esquerdo, A2 = direito)"));
#if LED_NO_LADO_DO_5V
  Serial.println(F("Ordem: 5V -> LED -> 220 -> GND. LED aceso: ~650.  Queimado/removido: perto de 0."));
#else
  Serial.println(F("Ordem: 5V -> 220 -> LED -> GND. LED aceso: 400 a 650.  Queimado/removido: perto de 1023."));
#endif
  Serial.println();
}

void loop() {
  for (int i = 0; i < 2; i++) {
    int valor = analogRead(PINOS_LED[i]);   // 0 a 1023
    float volts = valor * 5.0 / 1023.0;
#if LED_NO_LADO_DO_5V
    bool queimado = valor < LIMITE_BAIXO;
#else
    bool queimado = valor > LIMITE_ALTO;
#endif

    Serial.print(NOMES[i]);
    Serial.print(F(": "));
    Serial.print(valor);
    Serial.print(F(" ("));
    Serial.print(volts, 1);
    Serial.print(F(" V) "));
    Serial.print(queimado ? F("QUEIMADO") : F("aceso"));
    Serial.print(F("   |   "));
  }
  Serial.println();
  delay(500);
}
