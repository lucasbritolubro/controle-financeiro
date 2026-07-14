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
2. Importe o repositório `lubrosolutions/controle-financeiro`
3. Em **Environment Variables**, adicione:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
4. Clique em **Deploy**

O site ficará em um endereço como `https://controle-financeiro.vercel.app`.

### 5. Domínio próprio (financas.lubrosolutions.com)

**Na Vercel** (ou via script):

```bash
./scripts/add-domain.sh
```

**No DNS** (onde `lubrosolutions.com` é gerenciado):

| Tipo | Nome | Destino |
|------|------|---------|
| CNAME | `financas` | `cname.vercel-dns.com` |

Ou pelo painel: [vercel.com/lubro/controle-financeiro/settings/domains](https://vercel.com/lubro/controle-financeiro/settings/domains) → Add → `financas.lubrosolutions.com`

Aguarde alguns minutos e acesse `https://financas.lubrosolutions.com`.

### 6. Testar localmente (opcional)

```bash
cp config.local.example.js config.local.js
# edite config.local.js com suas chaves

npx vercel dev
```

Ou use `python3 -m http.server` apenas para ver o layout — login e banco exigem `vercel dev` ou o deploy.

## Estrutura dos dados

Cada perfil (Lucas, Lubro, Nexo) e as contas a pagar são salvos como JSON na tabela `app_storage`, isolados pelo seu usuário (Row Level Security).

## Repositório

https://github.com/lubrosolutions/controle-financeiro