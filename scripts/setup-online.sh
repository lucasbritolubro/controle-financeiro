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

pick_project_ref() {
  python3 <<'PY'
import json, os, sys

raw = sys.stdin.read().strip()
if not raw:
    print("", end="")
    sys.exit(0)

try:
    data = json.loads(raw)
except json.JSONDecodeError:
    print(f"ERRO: Resposta inválida da API Supabase: {raw[:300]}", file=sys.stderr)
    sys.exit(1)

if isinstance(data, dict):
    if data.get("message") or data.get("error"):
        msg = data.get("message") or data.get("error")
        print(f"ERRO: {msg}", file=sys.stderr)
        sys.exit(1)
    for key in ("projects", "data", "items"):
        if isinstance(data.get(key), list):
            data = data[key]
            break
    else:
        if data.get("id"):
            print(data["id"], end="")
            sys.exit(0)
        print(f"ERRO: Formato inesperado: {raw[:300]}", file=sys.stderr)
        sys.exit(1)

if not isinstance(data, list):
    print(f"ERRO: Esperava lista de projetos, recebeu: {type(data)}", file=sys.stderr)
    sys.exit(1)

if not data:
    print("", end="")
    sys.exit(0)

wanted = os.environ.get("SUPABASE_PROJECT_REF", "").strip()
if wanted:
    for p in data:
        ref = p.get("id") or p.get("ref") or ""
        if ref == wanted:
            print(ref, end="")
            sys.exit(0)
    print(f"ERRO: Projeto '{wanted}' não encontrado na sua conta.", file=sys.stderr)
    sys.exit(1)

print("\nProjetos Supabase encontrados:", file=sys.stderr)
for i, p in enumerate(data):
    ref = p.get("id") or p.get("ref") or "?"
    name = p.get("name") or "sem nome"
    print(f"  [{i+1}] {name}  (ref: {ref})", file=sys.stderr)

choice = input("\nNúmero do projeto (ou Enter para o primeiro): ").strip()
idx = int(choice) - 1 if choice else 0
if idx < 0 or idx >= len(data):
    print("ERRO: Opção inválida.", file=sys.stderr)
    sys.exit(1)

ref = data[idx].get("id") or data[idx].get("ref") or ""
if not ref:
    print("ERRO: Projeto sem ref/id.", file=sys.stderr)
    sys.exit(1)
print(ref, end="")
PY
}

echo ""
echo "→ Conectando ao Supabase..."
supabase login --token "$SUPABASE_ACCESS_TOKEN" >/dev/null

PROJECT_REF="${SUPABASE_PROJECT_REF:-}"

if [[ -z "$PROJECT_REF" ]]; then
  echo "→ Listando projetos..."
  PROJECTS_JSON=$(supabase projects list -o json 2>/dev/null || true)

  if [[ -z "$PROJECTS_JSON" || "$PROJECTS_JSON" == "[]" || "$PROJECTS_JSON" == "null" ]]; then
    PROJECTS_JSON=$(curl -sS "${HDR[@]}" "$API/projects" || true)
  fi

  PROJECT_REF=$(echo "$PROJECTS_JSON" | pick_project_ref)
fi

if [[ -z "$PROJECT_REF" ]]; then
  echo ""
  echo "Nenhum projeto encontrado."
  read -rp "Criar novo projeto? (s/N): " CREATE_CHOICE
  case "$CREATE_CHOICE" in
    s|S) ;;
    *)
    echo ""
    echo "Crie um projeto em https://supabase.com/dashboard e rode de novo informando o ref:"
    echo "  SUPABASE_PROJECT_REF=seu_ref ./scripts/setup-online.sh"
    exit 1
    ;;
  esac

  ORGS_JSON=$(curl -sS "${HDR[@]}" "$API/organizations")
  ORG_ID=$(echo "$ORGS_JSON" | python3 -c "
import json,sys
data=json.load(sys.stdin)
if isinstance(data, dict):
    for k in ('organizations','data','items'):
        if isinstance(data.get(k), list) and data[k]:
            print(data[k][0]['id']); break
    else:
        if data.get('id'): print(data['id'])
elif isinstance(data, list) and data:
    print(data[0]['id'])
" 2>/dev/null || true)

  if [[ -z "$ORG_ID" ]]; then
    echo "ERRO: Não foi possível obter a organização. Crie o projeto manualmente no dashboard."
    echo "$ORGS_JSON"
    exit 1
  fi

  [[ -z "${DB_PASSWORD:-}" ]] && read -rsp "Senha do banco Postgres (guarde!): " DB_PASSWORD && echo ""
  BODY=$(python3 -c "import json; print(json.dumps({'name':'controle-financeiro','organization_id':'$ORG_ID','db_pass':'$DB_PASSWORD','region':'sa-east-1'}))")
  CREATE=$(curl -sS -X POST "${HDR[@]}" -d "$BODY" "$API/projects")
  PROJECT_REF=$(echo "$CREATE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null || true)

  if [[ -z "$PROJECT_REF" ]]; then
    echo "ERRO ao criar projeto:"
    echo "$CREATE"
    exit 1
  fi

  echo "Projeto criado: $PROJECT_REF"
  echo "Aguardando banco ficar pronto (90s)..."
  sleep 90
fi

echo "→ Projeto selecionado: $PROJECT_REF"

PROJECT=$(curl -sS "${HDR[@]}" "$API/projects/$PROJECT_REF")
SUPABASE_URL=$(echo "$PROJECT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('endpoint',''))")
KEYS=$(curl -sS "${HDR[@]}" "$API/projects/$PROJECT_REF/api-keys")
SUPABASE_ANON_KEY=$(echo "$KEYS" | python3 -c "import json,sys
for k in json.load(sys.stdin):
    if k.get('name')=='anon':
        print(k['api_key']); break")
SERVICE_ROLE_KEY=$(echo "$KEYS" | python3 -c "import json,sys
for k in json.load(sys.stdin):
    if k.get('name')=='service_role':
        print(k['api_key']); break")

if [[ -z "$SUPABASE_URL" || -z "$SUPABASE_ANON_KEY" || -z "$SERVICE_ROLE_KEY" ]]; then
  echo "ERRO: Não foi possível obter as chaves do projeto."
  echo "PROJECT=$PROJECT"
  echo "KEYS=$KEYS"
  exit 1
fi

echo "→ Aplicando migrations..."
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