# AlmaSound — product brief

Original brief from the owner (European Portuguese), kept verbatim as the source of truth.
Working title in the brief: "Linhas de Acordes". The reference web prototype is
[`docs/prototype/linhas-de-acordes.html`](prototype/linhas-de-acordes.html).

---

# Projeto: "Linhas de Acordes" — app de música para Windows (.exe)

## 1. Contexto
Quero uma aplicação de desktop para Windows que permita compor música a partir de progressões de acordes, visualizada como linhas luminosas (uma por voz) que deslizam no tempo. A inspiração é um tipo de vídeo do TikTok onde cada nota de um acorde é uma linha horizontal; quando o acorde muda, cada linha desliza suavemente para a nota seguinte (condução de vozes). Quero transformar essa visualização numa ferramenta interativa onde posso editar as linhas, adicionar instrumentos, gravar, importar áudio e exportar a música final.

Já existe um protótipo web (HTML + Canvas + Web Audio) que valida a ideia. Usa a lógica descrita na secção 5 como ponto de partida, mas constrói o projeto do zero com uma arquitetura adequada.

Interface multilíngue: inglês como idioma principal (por defeito) e português de Portugal como segundo idioma. A arquitetura tem de permitir adicionar novos idiomas no futuro sem alterar código (ver secção 6).

## 2. Stack técnica
- Electron + React + TypeScript + Vite.
- Áudio: Web Audio API (podes usar Tone.js se simplificar agendamento e instrumentos).
- Renderização da visualização: Canvas 2D (ou WebGL/PixiJS se o desempenho o exigir).
- Internacionalização: i18next + react-i18next (ou equivalente).
- Exportação MP3: ffmpeg incluído na app (ffmpeg-static) ou lamejs; WAV escrito diretamente.
- Empacotamento: electron-builder → instalador NSIS (.exe) e versão portátil.
- Testes: Vitest para a lógica (parser, voicing, timeline, export, traduções); Playwright para um teste de ponta a ponta básico.
Se achares que outra stack é claramente melhor (ex.: Tauri), explica porquê antes de mudar.

## 3. Referência visual (o agente não viu o vídeo — segue isto)
- Fundo azul profundo com gradiente radial (≈ #0b2a8f no centro → #061a5e nas bordas), grelha horizontal muito ténue (uma linha por semitom, mais marcada em cada Dó).
- 5 vozes, cada uma com cor própria, de cima para baixo: branco, ciano, lilás, rosa, amarelo (baixo).
- Uma linha vertical fixa de "reprodução" a ~35–40% da largura; a música desloca-se da direita para a esquerda.
- À esquerda da linha (passado): linhas brilhantes com glow. À direita (futuro): as mesmas linhas, finas e semitransparentes.
- Mudanças de acorde: linhas verticais finas com o nome do acorde no topo.
- No ponto de reprodução: um ponto luminoso por voz e o nome da nota (ex.: A4, E4, C4, A3, A2) ao lado.
- Nome do acorde atual em grande no topo, com a fundamental grande e a qualidade menor (ex.: "D" grande + "m7" pequeno).
- Transições entre notas são curvas suaves (easing cosseno) que terminam exatamente no início do acorde seguinte.
- NÃO incluir diagramas de guitarra nem logótipos.

## 4. Funcionalidades (por fases — conclui e mostra cada fase antes de passar à seguinte)

### Fase 1 — Núcleo
- Campo de texto para a progressão: acordes separados por espaços; sufixo ":N" define a duração em tempos (por defeito 4). Ex.: "Am Dm7 G7 Cmaj7 Bm7b5:2 E7:2 A:8".
- Qualidades suportadas: maior, m, 7, maj7, m7, mMaj7, m7b5 (e "m7(b5)", "ø"), dim, dim7, aug/+, sus2, sus4, 7sus4, 6, m6, add9, madd9, 9, m9, maj9, 5. Baixo alternativo com "/" (ex.: C/G, E/G#). Aceitar # ♯ b ♭.
- Mensagem clara para acordes não reconhecidos, sem bloquear os restantes.
- BPM (40–220) e compasso 4/4.
- Geração automática das vozes (ver secção 5).
- Reprodução, pausa, voltar ao início, barra de espaço = play/pausa.
- Navegação: arrastar o fundo ou roda do rato para avançar/recuar no tempo; clicar num acorde toca-o.
- Edição: arrastar uma linha para cima/baixo muda essa nota em passos de meio tom, com pré-escuta imediata; acordes editados ficam marcados. Desfazer/refazer (Ctrl+Z / Ctrl+Y).
- Zoom horizontal do tempo.
- Ecrã de Definições com seletor de idioma (English / Português).

### Fase 2 — Camadas / instrumentos
- Painel de pistas (estilo DAW simplificado) com: nome, ligar/desligar, solo, volume, pan.
- Pistas iniciais: Piano (todas as vozes), Violinos (4 vozes superiores, ataque lento, vibrato), Flauta (voz de topo, uma oitava acima), Contrabaixo (voz do baixo), Bateria.
- Instrumentos com amostras reais (SoundFont/SFZ ou amostras livres de licença incluídas na app), não só síntese. Indica as fontes e licenças das amostras.
- Cada pista pode escolher que vozes toca.
- Bateria: padrões pré-definidos (ex.: pop, balada, rock, sem bateria) e um editor de passos simples (grelha de 16 passos para bombo, tarola, prato de choque).
- Reverb e EQ simples por pista e um master com limitador para não saturar.

### Fase 3 — Áudio externo e gravação
- Importar ficheiros de áudio (WAV, MP3, OGG, FLAC) como pistas de áudio, arrastando para a janela ou via menu; mostrar forma de onda; mover no tempo, cortar início/fim, volume.
- Gravar do microfone/entrada escolhida para uma nova pista de áudio, com metrónomo opcional e contagem de entrada de 1 compasso; compensação de latência configurável.
- Pistas de áudio aparecem na mesma linha temporal das vozes.

### Fase 4 — Projetos e exportação
- Guardar/abrir projeto (formato próprio, ex.: .linhas = JSON + pasta/zip com os áudios). Avisar alterações por guardar ao fechar.
- Exportar a música completa (ou um intervalo) por renderização offline (OfflineAudioContext), mais rápido que tempo real, com barra de progresso:
  - WAV 44,1 kHz / 16 ou 24 bits
  - MP3 128/192/320 kbps
- Exportar vídeo da visualização (MP4 1080p, vertical 9:16 e horizontal 16:9) com o áudio — útil para redes sociais. (Opcional, deixar para o fim.)
- Exportar MIDI das vozes (opcional).

### Fase 5 — Empacotamento
- Gerar instalador .exe (NSIS) e versão portátil para Windows 10/11 64-bit, com ícone e nome da app.
- Instruções no README para correr em desenvolvimento e gerar o .exe.

## 5. Lógica musical (do protótipo — usar como base)
- Vozes superiores (4) na gama Sol3–Dó5 (MIDI 55–72); baixo na gama Mi2–Ré#3 (MIDI 40–51), com a nota do baixo do acorde (ou a do "/").
- Para cada acorde, enumerar todas as combinações de 4 notas na gama cujas classes de altura pertençam ao acorde e cubram todas as notas necessárias (em acordes com mais de 4 notas, omitir a 5.ª). Escolher a de menor custo:
  custo = Σ |nota_i − nota_anterior_i| + 3 por cada segunda menor entre vozes adjacentes + 1 se a voz de topo passar Si♭4.
  No primeiro acorde, usar como referência [57, 60, 64, 69].
- Transição: cada voz desliza nos últimos min(0,35 s; 30% da duração) do acorde, com easing cosseno.
- Edições manuais do utilizador prevalecem sobre a geração automática; regenerar só quando o texto da progressão ou o BPM mudar, e avisar antes de apagar edições.

## 6. Requisitos de qualidade
- Agendamento de áudio preciso (lookahead), sem cliques nem dessincronização entre som e visualização.
- 60 fps na visualização num PC médio.
- A exportação tem de soar exatamente igual à reprodução.
- Interface utilizável com teclado; atalhos visíveis.
- Internacionalização (i18n) desde o início:
  - Nenhum texto visível escrito diretamente no código; tudo vem de ficheiros de tradução (ex.: locales/en.json, locales/pt-PT.json), incluindo menus nativos do Electron, diálogos e mensagens de erro.
  - Inglês (en) é o idioma por defeito e o de referência: qualquer chave em falta noutro idioma mostra o texto em inglês.
  - Seletor de idioma nas Definições; a escolha fica guardada e aplica-se sem reiniciar a app.
  - Adicionar um idioma novo = criar um novo ficheiro JSON em locales/ e ele aparece automaticamente no seletor (com o nome do idioma definido dentro do próprio ficheiro).
  - Incluir um teste que verifica que pt-PT tem as mesmas chaves que en.
  - Números, durações e datas formatados segundo o idioma (Intl).
  - Nomes de notas e acordes ficam na notação internacional (C, D, E… / Am, G7) em todos os idiomas; numa fase futura poderá existir a opção de notação latina (Dó, Ré, Mi…), por isso não a escrevas fixa no código.
- Testes automáticos para: parser de acordes, geração de vozes, cálculo de tempos, paridade das traduções, e um teste que exporta 4 compassos para WAV e verifica duração e que não está em silêncio.
- Código organizado em módulos: core (teoria musical, timeline), audio (motor, instrumentos, export), ui (componentes), i18n (configuração e locales), electron (main, ficheiros, menus).

## 7. Fora de âmbito (não fazer sem eu pedir)
- Versão mobile ou web.
- Contas, nuvem, partilha online.
- Plugins VST.

## 8. Como quero que trabalhes
- Começa por propor a estrutura de pastas e o plano das fases; espera pela minha aprovação.
- No fim de cada fase: diz o que fizeste, como testar, e o que ficou por fazer.
- Se uma decisão tiver vários caminhos razoáveis, escolhe o mais simples, regista-o no README e continua.
- Faz commits pequenos e descritivos.
- Código, comentários, nomes de ficheiros, commits e README em inglês.
