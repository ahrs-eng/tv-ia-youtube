# Canal VivaBr — versão unificada (teste)

(Antes: Brasilzão TV. Nome e estilo novos aplicados em 10/11/2026: logo VivaBr em SVG vetorial, paleta roxo escuro + ciano, roxo/magenta, laranja e rosa, fonte Fredoka.)

Programação nova (catalogo.json, grade v3, quiz, intervalos com tempo real, visual v3) + painel de edição "Sala de controle".

- Teste publicado: https://brasilzao-unificado.arthurhector-ori.workers.dev/
- Público: abre só a programação. O código do painel nem é carregado.
- Painel: abra o endereço com `?admin=1` e toque em "⚙ Sala de controle", na parte de baixo da tela. Use `&aba=grade|videos|canais|fila|status` para abrir direto numa aba.

## O que o painel edita
- **Grade:** faixas de cada hora (dia útil e fim de semana): tipo, minutos, ordem, adicionar ou remover; copiar de outra hora; madrugada (0–5h repete uma hora escolhida); horários do quiz; voltar à grade padrão.
- **Vídeos:** ligar ou desligar vídeos; adicionar por ID ou link. O ID é conferido pelo oEmbed e por um teste real no player do YouTube (assim pega o erro 150); dá para trocar, desligando outro ao adicionar.
- **Canais:** ligar ou desligar um canal inteiro.
- **Relógio** (adiantar a programação para conferir como a grade fica no ar): ⏭ Pular para o próximo, +15 min, +1 h, Ir para HH:MM, Dia útil / Fim de semana (vai ao próximo dia desse tipo, mesma hora) e ⟲ Voltar ao vivo. O relógio da tela, o A SEGUIR, a fila, os intervalos e o quiz seguem o horário simulado. O aviso "⏱ horário simulado" aparece só na barra do painel. Fica salvo no localStorage (`bz.unificado.relogio.v1`) e só é lido com ?admin=1 — o endereço normal sempre usa a hora real (o antigo `?t=HH:MM` também passou a valer só com ?admin=1).
- **Fila:** os próximos itens de hoje, com horário.
- **Status:** Exportar catalogo.json (já mesclado); exportar ou importar ajustes; restaurar o padrão.

As alterações valem a partir do próximo item; o que está no ar não é cortado.

## Onde fica salvo
Só no navegador (localStorage, chave `bz.unificado.edicao.v1`). Outros aparelhos e espectadores só veem as mudanças depois que o catalogo.json exportado substituir o do site. Não há senha, KV nem backend.

## Pronto para o repositório
Caminhos relativos, sem depender do Worker. Pode entrar em ahrs-eng/tv-ia-youtube como a próxima versão: index.html (ou renomeado) + estilo.css, app.js, painel.js, painel.css, catalogo.json, logo.svg, fonts/. Nenhum push foi feito.

`_work/`: deploy do teste (gera_deploy.py) e testes headless (teste.mjs, teste-add.mjs, teste-relogio.mjs).

## Identidade Canal VivaBr
- logo.svg: recriado a partir de logos/canal-vivabr-referencia.png, com o texto convertido em curvas (não depende de fonte). Gerado por _work/gera_logo.py. icone.svg = favicon (play em degradê). onda-topo.svg / onda-base.svg = ondas dos cantos.
- Fontes: fonts/LICENCAS.txt (Fredoka e Nunito, SIL OFL 1.1).
- Slogan "O canal do tamanho do Brasil" mantido por enquanto: pendente de decisão.
- Nomes internos que continuam "bz"/"brasilzao" (não aparecem na tela): chaves do navegador bz.unificado.edicao.v1 e bz.unificado.relogio.v1 (mantidas para não perder as edições), sessionStorage bz_ruins, objeto window.BZ, semente do sorteio diário "bz" (trocar mudaria a programação do dia), nome do Worker/endereço brasilzao-unificado.
