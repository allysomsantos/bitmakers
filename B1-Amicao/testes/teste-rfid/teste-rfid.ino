/*
  TESTE SO DO RC522 (leitor de tag) - Amicao (B1)
  Nao usa balanca, motor, bomba nem Bluetooth. So confere a ligacao do leitor e mostra o UID da tag.

  Ligacao (RC522 -> Arduino Uno):
    SDA  -> D10
    SCK  -> D13
    MOSI -> D11
    MISO -> D12
    IRQ  -> (nao liga)
    GND  -> GND
    RST  -> D9
    3.3V -> 3.3V   (NUNCA no 5V)

  Como usar:
    1. Grave e abra o Serial Monitor em 9600 (Nova linha).
    2. Veja a "versao do chip": 0x91, 0x92, 0x12 ou 0xB2 = o RC522 esta respondendo.
       0x00 ou 0xFF = o Arduino nao esta falando com o chip (fio solto, errado ou sem 3.3V).
    3. Encoste a tag a 2 a 3 cm da face do leitor. O UID aparece no monitor.

  Comandos (digite e aperte Enter):
    v   le a versao do chip de novo
    s   autoteste do chip (mais rigoroso que a versao)
    d   diagnostico da antena: mostra se ela esta ligada e tenta falar com a tag 10 vezes
    i   inicia o chip de novo (ganho normal)
    g   troca o ganho do receptor (18, 23, 33, 38, 43, 48 dB). Ganho alto demais gera ruido e erros.
    ?   ajuda
*/

#include <SPI.h>
#include <MFRC522.h>

const int PINO_RFID_SS  = 10;   // SDA do RC522
const int PINO_RFID_RST = 9;

// Pinos das outras pecas. Este teste nao usa, mas PRECISA deixa-los em estado seguro:
// pino solto no ar faz o rele estalar e as bobinas do ULN2003 ligarem sozinhas,
// e isso gera ruido que atrapalha o RC522 quando tudo esta ligado.
const int PINO_BOMBA = 3;            // IN do rele (liga com HIGH)
const int PINO_MOTOR_IN1 = 4;
const int PINO_MOTOR_IN2 = 5;
const int PINO_MOTOR_IN3 = 6;
const int PINO_MOTOR_IN4 = 7;

MFRC522 rfid(PINO_RFID_SS, PINO_RFID_RST);

unsigned long ultimoAviso = 0;
unsigned long ultimaVersao = 0;
bool chipOk = false;
MFRC522::StatusCode ultimoStatus = MFRC522::STATUS_OK;   // resultado da ultima tentativa de falar com a tag
byte ultimoErro = 0;                                      // registrador de erros do chip nessa tentativa

// Ganhos do receptor para o comando g. O padrao do chip e 33 dB.
const byte GANHOS[] = { MFRC522::RxGain_18dB, MFRC522::RxGain_23dB, MFRC522::RxGain_33dB,
                        MFRC522::RxGain_38dB, MFRC522::RxGain_43dB, MFRC522::RxGain_48dB };
const int  GANHOS_DB[] = { 18, 23, 33, 38, 43, 48 };
const int  QUANTOS_GANHOS = 6;
int indiceGanho = 2;   // comeca em 33 dB

// ---------------- FUNCOES ----------------
void mostrarAjuda() {
  Serial.println(F("Comandos: v = versao  s = autoteste  d = diagnostico da antena  i = reiniciar  g = trocar ganho  ? = ajuda"));
  Serial.println(F("Encoste a tag a 2-3 cm do leitor. So le tags de 13,56 MHz (cartao azul / chaveiro NFC)."));
}

// Le o registrador de versao do chip. E o jeito mais rapido de saber se a ligacao esta certa.
bool checarVersao() {
  byte versao = rfid.PCD_ReadRegister(MFRC522::VersionReg);
  Serial.print(F("Versao do chip: 0x"));
  Serial.print(versao, HEX);
  if (versao == 0x00 || versao == 0xFF) {
    Serial.println(F("  -> SEM RESPOSTA"));
    Serial.println(F("  Confira: 3.3V no 3.3V (nao no 5V), GND, SDA=D10, SCK=D13, MOSI=D11, MISO=D12, RST=D9."));
    Serial.println(F("  Mexa nos fios: jumper com mau contato e o problema mais comum."));
    return false;
  }
  if (versao == 0x91 || versao == 0x92 || versao == 0x12 || versao == 0xB2) {
    Serial.println(F("  -> OK, o RC522 esta respondendo"));
  } else {
    Serial.println(F("  -> respondeu, mas e uma versao fora do comum (clone). Pode funcionar; teste com a tag."));
  }
  return true;
}

void autoteste() {
  Serial.println(F("Autoteste do chip (leva uns segundos)..."));
  bool passou = rfid.PCD_PerformSelfTest();
  Serial.println(passou ? F("Autoteste: OK") : F("Autoteste: FALHOU (chip com defeito, sem energia ou fio ruim)"));
  rfid.PCD_Init();   // o autoteste deixa o chip zerado: inicia de novo
  rfid.PCD_SetAntennaGain(GANHOS[indiceGanho]);
}

// Pergunta "tem alguem ai?" (REQA). Se uma tag estiver perto, ela responde com o ATQA.
// Guarda em ultimoStatus o que aconteceu: TIMEOUT = ninguem respondeu.
bool perguntarSeTemTag() {
  byte atqa[2];
  byte tamanho = sizeof(atqa);
  rfid.PCD_WriteRegister(MFRC522::ModWidthReg, 0x26);
  ultimoStatus = rfid.PICC_RequestA(atqa, &tamanho);
  ultimoErro = rfid.PCD_ReadRegister(MFRC522::ErrorReg);
  return ultimoStatus == MFRC522::STATUS_OK || ultimoStatus == MFRC522::STATUS_COLLISION;
}

void diagnostico() {
  byte tx = rfid.PCD_ReadRegister(MFRC522::TxControlReg);
  byte rf = rfid.PCD_ReadRegister(MFRC522::RFCfgReg);
  Serial.print(F("TxControlReg: 0x"));
  Serial.print(tx, HEX);
  Serial.println((tx & 0x03) == 0x03 ? F("  -> antena LIGADA") : F("  -> antena DESLIGADA (problema!)"));
  Serial.print(F("Ganho do receptor: "));
  Serial.print(GANHOS_DB[indiceGanho]);
  Serial.println(F(" dB"));
  Serial.println(F("Encoste a tag AGORA e segure. 10 tentativas:"));
  for (int i = 1; i <= 10; i++) {
    bool achou = perguntarSeTemTag();
    Serial.print(i);
    Serial.print(F(": "));
    Serial.print(rfid.GetStatusCodeName(ultimoStatus));
    Serial.print(F("  (ErrorReg 0x"));
    Serial.print(ultimoErro, HEX);
    Serial.print(F(")"));
    Serial.println(achou ? F("   <- A TAG RESPONDEU") : F(""));
    delay(300);
  }
  Serial.println(F("Fim. TIMEOUT em todas = o leitor nao ouviu nenhuma tag."));
}

void imprimirUid() {
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) Serial.print('0');
    Serial.print(rfid.uid.uidByte[i], HEX);
    if (i < rfid.uid.size - 1) Serial.print(':');
  }
}

void tratarComando(char comando) {
  switch (comando) {
    case 'v': chipOk = checarVersao(); break;
    case 's': autoteste(); break;
    case 'd': diagnostico(); break;
    case 'i':
      rfid.PCD_Init();
      indiceGanho = 2;
      rfid.PCD_SetAntennaGain(GANHOS[indiceGanho]);
      chipOk = checarVersao();
      break;
    case 'g':
      indiceGanho = (indiceGanho + 1) % QUANTOS_GANHOS;
      rfid.PCD_SetAntennaGain(GANHOS[indiceGanho]);
      Serial.print(F("Ganho do receptor agora: "));
      Serial.print(GANHOS_DB[indiceGanho]);
      Serial.println(F(" dB"));
      break;
    case '?': mostrarAjuda(); break;
    case '\n': case '\r': case ' ': break;
    default:
      Serial.print(F("Comando desconhecido: "));
      Serial.println(comando);
      break;
  }
}

// ---------------- PROGRAMA ----------------
void setup() {
  Serial.begin(9600);

  // Rele e motor desligados (como no programa final)
  digitalWrite(PINO_BOMBA, LOW);
  pinMode(PINO_BOMBA, OUTPUT);
  pinMode(PINO_MOTOR_IN1, OUTPUT);
  pinMode(PINO_MOTOR_IN2, OUTPUT);
  pinMode(PINO_MOTOR_IN3, OUTPUT);
  pinMode(PINO_MOTOR_IN4, OUTPUT);
  digitalWrite(PINO_MOTOR_IN1, LOW);
  digitalWrite(PINO_MOTOR_IN2, LOW);
  digitalWrite(PINO_MOTOR_IN3, LOW);
  digitalWrite(PINO_MOTOR_IN4, LOW);
  SPI.begin();
  rfid.PCD_Init();
  rfid.PCD_SetAntennaGain(GANHOS[indiceGanho]);   // ganho normal (33 dB). Use g para variar

  Serial.println(F("TESTE SO DO RC522"));
  chipOk = checarVersao();
  mostrarAjuda();
}

void loop() {
  if (Serial.available()) tratarComando(Serial.read());

  // Se o chip nao respondeu, repete a checagem a cada 5 s (da tempo de mexer nos fios)
  if (!chipOk && millis() - ultimaVersao > 5000) {
    ultimaVersao = millis();
    rfid.PCD_Init();
    chipOk = checarVersao();
    return;
  }

  // Lembrete a cada 5 s para voce saber que ele esta vivo
  if (chipOk && millis() - ultimoAviso > 5000) {
    ultimoAviso = millis();
    Serial.print(F("... aguardando tag (ultimo status: "));
    Serial.print(rfid.GetStatusCodeName(ultimoStatus));
    Serial.print(F(", ErrorReg 0x"));
    Serial.print(ultimoErro, HEX);
    Serial.println(F(")"));
  }

  if (!chipOk) return;

  if (!perguntarSeTemTag()) return;

  // Algo apareceu no campo do leitor
  if (!rfid.PICC_ReadCardSerial()) {
    Serial.println(F("Vi algo no leitor, mas nao consegui ler o UID. Afaste e encoste de novo."));
    return;
  }

  Serial.print(F("TAG LIDA!  UID: "));
  imprimirUid();
  Serial.print(F("   tipo: "));
  Serial.println(rfid.PICC_GetTypeName(rfid.PICC_GetType(rfid.uid.sak)));

  rfid.PICC_HaltA();        // para de responder ate a tag sair e voltar
  rfid.PCD_StopCrypto1();
  ultimoAviso = millis();
}
