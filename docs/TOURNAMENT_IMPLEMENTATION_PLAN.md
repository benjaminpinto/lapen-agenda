# Módulo de Torneios — Plano de Implementação

**Base:** [TOURNAMENT_REQUIREMENTS.md](TOURNAMENT_REQUIREMENTS.md) v0.3 (premissas P-1..P-9) · **Data:** 06/10/2026 · **Status:** etapas 1–9 concluídas (a Etapa 7 foi reescrita na v0.3: cronograma próprio no lugar da reserva na Agenda). Entrega e deploy em [TOURNAMENT_DEPLOY.md](TOURNAMENT_DEPLOY.md)

> Os IDs `RF-xx`/`RNF-xx` apontam para o documento de requisitos. Cada etapa termina com uma **verificação objetiva**; só passa para a próxima quando ela estiver verde.

---

## 1. O que o código atual impõe ao plano

Achados da leitura do código que mudam *como* implementar (não *o quê*):

| # | Achado | Consequência no plano |
|---|---|---|
| 1 | **CI e `setup_db.py` executam `postgres_schema.sql` inteiro de uma vez**; `init_db()` (`src/database.py`) divide o arquivo por `;`. | O schema mestre só pode ter **instruções simples** (sem `DO $$`, sem `;` dentro de corpo). Blocos `DO` ficam só na migration. |
| 2 | **`run_migrations.py` reexecuta todos os `.sql` a cada execução.** | A `014` precisa ser **idempotente de verdade** (`IF NOT EXISTS`, constraints nomeadas e checadas). Testar rodando 2×. |
| 3 | `match_statistics_unified` tem dois `CHECK` **sem nome** (nome gerado pelo Postgres). | A migration descobre os nomes em `pg_constraint` (bloco `DO`) antes de remover. O schema mestre já declara o `CHECK` final, **nomeado**. |
| 4 | O schema mestre define `match_statistics_unified` no meio do arquivo. | Colocar o bloco `tournament_*` **antes** dela, para a FK `tournament_match_id` já nascer inline. |
| 5 | `get_db()` abre conexão sem autocommit e `DBConnection.__exit__` faz rollback. Muitas rotas existentes não fazem rollback no erro. | Todo write do módulo usa **`with get_db() as db:`** e um único `commit()` no fim (RNF-04). |
| 6 | Admin = JWT + `users.is_admin` (`require_admin_auth`, `src/auth.py:132`). O `swagger.yaml` ainda cita `AdminSession`. | Rotas novas documentadas com `BearerAuth`. *(v0.3: sem decorator novo; só o admin planeja.)* |
| 7 | ~~`generate_time_slots`/`is_time_blocked` em `public.py`~~ | **Obsoleto (v0.3):** o torneio não toca na Agenda; nada de `court_booking.py`. |
| 8 | ~~Escritas em `schedules` só em `public.py`~~ | **Obsoleto (v0.3):** sem guardas de vínculo em `update_schedule`/`delete_schedule`. |
| 9 | Não há `Flask-Limiter` nas dependências e o app roda em serverless (memória não persiste). Também não há `ProxyFix`. | Rate limit da inscrição (RF-17) **em banco**: coluna `ip_hash` (SHA-256 de `X-Forwarded-For` + `SECRET_KEY`), máx. 5 inscrições/hora por IP. Como o admin confirma tudo, o risco de spoofing é baixo. |
| 10 | Padrão de testes: `from main import app`, `app.test_client()`, `generate_token(user_id)`, ids fixos ≥ 9999 e limpeza em fixture. CI só semeia a quadra id 1. | Seguir o padrão. FKs com `ON DELETE CASCADE` na árvore do torneio para limpeza simples. |
| 11 | `/api/test/cleanup` (`src/routes/test.py`, bloqueado em produção) é o gancho de limpeza do E2E. | Acrescentar `/api/test/tournaments/...` (cleanup + **seed por estado**) no mesmo blueprint. |
| 12 | O container `lapen-postgres` **não está rodando** agora (só os do projeto `combinador`). | Etapa 0: `docker-compose up -d` e baseline de testes. |

---

## 2. Arquitetura de arquivos

**Backend (novo)**

```
src/database/migrations/014_add_tournaments.sql
src/services/tournament_service.py     # ciclo de vida, regras de inscrição, serializers públicos (whitelist)
src/services/tournament_draw.py        # PURO (sem DB): tamanho de chave, cabeças, byes, grupos, round-robin, esqueleto
src/services/tournament_standings.py   # PURO: classificação + desempate ATP
src/services/tournament_results.py     # DB: lançar/corrigir resultado, propagação, qualificação, estatística (1 transação)
src/services/tournament_schedule.py    # PURO: janelas de 90 min, pessoa (membro/e-mail), validador de conflitos, distribuição (guloso + busca local)
src/services/tournament_schedule_service.py  # DB: sessões, bloqueios, colocar/mover/trocar/remover/fixar, proposta, aplicar, publicar, impedimentos
src/routes/tournaments.py              # público (leitura + inscrição)
src/routes/admin_tournaments.py        # admin
src/routes/admin_tournament_schedule.py # admin: cronograma e impedimentos
```

**Backend (alterado)**

```
src/database/postgres_schema.sql       # bloco tournament_* + CHECK/coluna em match_statistics_unified
src/utils/score_parser.py              # validate_score(score, match_format=...) — padrão inalterado
src/routes/statistics.py               # general (filtro Amistosos / Torneio)
src/routes/test.py                     # cleanup + seed de torneio por estado
main.py                                # registra os blueprints
swagger.yaml · .amazonq/rules/architecture.md · src/database/migrations/README.md
```

**Frontend (novo)**

```
src/components/tournament/
  TournamentPage.jsx        # tela de acompanhamento (abas + seletor de categoria + polling)
  TournamentHome.jsx        # /tournaments (ativo ou histórico)
  RegistrationForm.jsx
  tabs/ ProgressTab · GroupsTab · BracketTab · MatchesTab · ResultsTab · EntriesTab · RulesTab
  BracketView.jsx · MatchCard.jsx · GroupCard.jsx · StandingsTable.jsx · ProgressTrack.jsx
  useTournamentData.js      # fetch + polling 60 s + visibilitychange
src/components/admin/tournament/
  AdminTournaments.jsx · AdminTournamentDetail.jsx
  TournamentForm · CategoriesPanel · RegistrationsPanel · DrawPanel · MatchesPanel
  schedule/ SchedulePanel · SessionsPanel · ScheduleGrid · UnscheduledList · ConflictsPanel · DistributeDialog · UnavailabilityDialog
e2e/tests/tournament.spec.ts · e2e/helpers/tournament-helpers.ts
tests/backend/test_tournament_*.py
```

**Frontend (alterado):** `App.jsx` (rotas), `Header.jsx` (item de menu), `AdminDashboard.jsx` (card + pendências), `statistics/Statistics.jsx` (filtro "Torneio").

---

## 3. Etapas

Legenda de tamanho: **S** ≈ meio dia · **M** ≈ 1–2 dias · **L** ≈ 3+ dias (estimativa relativa, não compromisso).

### Etapa 0 — Preparação (S)

- Criar branch `feat/tournaments`.
- `docker-compose up -d`; rodar `pytest tests/backend/` e **registrar o baseline** (falhas pré-existentes ficam anotadas para não serem confundidas com regressão).

**Verificação:** baseline anotado; `docker exec lapen-postgres psql -U lapen_user -d lapen_agenda -c "select 1"` responde.

---

### Etapa 1 — Schema (M)

**Tarefas**
1. `014_add_tournaments.sql`, idempotente:
   - tabelas `tournaments`, `tournament_categories`, `tournament_registrations`, `tournament_groups`, `tournament_group_entries`, `tournament_matches`, `tournament_audit_log` (esboço da seção 10 dos requisitos), com `CHECK` nos enums de status/formato/desfecho e `ON DELETE CASCADE` na árvore;
   - **índice único parcial** de torneio ativo: `UNIQUE ((true)) WHERE status IN ('registration_open','registration_closed','in_progress')`;
   - único `(category_id, lower(email))` **parcial**, ignorando `rejected/cancelled/withdrawn` (quem foi recusado pode se inscrever de novo);
   - `tournament_matches.schedule_id` único, FK `ON DELETE SET NULL`; `tournament_registrations.ip_hash`;
   - `match_statistics_unified`: `ADD COLUMN IF NOT EXISTS tournament_match_id`, remover os dois `CHECK` antigos (descobertos em `pg_constraint`), criar `chk_match_stats_single_source` ("exatamente uma origem"), índice único parcial em `tournament_match_id`.
2. `postgres_schema.sql`: mesmo conteúdo, **sem `DO`**, bloco novo antes de `match_statistics_unified`, que já declara o `CHECK` final e a coluna inline.
3. Atualizar `migrations/README.md` (entrada 014) e a seção Database de `.amazonq/rules/architecture.md` (regra do CLAUDE.md).
4. `tests/backend/test_tournament_schema.py`.

**Verificação**
- Banco **novo** a partir do `postgres_schema.sql` (como o CI faz): sem erro.
- Banco **existente** com `python run_migrations.py` rodado **duas vezes**: sem erro na 014; linhas antigas de estatística continuam válidas.
- Pytest: segundo torneio ativo → `UniqueViolation`; estatística com 0 ou 2 origens → `CheckViolation`; só `tournament_match_id` → ok; e-mail duplicado ativo na categoria → erro, mas após `rejected` → ok.

**Risco:** reescrita do `CHECK` em tabela de produção. Mitigação: as linhas atuais já têm exatamente uma origem (o novo `CHECK` é compatível); a operação é rápida e dentro de transação.

---

### Etapa 2 — Torneio, categorias e inscrições (backend) (M–L)

**Tarefas** (RF-01..04, RF-10..18, RF-20..26)
- `tournament_service.py`: máquina de estados do torneio e da categoria (RF-01, seção 7), regra D-1 com erro 409 amigável ("Finalize ou cancele o torneio X"), geração de slug (minúsculas, sem acento, único), regras de vaga/lista de espera, **serializer público com whitelist** (nunca `email`, `phone`, `ip_hash`, `notes`).
- `admin_tournaments.py`: CRUD de torneio/categoria; inscrições (listar, confirmar/recusar em lote, criar manual, mover de categoria, vincular a `user_id` **só se `lapen_approved`**, definir cabeças, promover da lista de espera).
- `tournaments.py` (público): `POST /api/tournaments/:slug/registrations` com honeypot, rate limit por `ip_hash`, vínculo automático **só** quando há JWT de membro aprovado (RF-12/13).
- `auth.py`: `get_optional_user` (a `require_admin_or_lapen_member` prevista aqui deixou de existir na v0.3).
- Registrar blueprints em `main.py` (ainda sem link no front).

**Verificação** (`tests/backend/test_tournament_registration.py`, `..._lifecycle.py`)
- Matriz de permissão: visitante 401/403, não membro 403, membro ok, admin ok, em cada rota.
- RF-14 (duplicado), RF-15 (lista de espera quando lotado), RF-18 (transições válidas/inválidas), janela de inscrição, 6ª inscrição do mesmo IP/hora → 429.
- Vínculo manual recusado para usuário não aprovado.
- **Teste de privacidade:** nenhuma resposta pública contém as chaves `email`, `phone`, `ip_hash`, `notes`.
- D-1: abrir inscrições com outro ativo → 409; rascunhos ilimitados.

---

### Etapa 3 — Motor de sorteio (L)

**Tarefas** (RF-30..36, RF-51) — `tournament_draw.py` **puro**, com `rng` injetável (`random.Random(seed)`) para ser determinístico em teste.
- `bracket_size(n)`, `seed_positions(size, n_seeds)` (ITF: CC1 primeira linha, CC2 última, CC3–4 sorteados entre os quartos, CC5–8 entre as oitavas).
- `build_knockout(entries, seeds, rng)`: byes primeiro para os cabeças em ordem; demais byes sorteados e espalhados uniformemente.
- `build_groups(entries, seeds, target_size, rng)`: nº de grupos = ⌈n/alvo⌉, diferença máxima 1, mínimo 3, cabeças em serpentina. `groups_knockout` exige n ≥ 6 (abaixo disso o admin é orientado a usar round-robin).
- `round_robin_rounds(entries)`: método do círculo.
- `knockout_skeleton_from_groups(...)`: 1ºs nas vagas de cabeça (A=CC1, B=CC2…); 2ºs sorteados só em vagas **fora da metade do 1º do próprio grupo** (com 2 grupos sai 1A×2B e 1B×2A). Sem potência de 2, o esqueleto só é montado ao fim dos grupos (byes pela campanha) — **é o ponto mais arriscado da etapa; implementar por último**.
- Endpoints: gerar pré-visualização, trocar duas posições, publicar (cria `tournament_groups`/`tournament_matches` com `next_match_id`/`next_slot` e bye já avançado), desfazer (bloqueado com resultado), tudo com auditoria (RNF-09).

**Verificação** (`tests/backend/test_tournament_draw.py`)
- Para **n = 4..64**: nenhum inscrito duplicado ou perdido; nº de byes = tamanho − n; CC1/CC2 em metades opostas; CC1–4 em quartos distintos; byes distribuídos entre os cabeças primeiro.
- Grupos: tamanhos diferem ≤ 1, nenhum < 3, cabeças em grupos distintos até esgotar.
- Round-robin: n(n−1)/2 jogos; ninguém joga duas vezes na mesma rodada.
- Mesmo `seed` de rng → mesma chave; seeds diferentes → chaves diferentes.
- Cruzamento 2 grupos = 1A×2B / 1B×2A; com 4 grupos nenhum 2º cai na metade do 1º do próprio grupo.
- API: publicar sem mínimo de inscritos → 400; desfazer com resultado → 409.

---

### Etapa 4 — Classificação, resultados e propagação (L)

**Tarefas** (RF-40..43, RF-50..54, RF-60..66, RF-80..83)
- `score_parser.py`: `validate_score(score, match_format='best_of_3_super_tb')`. O padrão **não muda** (o validador atual já cobre o formato D-7). Acrescentar `pro_set_8` e `single_set_6` (placares válidos de cada um: [§5, item 1](#5-detalhes-a-decidir-durante-a-implementação)).
- `tournament_standings.py` **puro**: J/V/D, sets e games (regras RF-42: super tie-break = 1 set e 1–0 em games; W.O. fora dos percentuais; desistência soma o parcial), ordem ATP fixa (vitórias → partidas em quadra → confronto direto → % sets → % games → empate residual), sub-procedimento do empate triplo, `manual_rank` do admin, retorno com estado por jogador (`provisional` / `qualified` / `eliminated` / `tie_pending`).
- `tournament_results.py`: lançar/corrigir resultado (normal, W.O., duplo W.O., desistência), propagação no mata-mata e bye, conclusão de grupo → classificação → preenchimento do esqueleto, fim de categoria/torneio (RF-54), correção só se a partida seguinte não tiver resultado (RF-64).
- **Tudo em 1 transação** com guarda `UPDATE ... WHERE status = <esperado>` (padrão do ranking): resultado + propagação + auditoria + **gravação em `match_statistics_unified`** (RF-80..83: só se há membro vinculado; nada para bye/duplo W.O.; idempotente por `tournament_match_id`).
- Endpoints `PUT /matches/:mid/result` e `PUT /groups/:gid/tiebreak`.

**Verificação**
- `test_score_parser.py` existente **continua verde sem edição**; novos casos para os dois formatos extras.
- `test_tournament_standings.py` (casos de ouro): empate de 2 por confronto direto; empate triplo resolvido por % sets e, ao separar um, volta ao confronto direto; 2–1 acima de 2–0; W.O. fora dos percentuais; desistente do torneio; **empate residual → `tie_pending` e a classificação não avança até o admin decidir**.
- `test_tournament_results.py`: mata-mata de 8 e 16 (propaga até o campeão); 2 grupos × 4 + semifinais; duplo W.O. no mata-mata; correção permitida e correção bloqueada; **dois envios simultâneos do mesmo resultado → um 200, outro 409**; falha no meio da transação não deixa estatística órfã.
- `test_tournament_statistics.py`: membro vs não membro → 1 linha; dois não membros → 0; bye → 0; W.O. simples → 1 linha com placar "W.O."; correção atualiza e anulação remove a linha.

---

### Etapa 5 — API de leitura, painel admin e fixtures de teste (L)

**Tarefas** (RF-100..103, RNF-06)
- Endpoints públicos de leitura (seção 11 dos requisitos). O de categoria devolve **tudo em um request**:
  `{category, format_text, stage, progress{done,total}, groups[{standings[...], matches[...]}], bracket{rounds[{name, matches[...]}]}, upcoming[], results[]}`; cada lado de partida traz `{display_name, seed, source_label}` (a origem aparece quando o lado ainda é indefinido).
- Painel admin (`AdminTournaments`, `AdminTournamentDetail` com as 5 abas, resultados e decisão de empate), rotas em `App.jsx`, card + pendências no `AdminDashboard`. O cronograma entra na Etapa 7.
- **Seed por estado** em `test.py` (bloqueado em produção): `registration_open`, `groups_in_progress`, `knockout_in_progress`, `finished`. Alimenta E2E, testes de layout e verificação visual.

**Verificação**
- Pytest do formato do payload para cada estado do seed (inclusive "antes do sorteio" vazio) e da whitelist de privacidade.
- Playwright (admin): criar torneio → categoria → inscrições (via API) → confirmar → sortear → publicar → lançar resultado → empate residual decidido.
- Console do navegador sem erros nas telas admin.

---

### Etapa 6 — Tela de acompanhamento e inscrição pública (L)

**Tarefas** (RF-10..12, RF-90..99, RNF-02)
- `useTournamentData`: busca por categoria, polling de 60 s **só com a aba visível** (`visibilitychange`), cancelamento de request pendente, botão "Atualizar" e "Atualizado às HH:MM".
- Telas: `TournamentHome` (ativo ou histórico, RF-91), `TournamentPage` com as 7 abas e URL com categoria/aba (RF-92), `RegistrationForm`.
- **Chave visual** (`BracketView` + `MatchCard`), sem dependência nova: colunas por rodada em CSS grid/flex e conectores com pseudo-elementos; origem do lado indefinido ("1º Grupo A", "Vencedor do jogo 3"); bye; vencedor em destaque; **mobile = uma rodada por vez** com abas e deslizar; desktop = árvore completa com rolagem horizontal **dentro do contêiner**.
- **Grupos:** `GroupCard` + `StandingsTable` com selos (Avança provisório / Classificado / Eliminado / Empate), destino ("→ Semifinal 1") e o bloco recolhível "Como é definida a classificação".
- **Cores:** âmbar/laranja/marrom para destaque, neutros para eliminado; sem verde, azul, roxo; nenhum estado só por cor (RNF-02). `data-testid` em tudo que é interativo.
- **Por último nesta etapa:** link "Torneios" no `Header.jsx` (desktop e mobile). Enquanto ele não existe, nada do módulo aparece para o público.

**Verificação**
- Playwright em **320, 768 e 1280 px** sobre cada estado do seed: vazio (pré-sorteio), grupos provisório, grupo confirmado + esqueleto, mata-mata parcial, campeão. Sem rolagem horizontal da **página** em 320 px.
- Teste de polling com relógio simulado: a aba oculta não dispara request; ao voltar, atualiza.
- Inscrição ponta a ponta: sucesso, e-mail duplicado, janela fechada, honeypot, lotado → lista de espera.
- Revisão visual com Playwright MCP (regra do CLAUDE.md para UI) das 7 abas em mobile e desktop.

---

### Etapa 7 — Cronograma próprio (L, em 5 fatias) · *reescrita na v0.3* · **concluída**

Sem integração com a Agenda (D-17). O planejador distribui as partidas pendentes em **janelas de 90 min** (D-11) e deixa o admin remanejar por troca. Detalhes em RF-70..79, RF-104 e RNF-10/11.

**Esquema** (editado na própria `014`, que nunca rodou em banco algum): remove `schedule_id` e `booked_by_user_id` de `tournament_matches`; acrescenta `locked`, índice único em quadra+data+hora e `CHECK` "as três juntas ou nenhuma"; novas tabelas `tournament_sessions`, `tournament_session_courts`, `tournament_slot_blocks`, `tournament_unavailability`; `tournaments.schedule_published_at`; `min_rest_min` padrão 60.

**7a — Sessões, quadro, validador e edição manual** (RF-70..76, RF-79)
- `tournament_schedule.py` (puro): `build_windows`, identidade da pessoa (união por membro/e-mail), `find_conflicts` (erro: sobreposição, ordem, janela inválida; aviso: descanso e impedimento).
- `tournament_schedule_service.py`: sessões e bloqueios, `get_schedule`, `place`/`swap`/`unplace`/`set_lock`, publicar/despublicar (com trava no torneio e auditoria).
- Público: horário e quadra só depois de publicado; `played_at` padrão passa a vir da janela; seed cria sessões e publica.
- **Verificação:** pytest do validador (mutação), edição concorrente (2 threads, 1 janela → 1 sucesso), invariantes da troca, sessão que removeria janela ocupada recusada, nada vaza antes da publicação.

**7b — Distribuição automática** (RF-78, RNF-11)
- `distribute` (guloso por fase/rodada + busca local por trocas, `rng_seed`), viabilidade, motivos de não alocação, métricas; `distribute` (proposta, não grava) e `apply` (revalida) na API.
- **Verificação:** propriedades sobre torneios aleatórios (nenhuma proposta viola regra dura, determinismo por semente, objetivo nunca pior que o guloso), mutação do motor, 200 partidas em < 2 s, "a partir de" e "refazer" respeitam fixadas e concluídas.

**7c — Impedimentos do atleta** (RF-27, RF-77)
- Tabela, `GET/PUT .../registrations/:rid/unavailability`, união por pessoa no validador e no motor, "também em: …" na inscrição.
- **Verificação:** a distribuição nunca coloca partida em horário de impedimento; impedimento de uma inscrição vale para a outra da mesma pessoa; nunca aparece em resposta pública (teste de privacidade ampliado).

**7d — Interface do cronograma** (RNF-10)
- Aba **Cronograma** no admin: sessões, quadro por dia (quadras em colunas, horários em linhas), lista "Sem horário", painel Verificação, diálogo de distribuição (viabilidade, proposta no quadro, aplicar), troca por toque e por arrastar, fixar/remover/bloquear, publicar; diálogo de impedimentos na aba Inscrições. Aba pública Jogos por dia/horário/quadra.
- **Verificação:** E2E (sessão → distribuir → aplicar → trocar → publicar → público vê; impedimento respeitado) em desktop e tablet.

**7e — Painel admin para desktop e tablet** (RNF-10)
- Reorganizar as abas existentes para 768 px+: lista de torneios em grade, cabeçalho fixo, Inscrições em tabela densa, Categorias em grade, Sorteio e Partidas em duas colunas; aviso abaixo de 768 px.
- **Verificação:** E2E e capturas em 768, 1024 e 1280 px (sem rolagem horizontal da página); aviso no celular.

---

### Etapa 8 — Estatísticas (leitura e filtros) (S) · *reduzida na v0.3* · **concluída**

**Tarefas** (RF-86) — a gravação já nasceu na Etapa 4. Sem `schedule` vinculado, as guardas de `get_past_matches` e `add_match_result` (RF-84/85) não são mais necessárias.
- `get_general_statistics`: "Amistosos" passa de `match_type != 'Ranking'` para `NOT IN ('Ranking','Torneio')`.
- `Statistics.jsx`: opção "Torneio" no filtro de tipo.

**Verificação** (`test_statistics_player.py` e testes novos)
- H2H e totais do jogador incluem a partida de torneio; "Amistosos" não; filtro "Torneio" mostra só elas.
- Playwright: filtro na tela de estatísticas.

---

### Etapa 9 — Fechamento e entrega (S) · **concluída**

- `swagger.yaml`: tag *Tournaments* e todos os caminhos novos, com `BearerAuth`.
- `docs/ARCHITECTURE.md` e `docs/FEATURES.md` (módulo + diagrama das 2 interfaces).
- Spec E2E `tournament.spec.ts` no job de CI existente (`e2e-tests.yml`) e limpeza via `cleanup.ts`.
- Regressão completa: `pytest tests/` e `npm run test:e2e`.
- **Roteiro de deploy:** (1) rodar `python run_migrations.py` no banco de produção **antes** do deploy do código; (2) deploy; (3) criar o torneio em rascunho e conferir pelo painel antes de abrir inscrições. A migration é aditiva e o código antigo ignora as tabelas novas, então a ordem é segura.

**Verificação:** CI verde (unit + E2E) no preview; checklist de revisão visual mobile/desktop assinado. *Feito localmente: `pytest tests/` completo em banco novo e Playwright numa stack isolada; o CI no preview da Vercel só roda depois do push, com `E2E_TEST_SECRET` configurado (ver TOURNAMENT_DEPLOY.md).*

---

## 4. Ordem, dependências e fatiamento

```
0 ─ 1 ─ 2 ─ 3 ─ 4 ─┬─ 5 ─ 6 ─ 7a ─ 7b ─ 7c ─ 7d ─ 7e ─ 9
                   └─ 8 ───────────────────────────────┘      (8 depende só de 4)
```

- **1 etapa = 1 branch/PR**, mergeável sem quebrar nada. Nada fica visível ao público até o link do menu (Etapa 6) e as rotas admin só aparecem para admin.
- Caminho crítico: **1 → … → 6 → 7a → 7e**. A Etapa 8 cabe em paralelo depois da 4.
- Se for dividir o trabalho: front (Etapas 5–6) pode começar contra o **seed por estado** assim que o contrato do payload (Etapa 5) estiver fechado, sem esperar o painel admin.

---

## 5. Detalhes a decidir durante a implementação

Não bloqueiam o início; decido com o padrão indicado salvo se você disser o contrário.

| # | Detalhe | Padrão proposto |
|---|---|---|
| 1 | Placares válidos dos formatos extras. **Set pro** (`pro_set_8`): vence quem chega a 8 com 2 de diferença, com tie-break em 8–8. **Set único** (`single_set_6`): 6-0..6-4, 7-5 ou 7-6. | Set pro aceita 8-0..8-6 e 9-8; set único aceita os placares listados. Ajusto se o seu regulamento usar outra variante (ex.: tie-break a 7–7). Só importa se alguém escolher esses formatos. |
| 2 | Filtro de temporada da tela de Estatísticas ("Todas / Amistosos / temporadas") não tem opção "Torneios"; o RF-86 só cobre o filtro de tipo. | Não adicionar agora. Custa ~5 linhas se quiser (`season=torneios`). |
| 3 | Schedules antigos com `match_type='Torneio'` criados à mão na agenda (já é possível hoje) passam de "Amistosos" para o filtro "Torneio" por causa do D-12. | Aceitar: é consequência direta da decisão, e o histórico fica coerente. Fica registrado nas notas de deploy. |
| 4 | Excluir torneio. | Só `draft`. Torneio com resultados nunca é apagado (cancela ou finaliza), para não perder estatística. |
| 5 | Limite de inscrições por IP. | 5 por hora; ajustável por constante. |

---

## 6. Riscos principais

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Esqueleto do mata-mata com nº de classificados fora de potência de 2 (byes pela campanha) | Média | Implementar por último na Etapa 3; testes de ouro por configuração (3 grupos × 2, 5 grupos × 1…); se travar, limitar a v1 a configurações em potência de 2 e avisar o admin na UI. |
| Distribuição não achar solução em agendas apertadas (muitos impedimentos, poucas janelas) | Média | Regras duras claras, viabilidade antes de gerar, motivo por partida não alocada e troca manual para fechar o resto; solver exato só se isso não bastar. |
| Arrastar não funciona em tela de toque | Média | Edição principal por **seleção e toque** (funciona em qualquer dispositivo); arrastar é só um atalho de mouse. |
| Reescrita do `CHECK` de `match_statistics_unified` em produção | Baixa | Compatível com as linhas atuais; testada em banco novo e existente, rodando 2×. |
| Chave de 64 pesada no mobile | Baixa | 63 cartões simples; contêiner com rolagem própria; medir no Playwright em 320 px. |
| Vazamento de dados pessoais em endpoint público | Média (impacto alto) | Serializer com whitelist + teste automático que falha se aparecer `email`/`phone` em qualquer resposta pública. |

---

## 7. Definição de pronto (vale para toda etapa)

- Testes da etapa verdes **e** `pytest tests/backend/` sem regressão em relação ao baseline da Etapa 0.
- Migrations idempotentes (rodadas 2×) e refletidas em `postgres_schema.sql`, no README de migrations e em `.amazonq/rules/architecture.md`.
- Queries com `%s`, textos em português, sem `alert/confirm/prompt`, `data-testid` em todo elemento interativo, paleta argila.
- `swagger.yaml` atualizado para toda rota criada ou alterada.
- Cada mudança de linha rastreável a um RF/RNF deste plano (sem refatoração paralela).
