/* ============================================================
   EXPENSE & BUDGET VISUALIZER — script.js
   ============================================================ */

'use strict';

// ─── Constants ───────────────────────────────────────────────
const STORAGE_KEY   = 'budgetviz_transactions';
const THEME_KEY     = 'budgetviz_theme';
const LARGE_THRESHOLD = 500000; // Rp 500.000 dianggap pengeluaran besar

const CATEGORY_CONFIG = {
  Makanan:      { icon: '🍔', color: '#60a5fa' },
  Transportasi: { icon: '🚗', color: '#34d399' },
  Hiburan:      { icon: '🎮', color: '#f472b6' },
};

// ─── State ───────────────────────────────────────────────────
let transactions = loadFromStorage();
let pieChart     = null;

// ─── DOM References ──────────────────────────────────────────
const form            = document.getElementById('expenseForm');
const inputName       = document.getElementById('itemName');
const inputAmount     = document.getElementById('itemAmount');
const inputCategory   = document.getElementById('itemCategory');
const errName         = document.getElementById('errName');
const errAmount       = document.getElementById('errAmount');
const totalAmountEl   = document.getElementById('totalAmount');
const totalCountEl    = document.getElementById('totalCount');
const transactionList = document.getElementById('transactionList');
const emptyState      = document.getElementById('emptyState');
const sortSelect      = document.getElementById('sortSelect');
const clearAllBtn     = document.getElementById('clearAll');
const darkToggle      = document.getElementById('darkToggle');
const chartCanvas     = document.getElementById('pieChart');
const chartEmpty      = document.getElementById('chartEmpty');
const chartLegend     = document.getElementById('chartLegend');
const toast           = document.getElementById('toast');

// ─── Init ─────────────────────────────────────────────────────
(function init() {
  applyTheme(localStorage.getItem(THEME_KEY) || 'light');
  render();
})();

// ─── Event Listeners ─────────────────────────────────────────
form.addEventListener('submit', handleSubmit);
sortSelect.addEventListener('change', renderList);
clearAllBtn.addEventListener('click', handleClearAll);
darkToggle.addEventListener('click', toggleTheme);

// ─── Form Submit ─────────────────────────────────────────────
function handleSubmit(e) {
  e.preventDefault();
  if (!validate()) return;

  const tx = {
    id:       Date.now(),
    name:     inputName.value.trim(),
    amount:   parseFloat(inputAmount.value),
    category: inputCategory.value,
    date:     new Date().toISOString(),
  };

  transactions.unshift(tx);
  saveToStorage();
  render();
  form.reset();
  showToast(`✅ "${tx.name}" ditambahkan`);
}

// ─── Validation ──────────────────────────────────────────────
function validate() {
  let valid = true;

  errName.textContent   = '';
  errAmount.textContent = '';
  inputName.classList.remove('error');
  inputAmount.classList.remove('error');

  if (!inputName.value.trim()) {
    errName.textContent = 'Nama barang tidak boleh kosong.';
    inputName.classList.add('error');
    valid = false;
  }

  const amt = parseFloat(inputAmount.value);
  if (!inputAmount.value || isNaN(amt) || amt <= 0) {
    errAmount.textContent = 'Masukkan jumlah yang valid (> 0).';
    inputAmount.classList.add('error');
    valid = false;
  }

  return valid;
}

// ─── Delete ──────────────────────────────────────────────────
function deleteTransaction(id) {
  const tx = transactions.find(t => t.id === id);
  transactions = transactions.filter(t => t.id !== id);
  saveToStorage();
  render();
  if (tx) showToast(`🗑 "${tx.name}" dihapus`);
}

// ─── Clear All ───────────────────────────────────────────────
function handleClearAll() {
  if (transactions.length === 0) return;
  if (!confirm('Hapus semua transaksi? Tindakan ini tidak bisa dibatalkan.')) return;
  transactions = [];
  saveToStorage();
  render();
  showToast('🗑 Semua transaksi dihapus');
}

// ─── Render (master) ─────────────────────────────────────────
function render() {
  renderSummary();
  renderList();
  renderChart();
}

// ─── Render Summary Cards ────────────────────────────────────
function renderSummary() {
  const total = transactions.reduce((s, t) => s + t.amount, 0);
  totalAmountEl.textContent = formatRupiah(total);
  totalCountEl.textContent  = `${transactions.length} transaksi tercatat`;

  const cats = { Makanan: 0, Transportasi: 0, Hiburan: 0 };
  transactions.forEach(t => { cats[t.category] = (cats[t.category] || 0) + t.amount; });

  document.getElementById('valMakanan').textContent      = formatRupiah(cats.Makanan);
  document.getElementById('valTransportasi').textContent = formatRupiah(cats.Transportasi);
  document.getElementById('valHiburan').textContent      = formatRupiah(cats.Hiburan);
}

// ─── Render Transaction List ─────────────────────────────────
function renderList() {
  const sorted = getSorted([...transactions]);

  if (sorted.length === 0) {
    emptyState.style.display = 'block';
    transactionList.innerHTML = '';
    return;
  }

  emptyState.style.display = 'none';
  transactionList.innerHTML = sorted.map(tx => buildItemHTML(tx)).join('');

  // Attach delete listeners
  transactionList.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', () => deleteTransaction(Number(btn.dataset.id)));
  });
}

function buildItemHTML(tx) {
  const cfg     = CATEGORY_CONFIG[tx.category] || {};
  const isLarge = tx.amount >= LARGE_THRESHOLD;
  const dateStr = formatDate(tx.date);

  return `
    <li class="transaction-item${isLarge ? ' large-expense' : ''}">
      <div class="item-icon icon-${tx.category}">${cfg.icon || '💰'}</div>
      <div class="item-info">
        <div class="item-name">${escapeHTML(tx.name)}</div>
        <div class="item-meta">
          <span class="item-cat cat-${tx.category}">${tx.category}</span>
          <span class="item-date">${dateStr}</span>
          ${isLarge ? '<span class="large-badge">⚠ Besar</span>' : ''}
        </div>
      </div>
      <span class="item-amount">${formatRupiah(tx.amount)}</span>
      <button class="btn-delete" data-id="${tx.id}" title="Hapus">✕</button>
    </li>
  `;
}

// ─── Sort ────────────────────────────────────────────────────
function getSorted(arr) {
  const mode = sortSelect.value;
  switch (mode) {
    case 'oldest':  return arr.sort((a, b) => a.id - b.id);
    case 'highest': return arr.sort((a, b) => b.amount - a.amount);
    case 'lowest':  return arr.sort((a, b) => a.amount - b.amount);
    default:        return arr.sort((a, b) => b.id - a.id); // newest
  }
}

// ─── Render Chart ────────────────────────────────────────────
function renderChart() {
  const cats  = { Makanan: 0, Transportasi: 0, Hiburan: 0 };
  const total = transactions.reduce((s, t) => {
    cats[t.category] = (cats[t.category] || 0) + t.amount;
    return s + t.amount;
  }, 0);

  const labels  = Object.keys(cats);
  const data    = Object.values(cats);
  const colors  = labels.map(l => CATEGORY_CONFIG[l]?.color || '#ccc');
  const hasData = data.some(v => v > 0);

  chartEmpty.style.display    = hasData ? 'none' : 'block';
  chartCanvas.style.display   = hasData ? 'block' : 'none';

  if (!hasData) {
    if (pieChart) { pieChart.destroy(); pieChart = null; }
    chartLegend.innerHTML = '';
    return;
  }

  const chartData = {
    labels,
    datasets: [{
      data,
      backgroundColor: colors,
      borderColor: colors.map(c => c),
      borderWidth: 2,
      hoverOffset: 8,
    }],
  };

  if (pieChart) {
    pieChart.data = chartData;
    pieChart.update('active');
  } else {
    pieChart = new Chart(chartCanvas, {
      type: 'doughnut',
      data: chartData,
      options: {
        responsive: true,
        cutout: '62%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` ${formatRupiah(ctx.parsed)}`,
            },
          },
        },
        animation: { animateRotate: true, duration: 500 },
      },
    });
  }

  // Custom legend
  chartLegend.innerHTML = labels.map((label, i) => {
    const pct = total > 0 ? ((data[i] / total) * 100).toFixed(1) : '0.0';
    return `
      <div class="legend-item">
        <div class="legend-left">
          <span class="legend-dot" style="background:${colors[i]}"></span>
          <span class="legend-name">${label}</span>
        </div>
        <div class="legend-right">
          <span class="legend-amount">${formatRupiah(data[i])}</span>
          <span class="legend-pct">${pct}%</span>
        </div>
      </div>
    `;
  }).join('');
}

// ─── Dark Mode ───────────────────────────────────────────────
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
}

// ─── Toast ───────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
}

// ─── LocalStorage ────────────────────────────────────────────
function saveToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

function loadFromStorage() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

// ─── Helpers ─────────────────────────────────────────────────
function formatRupiah(num) {
  return 'Rp ' + Math.round(num).toLocaleString('id-ID');
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function escapeHTML(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
