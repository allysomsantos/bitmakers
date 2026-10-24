/*
  LEITOR RFID — Arduino SEPARADO do Amicao (B1)
  Este e o segundo Arduino: so le a tag e entrega o UID para o Arduino principal por I2C.
  O Arduino principal (B1-Amicao.ino com RFID_EXTERNO 1) pergunta se chegou tag.

  Ligacao do RC522 (igual ao projeto):
    SDA -> D10   SCK -> D13   MOSI -> D11   MISO -> D12   RST -> D9
    GND -> GND   3.3V -> 3.3V (NUNCA 5V)   IRQ -> solto

  Ligacao entre os dois Arduinos:
    A4 (SDA) deste  <->  A4 (SDA) do principal
    A5 (SCL) deste  <->  A5 (SCL) do principal
    GND      deste  <->  GND      do principal    (obrigatorio)
  Este Arduino tem a propria alimentacao (USB de um carregador ou do computador).
  NAO ligue o 5V de um no 5V do outro.

  O Serial Monitor (9600) mostra cada tag lida e, a cada 5 s, o que o leitor esta vendo.
  IMPORTANTE: depois de lida, a tag "dorme" ate sair do campo do leitor. Para ler de novo,
  tire a tag de perto (uns 3 segundos) e encoste outra vez.
*/

#include <SPI.h>
#include <MFRC522.h>
#include <Wire.h>

const byte ENDERECO_I2C = 0x30;   // endereco deste leitor no barramento I2C
const int  PINO_RFID_SS  = 10;
const int  PINO_RFID_RST = 9;

MFRC522 rfid(PINO_RFID_SS, PINO_RFID_RST);

// O pacote que o principal le: [novo][tamanho][UID de ate 7 bytes][chip ok]  = 10 bytes
volatile byte novaTag = 0;        // 1 = tem uma tag (a mais recente) que o principal ainda nao buscou
volatile byte tamanhoUid = 0;
volatile byte bytesUid[7];
volatile byte chipOk = 0;         // 1 = o RC522 esta respondendo (o principal mostra no app)

MFRC522::StatusCode ultimoStatus = MFRC522::STATUS_OK;   // resultado da ultima tentativa de falar com a tag
unsigned long ultimoAviso = 0;
unsigned long ultimaChecagem = 0;
unsigned long totalTags = 0;

// Para nao entregar a mesma tag varias vezes enquanto ela fica em cima do leitor
byte ultimoUid[7];
byte ultimoTamanho = 0;
unsigned long ultimaVezVista = 0;
const unsigned long JANELA_REPETIDA = 3000UL;   // mesma tag dentro de 3 s = a mesma leitura

// Chamada automatica quando o Arduino principal pede dados.
void aoPedirDados() {
  byte pacote[10];
  pacote[0] = novaTag;
  pacote[1] = tamanhoUid;
  for (byte i = 0; i < 7; i++) pacote[2 + i] = bytesUid[i];
  pacote[9] = chipOk;
  Wire.write(pacote, 10);
  novaTag = 0;                    // entregou: nao entrega a mesma tag duas vezes
}

void imprimirUid() {
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) Serial.print('0');
    Serial.print(rfid.uid.uidByte[i], HEX);
    if (i < rfid.uid.size - 1) Serial.print(':');
  }
}

bool antenaLigada() {
  return (rfid.PCD_ReadRegister(MFRC522::TxControlReg) & 0x03) == 0x03;
}

// Inicia o chip do zero. Ajuda quando um RC522 clone "trava" depois de uma leitura.
void reiniciarLeitor() {
  rfid.PCD_Init();
}

// Pergunta "tem alguem ai?" (REQA). Guarda em ultimoStatus o que aconteceu.
bool perguntarSeTemTag() {
  byte atqa[2];
  byte tamanho = sizeof(atqa);
  rfid.PCD_WriteRegister(MFRC522::ModWidthReg, 0x26);
  ultimoStatus = rfid.PICC_RequestA(atqa, &tamanho);
  return ultimoStatus == MFRC522::STATUS_OK || ultimoStatus == MFRC522::STATUS_COLLISION;
}

void setup() {
  Serial.begin(9600);
  SPI.begin();
  rfid.PCD_Init();

  byte versao = rfid.PCD_ReadRegister(MFRC522::VersionReg);
  Serial.print(F("LEITOR RFID - versao do chip: 0x"));
  Serial.print(versao, HEX);
  Serial.println((versao == 0x00 || versao == 0xFF) ? F("  -> SEM RESPOSTA (confira a ligacao)") : F("  -> OK"));

  chipOk = (versao != 0x00 && versao != 0xFF) ? 1 : 0;
  Wire.begin(ENDERECO_I2C);       // entra no barramento como "escravo"
  Wire.onRequest(aoPedirDados);
  Serial.println(F("Pronto. Encoste a tag."));
}

void loop() {
  // A cada 1 s confere se o chip responde e se a antena continua ligada; se nao, liga de novo
  if (millis() - ultimaChecagem > 1000) {
    ultimaChecagem = millis();
    byte versao = rfid.PCD_ReadRegister(MFRC522::VersionReg);
    chipOk = (versao != 0x00 && versao != 0xFF) ? 1 : 0;
    if (!antenaLigada()) {
      Serial.println(F("ATENCAO: a antena do RC522 estava desligada. Reiniciando o leitor."));
      reiniciarLeitor();
    }
  }

  // A cada 5 s mostra que esta vivo e o que viu na ultima tentativa
  if (millis() - ultimoAviso > 5000) {
    ultimoAviso = millis();
    Serial.print(F("... aguardando tag (status: "));
    Serial.print(rfid.GetStatusCodeName(ultimoStatus));
    Serial.print(F(", tags lidas: "));
    Serial.print(totalTags);
    Serial.println(F(")"));
  }

  // Le sempre, mesmo que o principal ainda nao tenha buscado a tag anterior:
  // vale a tag mais recente (o principal pode estar ocupado dando racao e agua).
  if (!perguntarSeTemTag()) return;

  if (!rfid.PICC_ReadCardSerial()) {
    Serial.println(F("Vi algo no leitor, mas nao consegui ler o UID. Afaste e encoste de novo."));
    return;
  }

  // Mesma tag vista de novo logo em seguida (ainda em cima do leitor): ignora.
  // A cada vez que a ve, renova o prazo: so conta como nova depois de ficar 3 s fora do leitor.
  bool igual = (rfid.uid.size == ultimoTamanho) && (memcmp(rfid.uid.uidByte, ultimoUid, ultimoTamanho) == 0);
  bool recente = (millis() - ultimaVezVista) < JANELA_REPETIDA;
  ultimaVezVista = millis();
  ultimoTamanho = rfid.uid.size;
  memcpy(ultimoUid, rfid.uid.uidByte, ultimoTamanho);
  if (igual && recente) {
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
    return;
  }

  totalTags++;
  Serial.print(F("Tag lida: "));
  imprimirUid();
  Serial.println();

  noInterrupts();                 // nao deixa o I2C ler o pacote pela metade
  tamanhoUid = rfid.uid.size;
  for (byte i = 0; i < 7; i++) bytesUid[i] = (i < rfid.uid.size) ? rfid.uid.uidByte[i] : 0;
  novaTag = 1;
  interrupts();

  rfid.PICC_HaltA();              // a tag so volta a responder quando sair do campo e voltar
  rfid.PCD_StopCrypto1();
}
