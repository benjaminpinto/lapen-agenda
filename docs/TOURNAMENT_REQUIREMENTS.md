# Módulo de Torneios — Documento de Requisitos

**Versão:** 0.3 (cronograma próprio no lugar da reserva na Agenda; impedimentos do atleta; admin para desktop/tablet) · **Data:** 06/10/2026 · **Status:** implementado (etapas 1–9; roteiro de entrega em [TOURNAMENT_DEPLOY.md](TOURNAMENT_DEPLOY.md))

> **Como ler:** requisitos funcionais são `RF-xx`, não funcionais são `RNF-xx`. Itens marcados com **[P-x]** dependem de uma premissa minha listada na [seção 5](#5-premissas-a-confirmar). Todas as etapas estão implementadas e verificadas.

### Mudanças da v0.2 para a v0.3

- **Sai a integração com a Agenda.** O módulo não cria, lê nem protege `schedules`. Durante o torneio o admin bloqueia todas as quadras pelo painel de bloqueios que já existe (`holidays_blocks`) e as quadras ficam à disposição do evento. **D-9 deixa de valer**; só o admin planeja horários.
- **Entra o cronograma próprio** ([seção 8.8](#88-cronograma-planejador-de-jogos)): sessões de jogo divididas em janelas de 90 min, quadro por dia e quadra, troca/remoção/fixação manual, distribuição automática dos jogos pendentes por fase, validação de conflitos e publicação.
- **Impedimentos do atleta** (dias e horários em que a pessoa não pode jogar), marcados por inscrito e respeitados pela distribuição (RF-77).
- **Descanso mínimo de 60 min** entre jogos da mesma pessoa (D-18); o padrão da categoria passa de 30 para 60.
- **Painel admin otimizado para desktop e tablet** (RNF-10); a interface pública continua mobile-first.
- **Estatísticas:** continuam só o filtro "Torneio" e a exclusão de "Amistosos" (RF-86). As guardas RF-84/85 deixam de existir, porque nenhum `schedule` é criado.
- Como a migration `014` ainda não rodou em nenhum banco, as mudanças de esquema entram **nela** (sem `015`).

### Mudanças da v0.1 para a v0.2

- Aplicadas as 16 decisões (tabela na [seção 4](#4-decisões-tomadas)).
- **Nova tela de acompanhamento** (grupos, quem avança, chaves visuais, andamento e resultados): [seção 8.10](#810-páginas-públicas-e-tela-de-acompanhamento).
- **Removidos:** envio de e-mails, controle de taxa/pagamento, sugestão de vínculo por e-mail, ordem de desempate configurável, "Fase 2" (duplas, consolação, 3º lugar, resultado pelos participantes).
- **Alterados:** um torneio ativo por vez, formato de partida configurável no início do torneio, reserva de quadra por admin **ou** membro LAPEN aprovado.
- **Corrigido:** o admin é autenticado por JWT + `users.is_admin` (não por sessão, como diz o CLAUDE.md), o que simplifica a regra de reserva.

---

## 1. Objetivo e escopo

Criar um módulo de **torneios** no LAPEN Agenda, **independente do Ranking** (sem tabelas, regras, pontos ou participantes compartilhados), com:

- seção pública com os dados do torneio aberto: **tela de acompanhamento** (andamento, fase de grupos, quem avança, chaves, jogos previstos e resultados);
- página pública de inscrição;
- painel de administração para configurar as regras do torneio e confirmar inscrições.

**Única interface de escrita com o resto do sistema:**

| Interface | O que faz |
|---|---|
| **Estatísticas** (`match_statistics_unified`) | Registrar o resultado quando ao menos um participante for membro LAPEN cadastrado, para que apareça nas estatísticas dele. |

A **Agenda não é uma interface** (v0.3): o torneio só **lê** a tabela `courts` (nomes das quadras ativas) para montar o cronograma. Quem reserva as quadras para o evento é o admin, pelos bloqueios existentes.

---

## 2. Como funcionam torneios de tênis (base da pesquisa)

### 2.1 Estrutura

**Torneio → Categorias (provas) → Chave.** Cada categoria tem sua própria chave e regras. No Brasil, o circuito amador da CBT organiza as categorias por **classe** (Principiante, 5ª, 4ª, 3ª, 2ª, 1ª), com subdivisão por idade (Classe 1 / Classe 2 = 35+), além de gênero e simples/duplas. A CBT exige **mínimo de 4 inscritos** por prova: com exatamente 4 joga-se **round-robin**; com 5 ou mais, **eliminatória simples**.

### 2.2 Formatos de chave

| Formato | Como funciona | Jogos garantidos | Uso típico |
|---|---|---|---|
| Eliminatória simples | Perdeu, saiu | 1 | Padrão CBT/ATP |
| Round-robin | Todos contra todos, classificação por tabela | n − 1 | Provas pequenas, ATP Finals |
| **Grupos + mata-mata** | Grupos em round-robin; os melhores de cada grupo vão para chave eliminatória | 2–3 | Torneios amadores de clube |
| Consolação / feed-in / compass | Chaves paralelas para os perdedores | 2–3 | Juvenil, ligas USTA — **fora do escopo (D-14)** |

### 2.3 Tamanho da chave e byes

- Tamanho da chave = próxima potência de 2 ≥ nº de inscritos (8, 16, 32, 64).
- Byes = tamanho − inscritos.
- Byes vão **primeiro aos cabeças de chave**, em ordem; os restantes são sorteados, distribuídos o mais uniformemente possível entre metades/quartos (ITF).

### 2.4 Cabeças de chave (ITF)

- Quantidade por tamanho de chave: **2 em 8, 4 em 16, 8 em 32, 16 em 64**.
- Posição: **CC1 na primeira linha, CC2 na última**; CC3 e CC4 sorteados entre os quartos restantes; CC5–CC8 sorteados entre as oitavas restantes.
- Efeito: CC1 e CC2 só se cruzam na final; CC1–CC4 só a partir da semifinal.
- Como o torneio não tem ligação com o Ranking, os cabeças são definidos **manualmente pelo organizador (D-6)**.

### 2.5 Grupos → mata-mata

- Grupos geralmente de 3 ou 4 jogadores; classificam 1 ou 2 por grupo.
- Cruzamento clássico (ATP Finals): **1º A × 2º B** e **1º B × 2º A**.
- Regra usual em regulamentos amadores: os 1ºs entram como cabeças, e o 2º colocado não cai no mesmo lado da chave do 1º do próprio grupo (evita revanche antes da final).

### 2.6 Desempate em grupos (ordem ATP Finals — adotada, D-15)

1. Nº de vitórias
2. Nº de partidas disputadas (2–1 fica à frente de 2–0)
3. Confronto direto (empate entre 2)
4. % de sets vencidos
5. % de games vencidos
6. No ATP, o ranking. **Aqui, decisão manual do admin** (ver RF-43).

Em **empate triplo**, usam-se os critérios 4–6. Assim que um deles separa um jogador (para cima ou para baixo), os dois restantes voltam ao **confronto direto**.

Essa ordem será **explicada ao público** na tela de acompanhamento (RF-94) e no regulamento (RF-98).

### 2.7 Formatos de partida comuns

| Formato | Descrição |
|---|---|
| **Melhor de 3 + match tie-break** | 2 sets com tie-break a 6–6; 3º set = super tie-break de 10 pontos (dif. 2). Padrão CBT para classes, normalmente NO-AD. **É o padrão deste módulo (D-7).** |
| Set pro | 1 set até 8 games. A CBT usa em caso de atraso. |
| Set único | 1 set até 6 games, tie-break a 6–6. Comum em fase de grupos. |

### 2.8 Programação, comparecimento e W.O. (CBT)

- A programação é publicada após o sorteio e atualizada diariamente.
- **Tolerância de 15 minutos**; quem não se apresenta perde por **W.O.**; se os dois faltam, **ambos perdem (duplo W.O.)**.
- **Descanso mínimo** entre jogos do mesmo tenista no mesmo dia: 30 min (jogo anterior ≤ 1h), 60 min (1h–1h30), 90 min (> 1h30).
- **Desistência durante o jogo** (*retirement*, "ret."): vence o adversário e o placar parcial é registrado.
- Jogo interrompido (chuva) continua do placar em que parou.

### 2.9 Inscrições

Janela com prazo final rígido, mínimo de inscritos para a prova acontecer, prazo de cancelamento (CBT: até 1 dia após o encerramento) e, quando há limite de vagas, lista de espera.

---

## 3. O que já existe no projeto

| Área | Situação atual | Impacto no torneio |
|---|---|---|
| **Agenda** (`schedules`) | Slots fixos de 90 min, 07:30–22:30 (`generate_time_slots`, `src/routes/public.py:14`). `match_type='Torneio'` já existe como tipo avulso. | **Nenhuma integração (v0.3).** O torneio não lê nem grava `schedules`. O admin bloqueia as quadras no período pelo painel de bloqueios (`holidays_blocks`). O cronograma é próprio (seção 8.8) e só lê `courts`. |
| **Estatísticas** (`match_statistics_unified`) | `CHECK` exige `schedule_id` **ou** `ranking_match_id` (nunca ambos). `winner_name` é `NOT NULL`. | Nova coluna `tournament_match_id` e `CHECK` reescrito ("exatamente uma origem"). **Duplo W.O. não tem vencedor, então não pode gerar linha** (RF-82). |
| **Validador de placar** (`src/utils/score_parser.py`) | Aceita 2–3 sets, set ≤ 7 games, 3º set sempre super tie-break (≥ 10, dif. 2); `W.O.` é aceito. | **O formato padrão (D-7) já passa.** Set pro (8–6) e set único seriam rejeitados: estender `validate_score` com um parâmetro opcional de formato. |
| **Parser de placar** | `parse_score` soma os pontos do super tie-break como games (ex.: "6-4, 3-6, 10-8" → 19–18 games). | Não usar essa soma na tabela de grupos (regra própria em RF-42). |
| **Filtros de estatística** | "Amistosos" = `match_type != 'Ranking'`; o filtro de tipo só oferece Ranking/Amistoso. | Torneio cairia em "Amistosos". Ajuste definido em RF-86 (D-12). |
| **Resolução de nomes** (`find_user_by_display_name`) | Casa o texto digitado com `name`/`short_name`. | Risco de homônimo. No torneio, o vínculo com membro é por `user_id` explícito, nunca por nome. |
| **W.O. no Ranking** | Entra nas estatísticas (`tests/backend/test_wo_statistics.py`). | Precedente para o D-12. |
| **Autenticação** | JWT em cookie/Bearer. **Admin = `users.is_admin`** (`require_admin_auth`, `src/auth.py:132`); membro = `require_approved_lapen_member` (`src/auth.py:157`). Não há sessão de admin nas rotas. | Só o admin planeja o cronograma; nenhum decorator novo. |
| **E-mail** | Flask-Mail com funções específicas em `src/email_service.py`. | **Não usado pelo módulo (D-10).** |
| **Pagamentos** | Mercado Pago/Stripe existem; apostas foram desacopladas. | **Fora do escopo (D-5).** |
| **Sorteio do Ranking** (`draw_engine.py`) | Sorteia pares nos grupos Elite/Challenger/NextGen evitando adversários recentes. | **Não reaproveitar**: lógica diferente e requisito de independência. |
| **Front** | Rotas em `src/App.jsx`, menu em `Header.jsx`, admin em `/admin/*`, shadcn/ui (`Tabs` próprio em `ui/tabs.jsx`), Recharts, html2canvas. | Novas seções `/tournaments` e `/admin/tournaments`. A chave visual será componente próprio (não há biblioteca de bracket no projeto). |

---

## 4. Decisões tomadas

| ID | Decisão | Efeito no documento |
|---|---|---|
| D-1 | **Um torneio por vez** | Só um torneio "ativo" (RF-01); `/tournaments` abre direto o torneio ativo (RF-91). |
| D-2 | Várias categorias; mesma pessoa pode se inscrever em mais de uma | RF-02. |
| D-3 | **Sem duplas** | Fora do escopo (seção 13). |
| D-4 | Qualquer pessoa pode se inscrever | Inscrição pública sem login (RF-10). |
| D-5 | **Pagamento fora do escopo** | Sem campos de taxa/pagamento. |
| D-6 | Cabeças de chave definidos manualmente | RF-26. |
| D-7 | Formato de partida configurável **no início** do torneio; padrão 2 sets sem vantagem + super tie-break de 10 pts | RF-03, RF-04 [P-3]. |
| D-8 | Só admin lança resultados | RF-60. |
| D-9 | ~~Admin ou membro LAPEN aprovado reserva quadra~~ **Substituída na v0.3 por D-17** | — |
| D-10 | **Sem e-mails** | RF-16; o admin contata o inscrito pelo telefone informado. |
| D-11 | Partida = 1 janela de 90 min | RF-70, RF-72. |
| D-12 | W.O. entra nas estatísticas; "Amistosos" exclui Torneio, que ganha filtro próprio | RF-82, RF-86. |
| D-13 | Lista pública de inscritos (confirmados, só nome de exibição) | RF-98. |
| D-14 | **Sem consolação nem 3º lugar** | Fora do escopo. |
| D-15 | **Ordem ATP**, explicada ao público | RF-41, RF-94, RF-98 [P-6]. |
| D-16 | **Sem vínculo automático por e-mail** | RF-13 [P-4]. |
| D-17 | **Sem integração com a Agenda.** O admin bloqueia as quadras no período; o torneio planeja os jogos num **cronograma próprio**, só pelo admin | Seção 8.8, RNF-01. |
| D-18 | **Descanso mínimo de 1 h** entre jogos da mesma pessoa | RF-75 [P-8]. |
| D-19 | Quadras do cronograma **lidas de `courts`** (somente leitura) | RF-70. |
| D-20 | **Impedimentos do atleta** (dias e horários) marcados por inscrito | RF-77. |
| D-21 | **Cronograma oculto ao público até o admin publicar** | RF-79. |
| D-22 | **Painel admin otimizado para desktop e tablet**; celular não é alvo do admin | RNF-10. |

---

## 5. Premissas a confirmar

Interpretei algumas respostas e preenchi lacunas. **Se alguma estiver errada, me diga que eu ajusto o documento.**

| ID | Premissa |
|---|---|
| **P-1** | A **tela de acompanhamento** é a tela pública principal do torneio (a mesma para visitante, membro e admin), não um painel separado. "Andamento" = progresso por fase e por jogos concluídos. **Não há placar ao vivo** (ponto a ponto) nem status "em quadra". |
| **P-2** | "Um por vez" = um torneio **ativo** por vez (inscrições abertas, encerradas ou em andamento). Rascunhos e finalizados não contam. |
| **P-3** | O formato de partida é **único para o torneio** (todas as fases), escolhido na criação, com 3 opções: padrão (2 sets + super tie-break de 10), set pro até 8 e set único até 6. "Sem vantagem" e os "10 pontos" são parâmetros de exibição e do validador. Congela quando sai o primeiro resultado. |
| **P-4** | D-3, D-5, D-10 e D-14 valem como **fora do escopo** do módulo, não só da v1 (removi a "Fase 2"). Sem e-mail, o inscrito acompanha pela aba **Inscritos** (aparece lá quando confirmado) e pelo contato do admin. O e-mail continua sendo coletado (contato e bloqueio de inscrição duplicada), mas nada é enviado. O vínculo com membro só acontece **logado** (RF-12) ou **manual pelo admin** (RF-22). |
| **P-5** | *(obsoleta na v0.3: sem reserva na Agenda)* |
| **P-6** | D-15 = ordem ATP **fixa** (retirei a opção de reordenar), mais as regras de contagem da v0.1: super tie-break conta 1 game a 0 na tabela, W.O. não entra nos percentuais, desistente mantém os jogos disputados e o restante vira W.O. Empate que sobrar depois de todos os critérios é **decidido pelo admin**. |
| **P-8** | Descanso (D-18): o mínimo é **medido do fim da janela de um jogo ao início do próximo**, vale o **maior** valor entre as categorias dos dois jogos, e o padrão de categoria é 60 min. Com janelas de 90 min coladas isso significa **pelo menos uma janela vazia** entre dois jogos da mesma pessoa. É regra **dura** na distribuição automática e **aviso** na edição manual. |
| **P-9** | "Mesma pessoa" em duas categorias = **mesmo membro vinculado ou mesmo e-mail** (união das duas pistas). E-mails diferentes não são reconhecidos; o painel mostra "também em: …" para o admin conferir. Impedimentos valem para todas as inscrições da mesma pessoa. |
| **P-7** | "Quem avança" mostra o classificado como **provisório** durante a fase e **confirmado** quando o grupo termina. Não calculo classificação matemática antecipada ("já garantido com 1 rodada de sobra"). |

---

## 6. Glossário

| Termo | Significado |
|---|---|
| Torneio | Evento com datas, regulamento e uma ou mais categorias. |
| Categoria | Prova dentro do torneio (ex.: "Masculino 3ª Classe"), com chave e regras próprias. |
| Inscrição | Pedido de participação de uma pessoa em uma categoria. |
| Chave | Estrutura de confrontos de uma categoria (grupos e/ou mata-mata). |
| Cabeça de chave (CC) | Inscrito posicionado para não enfrentar outros CCs cedo. |
| Bye | Vaga vazia na chave; o adversário avança sem jogar. |
| W.O. | Vitória por ausência do adversário. Duplo W.O. = ambos ausentes. |
| Jogos previstos | Partidas com data/hora/quadra definidas, mas ainda não disputadas. |
| Membro vinculado | Inscrição associada a um `users.id` de membro LAPEN aprovado. |
| Tela de acompanhamento | Página pública do torneio ativo, com andamento, grupos, chave, jogos e resultados. |

---

## 7. Perfis e permissões

| Ação | Visitante | Logado (não membro) | Membro LAPEN aprovado | Admin |
|---|:-:|:-:|:-:|:-:|
| Ver torneio, grupos, chave, jogos e resultados | ✓ | ✓ | ✓ | ✓ |
| Inscrever-se | ✓ (formulário) | ✓ | ✓ (vinculado) | ✓ (inscreve terceiros) |
| Planejar o cronograma (sessões, horários, trocas) e marcar impedimentos | — | — | — | ✓ |
| Configurar torneio, confirmar inscrições, sortear | — | — | — | ✓ |
| Lançar/corrigir resultado | — | — | — | ✓ |

**Ciclo de vida do torneio:** `draft` → `registration_open` → `registration_closed` → `in_progress` → `finished`. `cancelled` é possível a partir de qualquer estado anterior a `finished`.

**Ciclo de vida da categoria:** `awaiting_draw` → `drawn` (pré-visualização, só admin) → `published` → `group_stage` → `knockout_stage` → `finished` (categoria só knockout pula `group_stage`; só round-robin pula `knockout_stage`).

**Regras de transição:**
- Reabrir inscrições: só enquanto nenhuma chave estiver publicada.
- Refazer/desfazer sorteio: só enquanto nenhum resultado tiver sido lançado na categoria.
- Encerramento de inscrições: automático no prazo ou manual pelo admin.

---

## 8. Requisitos funcionais

### 8.1 Cadastro e regras (admin)

- **RF-01** Criar/editar torneio: nome, slug (URL), descrição, local, datas de início/fim, janela de inscrição (abertura e fechamento com data e hora), regulamento em texto livre, contato do organizador e **formato de partida** (RF-03). **D-1:** só pode haver **um torneio ativo** (status de `registration_open` a `in_progress`). Abrir inscrições com outro ativo é bloqueado com a mensagem "Finalize ou cancele o torneio <nome>". Rascunhos são ilimitados. A garantia fica no banco (índice único parcial).
- **RF-02** Um torneio tem uma ou mais categorias. Campos: nome, vagas máximas, mínimo de inscritos (padrão 4) e ordem de exibição. A mesma pessoa pode se inscrever em mais de uma categoria (D-2).
- **RF-03** **Formato de partida do torneio**, escolhido na criação **(D-7)**:
  - `best_of_3_super_tb` (**padrão**): 2 sets, tie-break a 6–6, 3º set = super tie-break de 10 pontos;
  - `pro_set_8`: 1 set até 8 games;
  - `single_set_6`: 1 set até 6 games, tie-break a 6–6;
  - parâmetros: sem vantagem (padrão sim) e pontos do match tie-break (padrão 10).
- **RF-03b** Regras **por categoria**: formato de chave (`knockout` | `round_robin` | `groups_knockout`); para grupos, tamanho alvo (3 ou 4), classificados por grupo (1 ou 2) e cruzamento (padrão 1A×2B); nº de cabeças de chave (sugerido pela tabela ITF, editável); tolerância de W.O. e descanso mínimo (informativos, exibidos no regulamento). **A ordem de desempate não é configurável (D-15).**
- **RF-04** Após o sorteio, o formato de chave da categoria fica travado (alterar exige desfazer o sorteio). O formato de partida do torneio fica travado quando sair o primeiro resultado.

### 8.2 Inscrição pública

- **RF-10** Página `/tournaments/:slug/register`, sem login e disponível só com o torneio em `registration_open` e dentro da janela. Fora dela, mostra o motivo (ainda não abriu / encerrada).
- **RF-11** Campos: nome completo, nome de exibição, e-mail, telefone/WhatsApp, categoria, observações, aceite do regulamento (obrigatório) e consentimento de uso de dados (LGPD).
- **RF-12** Usuário logado e **membro LAPEN aprovado**: campos pré-preenchidos e inscrição vinculada ao `user_id` (marcada "Membro LAPEN"). Logado mas não aprovado: inscreve como visitante, sem vínculo.
- **RF-13** **Sem vínculo automático por e-mail ou nome (D-16).** O vínculo só ocorre pela sessão logada (RF-12) ou manualmente pelo admin (RF-22).
- **RF-14** Mesmo e-mail na mesma categoria → bloqueado com mensagem clara.
- **RF-15** Com as vagas preenchidas por inscrições confirmadas, novas inscrições entram em **lista de espera**, e o formulário avisa antes do envio.
- **RF-16** Após o envio: tela de sucesso com status "Pendente de confirmação" explicando que **o organizador entrará em contato pelo telefone informado** e que o nome aparece na aba **Inscritos** quando confirmado. **Nenhum e-mail é enviado (D-10).**
- **RF-17** Anti-abuso: limite de requisições por IP e campo *honeypot* (sem CAPTCHA).
- **RF-18** Estados da inscrição: `pending` → `confirmed` | `rejected`; `pending`/`confirmed` → `cancelled`; `waitlist` → `pending`/`confirmed` **por ação do admin** quando abre vaga; `rejected`/`cancelled` → `pending` (**reabrir**, só antes do sorteio da categoria: volta para análise e a vaga só é checada ao confirmar; o motivo da recusa e o cabeça de chave são perdidos); `withdrawn` (desistência após o sorteio, com as partidas pendentes virando W.O.).

### 8.3 Gestão de inscrições (admin)

- **RF-20** Lista por categoria com filtro por status, busca por nome/e-mail e contadores (confirmadas / vagas / pendentes), com telefone visível para contato.
- **RF-21** Confirmar ou recusar, individualmente e em lote, com motivo opcional na recusa.
- **RF-22** Vincular/desvincular a inscrição a um usuário cadastrado (busca por nome/e-mail). É o que habilita as estatísticas.
- **RF-24** Criar inscrição manualmente (ex.: recebida por WhatsApp).
- **RF-25** Mover inscrito entre categorias antes do sorteio.
- **RF-26** Definir cabeças de chave (ordem 1..N) entre os confirmados (D-6).
- **RF-27** Marcar os **impedimentos** do inscrito (RF-77) e ver, na inscrição, em que outras categorias a mesma pessoa está (P-9).

### 8.4 Sorteio e montagem das chaves

- **RF-30** Pré-condições: inscrições encerradas e nº de confirmados ≥ mínimo da categoria.
- **RF-31** **Eliminatória simples:** chave na próxima potência de 2; cabeças posicionados conforme 2.4; byes primeiro aos cabeças, em ordem, e os restantes sorteados distribuídos entre metades/quartos; demais inscritos sorteados.
- **RF-32** **Grupos:** nº de grupos = ⌈n / tamanho alvo⌉, com grupos equilibrados (diferença máxima de 1 jogador, nenhum com menos de 3). Cabeças distribuídos em serpentina (CC1→A, CC2→B, …, e volta); demais sorteados.
- **RF-33** **Round-robin** (categoria inteira ou dentro de cada grupo): gerar todos os n·(n−1)/2 confrontos, organizados em rodadas pelo método do círculo para sugerir a ordem dos jogos.
- **RF-34** Pré-visualização só para o admin, com opção de trocar dois inscritos de posição/grupo e de refazer o sorteio.
- **RF-35** Publicar torna a chave pública. Registro de auditoria: quem, quando, resultado do sorteio e ajustes manuais.
- **RF-36** Desfazer publicação/sorteio só enquanto a categoria não tiver resultados.

### 8.5 Fase de grupos

- **RF-40** Tabela por grupo: J, V, D, sets pró/contra, games pró/contra, % sets, % games e posição. **Calculada no servidor** (fonte única para a tela e para a classificação).
- **RF-41** Desempate **fixo na ordem ATP (D-15)**: vitórias → partidas disputadas **em quadra** (W.O. não conta) → confronto direto (empate entre 2) → % de sets → % de games → decisão do admin. Em empate triplo, usar os critérios 4 e 5 e, ao separar um jogador, voltar ao confronto direto entre os restantes (2.6).
- **RF-42** Contagem na tabela **[P-6]**: o super tie-break vale **1 set e 1 game a 0** para o vencedor (o placar real fica preservado nos resultados); **W.O. conta como vitória/derrota, sem somar sets nem games**; **desistência durante o jogo** soma os sets e games até a interrupção; **desistência do torneio** mantém os jogos disputados e converte os restantes em W.O.
- **RF-43** **Quem avança [P-7]:**
  - enquanto o grupo não terminou: as N primeiras posições aparecem como **"Avança (provisório)"**;
  - quando todos os jogos do grupo estão concluídos: viram **"Classificado"** e os demais **"Eliminado"**, e o classificado entra na chave (RF-51);
  - se restar **empate após todos os critérios**, o grupo fica "Empate — decisão do organizador" e **bloqueia a classificação** até o admin definir a ordem (`PUT /groups/:gid/tiebreak`).

### 8.6 Mata-mata

- **RF-50** Rodadas nomeadas conforme o tamanho: 1ª rodada, oitavas, quartas, semifinal, final.
- **RF-51** **Vindo de grupos:** 1ºs colocados como cabeças; 2ºs cruzados, sem cair na mesma metade do 1º do próprio grupo (com 2 grupos: 1A×2B e 1B×2A). Ao publicar o sorteio já se cria o **esqueleto** da chave, com as vagas identificadas pela origem ("1º Grupo A", "2º Grupo B"), preenchidas quando cada grupo é confirmado. Se o nº de classificados não for potência de 2, os byes vão aos 1ºs com melhor campanha (critérios de 2.6) e o esqueleto só é montado quando todos os grupos terminarem.
- **RF-52** Bye avança automaticamente.
- **RF-53** O vencedor avança automaticamente para a vaga correta da partida seguinte, que mostra a origem ("Vencedor do jogo 3") até os dois lados serem conhecidos.
- **RF-54** Ao fim da final, a categoria é finalizada e exibe campeão e vice. Com todas as categorias finalizadas, o torneio pode ser encerrado (`finished`), o que libera o próximo torneio (D-1).

### 8.7 Resultados

- **RF-60** **Só o admin** lança resultados (D-8).
- **RF-61** Placar validado conforme o formato do torneio (RF-03), estendendo `validate_score`: o padrão aceita, por exemplo, "6-4, 3-6, 10-8".
- **RF-62** Desfechos:
  - normal;
  - W.O.;
  - duplo W.O.: no mata-mata a partida seguinte recebe W.O./bye; no grupo, derrota para ambos;
  - desistência durante o jogo: placar parcial + "ret.".
- **RF-63** Data de realização registrada (padrão: data do `schedule` vinculado ou a informada).
- **RF-64** **Correção de resultado:** permitida enquanto a partida seguinte do vencedor não tiver resultado. Trocar o vencedor reverte a propagação e atualiza classificação e estatísticas; caso contrário, a correção é bloqueada com mensagem.
- **RF-65** Auditoria de quem lançou/alterou e quando.
- **RF-66** Resultado + propagação + estatística em **uma transação**, protegida contra lançamento concorrente (padrão `WHERE status = …` já usado no ranking).

### 8.8 Cronograma (planejador de jogos)

Vocabulário: **janela** = uma quadra num dia e horário, com 90 min (D-11); **sessão** = intervalo de um dia em que o torneio usa certas quadras, dividido em janelas; **cronograma** = a partida de cada janela.

- **RF-70** **Sessões.** O admin cria sessões com data (dentro do período do torneio), hora inicial, hora final e as quadras usadas (lidas de `courts` ativas, D-19). As janelas são contadas de 90 em 90 min a partir da hora inicial; só cabem janelas inteiras (a sobra é descartada, com aviso). Dá para ter várias sessões no mesmo dia (ex.: manhã e tarde, com pausa no meio). Uma sessão não pode sobrepor outra na mesma quadra. Editar ou remover sessão só é permitido se nenhuma partida ocupar janela que deixaria de existir.
- **RF-71** **Janela bloqueada.** O admin bloqueia uma janela livre (chuva, manutenção). Bloquear uma janela ocupada, depois de confirmar, tira a partida do horário. Janela bloqueada não recebe partida.
- **RF-72** **Quadro.** Por dia, linhas = horários e colunas = quadras, cada partida ocupando uma janela. Ao lado, a lista **"Sem horário"** com as partidas pendentes sem janela, filtrável por categoria e fase. Partida concluída, bye e W.O. automático não ocupam janela nova.
- **RF-73** **Edição manual.** Colocar uma partida da lista numa janela livre, **mover** para outra janela livre, **trocar** duas partidas de lugar (swap), **remover do horário** e **fixar/desafixar** (partida fixada não é movida pela distribuição automática). Partida com resultado lançado não se move.
- **RF-74** **Validação.** Toda edição é conferida pelo mesmo validador que serve de regra à distribuição automática. Conflito de nível **erro** impede a ação; de nível **aviso** pede confirmação ("aplicar mesmo assim"). O quadro marca as partidas em conflito (borda, ícone e texto, nunca só cor) e um painel **Verificação** lista todos os conflitos atuais, que são recalculados a cada leitura (resultados e chaves mudam o que é conhecido).
- **RF-75** **Conflitos.**
  - *(erro)* a mesma pessoa em duas partidas sobrepostas;
  - *(erro)* partida antes do fim das que a alimentam (rodada seguinte antes da anterior; mata-mata antes do fim do grupo de onde vem a vaga);
  - *(erro)* janela inexistente ou bloqueada;
  - *(aviso)* descanso menor que o mínimo (D-18, P-8): na distribuição automática é regra dura;
  - *(aviso)* partida em horário de impedimento do atleta (RF-77): na distribuição automática é regra dura.

  Lados ainda indefinidos (mata-mata futuro) não geram conflito de pessoa; a ordem e o descanso do vencedor são garantidos pelas partidas que o alimentam, e o validador reavalia quando os jogadores forem conhecidos.
- **RF-76** **Pessoa.** O conflito entre categorias reconhece a mesma pessoa pelo membro vinculado ou pelo e-mail (P-9).
- **RF-77** **Impedimentos.** Por inscrição, uma lista de impedimentos: **data** (dentro do período do torneio) e **dia todo** ou **faixa de horário**, com observação opcional. Valem para todas as inscrições da mesma pessoa, são visíveis **só ao admin** e nunca aparecem em resposta pública.
- **RF-78** **Distribuição automática.** O admin escolhe o **escopo** (categorias e fase: grupos, mata-mata inteiro ou uma rodada), as **sessões** e, opcionalmente, "a partir de" (data e hora; janelas anteriores ficam intocadas, para replanejar com o torneio em andamento) e "refazer as já alocadas e não fixadas".
  1. **Viabilidade:** partidas a alocar × janelas livres, com o que falta ("faltam 6 janelas").
  2. **Proposta**, que **não grava nada**, mostrada no próprio quadro, com métricas (término previsto, maior espera de um atleta, jogos por atleta por dia) e a lista das partidas que **não couberam, cada uma com o motivo** ("Ana está indisponível nas janelas restantes", "depende da partida X, sem janela").
  3. **Aplicar:** grava em uma transação, revalidando cada partida (a proposta pode ter ficado velha).

  Regras duras: RF-75 (erros, descanso e impedimentos) e partidas fixadas/concluídas intocadas. Objetivos, nesta ordem: terminar cedo, reduzir a espera dos atletas, no máximo 2 jogos por atleta por dia, rodadas alinhadas no mesmo horário. Resultado reproduzível (mesma entrada e `rng_seed`, mesma proposta).
- **RF-79** **Publicação.** Os horários (data, hora, quadra) só aparecem ao público depois de **"Publicar cronograma"** (D-21), para o torneio todo; "Despublicar" volta a ocultar. Depois de publicado, as alterações aparecem imediatamente.

### 8.9 Estatísticas (interface)

- **RF-80** Ao registrar (ou corrigir) um resultado, se **ao menos um** participante estiver vinculado a membro LAPEN aprovado, gravar/atualizar uma linha em `match_statistics_unified` com:
  - `tournament_match_id` (única origem preenchida);
  - `player1_id`/`player2_id` (NULL para não vinculado) e nomes;
  - vencedor, placar, `match_type='Torneio'`, `match_date` e `added_by`.
- **RF-81** Nenhum membro vinculado → nada é gravado.
- **RF-82** **Bye e duplo W.O. nunca geram estatística** (sem vencedor; `winner_name` é obrigatório). **W.O. simples entra (D-12)**, com placar "W.O.", como no Ranking.
- **RF-83** Operação idempotente: índice único em `tournament_match_id`. Correção atualiza a linha; anulação a remove.
- **RF-84** *(removido na v0.3: nenhum `schedule` é vinculado a torneio)*
- **RF-85** *(removido na v0.3)*
- **RF-86** Tela de Estatísticas **(D-12):** opção "Torneio" no filtro de tipo e o filtro "Amistosos" passa a **excluir** `Torneio`. O H2H passa a incluir torneios automaticamente, porque já filtra por `player_id`.

### 8.10 Páginas públicas e tela de acompanhamento

- **RF-90** Item "Torneios" no menu (desktop e mobile).
- **RF-91** `/tournaments`: com torneio ativo, **abre direto a tela de acompanhamento dele** (D-1); sem torneio ativo, mostra "Nenhum torneio em andamento" e o histórico de finalizados, cada um abrindo a mesma tela em modo leitura.
- **RF-92** `/tournaments/:slug` é a **tela de acompanhamento**. Cabeçalho com nome, datas, local, status, **formato de partida em texto** ("2 sets sem vantagem + super tie-break de 10 pts") e botão "Inscreva-se" enquanto houver inscrições abertas. Abaixo, seletor de categoria e as abas **Andamento · Grupos · Chave · Jogos · Resultados · Inscritos · Regulamento** (rolagem horizontal no mobile). Categoria e aba ficam na URL, para compartilhar no WhatsApp. Antes do sorteio, Grupos e Chave mostram estado vazio explicativo ("A chave será publicada após o sorteio").
- **RF-93** **Andamento** (aba inicial):
  - **trilha de fases** por categoria (Inscrições → Grupos → Mata-mata → Final → Campeão), com a fase atual destacada e as concluídas marcadas;
  - **barra de progresso** "X de Y jogos concluídos", da categoria e do torneio, e contagem por fase;
  - **Próximos jogos** (até 5) e **Últimos resultados** (até 5);
  - **faixa de campeão e vice** quando a categoria termina.
- **RF-94** **Grupos** (visual):
  - um **cartão por grupo**, com a tabela de classificação (posição, jogador, J, V, D, saldo de sets, saldo de games; no mobile, colunas compactas);
  - **zona de classificação** destacada (faixa lateral na cor de destaque + selo) com os estados do RF-43: **Avança (provisório)**, **Classificado**, **Eliminado**, **Empate — decisão do organizador**;
  - quando o cruzamento já está determinado, o classificado mostra o **destino** (ex.: "→ Semifinal 1");
  - abaixo da tabela, os **jogos do grupo** (resultado ou data prevista);
  - bloco recolhível **"Como é definida a classificação"** com a ordem ATP, a regra do empate triplo e o tratamento de super tie-break e W.O. (D-15).
- **RF-95** **Chave** (visual):
  - **árvore por colunas de rodadas** (1ª rodada… final), com **conectores** ligando cada partida à seguinte;
  - **cartão da partida:** dois lados com nome e nº do cabeça, placar por set, **vencedor em destaque** e perdedor esmaecido, e status (concluída / agendada com data, hora e quadra / a definir). W.O. e desistência ficam indicados por texto;
  - lado ainda indefinido mostra a **origem** ("1º Grupo A", "Vencedor do jogo 3"); bye aparece como "BYE";
  - final destacada e **campeão** ao fim;
  - **mobile:** uma rodada por vez, com abas de rodada e deslizar para trocar; **desktop:** árvore completa com rolagem horizontal quando a chave for grande;
  - em `groups_knockout`, a chave mostra de qual grupo vem cada vaga.
- **RF-96** **Jogos:** partidas previstas agrupadas por dia → horário → quadra, e "a definir" ao final. Só mostra horário e quadra **depois que o cronograma for publicado** (RF-79).
- **RF-97** **Resultados:** mais recentes primeiro, com filtro por categoria e por fase.
- **RF-98** **Inscritos** (D-13): só confirmados e só o nome de exibição (e-mail e telefone nunca são públicos), com contagem de vagas. **Regulamento:** texto do organizador, formato de partida, tolerância de W.O., descanso mínimo e os **critérios de desempate** (os mesmos do RF-94).
- **RF-99** **Atualização:** a tela se recarrega a cada **60 s** enquanto a aba do navegador estiver visível, com botão "Atualizar" e "Atualizado às HH:MM". Sem tempo real (websocket) e sem placar ao vivo.

### 8.11 Painel administrativo

- **RF-100** `/admin/tournaments`: lista com status, datas, badge de inscrições pendentes e botão de criar (respeitando o RF-01).
- **RF-101** `/admin/tournaments/:id` com as abas **Dados & Regulamento · Categorias & Regras · Inscrições** (com impedimentos) **· Sorteio · Cronograma** (RF-70..79) **· Partidas** (resultados e decisão de empates).
- **RF-102** Atalho no AdminDashboard com pendências (inscrições pendentes, resultados pendentes, empates a decidir).
- **RF-103** Ações destrutivas (desfazer sorteio, cancelar torneio, recusar inscrição) confirmadas via Dialog do shadcn/ui.
- **RF-104** Partida com janela já vencida e sem resultado aparece como **"resultado pendente"** no painel (e no atalho do AdminDashboard).

---

## 9. Requisitos não funcionais

- **RNF-01 Independência.** Nenhuma consulta às tabelas `ranking_*` e nenhum import dos serviços do ranking. Estrutura própria:
  - tabelas `tournament_*`;
  - blueprint `tournaments_bp` (`/api/tournaments`, leitura pública + inscrição) e `admin_tournaments_bp` (`/api/admin/tournaments`, `require_admin_auth`);
  - serviços em `src/services/tournament_*.py` (sorteio, classificação, propagação).

  Pontos de contato: `match_statistics_unified` (escrita) e `courts` (somente leitura, nomes das quadras).
- **RNF-02 Front público.** Mobile-first (320px, alvos de 44px), `data-testid` em todo elemento interativo, sem `alert/confirm/prompt`. **Paleta argila:** vencedor, classificado e destaques em âmbar/laranja/marrom, perdedor e eliminado em tons neutros esmaecidos; **sem verde, azul ou roxo**. Nenhum estado depende só da cor (sempre selo ou texto).
- **RNF-03 LGPD.** E-mail e telefone visíveis só para o admin; aceite do regulamento e consentimento registrados com data/hora.
- **RNF-04 Atomicidade e concorrência.** Lançamento de resultado (com propagação e estatística) e toda alteração do cronograma são transacionais; duas edições simultâneas não podem ocupar a mesma janela (índice único + trava no torneio).
- **RNF-05 Datas e horas.** Usar os utilitários de timezone existentes (`src/utils/time_utils.py`, `src/utils/dateUtils.js`).
- **RNF-06 Performance.** Os dados de uma categoria (grupos, classificação, chave, partidas) vêm em **um único request**. A chave de 64 deve rolar com fluidez no mobile. O polling de 60 s (RF-99) só roda com a aba visível.
- **RNF-07 Testes.**
  - pytest: gerador de chave (cabeças/byes para n = 4..64), grupos, desempate (2 e 3 empatados, empate residual), propagação/correção, índice de torneio único, estatísticas, validador e distribuição do cronograma (propriedades: nenhuma proposta viola regra dura; troca preserva os invariantes).
  - Playwright: inscrição pública → confirmação → sorteio → resultado → estatística; cronograma (sessões, distribuição, troca, publicação, impedimentos); tela de acompanhamento em 320px e desktop; painel admin em tablet e desktop.
- **RNF-08 Documentação.** `swagger.yaml` atualizado; migrations numeradas e idempotentes, refletidas em `postgres_schema.sql` e em `.amazonq/rules/architecture.md`.
- **RNF-09 Auditoria.** Sorteio, ajustes de chave, confirmação de inscrição, lançamento/correção de resultado, decisão de empate e **alterações do cronograma (distribuição aplicada, troca, remoção, fixação, publicação, impedimentos)** registram autor e momento.

- **RNF-10 Painel admin em desktop e tablet (D-22).** O painel de torneios é projetado para largura de **768 px em diante** (tablet em pé e deitado, notebook, monitor): usa a largura em colunas, tabelas densas e o quadro do cronograma, e a edição funciona **por toque** (selecionar e tocar no destino) além do arrastar com mouse. Abaixo de 768 px aparece um aviso recomendando tablet ou computador. A interface **pública** não muda: continua mobile-first.
- **RNF-11 Distribuição.** Resolve até 200 partidas em até 2 s sem dependência nova (Python puro), de forma determinística por `rng_seed`.

---

## 10. Modelo de dados proposto (esboço)

> Esboço para discussão, não SQL final. Nomes em inglês seguindo a convenção do projeto.

| Tabela | Campos principais |
|---|---|
| `tournaments` | id, name, slug (único), description, location, start_date, end_date, registration_opens_at, registration_closes_at, rules_text, contact_info, **match_format, no_ad, match_tiebreak_points**, status, created_at, updated_at · **índice único parcial: no máximo 1 torneio com status ativo (D-1)** |
| `tournament_categories` | id, tournament_id, name, max_entries, min_entries, draw_format, group_target_size, qualifiers_per_group, num_seeds, wo_tolerance_min, **min_rest_min (padrão 60)**, status, sort_order |
| `tournament_registrations` | id, category_id, user_id (NULL), full_name, display_name, email, phone, notes, status, seed (NULL), terms_accepted_at, reviewed_at, rejection_reason, created_at · único (category_id, lower(email)) |
| `tournament_groups` | id, category_id, name ("A", "B"…) · único (category_id, name) |
| `tournament_group_entries` | group_id, registration_id, final_position, manual_rank (NULL: decisão do admin em empate residual) |
| `tournament_matches` | id, category_id, stage (`group`/`knockout`), group_id (NULL), round_number, bracket_position, entry1_id, entry2_id, **entry1_source, entry2_source** (origem: "1º Grupo A", "Vencedor do jogo 3"), winner_entry_id, next_match_id, next_slot (1/2), status, outcome (`normal`/`wo`/`double_wo`/`retired`/`bye`), score, planned_date, planned_time, court_id (as três juntas ou nenhuma; **índice único** em quadra+data+hora), **locked**, played_at, result_by, result_at |
| **`tournament_sessions`** | id, tournament_id, play_date, start_time, end_time · `end_time` > `start_time` |
| **`tournament_session_courts`** | session_id, court_id (FK `courts`) · chave (session_id, court_id) |
| **`tournament_slot_blocks`** | id, tournament_id, court_id, play_date, start_time · único (court_id, play_date, start_time) |
| **`tournament_unavailability`** | id, registration_id, play_date, start_time (NULL = dia todo), end_time, note |
| `tournaments` (acréscimo) | **schedule_published_at** (NULL = cronograma oculto) |
| `tournament_audit_log` | id, tournament_id, category_id, action, payload (JSON), actor, created_at |
| **Alteração** `match_statistics_unified` | + `tournament_match_id` (FK, NULL) + índice único parcial + `CHECK` "exatamente uma de `schedule_id` / `ranking_match_id` / `tournament_match_id`" |

Removidos em relação à v0.1: `entry_type`, `payment_status`, `paid_at`, `tiebreak_order`, formatos de partida por fase.

---

## 11. API proposta (esboço)

**Pública (sem autenticação)**

```
GET  /api/tournaments                                 { current: torneio ativo | null, history: [...] }
GET  /api/tournaments/:slug                           detalhes + categorias + progresso (RF-93)
GET  /api/tournaments/:slug/categories/:id            grupos, classificação, chave, partidas (1 request)
GET  /api/tournaments/:slug/matches?view=upcoming|results&category=
POST /api/tournaments/:slug/registrations             inscrição (rate-limited)
```

**Admin (JWT, `is_admin`)**

```
GET|POST|PUT|DELETE  /api/admin/tournaments[/:id]
GET|POST|PUT|DELETE  /api/admin/tournaments/:id/categories[/:cid]
GET|PATCH            /api/admin/tournaments/:id/registrations[/:rid]   confirmar/recusar/vincular/cabeça (aceita lote)
GET                  /api/admin/tournaments/:tid/categories/:cid/draw         grupos e chave (pré-visualização ou publicado)
POST                 /api/admin/tournaments/:tid/categories/:cid/draw         gerar (ou refazer) a pré-visualização
PUT                  /api/admin/tournaments/:tid/categories/:cid/draw         trocar dois inscritos de posição/grupo
POST                 /api/admin/tournaments/:tid/categories/:cid/draw/publish
DELETE               /api/admin/tournaments/:tid/categories/:cid/draw         desfazer (sem resultados)
GET                  /api/admin/tournaments/:tid/categories/:cid/standings    tabelas dos grupos
PUT                  /api/admin/tournaments/:tid/groups/:gid/tiebreak         decidir empate residual
GET                  /api/admin/tournaments/:tid/schedule                     quadro: quadras, sessões, janelas, partidas, conflitos
POST|PUT|DELETE      /api/admin/tournaments/:tid/schedule/sessions[/:sid]     sessões (RF-70)
PUT                  /api/admin/tournaments/:tid/schedule/blocks              bloquear/desbloquear janela (RF-71)
POST                 /api/admin/tournaments/:tid/schedule/place               colocar ou mover partida (RF-73)
POST                 /api/admin/tournaments/:tid/schedule/swap                trocar duas partidas (RF-73)
DELETE               /api/admin/tournaments/:tid/schedule/matches/:mid        remover do horário
PUT                  /api/admin/tournaments/:tid/schedule/matches/:mid/lock   fixar/desafixar
POST                 /api/admin/tournaments/:tid/schedule/distribute          proposta (não grava) (RF-78)
POST                 /api/admin/tournaments/:tid/schedule/apply               aplicar a proposta
POST                 /api/admin/tournaments/:tid/schedule/publish|unpublish   (RF-79)
GET|PUT              /api/admin/tournaments/:tid/registrations/:rid/unavailability   impedimentos (RF-77)
PUT                  /api/admin/tournaments/:tid/matches/:mid/result          lançar resultado
PATCH                /api/admin/tournaments/:tid/matches/:mid/result          corrigir resultado
DELETE               /api/admin/tournaments/:tid/matches/:mid/result          anular resultado
```

---

## 12. Etapas de implementação sugeridas

Cada etapa é testável sozinha:

1. **Migrations + modelo** → verificar: migrations idempotentes rodam 2×; schema atualizado; índice de torneio único rejeita o segundo ativo.
2. **Inscrição pública + gestão de inscrições** → verificar: pytest das regras RF-14/15/18; E2E da inscrição.
3. **Gerador de chaves** (serviço puro) → verificar: pytest de cabeças/byes/grupos para n = 4..64.
4. **Resultados, classificação e propagação** (inclui a gravação em estatísticas, RF-80..83, na mesma transação do resultado) → verificar: pytest de desempate (2, 3 e residual), correção e estatística.
5. **API de leitura + painel admin** → verificar: 1 request por categoria devolve tudo que a tela precisa.
6. **Tela de acompanhamento** (Andamento, Grupos, Chave, Jogos, Resultados, Inscritos, Regulamento) → verificar: E2E em 320px e desktop; estados vazio, provisório, confirmado e campeão.
7. **Cronograma** (7a sessões/quadro/validador/edição manual · 7b distribuição automática · 7c impedimentos · 7d interface do cronograma · 7e painel admin para desktop e tablet) → verificar: pytest com propriedades (nenhuma proposta viola regra dura; troca preserva invariantes), E2E do quadro em tablet e desktop.
8. **Estatísticas (leitura e filtros)** → verificar: pytest da regra RF-86; filtros na tela. Detalhamento em [TOURNAMENT_IMPLEMENTATION_PLAN.md](TOURNAMENT_IMPLEMENTATION_PLAN.md).

---

## 13. Fora de escopo

- Qualquer ligação com o Ranking LAPEN (pontos, cabeças pelo ranking, participantes, temporadas).
- Apostas e pagamento/taxa de inscrição (D-5).
- Envio de e-mails (D-10).
- Duplas (D-3), consolação e disputa de 3º lugar (D-14).
- Lançamento de resultado por participantes (D-8).
- Placar ao vivo ponto a ponto e status "em quadra" (P-1).
- Arbitragem, código de conduta e penalidades.
- Ranking próprio de torneios entre edições.
- Notificações push.
- Mais de um torneio ativo ao mesmo tempo (D-1).
- Qualquer integração com a Agenda (`schedules`): reservas, bloqueio automático de quadras, proteção de edição (D-17).
- Painel admin otimizado para celular (D-22).
- Extras sugeridos e adiados: variantes de proposta, mensagem de WhatsApp por atleta, impressão da ordem de jogo, "horário alterado", solver exato.

---

## 14. Fontes

- [Nitto ATP Finals — Rules and Format](https://www.nittoatpfinals.com/en/event/rules-and-format)
- [ATP Rulebook 2026 — Chapter IV, World Championships (PDF)](https://www.atptour.com/-/media/files/rulebook/2026/2026-rulebook-chapter-4_world-championships_193dec25.pdf)
- [JudgeMate — Tennis seeding and draws explained](https://www.judgemate.com/en/guides/tennis-seeding-and-draw-explained)
- [ITF World Tennis Tour Juniors 2026 Regulations (PDF)](https://www.itftennis.com/media/15480/2026-itf-world-tennis-tour-juniors-regulations.pdf)
- [CBT — Regulamento Nacional de Classes/Amador 2021 (PDF)](https://tenis-integrado-prod.s3.amazonaws.com/sync-prod/id382331/anexos/anexo_1694439101.pdf)
- [Ranking de Tênis — exemplo de regulamento de torneio com grupos](https://www.rankingdetenis.com/Torneio/Regulamento?barragem=1189)
- [UTR Sports — Feed-In Consolation](https://support.universaltennis.com/en/support/solutions/articles/9000232534-creating-draws-feed-in-consolation) · [Compass Draw](https://support.universaltennis.com/en/support/solutions/articles/9000153525-creating-draws-compass-draw)
