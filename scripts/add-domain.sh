#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PATH="/opt/homebrew/bin:$PATH"

DOMAIN="${DOMAIN:-financas.lubrosolutions.com}"
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
echo "Configure o DNS onde $DOMAIN é gerenciado:"
echo ""

if [[ "$DOMAIN" == *.*.* ]]; then
  SUB="${DOMAIN%%.*}"
  echo "  Tipo:  CNAME"
  echo "  Nome:  $SUB"
  echo "  Valor: cname.vercel-dns.com"
else
  echo "  Registro A (domínio raiz):"
  echo "    Nome:  @"
  echo "    Valor: 76.76.21.21"
  echo ""
  echo "  Registro CNAME (www):"
  echo "    Nome:  www"
  echo "    Valor: cname.vercel-dns.com"
fi

echo ""
echo "  TTL: automático (ou 3600)"
echo ""
echo "Se usar Cloudflare, deixe o proxy DESLIGADO (nuvem cinza)"
echo "na primeira vez, para o SSL da Vercel validar."
echo ""
echo "Aguarde 5–30 min e acesse:"
echo "  https://$DOMAIN"
echo "============================================"