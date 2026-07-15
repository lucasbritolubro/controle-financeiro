/**
 * Integração: simula storage Supabase + fluxo init/render das abas Contas.
 * node scripts/test-contas-integration.mjs
 */

const BILLS_KEY = 'painel-financeiro:contas-a-pagar';
const RECURRING_KEY = 'painel-financeiro:contas-recorrentes';
const BILLS_MONTH_ALL = '__all__';

// --- storage + parse (espelho index.html) ---
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

const db = new Map();
let billsStorageError = false;
let recurringStorageError = false;

const storage = {
  async get(key) {
    if (!db.has(key)) return { value: null, missing: true };
    return { value: db.get(key) };
  },
  async set(key, valueStr) {
    db.set(key, JSON.parse(valueStr));
  },
};

function monthKey(d) { return d.slice(0, 7); }
function todayISO(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function currentMonthKeyNow(d = new Date()) { return monthKey(todayISO(d)); }
function clampDueDate(year, month, day) {
  const last = new Date(year, month + 1, 0).getDate();
  const d = Math.min(Math.max(1, day), last);
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

let bills = [];
let recurringBills = [];
let state = { installments: [] };
let contasSubActive = 'todas';

async function loadBills() {
  bills = [];
  billsStorageError = false;
  const res = await storage.get(BILLS_KEY);
  if (!res || res.error) { billsStorageError = true; return; }
  bills = parseStoredList(res.value);
}
async function loadRecurring() {
  recurringBills = [];
  recurringStorageError = false;
  const res = await storage.get(RECURRING_KEY);
  if (!res || res.error) { recurringStorageError = true; return; }
  recurringBills = parseStoredList(res.value);
}
async function saveBills() {
  if (billsStorageError) return;
  await storage.set(BILLS_KEY, JSON.stringify(bills));
}

function isNonRecurringBill(b) { return !b.isInstallment && !b.recurringId; }
function getAllBillsForDisplay() { return bills.slice(); }
function getBillsForContasMonth(selMonth) {
  const all = getAllBillsForDisplay();
  if (selMonth === BILLS_MONTH_ALL) return all;
  return all.filter(b => monthKey(b.dueDate) === selMonth);
}
function getBillsListItems(selMonth) {
  let items = getBillsForContasMonth(selMonth).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  if (contasSubActive === 'nao-recorrentes') items = items.filter(isNonRecurringBill);
  return items;
}

function recurringDueDatesInMonth(r, year, month) {
  if ((r.freq || 'mensal') === 'mensal') return [clampDueDate(year, month, r.dueDay || 1)];
  return [];
}
async function ensureRecurringInstancesForMonth(year, month) {
  if (recurringBills.length === 0) return false;
  let changed = false;
  recurringBills.forEach(r => {
    recurringDueDatesInMonth(r, year, month).forEach(dd => {
      if (!bills.find(b => String(b.recurringId) === String(r.id) && b.dueDate === dd)) {
        bills.push({ id: `i-${r.id}-${dd}`, desc: r.desc, value: r.value, dueDate: dd, recurringId: r.id, paid: false });
        changed = true;
      }
    });
  });
  if (changed) await saveBills();
  return changed;
}

// DOM mock
const dom = {
  billsMonthSelect: { value: '', innerHTML: '' },
  billsList: { innerHTML: '' },
  billsEmpty: { style: { display: 'none' }, textContent: '' },
  recurringList: { innerHTML: '' },
  recurringEmpty: { style: { display: 'none' }, textContent: '' },
};
const document = {
  getElementById(id) {
    if (id === 'billsMonthSelect') return dom.billsMonthSelect;
    if (id === 'billsList') return dom.billsList;
    if (id === 'billsEmpty') return dom.billsEmpty;
    if (id === 'recurringList') return dom.recurringList;
    if (id === 'recurringEmpty') return dom.recurringEmpty;
    return null;
  },
};
function getContasMonthKey() {
  const el = document.getElementById('billsMonthSelect');
  return (el && el.value) ? el.value : currentMonthKeyNow(FIXED_NOW);
}
function populateBillsMonthSelect(preserveSelection) {
  const el = dom.billsMonthSelect;
  const prev = el.value;
  const keys = new Set(getAllBillsForDisplay().map(b => monthKey(b.dueDate)));
  keys.add(currentMonthKeyNow(FIXED_NOW));
  if (prev && prev !== BILLS_MONTH_ALL && /^\d{4}-\d{2}$/.test(prev)) keys.add(prev);
  const sorted = [...keys].sort();
  let html = '';
  if (contasSubActive === 'todas') html += `<option value="${BILLS_MONTH_ALL}">TODOS</option>`;
  html += sorted.map(k => `<option value="${k}">${k}</option>`).join('');
  el.innerHTML = html;
  if (preserveSelection && (prev === BILLS_MONTH_ALL || sorted.includes(prev))) el.value = prev;
  else el.value = currentMonthKeyNow(FIXED_NOW);
}
function renderBillsList() {
  const items = getBillsListItems(getContasMonthKey());
  dom.billsList.innerHTML = items.map(b => b.id).join(',');
  dom.billsEmpty.style.display = items.length ? 'none' : 'block';
}
function renderRecurringList() {
  if (recurringBills.length === 0) {
    dom.recurringList.innerHTML = '';
    dom.recurringEmpty.style.display = 'block';
    return;
  }
  dom.recurringEmpty.style.display = 'none';
  dom.recurringList.innerHTML = recurringBills.map(r => r.id).join(',');
}
async function renderContasTab() {
  await ensureRecurringInstancesForMonth(2026, 6);
  renderBillsList();
}

const FIXED_NOW = new Date(2026, 6, 15);
const MK = '2026-07';

// --- cenários de storage ---
const scenarios = [
  {
    name: 'jsonb array nativo',
    bills: [
      { id: 'a1', desc: 'Luz', value: 80, dueDate: '2026-07-12', paid: false },
      { id: 'a2', desc: 'Água', value: 45, dueDate: '2026-06-03', paid: false },
      { id: 'a3', desc: 'Aluguel inst', value: 1500, dueDate: '2026-07-05', recurringId: 'R1', paid: false },
    ],
    recurring: [
      { id: 'R1', desc: 'Aluguel', value: 1500, freq: 'mensal', dueDay: 5, mode: 'fixed' },
      { id: 'R2', desc: 'Spotify', value: 22, freq: 'mensal', dueDay: 1, mode: 'fixed' },
    ],
    format: 'array',
  },
  {
    name: 'string JSON (legado)',
    bills: [
      { id: 'b1', desc: 'Internet', value: 99, dueDate: '2026-07-20', paid: false },
    ],
    recurring: [
      { id: 'R9', desc: 'Netflix', value: 45, freq: 'mensal', dueDay: 20, mode: 'fixed' },
    ],
    format: 'string',
  },
  {
    name: 'double-encoded string',
    bills: [
      { id: 'c1', desc: 'Condomínio', value: 600, dueDate: '2026-07-08', paid: false },
      { id: 'c2', desc: 'Gás', value: 30, dueDate: '2026-07-25', paid: false },
    ],
    recurring: [],
    format: 'double',
  },
];

let passed = 0;
let failed = 0;
function ok(c, m) { if (c) passed++; else { failed++; console.error('FAIL:', m); } }

for (const sc of scenarios) {
  db.clear();
  const storeBills = sc.format === 'double' ? JSON.stringify(JSON.stringify(sc.bills)) : sc.format === 'string' ? JSON.stringify(sc.bills) : sc.bills;
  const storeRec = sc.format === 'double' ? JSON.stringify(JSON.stringify(sc.recurring)) : sc.format === 'string' ? JSON.stringify(sc.recurring) : sc.recurring;
  db.set(BILLS_KEY, storeBills);
  db.set(RECURRING_KEY, storeRec);

  bills = [];
  recurringBills = [];
  contasSubActive = 'todas';
  dom.billsMonthSelect.value = '';

  await loadBills();
  await loadRecurring();
  ok(bills.length === sc.bills.length, `[${sc.name}] loadBills count`);
  ok(recurringBills.length === sc.recurring.length, `[${sc.name}] loadRecurring count`);

  populateBillsMonthSelect(false);
  ok(getContasMonthKey() === MK, `[${sc.name}] mês padrão = corrente`);

  await renderContasTab();
  const todas = getBillsListItems(MK);
  const expectedTodasMin = sc.bills.filter(b => monthKey(b.dueDate) === MK).length + (sc.recurring.length > 0 ? sc.recurring.filter(r => !sc.bills.some(b => b.recurringId === r.id && monthKey(b.dueDate) === MK)).length : 0);
  ok(todas.length >= sc.bills.filter(b => monthKey(b.dueDate) === MK).length, `[${sc.name}] TODAS jul tem contas do mês`);

  contasSubActive = 'nao-recorrentes';
  const naoRec = getBillsListItems(MK);
  ok(naoRec.every(isNonRecurringBill), `[${sc.name}] NÃO RECORRENTES sem recorrentes`);
  ok(naoRec.length === sc.bills.filter(b => monthKey(b.dueDate) === MK && !b.recurringId).length, `[${sc.name}] NÃO RECORRENTES count`);

  renderRecurringList();
  ok(dom.recurringList.innerHTML.split(',').filter(Boolean).length === sc.recurring.length, `[${sc.name}] RECORRENTES templates`);

  // troca de mês
  dom.billsMonthSelect.value = '2026-06';
  contasSubActive = 'todas';
  const jun = getBillsListItems('2026-06');
  ok(jun.length === sc.bills.filter(b => monthKey(b.dueDate) === '2026-06').length, `[${sc.name}] filtro junho`);

  // preserva mês ao trocar subaba
  contasSubActive = 'nao-recorrentes';
  populateBillsMonthSelect(true);
  ok(getContasMonthKey() === '2026-06', `[${sc.name}] preserva mês selecionado entre subabas`);
}

console.log('\n--- Integração ---');
console.log(`Passou: ${passed}`);
console.log(`Falhou: ${failed}`);
if (failed) process.exit(1);
console.log('OK: integração completa.');