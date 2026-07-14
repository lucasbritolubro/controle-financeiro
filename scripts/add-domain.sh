#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PATH="/opt/homebrew/bin:$PATH"

DOMAIN="${DOMAIN:-financas.lubrosolutions.com}"
PROJECT="${VERCEL_PROJECT:-controle-financeiro}"
SCOPE="${VERCEL_SCOPE:-lubro}"

echo "=== Domínio personalizado: $DOMAIN ==="
echo ""

[[ -z "${VERCEL_TOKEN:-}" ]] && read -rsp "Token Vercel: " VERCEL_TOKEN && echo "" && export VERCEL_TOKEN

echo "→ Adicionando domínio ao projeto $PROJECT (time $SCOPE)..."
if ! vercel domains add "$DOMAIN" "$PROJECT" \
  --token "$VERCEL_TOKEN" \
  --scope "$SCOPE" \
  --force; then
  echo ""
  echo "ERRO ao adicionar via CLI."
  echo "Use o painel (mais confiável):"
  echo "  https://vercel.com/$SCOPE/$PROJECT/settings/domains"
  echo "  → Add → $DOMAIN"
  exit 1
fi

SUB="${DOMAIN%%.*}"

echo ""
echo "============================================"
echo "Domínio adicionado na Vercel!"
echo ""
echo "Agora configure o DNS de lubrosolutions.com:"
echo ""
echo "  Tipo:  CNAME"
echo "  Nome:  $SUB"
echo "  Valor: (copie o CNAME exato que a Vercel mostrar)"
echo "         em Settings → Domains → $DOMAIN"
echo ""
echo "  Geralmente é algo como:"
echo "    cname.vercel-dns.com"
echo "  ou um endereço único tipo:"
echo "    xxxxx.vercel-dns-017.com"
echo ""
echo "Se a Vercel pedir verificação TXT, adicione o registro"
echo "que ela mostrar antes do CNAME."
echo ""
echo "Cloudflare: proxy DESLIGADO (nuvem cinza) até validar SSL."
echo ""
echo "Aguarde 5–30 min e acesse:"
echo "  https://$DOMAIN"
echo "============================================"