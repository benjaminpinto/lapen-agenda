# Módulo de Torneios — Entrega e Deploy

Complementa [TOURNAMENT_REQUIREMENTS.md](TOURNAMENT_REQUIREMENTS.md) (v0.3) e [TOURNAMENT_IMPLEMENTATION_PLAN.md](TOURNAMENT_IMPLEMENTATION_PLAN.md).

## Roteiro de deploy

A migration é **aditiva** (tabelas novas e uma coluna nova em `match_statistics_unified`) e o código antigo ignora tudo isso, então a ordem abaixo é segura e reversível.

1. **Backup** do banco de produção (snapshot do Vercel Postgres ou `pg_dump`). A `014` troca o `CHECK` de origem de `match_statistics_unified` por um que aceita também `tournament_match_id`; ela é compatível com todas as linhas atuais, mas é a única alteração em tabela existente.
2. **Migration antes do código**, contra o banco de produção:

   ```bash
   DATABASE_URL=<url de produção> python run_migrations.py
   ```

   Pode rodar mais de uma vez (idempotente; verificado rodando duas vezes seguidas). Confira o final da saída: `✓ 014_add_tournaments.sql completed successfully`.
3. **Deploy** do código (Vercel). O link "Torneios" aparece no menu para todos.
4. **Conferência pelo painel** antes de abrir inscrições (nada fica público enquanto o torneio é rascunho):
   1. `/admin/tournaments` → criar o torneio em rascunho, com as categorias e o regulamento;
   2. conferir `/tournaments`: sem torneio ativo mostra "Nenhum torneio aberto no momento";
   3. abrir as inscrições e conferir `/tournaments/<slug>/register` (faça uma inscrição de teste e recuse-a no painel).

## Variáveis de ambiente

Nenhuma obrigatória em produção. **Não defina `E2E_TEST_SECRET` em produção.** Ela existe só para os testes de ponta a ponta nos *previews* da Vercel e libera `/api/test/tournaments/*` e `/api/test/users` (que criam torneios e usuários admin de teste). Esses endpoints também recusam quando `FLASK_ENV=production`, mas o segredo ausente é a proteção principal.

Para ligar os testes de torneio no CI: crie o secret `E2E_TEST_SECRET` no GitHub e a **mesma** variável no ambiente *Preview* da Vercel. Sem ela os três specs de torneio se pulam sozinhos e o CI continua verde.

## Como usar no dia do evento

1. **Bloqueie as quadras** pelo painel de bloqueios que já existe (Feriados e bloqueios): as quadras ficam à disposição do evento. O torneio não lê nem grava a agenda; só lê os nomes da tabela `courts`.
2. Aba **Cronograma**: crie as sessões (dia, horário, quadras), gere a proposta de distribuição, ajuste por troca e **publique**. Até publicar, o público não vê data, hora nem quadra.
3. Aba **Inscrições** → **Impedimentos**: marque os dias e horários em que cada atleta não pode jogar (valem para todas as inscrições da mesma pessoa; só o organizador vê).
4. Se o dia atrasar ou chover: bloqueie a janela (as partidas dela voltam para a lista) e use **Distribuir** com "a partir de".

## O que muda para quem já usa o sistema

- **Menu do site:** abaixo de 1024 px (tablet em pé e celular) o cabeçalho passa a usar o menu hambúrguer, porque com o item "Torneios" e o usuário logado a barra completa não cabe em 768 px.
- **Estatísticas:** "Amistosos" (temporada) passa a **excluir** o tipo `Torneio`, e o filtro de tipo ganha a opção "Torneio". Um agendamento antigo criado à mão na agenda com tipo "Torneio" passa a aparecer só no filtro "Torneio". Os desafios continuam contando só partidas `Amistoso`.
- **Torneio e estatística:** só entra resultado de torneio quando ao menos um participante estiver vinculado a um membro LAPEN aprovado. Bye e duplo W.O. nunca entram; W.O. simples entra.

## Checklist de revisão visual

Feito com capturas reais (Playwright) de cada tela:

| Tela | 320 | 768 | 1024 | 1280 |
|---|:-:|:-:|:-:|:-:|
| Pública: home, acompanhamento (7 abas), chave, inscrição | ✓ | ✓ | — | ✓ |
| Admin: lista, dados, categorias, inscrições, sorteio, cronograma, partidas | aviso | ✓ | ✓ | ✓ |

## Pendências conhecidas (fora deste módulo)

- `tests/backend/test_ranking_schedule_integration.py` apaga a quadra de id 1 do CI; uma segunda rodada completa de `pytest tests/` no mesmo banco falha em 4 testes antigos. Em banco novo (como no CI) tudo passa.
- O arquivo `.coverage` está versionado e muda a cada `pytest --cov`; vale colocá-lo no `.gitignore`.
- Os E2E antigos (admin, auth, schedule, timezone, betting, navigation, mobile) já falham no código original: 34 de 45 testes em chromium, com o mesmo resultado teste a teste no `HEAD` sem as mudanças do torneio (comparado com uma cópia do `HEAD` em banco e portas próprios). Vários usam o login por senha de admin antigo ou telas de apostas já desativadas. Os E2E novos de torneio rodam em projetos próprios e passam.
