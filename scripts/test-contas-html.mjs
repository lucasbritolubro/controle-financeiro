/**
 * Smoke test: garante que index.html contém a lógica correta das abas Contas.
 * node scripts/test-contas-html.mjs
 */
import { readFileSync } from 'fs';
import { spawnSync } from 'child_process';
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
  ['deploy tag atual', /deploy-v20260715h/],
  ['deleteRecurring usa sameId e withContasLock', /deleteRecurring[\s\S]*?sameId\(x\.id, id\)[\s\S]*?withContasLock/],
  ['bloqueio de recriação de recorrentes excluídos', /DELETED_RECURRING_KEY[\s\S]*?isRecurringDeleted/],
  ['billKindTagHTML usa catColor para tipos customizados', /billKindTagHTML[\s\S]*?const color = catColor\(k\)/],
  ['carregamento de contas preserva dados em erro', /const previousBills = bills/],
  ['operações de contas serializadas', /function withContasLock\(fn\)/],
  ['filtro de mês visível em recorrentes', /monthFilter\) monthFilter\.style\.display = 'flex'/],
  ['recorrentes filtra instâncias por mês', /filter\(isRecurringBillInstance\)/],
  ['renderContasTotals usa getBillsByCategoryForMonth', /function renderContasTotals\(\)[\s\S]*?getBillsByCategoryForMonth\(selMonth\)/],
  ['total todas = sumBillsValue\(cats\.todas\)', /contasTotalTodas.*sumBillsValue\(cats\.todas\)/s],
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

for (const script of ['test-contas-views.mjs', 'test-contas-integration.mjs', 'test-contas-totals.mjs']) {
  const r = spawnSync('node', [join(root, script)], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status || 1);
}
console.log('\n✓ SUÍTE COMPLETA OK — visualizações e totais validados.');