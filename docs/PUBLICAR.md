# Publicar os apps (GitHub Pages)

O Chrome só libera Bluetooth em HTTPS. O jeito mais simples e gratuito é o GitHub Pages.

> **Situação:** o código está em `https://github.com/allysomsantos/bitmakers` (público, projeto inteiro: apps, firmware, manual, fotos). O **GitHub Pages ainda precisa ser ligado** (passo 1) e o PWA em HTTPS (Service Worker, offline, "Instalar app") **nunca foi testado**.

Tudo que está no repositório fica visível para qualquer pessoa. Os apps ficam dentro das pastas dos projetos, então o Pages serve o repositório inteiro a partir da raiz.

1. No GitHub: repositório → Settings → Pages → Source: **Deploy from a branch**, branch `main`, pasta `/ (root)`. Espere a primeira publicação terminar (a aba Actions mostra "pages build and deployment").
2. Os endereços dos apps são:
   - Amicão: `https://allysomsantos.github.io/bitmakers/B1-Amicao/app/`
   - Anjos da Estrada: `https://allysomsantos.github.io/bitmakers/B2-AnjosDaEstrada/app/`
3. No tablet (Chrome): abra o endereço, confirme que o app abre, depois menu ⋮ → **Instalar app**. Abrir uma vez com internet; depois funciona offline.
4. Para atualizar: mude o número de `VERSAO` no `sw.js` do app, faça commit e `git push`. O app instalado troca de versão na próxima abertura.

Conferir depois de publicar: no Chrome do computador, DevTools → Application → Service Workers (registrado) e Manifest (sem erros, ícones carregam).

## Cuidados
- O `sw.js` lista os arquivos que ele guarda para funcionar offline. Se um arquivo for criado, renomeado ou apagado no app, atualize a lista `ARQUIVOS` do `sw.js` junto, senão o app não instala ou abre quebrado offline.
- Cada app tem o seu próprio `sw.js` e o seu próprio `VERSAO` (`amicao-v1`, `anjos-v1`). Atualizar um não atualiza o outro.
- Os dados do B1 (cachorros, fotos, visitas) ficam no tablet, ligados ao endereço do app. **Se o endereço mudar** (outro usuário do GitHub ou outro domínio; o nome do repositório e da pasta não mudam o armazenamento do navegador, só o endereço base), o tablet começa do zero. Exporte o backup nos Ajustes antes de mudar.
- Depois de publicar, rode o checklist de hardware do `app/README.md` de cada app, com os HM-10 montados.
