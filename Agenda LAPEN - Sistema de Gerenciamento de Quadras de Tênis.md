# Agenda LAPEN - Sistema de Gerenciamento de Quadras de Tênis

## Visão Geral

O Agenda LAPEN é um sistema completo de gerenciamento de agendamentos para quadras de tênis, desenvolvido especificamente para atender às necessidades do Projeto Tênis Clube. O sistema oferece uma interface intuitiva para agendamento público e um painel administrativo robusto para gestão completa das operações.

## 🚀 Aplicação Implantada

**URL da Aplicação: https://19hninc0e3qz.manus.space

### Credenciais de Acesso Administrativo
- **Senha:** PTCadmin2025

## 📋 Funcionalidades Principais

### Módulo Público
- **Agendamento Intuitivo**: Interface simples para seleção de quadra, data e horário
- **Autocompletar de Jogadores**: Sistema inteligente que sugere nomes de jogadores cadastrados
- **Visualização de Agenda**: Lista organizada por data com todos os agendamentos
- **Compartilhamento WhatsApp**: Geração automática de mensagem para compartilhamento
- **Edição de Agendamentos**: Possibilidade de alterar jogadores e tipo de partida
- **Exclusão de Agendamentos**: Remoção de agendamentos com confirmação

### Módulo Administrativo
- **Gestão de Quadras**: Cadastro, edição e exclusão de quadras (saibro/rápida)
- **Gestão de Jogadores**: Controle completo do cadastro de jogadores
- **Configuração de Feriados**: Definição de datas especiais sem funcionamento
- **Agendamentos Recorrentes**: Criação de agendamentos que se repetem automaticamente
- **Painel de Controle**: Visão geral de todas as operações do sistema

## 🛠️ Tecnologias Utilizadas

### Backend
- **Flask**: Framework web Python
- **SQLite**: Banco de dados relacional (com persistência garantida em `/home/ubuntu/agenda_lapen/app.db`)
- **Flask-CORS**: Suporte a requisições cross-origin
- **Python 3.11**: Linguagem de programação

### Frontend
- **React 19**: Biblioteca JavaScript para interface
- **Vite**: Build tool e servidor de desenvolvimento
- **Tailwind CSS**: Framework CSS utilitário
- **Shadcn/UI**: Componentes de interface
- **Lucide React**: Ícones
- **React Router**: Roteamento
- **Sonner**: Sistema de notificações

## 📁 Estrutura do Projeto

```
agenda_lapen/
├── agenda_lapen_backend/          # Backend Flask
│   ├── src/
│   │   ├── database/
│   │   │   ├── __init__.py
│   │   │   └── schema.sql         # Esquema do banco de dados
│   │   ├── routes/
│   │   │   ├── admin.py           # Rotas administrativas
│   │   │   └── public.py          # Rotas públicas
│   │   ├── static/                # Arquivos estáticos (frontend build)
│   │   ├── database.py            # Configuração do banco
│   │   └── main.py                # Aplicação principal
│   ├── requirements.txt           # Dependências Python
│   └── venv/                      # Ambiente virtual
├── agenda_lapen_frontend/         # Frontend React
│   ├── src/
│   │   ├── components/
│   │   │   ├── admin/             # Componentes administrativos
│   │   │   ├── ui/                # Componentes de interface
│   │   │   ├── Header.jsx         # Cabeçalho
│   │   │   ├── Home.jsx           # Página inicial
│   │   │   ├── ScheduleForm.jsx   # Formulário de agendamento
│   │   │   └── ScheduleView.jsx   # Visualização de agendamentos
│   │   ├── hooks/
│   │   │   └── use-toast.js       # Hook para notificações
│   │   └── App.jsx                # Componente principal
│   ├── dist/                      # Build de produção
│   └── package.json               # Dependências Node.js
└── README.md                      # Esta documentação
```

## 🗄️ Esquema do Banco de Dados

### Tabela: courts (Quadras)
- `id`: Identificador único
- `name`: Nome da quadra
- `type`: Tipo (saibro/rápida)
- `active`: Status ativo/inativo

### Tabela: players (Jogadores)
- `id`: Identificador único
- `name`: Nome do jogador
- `active`: Status ativo/inativo

### Tabela: schedules (Agendamentos)
- `id`: Identificador único
- `court_id`: Referência à quadra
- `date`: Data do agendamento
- `start_time`: Horário de início
- `player1_name`: Nome do primeiro jogador
- `player2_name`: Nome do segundo jogador
- `match_type`: Tipo de partida (Liga/Amistoso)

### Tabela: holidays (Feriados)
- `id`: Identificador único
- `date`: Data do feriado
- `description`: Descrição do feriado

### Tabela: recurring_schedules (Agendamentos Recorrentes)
- `id`: Identificador único
- `court_id`: Referência à quadra
- `day_of_week`: Dia da semana (0-6)
- `start_time`: Horário de início
- `player1_name`: Nome do primeiro jogador
- `player2_name`: Nome do segundo jogador
- `match_type`: Tipo de partida
- `active`: Status ativo/inativo

## 🔧 Configuração e Instalação Local

### Pré-requisitos
- Python 3.11+
- Node.js 18+
- pnpm ou npm

### Backend
```bash
cd agenda_lapen_backend
python -m venv venv
source venv/bin/activate  # Linux/Mac
# ou venv\Scripts\activate  # Windows
pip install -r requirements.txt
python src/main.py
```

### Frontend
```bash
cd agenda_lapen_frontend
pnpm install
pnpm run dev

Para o desenvolvimento local, o frontend está configurado para usar um proxy para o backend Flask. Isso é configurado no `vite.config.js`.
```

## 🚀 Deploy

O sistema está configurado para deploy automático usando o serviço Manus. O frontend é construído e integrado ao backend Flask para servir uma aplicação unificada.

### Processo de Deploy
1. Build do frontend React
2. Cópia dos arquivos para o diretório static do Flask
3. Deploy do backend Flask com frontend integrado

## 📱 Funcionalidades Detalhadas

### Sistema de Horários
- **Horário de Funcionamento**: 07:30 às 22:30
- **Duração das Partidas**: 1h30 (90 minutos)
- **Slots Disponíveis**: Calculados automaticamente
- **Verificação de Conflitos**: Automática

### Agendamentos Recorrentes
- Configuração por dia da semana
- Geração automática de agendamentos futuros
- Controle de ativação/desativação

### Sistema de Notificações
- Feedback visual para todas as ações
- Mensagens de sucesso e erro
- Confirmações para ações destrutivas

### Compartilhamento WhatsApp
- Geração automática de mensagem formatada
- Inclusão de todos os agendamentos do mês
- Link direto para o WhatsApp

## 🔐 Segurança

- Autenticação administrativa por senha
- Validação de dados no frontend e backend
- Sanitização de entradas
- Controle de acesso às rotas administrativas

## 📊 Relatórios e Visualizações

- Lista de agendamentos agrupados por data
- Visualização mensal completa
- Filtros por tipo de partida
- Identificação visual de partidas de liga vs amistosas

## 🎯 Próximas Melhorias Sugeridas

1. **Sistema de Usuários**: Autenticação individual para jogadores
2. **Calendário Visual**: Interface de calendário interativo
3. **Relatórios Avançados**: Estatísticas de uso e frequência
4. **Notificações Push**: Lembretes automáticos
5. **API Mobile**: Suporte para aplicativo móvel
6. **Backup Automático**: Sistema de backup do banco de dados
7. **Logs de Auditoria**: Rastreamento de todas as ações administrativas

## 📞 Suporte

Para suporte técnico ou dúvidas sobre o sistema, entre em contato através dos canais oficiais do Projeto Tênis Clube.

---

**Desenvolvido com ❤️ para o Projeto Tênis Clube**

