/**
 * Smoke test: garante que index.html contém a lógica correta das abas Contas.
 * node scripts/test-contas-html.mjs
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(root, '..', 'index.html'), 'utf8');

const checks = [
  ['parseStoredJson com loop de JSON.parse', /function parseStoredJson\(raw, fallback\)/],
  ['todayISO usa data local', /getFullYear\(\).*getMonth\(\).*getDate\(\)/s],
  ['mês padrão corrente em populateBillsMonthSelect', /else el\.value = currentMonthKeyNow\(\)/],
  ['preserva mês selecionado no select', /if\(prev && prev !== BILLS_MONTH_ALL/],
  ['aba todas sem filtro extra', /contasSubActive === 'nao-recorrentes'\) items = items\.filter\(isNonRecurringBill\)/],
  ['syncContasData fora de renderContasTab', /async function renderContasTab\(\)\{\s*\n\s*await ensureRecurringForVisibleMonths/],
  ['subaba recorrentes usa renderRecurringList', /renderRecurringList\(\)/],
  ['proteção saveBills em erro de storage', /if\(billsStorageError\) return/],
  ['subaba padrão todas', /data-sub="todas".*active/s],
  ['deploy tag atual', /deploy-v20260715c/],
];

let failed = 0;
for (const [label, re] of checks) {
  if (!re.test(html)) {
    console.error('FAIL:', label);
    failed++;
  } else {
    console.log('OK:', label);
  }
}

if (failed) {
  console.error(`\n${failed} verificação(ões) falharam no HTML.`);
  process.exit(1);
}
console.log('\nOK: index.html consistente com as regras das abas Contas.');