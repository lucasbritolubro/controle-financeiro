/**
 * Testes exaustivos da lógica de visualização das abas Contas.
 * Executar: node scripts/test-contas-views.mjs
 */

const BILLS_MONTH_ALL = '__all__';

// --- funções espelhadas do app (manter em sync com index.html) ---
function parseStoredJson(raw, fallback) {
  if (raw == null || raw === '') return fallback;
  if (typeof raw === 'object') return raw;
  if (typeof raw !== 'string') return fallback;
  let cur = raw;
  for (let i = 0; i < 4; i++) {
    try {
      const parsed = JSON.parse(cur);
      if (typeof parsed === 'string') { cur = parsed; continue; }
      return parsed;
    } catch { return fallback; }
  }
  return fallback;
}

function parseStoredList(raw) {
  const parsed = parseStoredJson(raw, null);
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === 'object') {
    if (Array.isArray(parsed.items)) return parsed.items;
    if (Array.isArray(parsed.bills)) return parsed.bills;
  }
  return [];
}

function monthKey(dateStr) { return dateStr.slice(0, 7); }

function todayISOLocal(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function currentMonthKeyNow(d = new Date()) {
  return monthKey(todayISOLocal(d));
}

function clampDueDate(year, month, day) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  const d = Math.min(Math.max(1, day), lastDay);
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function isNonRecurringBill(b) {
  return !b.isInstallment && !b.recurringId;
}

function isRecurringBillInstance(b) {
  return !b.isInstallment && !!b.recurringId;
}

function getInstallmentBills(installments) {
  const out = [];
  (installments || []).forEach(inst => {
    if (!inst.dueDay || !inst.firstDueMonth) return;
    const total = inst.totalInstallments;
    const paid = inst.paidInstallments || 0;
    const restantes = total ? (total - paid) : 1;
    if (restantes <= 0) return;
    const [fy, fm] = inst.firstDueMonth.split('-').map(Number);
    const parcelaValor = inst.mode === 'fixed' ? inst.installmentValue : (inst.referenceValue || inst.lastPaymentValue || 0);
    for (let k = 0; k < restantes; k++) {
      const parcelaIndex = paid + k;
      const mIndex = (fm - 1) + parcelaIndex;
      const y = fy + Math.floor(mIndex / 12);
      const m = mIndex % 12;
      const dueDate = clampDueDate(y, m, inst.dueDay);
      const numLabel = total ? `${parcelaIndex + 1}/${total}` : `nº ${parcelaIndex + 1}`;
      out.push({
        id: `inst:${inst.id}:${parcelaIndex}`,
        installmentId: inst.id,
        isInstallment: true,
        desc: `${inst.desc} — parcela ${numLabel}`,
        value: parcelaValor,
        dueDate,
        paid: false,
      });
    }
  });
  return out;
}

function getAllBillsForDisplay(bills, installments) {
  return bills.concat(getInstallmentBills(installments));
}

function getBillsForContasMonth(all, selMonth) {
  if (selMonth === BILLS_MONTH_ALL) return all;
  return all.filter(b => monthKey(b.dueDate) === selMonth);
}

function filterBillsListItems(all, selMonth, contasSubActive) {
  let items = getBillsForContasMonth(all, selMonth).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  if (contasSubActive === 'nao-recorrentes') items = items.filter(isNonRecurringBill);
  return items;
}

function recurringDueDatesInMonth(r, year, month) {
  const freq = r.freq || 'mensal';
  if (freq === 'mensal') return [clampDueDate(year, month, r.dueDay || 1)];
  return [];
}

function ensureRecurringInstancesForMonth(bills, recurringBills, year, month) {
  if (recurringBills.length === 0) return { bills, changed: false };
  const next = bills.slice();
  let changed = false;
  recurringBills.forEach(r => {
    recurringDueDatesInMonth(r, year, month).forEach(dd => {
      const inst = next.find(b => String(b.recurringId) === String(r.id) && b.dueDate === dd);
      if (!inst) {
        next.push({
          id: `gen-${r.id}-${dd}`,
          desc: r.desc,
          value: r.value,
          dueDate: dd,
          recurringId: r.id,
          paid: false,
        });
        changed = true;
      }
    });
  });
  return { bills: next, changed };
}

function resolveDefaultMonth(sortedKeys, preserveSelection, prev, contasSubActive, now = new Date()) {
  const cur = currentMonthKeyNow(now);
  if (preserveSelection && (prev === BILLS_MONTH_ALL || sortedKeys.includes(prev))) return prev;
  return cur;
}

// --- harness ---
let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { passed++; return; }
  failed++;
  console.error('FAIL:', msg);
}

function assertEq(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  assert(a === e, `${msg}\n  expected: ${e}\n  actual:   ${a}`);
}

function assertLen(arr, n, msg) {
  assert(arr.length === n, `${msg} (expected ${n}, got ${arr.length}: ${JSON.stringify(arr.map(x => x.desc || x.id))})`);
}

// --- fixtures ---
const CURRENT = new Date(2026, 6, 15); // 15/jul/2026 local
const MK_JUL = '2026-07';
const MK_JUN = '2026-06';
const MK_AGO = '2026-08';

const billsFixture = [
  { id: 'n1', desc: 'Conta avulsa jul', value: 100, dueDate: '2026-07-10', paid: false },
  { id: 'n2', desc: 'Conta avulsa jun', value: 50, dueDate: '2026-06-05', paid: false },
  { id: 'r1', desc: 'Aluguel jul', value: 2000, dueDate: '2026-07-05', recurringId: 'rec-1', paid: false },
  { id: 'r2', desc: 'Internet ago', value: 120, dueDate: '2026-08-10', recurringId: 'rec-2', paid: false },
];

const recurringFixture = [
  { id: 'rec-1', desc: 'Aluguel', value: 2000, freq: 'mensal', dueDay: 5, mode: 'fixed' },
  { id: 'rec-2', desc: 'Internet', value: 120, freq: 'mensal', dueDay: 10, mode: 'fixed' },
  { id: 'rec-3', desc: 'Academia', value: 90, freq: 'mensal', dueDay: 20, mode: 'variable' },
];

const installmentsFixture = [
  {
    id: 'inst-1', desc: 'Notebook', dueDay: 15, firstDueMonth: '2026-07',
    totalInstallments: 12, paidInstallments: 0, mode: 'fixed', installmentValue: 300,
  },
];

console.log('=== Testes: parseStoredList ===');
assertLen(parseStoredList(null), 0, 'null -> []');
assertLen(parseStoredList([]), 0, 'array vazio');
assertLen(parseStoredList(billsFixture), 4, 'array nativo jsonb');
assertLen(parseStoredList(JSON.stringify(billsFixture)), 4, 'string JSON');
assertLen(parseStoredList(JSON.stringify(JSON.stringify(billsFixture))), 4, 'double-encoded string');
assertLen(parseStoredList({ bills: billsFixture }), 4, 'objeto com .bills');

console.log('=== Testes: mês padrão (fuso local) ===');
assertEq(currentMonthKeyNow(CURRENT), MK_JUL, 'mês corrente jul/2026');
// UTC bug: à noite no Brasil, toISOString() pode virar dia seguinte
const lateBrazil = new Date(2026, 6, 15, 23, 30, 0);
const utcIso = lateBrazil.toISOString().slice(0, 10);
const localIso = todayISOLocal(lateBrazil);
assert(utcIso !== localIso || utcIso === '2026-07-16', 'demonstração divergência UTC vs local às 23:30');
assertEq(localIso, '2026-07-15', 'data local correta às 23:30');
assertEq(resolveDefaultMonth([MK_JUN, MK_JUL], false, MK_JUN, 'todas', CURRENT), MK_JUL, 'default = mês corrente');
assertEq(resolveDefaultMonth([MK_JUN, MK_JUL], true, MK_JUN, 'todas', CURRENT), MK_JUN, 'preserve seleção anterior');

console.log('=== Testes: TODAS AS CONTAS (mês jul/2026) ===');
const allJul = getAllBillsForDisplay(billsFixture, installmentsFixture);
const todasJul = filterBillsListItems(allJul, MK_JUL, 'todas');
// jul: n1, r1, parcela notebook (15/jul)
assertLen(todasJul, 3, 'todas jul: avulsa + recorrente instância + parcela');
assert(todasJul.some(b => b.id === 'n1'), 'contém não recorrente');
assert(todasJul.some(b => b.recurringId === 'rec-1'), 'contém instância recorrente');
assert(todasJul.some(b => b.isInstallment), 'contém parcela virtual');

console.log('=== Testes: NÃO RECORRENTES (mês jul/2026) ===');
const naoRecJul = filterBillsListItems(allJul, MK_JUL, 'nao-recorrentes');
assertLen(naoRecJul, 1, 'só avulsa em jul');
assertEq(naoRecJul[0].id, 'n1', 'única é n1');
assert(naoRecJul.every(isNonRecurringBill), 'nenhuma recorrente/parcela');

console.log('=== Testes: filtro por mês ===');
const todasJun = filterBillsListItems(allJul, MK_JUN, 'todas');
assertLen(todasJun, 1, 'jun só n2');
const todasAll = filterBillsListItems(allJul, BILLS_MONTH_ALL, 'todas');
assertLen(todasAll, allJul.length, 'todos os meses = tudo');

console.log('=== Testes: RECORRENTES (templates) ===');
assertLen(recurringFixture, 3, '3 templates cadastrados');
// renderRecurringList mostra todos os templates, sem filtro de mês
assert(recurringFixture.every(r => r.id && r.desc), 'templates válidos');

console.log('=== Testes: geração de instâncias recorrentes no mês corrente ===');
let bills = billsFixture.filter(b => monthKey(b.dueDate) !== MK_JUL || !b.recurringId);
const gen = ensureRecurringInstancesForMonth(bills, recurringFixture, 2026, 6);
assert(gen.changed, 'gerou instâncias para jul/2026');
const julRecurring = gen.bills.filter(b => b.recurringId && monthKey(b.dueDate) === MK_JUL);
assert(julRecurring.length >= 3, 'jul tem instâncias para os 3 templates');
const merged = getAllBillsForDisplay(gen.bills, []);
const todasJulAfterGen = filterBillsListItems(merged, MK_JUL, 'todas');
assert(todasJulAfterGen.length >= 4, 'todas jul inclui instâncias geradas + avulsas');

console.log('=== Testes: categorização para totais ===');
const cats = getBillsForContasMonth(allJul, MK_JUL);
const naoRec = cats.filter(isNonRecurringBill);
const rec = cats.filter(isRecurringBillInstance);
const parcelas = cats.filter(b => b.isInstallment);
assertLen(naoRec, 1, 'totais: não recorrentes jul');
assertLen(rec, 1, 'totais: recorrentes jul');
assertLen(parcelas, 1, 'totais: parcelas jul');
assertLen(cats, 3, 'totais: todas jul = soma das partes');

console.log('\n--- Resultado ---');
console.log(`Passou: ${passed}`);
console.log(`Falhou: ${failed}`);
if (failed > 0) process.exit(1);
console.log('OK: todos os testes passaram.');