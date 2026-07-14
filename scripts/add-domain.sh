#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PATH="/opt/homebrew/bin:$PATH"

DOMAIN="${DOMAIN:-financeiro.lubro.com.br}"
PROD_URL="${PROD_URL:-controle-financeiro-two-bice.vercel.app}"

echo "=== Domínio personalizado: $DOMAIN ==="
echo ""

[[ -z "${VERCEL_TOKEN:-}" ]] && read -rsp "Token Vercel: " VERCEL_TOKEN && echo "" && export VERCEL_TOKEN

echo "→ Adicionando domínio na Vercel..."
vercel domains add "$DOMAIN" --token "$VERCEL_TOKEN" 2>/dev/null || true

echo "→ Vinculando ao projeto controle-financeiro..."
vercel alias set "$PROD_URL" "$DOMAIN" --token "$VERCEL_TOKEN" --scope lubro 2>/dev/null \
  || vercel alias set "$PROD_URL" "$DOMAIN" --token "$VERCEL_TOKEN"

echo ""
echo "============================================"
echo "Domínio registrado na Vercel!"
echo ""
echo "Agora configure o DNS onde lubro.com.br é gerenciado"
echo "(Registro.br, Cloudflare, Hostinger, etc.):"
echo ""
echo "  Tipo:  CNAME"
echo "  Nome:  financeiro"
echo "  Valor: cname.vercel-dns.com"
echo "  TTL:   automático (ou 3600)"
echo ""
echo "Se usar Cloudflare, deixe o proxy DESLIGADO (nuvem cinza)"
echo "na primeira vez, para o SSL da Vercel validar."
echo ""
echo "Aguarde 5–30 min e acesse:"
echo "  https://$DOMAIN"
echo "============================================"