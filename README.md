# Controle Financeiro

Painel financeiro pessoal em HTML, CSS e JavaScript com dados na nuvem (Supabase).

## Publicar online (Vercel + Supabase)

### 1. Banco de dados no Supabase

1. Abra [supabase.com](https://supabase.com) → seu projeto → **SQL Editor**
2. Cole e execute o conteúdo de [`supabase/schema.sql`](supabase/schema.sql)

### 2. Criar seu usuário

1. No Supabase: **Authentication** → **Users** → **Add user**
2. Cadastre seu e-mail e senha
3. (Recomendado, uso solo) **Authentication** → **Providers** → **Email** → desative **Confirm email**

### 3. Chaves do projeto

No Supabase: **Project Settings** → **API**

- `Project URL` → variável `SUPABASE_URL`
- `anon public` → variável `SUPABASE_ANON_KEY`

### 4. Deploy na Vercel

1. Abra [vercel.com](https://vercel.com) → **Add New Project**
2. Importe o repositório `lucasbritolubro/controle-financeiro`
3. Em **Environment Variables**, adicione:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `GOOGLE_CLIENT_ID` (opcional — integração com Google Agenda)
4. Clique em **Deploy**

O site ficará em um endereço como `https://controle-financeiro.vercel.app`.

### Agenda pessoal + Google Calendar / Tasks

O módulo **Agenda** é independente do Financeiro. Sincroniza de forma **bidirecional** com o Google:

- **Lê** eventos de todos os calendários selecionados (com paginação) e **tarefas** do Google Tasks
- **Cria / edita / exclui** no app:
  - **Tarefa** → Google Tasks (com data de vencimento, aparece no Google Agenda como tarefa)
  - **Compromisso / aniversário** → Google Calendar (evento)

Configuração:

1. No [Google Cloud Console](https://console.cloud.google.com/) crie um projeto (ou use um existente)
2. Ative a **Google Calendar API** e a **Google Tasks API**
3. Em **APIs e serviços → Credenciais**, crie um **ID do cliente OAuth** do tipo **Aplicativo da Web**
4. Em **Origens JavaScript autorizadas**, inclua seu domínio (ex.: `https://agenda.lubrosolutions.com` e `http://localhost:3000` para teste)
5. Na tela de consentimento OAuth, se o app estiver em modo **Teste**, adicione seu e-mail em **Usuários de teste**
6. Copie o **Client ID** para a variável `GOOGLE_CLIENT_ID` na Vercel e faça redeploy

No app: módulo **Agenda** → **Conectar Google** → autorize **Calendar** e **Tasks** (é preciso reconectar se você já tinha conectado só leitura).

### 5. Domínio próprio (agenda.lubrosolutions.com)

**Na Vercel** (já adicionado ao projeto `controle-financeiro-novo`, ou via script):

```bash
./scripts/add-domain.sh
# ou:
# DOMAIN=agenda.lubrosolutions.com ./scripts/add-domain.sh
```

**No DNS** (Locaweb — `lubrosolutions.com`):

| Tipo | Nome | Destino |
|------|------|---------|
| CNAME | `agenda` | `d6a2117d3759f49d.vercel-dns-017.com` |

Confirme o valor em:  
[vercel.com/lubro/controle-financeiro-novo/settings/domains](https://vercel.com/lubro/controle-financeiro-novo/settings/domains) → `agenda.lubrosolutions.com`.

Aguarde a propagação DNS (minutos a ~1 h) e o SSL automático da Vercel. Depois acesse `https://agenda.lubrosolutions.com`.

**Google OAuth:** atualize também as **Origens JavaScript autorizadas** com `https://agenda.lubrosolutions.com`.

**Domínio antigo:** `financas.lubrosolutions.com` pode continuar apontando até você remover o CNAME `financas` no DNS e o domínio no painel da Vercel.

### 6. Testar localmente (opcional)

```bash
cp config.local.example.js config.local.js
# edite config.local.js com suas chaves

npx vercel dev
```

Ou use `python3 -m http.server` apenas para ver o layout — login e banco exigem `vercel dev` ou o deploy.

## Estrutura dos dados

Cada perfil (Lucas, Lubro, Nexo), as contas a pagar e a agenda pessoal são salvos como JSON na tabela `app_storage`, isolados pelo seu usuário (Row Level Security). A agenda usa a chave `painel-financeiro:agenda-pessoal` (compartilhada entre perfis).

## Repositório

https://github.com/lucasbritolubro/controle-financeiro