/**
 * Testa exclusão de conta recorrente: não deve voltar após syncContasData.
 * node scripts/test-delete-recurring.mjs
 */

const BILLS_KEY = 'painel-financeiro:contas-a-pagar';
const RECURRING_KEY = 'painel-financeiro:contas-recorrentes';
const DELETED_RECURRING_KEY = 'painel-financeiro:recorrentes-excluidos';

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
  return Array.isArray(parsed) ? parsed : [];
}
function sameId(a, b) { return String(a) === String(b); }

const db = new Map();
const storage = {
  async get(key) {
    if (!db.has(key)) return { value: null, missing: true };
    return { value: db.get(key) };
  },
  async set(key, valueStr) {
    db.set(key, JSON.parse(valueStr));
  },
};

let bills = [];
let recurringBills = [];
let deletedRecurringIds = [];
let contasDataLock = Promise.resolve();
function withContasLock(fn) {
  const next = contasDataLock.then(() => fn());
  contasDataLock = next.catch(() => {});
  return next;
}

function isRecurringDeleted(id) {
  return deletedRecurringIds.some(x => sameId(x, id));
}
async function loadDeletedRecurringIds() {
  const res = await storage.get(DELETED_RECURRING_KEY);
  deletedRecurringIds = parseStoredList(res && res.value).map(String);
}
async function saveDeletedRecurringIds() {
  await storage.set(DELETED_RECURRING_KEY, JSON.stringify(deletedRecurringIds));
}
async function markRecurringDeleted(id) {
  const sid = String(id);
  if (!isRecurringDeleted(sid)) deletedRecurringIds.push(sid);
  await saveDeletedRecurringIds();
}
async function loadBills() {
  const res = await storage.get(BILLS_KEY);
  bills = parseStoredList(res && res.value);
}
async function loadRecurring() {
  const res = await storage.get(RECURRING_KEY);
  recurringBills = parseStoredList(res && res.value);
}
async function saveBillsUnlocked() {
  await storage.set(BILLS_KEY, JSON.stringify(bills));
}
async function saveRecurringUnlocked() {
  await storage.set(RECURRING_KEY, JSON.stringify(recurringBills));
}
function recoverRecurringTemplatesFromBills() {
  let changed = false;
  const groups = new Map();
  bills.forEach(b => {
    if (!b.recurringId) return;
    const rid = String(b.recurringId);
    if (!groups.has(rid)) groups.set(rid, []);
    groups.get(rid).push(b);
  });
  groups.forEach((instances, rid) => {
    if (isRecurringDeleted(rid)) return;
    if (recurringBills.some(r => sameId(r.id, rid))) return;
    const b = instances.slice().sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
    if (!b) return;
    recurringBills.push({
      id: b.recurringId,
      desc: b.desc,
      value: b.value,
      freq: 'mensal',
      dueDay: parseInt((b.dueDate || '').split('-')[2], 10) || 1,
      mode: 'fixed',
    });
    changed = true;
  });
  return changed;
}
async function syncContasData() {
  return withContasLock(async () => {
    await loadDeletedRecurringIds();
    await loadBills();
    await loadRecurring();
    recurringBills = recurringBills.filter(r => !isRecurringDeleted(r.id));
    bills = bills.filter(b => !b.recurringId || !isRecurringDeleted(b.recurringId));
    if (recoverRecurringTemplatesFromBills()) await saveRecurringUnlocked();
  });
}
async function deleteRecurring(id) {
  return withContasLock(async () => {
    await markRecurringDeleted(id);
    recurringBills = recurringBills.filter(x => !sameId(x.id, id));
    bills = bills.filter(b => !sameId(b.recurringId, id));
    await saveRecurringUnlocked();
    await saveBillsUnlocked();
  });
}

async function run() {
  const rid = 'rec-1';
  recurringBills = [{ id: rid, desc: 'Aluguel', value: 1000, freq: 'mensal', dueDay: 5, mode: 'fixed' }];
  bills = [
    { id: 'b1', desc: 'Aluguel', value: 1000, dueDate: '2026-07-05', recurringId: rid },
    { id: 'b2', desc: 'Aluguel', value: 1000, dueDate: '2026-08-05', recurringId: rid },
  ];
  await saveRecurringUnlocked();
  await saveBillsUnlocked();

  await deleteRecurring(rid);

  // Simula corrida: storage ainda tem bills antigas mas recurring já foi salvo sem template
  db.set(BILLS_KEY, [
    { id: 'b1', desc: 'Aluguel', value: 1000, dueDate: '2026-07-05', recurringId: rid },
    { id: 'b2', desc: 'Aluguel', value: 1000, dueDate: '2026-08-05', recurringId: rid },
  ]);
  db.set(RECURRING_KEY, []);

  await syncContasData();

  if (recurringBills.length !== 0) {
    console.error('FAIL: template recorrente foi recriado após exclusão');
    process.exit(1);
  }
  if (bills.some(b => sameId(b.recurringId, rid))) {
    console.error('FAIL: instâncias recorrentes não foram removidas no sync');
    process.exit(1);
  }
  if (!isRecurringDeleted(rid)) {
    console.error('FAIL: id excluído não está na lista de bloqueio');
    process.exit(1);
  }

  console.log('OK: exclusão de recorrente persiste e não é recriada pelo sync');
}

run().catch(e => { console.error(e); process.exit(1); });