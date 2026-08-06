# Eaglercraft Test

Base de experimentação para uma versão web inspirada no Eaglercraft: shaders em WebGL, sandbox
interativo e publicação estática no GitHub Pages.

> **Estado atual:** primeira versão visual/protótipo. O cliente Minecraft/Eaglercraft compilado ainda
> não está incluído neste repositório vazio; o projeto deixa a integração isolada em `docs/client/`.
> Assim, nenhum asset ou build de terceiros é redistribuído sem a licença/permissão correta.

## O que já está pronto

- Landing page responsiva em `docs/index.html`.
- Shader lab real em WebGL, sem framework ou dependência externa.
- Quatro presets: **Vanilla**, **Vibrant**, **Soft light** e **PBR dusk**.
- Controles de intensidade, pixelização, movimento e reset, salvos no `localStorage` do navegador.
- `docs/game.html` com um sandbox de blocos jogável para testar movimento, paleta e colocação/remoção.
- Fallback visível quando WebGL não está disponível.
- Pasta `docs/` pronta para publicação pelo GitHub Pages.

## Rodar localmente

Como os shaders são carregados por `fetch`, use um servidor HTTP local em vez de abrir o HTML por
`file://`:

```bash
python3 -m http.server 4173 --directory docs
```

Depois abra <http://localhost:4173>.

## Publicar no GitHub Pages

1. No GitHub, abra **Settings → Pages**.
2. Em **Build and deployment → Source**, escolha **Deploy from a branch**.
3. Selecione a branch `arena/019fd8d7-eaglercraft-test` e a pasta `/docs`.
4. Faça push para a branch deste trabalho:

   ```bash
   git add .
   git commit -m "atualiza o laboratório de shaders"
   git push origin arena/019fd8d7-eaglercraft-test
   ```

5. Salve. O endereço publicado aparece na própria tela do Pages depois do primeiro build.

O Pages publica somente a pasta `docs/`, então arquivos de desenvolvimento e documentação não
entram no site.

## Conectar um cliente Eaglercraft

O sandbox desta branch é intencionalmente separado do cliente. Para adicionar um cliente real:

1. Escolha a versão e o repositório upstream que você tem autorização para usar.
2. Compile o cliente seguindo as instruções do upstream e confirme a licença dos arquivos gerados.
3. Coloque o build autorizado em `docs/client/` (há um README nessa pasta).
4. Integre o ponto de entrada em `docs/game.html` ou crie um launcher dentro de `docs/client/`.
5. Teste localmente com o servidor HTTP acima antes do push.

Shaders específicos do cliente podem ficar em `docs/shaders/`. O arquivo
`docs/shaders/skyline-vibrant.frag` é um exemplo GLSL usado pela prévia pública; ele não altera um
cliente Eaglercraft até ser conectado ao pipeline do cliente.

## Estrutura

```text
docs/index.html              # página inicial e shader lab
docs/game.html               # sandbox/protótipo
docs/js/app.js               # WebGL, presets e controles
docs/js/game.js              # sandbox de blocos
docs/shaders/                # vertex e fragment shaders
docs/client/                 # ponto de integração do cliente autorizado
```
