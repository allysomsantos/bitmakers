# Publicar os apps (GitHub Pages)

O Chrome só libera Bluetooth em HTTPS. O jeito mais simples e gratuito é o GitHub Pages.

> **Situação:** os apps **ainda não foram publicados**. Criar o repositório e ativar o Pages coloca conteúdo na internet, então depende de o Allysom confirmar a conta, o nome do repositório e que ele pode ser público. Os passos abaixo são o roteiro; ninguém os executou ainda, e o PWA em HTTPS (Service Worker, offline, "Instalar app") **nunca foi testado**.

1. Crie um repositório **público** só para os apps, por exemplo `bitmakers-apps` (o repositório com manual, fotos e firmware não precisa ficar público). Tudo que estiver nesse repositório fica visível para qualquer pessoa: não coloque nada que não seja dos apps.
2. Copie as pastas:
   - `B1-Amicao/app/`  para  `amicao/`
   - `B2-AnjosDaEstrada/app/`  para  `anjos/`
   (não precisa copiar a pasta `teste/` nem o `package.json`)
3. No GitHub: Settings → Pages → Source: branch `main`, pasta `/ (root)`.
4. Os endereços ficam `https://<usuario>.github.io/bitmakers-apps/amicao/` e `.../anjos/`.
5. No tablet (Chrome): abra o endereço, confirme que o app abre, depois menu ⋮ → **Instalar app**. Abrir uma vez com internet; depois funciona offline.
6. Para atualizar: mude o número de `VERSAO` no `sw.js`, copie os arquivos de novo e faça commit. O app instalado troca de versão na próxima abertura.

Conferir depois de publicar: no Chrome do computador, DevTools → Application → Service Workers (registrado) e Manifest (sem erros, ícones carregam).

## Cuidados
- O `sw.js` lista os arquivos que ele guarda para funcionar offline. Se um arquivo for criado, renomeado ou apagado no app, atualize a lista `ARQUIVOS` do `sw.js` junto, senão o app não instala ou abre quebrado offline.
- Cada app tem o seu próprio `sw.js` e o seu próprio `VERSAO` (`amicao-v1`, `anjos-v1`). Atualizar um não atualiza o outro.
- Os dados do B1 (cachorros, fotos, visitas) ficam no tablet, ligados ao endereço do app. **Se o endereço mudar** (outro usuário, outro nome de repositório), o tablet começa do zero. Exporte o backup nos Ajustes antes de mudar.
- Depois de publicar, rode o checklist de hardware do `app/README.md` de cada app, com os HM-10 montados.
