#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PATH="/opt/homebrew/bin:$PATH"

echo "=== Setup: Controle Financeiro online ==="
echo ""
echo "Tokens necessários (crie antes de continuar):"
echo "  Supabase → https://supabase.com/dashboard/account/tokens"
echo "  Vercel   → https://vercel.com/account/tokens"
echo ""

[[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]] && read -rsp "Token Supabase: " SUPABASE_ACCESS_TOKEN && echo "" && export SUPABASE_ACCESS_TOKEN
[[ -z "${VERCEL_TOKEN:-}" ]] && read -rsp "Token Vercel: " VERCEL_TOKEN && echo "" && export VERCEL_TOKEN
[[ -z "${APP_EMAIL:-}" ]] && read -rp "E-mail para login no app: " APP_EMAIL && export APP_EMAIL
[[ -z "${APP_PASSWORD:-}" ]] && read -rsp "Senha do app (mín. 6 caracteres): " APP_PASSWORD && echo "" && export APP_PASSWORD

API="https://api.supabase.com/v1"
HDR=(-H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json")

json_field() { python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('$1',''))"; }

echo ""
echo "→ Listando projetos Supabase..."
PROJECTS=$(curl -sS "${HDR[@]}" "$API/projects")
PROJECT_REF="${SUPABASE_PROJECT_REF:-}"

if [[ -z "$PROJECT_REF" ]]; then
  COUNT=$(echo "$PROJECTS" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))")
  if [[ "$COUNT" == "0" ]]; then
    echo "Nenhum projeto. Criando..."
    ORG_ID=$(curl -sS "${HDR[@]}" "$API/organizations" | python3 -c "import json,sys; print(json.load(sys.stdin)[0]['id'])")
    [[ -z "${DB_PASSWORD:-}" ]] && read -rsp "Senha do banco Postgres (guarde!): " DB_PASSWORD && echo ""
    BODY=$(python3 -c "import json; print(json.dumps({'name':'controle-financeiro','organization_id':'$ORG_ID','db_pass':'$DB_PASSWORD','region':'sa-east-1'}))")
    CREATE=$(curl -sS -X POST "${HDR[@]}" -d "$BODY" "$API/projects")
    PROJECT_REF=$(echo "$CREATE" | json_field id)
    [[ -z "$PROJECT_REF" ]] && echo "Erro ao criar projeto: $CREATE" && exit 1
    echo "Aguardando banco ficar pronto (90s)..."
    sleep 90
  else
    PROJECT_REF=$(echo "$PROJECTS" | python3 -c "import json,sys; print(json.load(sys.stdin)[0]['id'])")
    echo "Usando projeto existente: $PROJECT_REF"
  fi
fi

PROJECT=$(curl -sS "${HDR[@]}" "$API/projects/$PROJECT_REF")
SUPABASE_URL=$(echo "$PROJECT" | json_field endpoint)
KEYS=$(curl -sS "${HDR[@]}" "$API/projects/$PROJECT_REF/api-keys")
SUPABASE_ANON_KEY=$(echo "$KEYS" | python3 -c "import json,sys
for k in json.load(sys.stdin):
  if k.get('name')=='anon': print(k['api_key']); break")
SERVICE_ROLE_KEY=$(echo "$KEYS" | python3 -c "import json,sys
for k in json.load(sys.stdin):
  if k.get('name')=='service_role': print(k['api_key']); break")

echo "→ Aplicando migrations..."
supabase login --token "$SUPABASE_ACCESS_TOKEN" >/dev/null
supabase link --project-ref "$PROJECT_REF" --yes
supabase db push --yes

echo "→ Criando usuário de login..."
USER_RESP=$(curl -sS -X POST \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$APP_EMAIL\",\"password\":\"$APP_PASSWORD\",\"email_confirm\":true}" \
  "$SUPABASE_URL/auth/v1/admin/users")
echo "$USER_RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('email') or d.get('msg') or d)" 2>/dev/null || echo "$USER_RESP"

echo "→ Deploy na Vercel..."
vercel link --yes --token "$VERCEL_TOKEN" --project controle-financeiro 2>/dev/null || vercel link --yes --token "$VERCEL_TOKEN"
vercel env add SUPABASE_URL production --token "$VERCEL_TOKEN" --value "$SUPABASE_URL" --yes --force 2>/dev/null || true
vercel env add SUPABASE_ANON_KEY production --token "$VERCEL_TOKEN" --value "$SUPABASE_ANON_KEY" --yes --force 2>/dev/null || true

DEPLOY_URL=$(vercel deploy --prod --yes --token "$VERCEL_TOKEN" | tail -1)

echo ""
echo "============================================"
echo "Pronto!"
echo "URL:   $DEPLOY_URL"
echo "Login: $APP_EMAIL"
echo "============================================"