# Fontes da TV POP!

Testado em 5 nov 2026, a partir do ambiente do agente. A página no ar não raspa o X e não guarda chave. O que gira no ticker, no card NAS REDES e na reclamação do dia é cache editorial (`live.json`), atualizado por `node tv-pop/fetch-live.mjs` quando o RSS responde.

## Funcionou

- Google Notícias RSS, HTTP 200: `https://news.google.com/rss/search?q=Marina+Ruy+Barbosa&hl=pt-BR&gl=BR&ceid=BR:pt-419`
- UOL Entretenimento RSS, HTTP 200: `https://rss.uol.com.br/feed/entretenimento.xml` (XML com acento solto; o script principal usa o Google Notícias)
- g1 Pop & Arte RSS, HTTP 200 depois de seguir o redirect: `https://g1.globo.com/dynamo/pop-arte/rss2.xml`
- Posts públicos do X já conferidos na API e guardados no HTML/live.json (Anitta, Ludmilla, Gloria Groove, KAROL G BRASIL, omelete, @dailygarotinho, O TEMPO, Metrópoles)
- YouTube oEmbed HTTP 200 para a abertura de Começar de Novo, `09zuMFQgnW0`

## Não funcionou no navegador / sem login

- Google Notícias no browser: sem `Access-Control-Allow-Origin` (`cross-origin-resource-policy: same-site`). O cliente não busca esse RSS direto.
- Instagram oEmbed `https://api.instagram.com/oembed/`: HTTP 302 para `instagram.com/oembed`, que também responde 302. Sem corpo de post. A página do post respondeu 200, mas isso não entrega o texto. Sem login, sem credencial. O card fica só com o link `https://www.instagram.com/p/DfPwDBBmxu9/`.
- API do X no front: não usada. Exige chave. Não entra no GitHub Pages.

## Como atualizar

`node tv-pop/fetch-live.mjs` relê o RSS do Google Notícias e reescreve as manchetes de celebridade em `live.json`, sem apagar reclamação, você lembra e a nota de fontes. O workflow `.github/workflows/tv-pop-live.yml` tenta o mesmo a cada 15 minutos, se o Actions tiver rede e permissão de escrita.
