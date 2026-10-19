// Reduz a foto da camera para um quadrado pequeno (guardar a foto inteira encheria o tablet).
export async function reduzirFoto(arquivo, lado = 200) {
  const imagem = await createImageBitmap(arquivo);
  const corte = Math.min(imagem.width, imagem.height);
  const quadro = document.createElement('canvas');
  quadro.width = lado;
  quadro.height = lado;
  quadro.getContext('2d').drawImage(
    imagem,
    (imagem.width - corte) / 2, (imagem.height - corte) / 2, corte, corte,
    0, 0, lado, lado,
  );
  return quadro.toDataURL('image/jpeg', 0.7);
}
