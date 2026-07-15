#!/usr/bin/env bash
# Migra o projeto para a conta nova do GitHub (lucasbritolubro).
# Rode depois de: gh auth login  (com a conta lucasbritolubro)
set -euo pipefail

NEW_OWNER="${NEW_OWNER:-lucasbritolubro}"
REPO_NAME="${REPO_NAME:-controle-financeiro}"
NEW_REMOTE="${NEW_REMOTE:-new-origin}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cd "$ROOT"

echo "==> Conta GitHub ativa:"
gh auth status || true
echo

read -r -p "Criar repositório ${NEW_OWNER}/${REPO_NAME} no GitHub? [s/N] " CREATE
if [[ "${CREATE,,}" == "s" ]]; then
  gh repo create "${NEW_OWNER}/${REPO_NAME}" --public --source=. --remote="${NEW_REMOTE}" --push
else
  if ! git remote | grep -qx "${NEW_REMOTE}"; then
    git remote add "${NEW_REMOTE}" "https://github.com/${NEW_OWNER}/${REPO_NAME}.git"
  fi
  git push -u "${NEW_REMOTE}" main
  git push "${NEW_REMOTE}" gh-pages 2>/dev/null || echo "(branch gh-pages opcional — ignorada se não existir)"
fi

echo
echo "==> Próximo passo na Vercel:"
echo "1. https://vercel.com/lubro/controle-financeiro/settings/git"
echo "2. Disconnect o repositório antigo (lubrosolutions/...)"
echo "3. Connect → ${NEW_OWNER}/${REPO_NAME}"
echo "4. Deployments → Create Deployment → branch main"
echo "5. Confirme SUPABASE_URL e SUPABASE_ANON_KEY em Settings → Environment Variables"
echo
echo "URL esperada: https://financas.lubrosolutions.com"