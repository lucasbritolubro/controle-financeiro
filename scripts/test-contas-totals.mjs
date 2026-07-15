/**
 * Testes exaustivos dos totais (NÃO RECORRENTES / RECORRENTES / TODAS).
 * node scripts/test-contas-totals.mjs
 */

const BILLS_MONTH_ALL = '__all__';

function monthKey(d) { return d.slice(0, 7); }
function clampDueDate(year, month, day) {
  const last = new Date(year, month + 1, 0).getDate();
  const d = Math.min(Math.max(1, day), last);
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function isNonRecurringBill(b) { return !b.isInstallment && !b.recurringId; }
function isRecurringBillInstance(b) { return !b.isInstallment && !!b.recurringId; }
function sumBillsValue(items) { return items.reduce((s, b) => s + (b.value || 0), 0); }

function getInstallmentBills(installments) {
  const out = [];
  (installments || []).forEach(inst => {
    if (!inst.dueDay || !inst.firstDueMonth) return;
    const total = inst.totalInstallments;
    const paid = inst.paidInstallments || 0;
    const restantes = total ? (total - paid) : 1;
    if (restantes <= 0) return;
    const [fy, fm] = inst.firstDueMonth.split('-').map(Number);
    const parcelaValor = inst.installmentValue || 0;
    for (let k = 0; k < restantes; k++) {
      const parcelaIndex = paid + k;
      const mIndex = (fm - 1) + parcelaIndex;
      const y = fy + Math.floor(mIndex / 12);
      const m = mIndex % 12;
      out.push({
        id: `inst:${inst.id}:${parcelaIndex}`,
        isInstallment: true,
        desc: `${inst.desc} parcela`,
        value: parcelaValor,
        dueDate: clampDueDate(y, m, inst.dueDay),
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

function getBillsByCategoryForMonth(all, selMonth) {
  const monthBills = getBillsForContasMonth(all, selMonth);
  return {
    todas: monthBills,
    naoRecorrentes: monthBills.filter(isNonRecurringBill),
    recorrentes: monthBills.filter(isRecurringBillInstance),
    parcelas: monthBills.filter(b => b.isInstallment),
  };
}

function getBillsListItems(all, selMonth, contasSubActive) {
  let items = getBillsForContasMonth(all, selMonth).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  if (contasSubActive === 'nao-recorrentes') items = items.filter(isNonRecurringBill);
  return items;
}

function computeTotals(all, selMonth) {
  const cats = getBillsByCategoryForMonth(all, selMonth);
  return {
    naoRec: sumBillsValue(cats.naoRecorrentes),
    rec: sumBillsValue(cats.recorrentes),
    todas: sumBillsValue(cats.todas),
    parcelas: sumBillsValue(cats.parcelas),
    cats,
  };
}

const MK = '2026-07';
const bills = [
  { id: 'n1', desc: 'IPTU', value: 100, dueDate: '2026-07-10' },
  { id: 'n2', desc: 'Multa', value: 50, dueDate: '2026-07-20' },
  { id: 'r1', desc: 'Aluguel', value: 2000, dueDate: '2026-07-05', recurringId: 'rec-1' },
  { id: 'r2', desc: 'Internet', value: 120, dueDate: '2026-07-15', recurringId: 'rec-2' },
  { id: 'old', desc: 'Junho', value: 999, dueDate: '2026-06-01' },
];
const installments = [
  { id: 'i1', desc: 'Notebook', dueDay: 15, firstDueMonth: '2026-07', totalInstallments: 10, paidInstallments: 0, installmentValue: 300 },
];
const all = getAllBillsForDisplay(bills, installments);

let passed = 0;
let failed = 0;
function ok(c, m) { if (c) { passed++; } else { failed++; console.error('FAIL:', m); } }
function eq(a, e, m) { ok(a === e, `${m}: esperado ${e}, obteve ${a}`); }

console.log('=== Totais jul/2026 ===');
const t = computeTotals(all, MK);
// n1=100 + n2=50 = 150
eq(t.naoRec, 150, 'NÃO RECORRENTES');
// r1=2000 + r2=120 = 2120
eq(t.rec, 2120, 'RECORRENTES');
// parcela = 300
eq(t.parcelas, 300, 'PARCELAS');
// todas = 150 + 2120 + 300 = 2570
eq(t.todas, 2570, 'TODAS AS CONTAS');
eq(t.todas, t.naoRec + t.rec + t.parcelas, 'TODAS = NÃO REC + REC + PARCELAS');

console.log('=== Totais batem com listas ===');
const listTodas = getBillsListItems(all, MK, 'todas');
const listNaoRec = getBillsListItems(all, MK, 'nao-recorrentes');
eq(sumBillsValue(listTodas), t.todas, 'lista TODAS = total TODAS');
eq(sumBillsValue(listNaoRec), t.naoRec, 'lista NÃO REC = total NÃO REC');
eq(listTodas.length, 5, 'lista TODAS tem 5 itens em jul');
eq(listNaoRec.length, 2, 'lista NÃO REC tem 2 itens em jul');

console.log('=== Totais todos os meses ===');
const tall = computeTotals(all, BILLS_MONTH_ALL);
const expectedAllMonthsBills = 100 + 50 + 2000 + 120 + 999; // inclui conta de junho
const expectedAllParcelas = sumBillsValue(getInstallmentBills(installments)); // 10 × 300
eq(tall.todas, expectedAllMonthsBills + expectedAllParcelas, 'TODOS inclui junho + todas parcelas');
eq(tall.naoRec, 150 + 999, 'NÃO REC todos os meses');

console.log('=== Totais mês com só parcela (ago/2026) ===');
const tAgo = computeTotals(all, '2026-08');
eq(tAgo.parcelas, 300, 'ago tem 2ª parcela do notebook');
eq(tAgo.todas, 300, 'ago total = parcela');
eq(tAgo.naoRec, 0, 'ago sem avulsas');
eq(tAgo.rec, 0, 'ago sem recorrentes');

console.log('=== Totais mês realmente vazio ===');
const tEmpty = computeTotals(all, '2025-01');
eq(tEmpty.todas, 0, 'jan/2025 vazio');

console.log('=== Valores decimais e zero ===');
const dec = getAllBillsForDisplay([
  { id: 'd1', value: 10.5, dueDate: '2026-07-01' },
  { id: 'd2', value: 20.25, dueDate: '2026-07-02' },
  { id: 'd3', value: 0, dueDate: '2026-07-03', recurringId: 'x' },
], []);
const td = computeTotals(dec, MK);
eq(td.naoRec, 30.75, 'soma com decimais');
eq(td.rec, 0, 'recorrente valor zero');

console.log('=== Contagem por categoria sem sobreposição ===');
const cats = t.cats;
eq(
  cats.todas.length,
  cats.naoRecorrentes.length + cats.recorrentes.length + cats.parcelas.length,
  'categorias são disjuntas e cobrem todas'
);

console.log('\n--- Totais ---');
console.log(`Passou: ${passed}`);
console.log(`Falhou: ${failed}`);
if (failed) process.exit(1);
console.log('OK: somas totais corretas.');