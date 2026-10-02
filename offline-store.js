const DB_NAME = 'mannas-tinadhan-pos';
const DB_VERSION = 1;
const SKU_PREFIX = {
  'Dairy Products': 'DRY',
  'Bread & Buns': 'BRD',
  'Sauces & Condiments': 'SCE',
  'Meat Products': 'MET',
  'Frozen Products': 'FRZ',
  'Packaging Supplies': 'PKG'
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

let databasePromise;
let initializationPromise;

function emptyState() {
  return { initialized: false, products: [], sales: [], restocks: [], priceChanges: [], adjustments: [] };
}

function openDatabase() {
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => request.result.createObjectStore('snapshots', { keyPath: 'key' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return databasePromise;
}

async function readState() {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('snapshots', 'readonly');
    const request = transaction.objectStore('snapshots').get('current');
    request.onsuccess = () => resolve(request.result?.value || emptyState());
    request.onerror = () => reject(request.error);
  });
}

async function updateState(update, markInitialized = true) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('snapshots', 'readwrite');
    const store = transaction.objectStore('snapshots');
    const request = store.get('current');
    let result;
    request.onsuccess = () => {
      const state = request.result?.value || emptyState();
      try {
        result = update(state);
        if (markInitialized) state.initialized = true;
        store.put({ key: 'current', value: state });
      } catch (error) {
        transaction.abort();
        reject(error);
      }
    };
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('Local database update failed'));
  });
}

function number(value) { return Number(value || 0); }
function formatDate(date) {
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${date.getFullYear()}`;
}
function formatTime(date) { return date.toLocaleTimeString('en-US'); }
function parseDate(value) {
  const [month, day, year] = String(value).split('/').map(Number);
  return month && day && year ? new Date(year, month - 1, day) : null;
}
function dateFromQuery(value) {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  return year && month && day ? new Date(year, month - 1, day) : null;
}
function startOfWeek(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}
function periodRange(period, anchor) {
  const y = anchor.getFullYear(), m = anchor.getMonth(), d = anchor.getDate();
  if (period === 'daily') return [new Date(y, m, d), new Date(y, m, d + 1)];
  if (period === 'weekly') {
    const start = startOfWeek(anchor);
    return [start, new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7)];
  }
  if (period === 'monthly') return [new Date(y, m, 1), new Date(y, m + 1, 1)];
  if (period === 'quarterly') {
    const quarterMonth = Math.floor(m / 3) * 3;
    return [new Date(y, quarterMonth, 1), new Date(y, quarterMonth + 3, 1)];
  }
  if (period === 'yearly') return [new Date(y, 0, 1), new Date(y + 1, 0, 1)];
  throw new Error(`Invalid period: ${period}`);
}
function periodLabel(period, anchor) {
  const y = anchor.getFullYear(), m = anchor.getMonth();
  if (period === 'daily') return `${MONTHS[m]} ${anchor.getDate()}, ${y}`;
  if (period === 'monthly') return `${MONTHS[m]} ${y}`;
  if (period === 'quarterly') return `Q${Math.floor(m / 3) + 1} ${y}`;
  if (period === 'yearly') return String(y);
  const [start, end] = periodRange('weekly', anchor);
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 1);
  return `${MONTHS[start.getMonth()]} ${start.getDate()} – ${MONTHS[last.getMonth()]} ${last.getDate()}, ${last.getFullYear()}`;
}
function summaryItems(state) { return state.sales.flatMap(transaction => transaction.items); }

function fromBackup(data) {
  const salesRows = data.sales || [];
  return {
    initialized: true,
    products: (data.products || []).map(p => ({ SKU: p.sku, Name: p.name, Category: p.category, Price: number(p.price), Stock: number(p.stock), MinStock: number(p.min_stock), Date: p.date, Time: p.time })),
    sales: (data.sales_summary || []).map(tx => ({
      TransactionID: tx.transaction_id, Date: tx.date, Time: tx.time, Cashier: tx.cashier,
      TotalAmount: number(tx.total_amount), ItemCount: number(tx.item_count), Cash: number(tx.cash), Change: number(tx.change),
      items: salesRows.filter(row => row.transaction_id === tx.transaction_id).map(row => ({
        TransactionID: row.transaction_id, Date: row.date, Time: row.time, Cashier: row.cashier,
        ProductName: row.product_name, SKU: row.sku, Category: row.category,
        Quantity: number(row.quantity), UnitPrice: number(row.unit_price), Subtotal: number(row.subtotal), TotalAmount: number(row.total_amount)
      }))
    })),
    restocks: (data.restock_history || []).map(r => ({ Date: r.date, Time: r.time, SKU: r.sku, Name: r.name, Category: r.category, QtyAdded: number(r.qty_added), StockBefore: number(r.stock_before), StockAfter: number(r.stock_after), Price: number(r.price) })),
    priceChanges: (data.price_change_log || []).map(r => ({ Date: r.date, Time: r.time, SKU: r.sku, Name: r.name, OldPrice: number(r.old_price), NewPrice: number(r.new_price), ChangedBy: r.changed_by })),
    adjustments: (data.stock_adjustments || []).map(r => ({ Date: r.date, Time: r.time, SKU: r.sku, Name: r.name, Adjustment: number(r.adjustment), StockBefore: number(r.stock_before), StockAfter: number(r.stock_after), Reason: r.reason }))
  };
}

async function ensureInitialized() {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      const state = await readState();
      if (state.initialized) return;
      let initial = emptyState();
      try {
        const response = await fetch('/offline-backup');
        if (response.ok) initial = fromBackup(await response.json());
      } catch (_) {}
      await updateState(current => {
        if (!current.initialized) Object.assign(current, initial);
      }, false);
    })().catch(error => {
      initializationPromise = null;
      throw error;
    });
  }
  return initializationPromise;
}

function transactionItems(transaction) {
  return transaction.items.map(item => ({
    TransactionID: transaction.TransactionID, Date: transaction.Date, Time: transaction.Time,
    Cashier: transaction.Cashier, ProductName: item.name, SKU: item.sku, Category: item.category,
    Quantity: item.qty, UnitPrice: item.price, Subtotal: item.price * item.qty, TotalAmount: transaction.TotalAmount
  }));
}

async function get(endpoint) {
  await ensureInitialized();
  const url = new URL(endpoint, location.origin);
  const path = url.pathname;
  const state = await readState();
  if (path === '/products') return [...state.products].sort((a, b) => a.SKU.localeCompare(b.SKU));
  if (path === '/sales') {
    const date = url.searchParams.get('date');
    return state.sales.filter(tx => !date || tx.Date === formatDate(dateFromQuery(date))).map(tx => ({ ...tx, items: transactionItems(tx) }));
  }
  if (path === '/restock-history') return [...state.restocks].reverse();
  if (path === '/price-change-log') return [...state.priceChanges].reverse();
  if (path === '/stock-adjustments') return [...state.adjustments].reverse();
  if (path === '/export-inventory') return state.products.map(p => ({ SKU: p.SKU, Name: p.Name, Category: p.Category, Price: p.Price, Stock: p.Stock }));
  if (path === '/inventory-dashboard') {
    const categories = {};
    for (const p of state.products) {
      if (!categories[p.Category]) categories[p.Category] = { count: 0, value: 0, items: [] };
      categories[p.Category].count++;
      categories[p.Category].value += p.Price * p.Stock;
      categories[p.Category].items.push({ name: p.Name, stock: p.Stock, price: p.Price });
    }
    const lowStockItems = state.products.filter(p => p.Stock <= p.MinStock).map(p => ({ sku: p.SKU, name: p.Name, stock: p.Stock, minStock: p.MinStock }));
    return {
      totalItems: state.products.length,
      totalStockValue: state.products.reduce((sum, p) => sum + p.Price * p.Stock, 0),
      lowStockCount: lowStockItems.length,
      outOfStockCount: state.products.filter(p => p.Stock === 0).length,
      lowStockItems, categories
    };
  }
  if (path === '/best-sellers') {
    const totals = {};
    for (const item of summaryItems(state)) {
      if (!totals[item.SKU]) totals[item.SKU] = { sku: item.SKU, name: item.ProductName, category: item.Category, qtyTotal: 0, revenueTotal: 0 };
      totals[item.SKU].qtyTotal += item.Quantity;
      totals[item.SKU].revenueTotal += item.Subtotal;
    }
    return Object.values(totals).sort((a, b) => b.qtyTotal - a.qtyTotal).slice(0, Number(url.searchParams.get('limit')) || 10);
  }
  if (path === '/sales-summary') return makeSalesSummary(state, url);
  throw new Error(`Unknown local request: ${path}`);
}

function makeSalesSummary(state, url) {
  const period = (url.searchParams.get('period') || 'daily').toLowerCase();
  if (!['daily', 'weekly', 'monthly', 'quarterly', 'yearly'].includes(period)) throw new Error(`Invalid period: ${period}`);
  const anchor = dateFromQuery(url.searchParams.get('date')) || new Date();
  const [start, end] = periodRange(period, anchor);
  const rows = state.sales.filter(tx => {
    const date = parseDate(tx.Date);
    return date && date >= start && date < end;
  });
  const revenue = rows.reduce((sum, row) => sum + row.TotalAmount, 0);
  const itemsSold = rows.reduce((sum, row) => sum + row.ItemCount, 0);
  const previousAnchor = new Date(start.getFullYear(), start.getMonth(), start.getDate() - 1);
  const [previousStart, previousEnd] = periodRange(period, previousAnchor);
  const previousRows = state.sales.filter(tx => {
    const date = parseDate(tx.Date);
    return date && date >= previousStart && date < previousEnd;
  });
  const previousRevenue = previousRows.reduce((sum, row) => sum + row.TotalAmount, 0);
  const buckets = [];
  if (period === 'daily') {
    for (let hour = 0; hour < 24; hour++) {
      const label = `${(hour % 12) || 12}${hour < 12 ? 'am' : 'pm'}`;
      buckets.push({ label, revenue: 0, transactions: 0, itemsSold: 0 });
    }
    for (const row of rows) {
      const hourText = row.Time.match(/^(\d{1,2}):\d{2}(?::\d{2})?\s*(AM|PM)?/i);
      if (!hourText) continue;
      let hour = Number(hourText[1]);
      if ((hourText[2] || '').toUpperCase() === 'PM' && hour !== 12) hour += 12;
      if ((hourText[2] || '').toUpperCase() === 'AM' && hour === 12) hour = 0;
      const bucket = buckets[Math.min(23, hour)];
      bucket.revenue += row.TotalAmount;
      bucket.transactions++;
      bucket.itemsSold += row.ItemCount;
    }
  } else {
    const monthMode = period === 'quarterly' || period === 'yearly';
    const count = period === 'weekly' ? 7 : period === 'monthly'
      ? new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate()
      : period === 'quarterly' ? 3 : 12;
    for (let index = 0; index < count; index++) {
      let date, label;
      if (monthMode) {
        const month = (period === 'quarterly' ? Math.floor(anchor.getMonth() / 3) * 3 : 0) + index;
        date = new Date(anchor.getFullYear(), month, 1);
        label = MONTHS[month];
      } else {
        date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
        label = period === 'weekly' ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index] : String(date.getDate());
      }
      buckets.push({ key: monthMode ? date.getMonth() : `${date.getMonth()}-${date.getDate()}`, label, revenue: 0, transactions: 0, itemsSold: 0 });
    }
    for (const row of rows) {
      const date = parseDate(row.Date);
      const key = monthMode ? date.getMonth() : `${date.getMonth()}-${date.getDate()}`;
      const bucket = buckets.find(item => item.key === key);
      if (bucket) {
        bucket.revenue += row.TotalAmount;
        bucket.transactions++;
        bucket.itemsSold += row.ItemCount;
      }
    }
    buckets.forEach(bucket => delete bucket.key);
  }
  const top = {};
  for (const item of rows.flatMap(transactionItems)) {
    if (!top[item.SKU]) top[item.SKU] = { sku: item.SKU, name: item.ProductName, category: item.Category, qtyTotal: 0, revenueTotal: 0 };
    top[item.SKU].qtyTotal += item.Quantity;
    top[item.SKU].revenueTotal += item.Subtotal;
  }
  return {
    period, label: periodLabel(period, anchor), start: start.toISOString(), end: end.toISOString(),
    totals: { revenue, transactions: rows.length, itemsSold, avgBasket: rows.length ? revenue / rows.length : 0 },
    previous: { label: periodLabel(period, previousAnchor), revenue: previousRevenue, changePct: previousRevenue ? (revenue - previousRevenue) / previousRevenue * 100 : null },
    buckets, topProducts: Object.values(top).sort((a, b) => b.qtyTotal - a.qtyTotal).slice(0, 5)
  };
}

async function post(endpoint, body) {
  await ensureInitialized();
  const path = new URL(endpoint, location.origin).pathname;
  return updateState(state => {
    const now = new Date();
    const date = formatDate(now), time = formatTime(now);
    if (path === '/add-product') {
      const { name, category, price, stock } = body;
      if (!name || !category || price == null || stock == null) throw new Error('Missing fields');
      const existing = state.products.find(p => p.Name.toLowerCase() === name.toLowerCase());
      if (existing) {
        const before = existing.Stock;
        const oldPrice = existing.Price;
        existing.Stock += number(stock);
        existing.Price = number(price);
        existing.Date = date;
        existing.Time = time;
        state.restocks.push({ Date: date, Time: time, SKU: existing.SKU, Name: name, Category: category, QtyAdded: number(stock), StockBefore: before, StockAfter: existing.Stock, Price: existing.Price });
        if (oldPrice !== existing.Price) state.priceChanges.push({ Date: date, Time: time, SKU: existing.SKU, Name: name, OldPrice: oldPrice, NewPrice: existing.Price, ChangedBy: 'admin' });
        return { message: `Restocked "${name}". New stock: ${existing.Stock}` };
      }
      const prefix = SKU_PREFIX[category] || 'GEN';
      const index = state.products.filter(p => p.Category === category).length + 1;
      const sku = `${prefix}-${String(index).padStart(3, '0')}`;
      state.products.push({ SKU: sku, Name: name, Category: category, Price: number(price), Stock: number(stock), MinStock: 5, Date: date, Time: time });
      state.restocks.push({ Date: date, Time: time, SKU: sku, Name: name, Category: category, QtyAdded: number(stock), StockBefore: 0, StockAfter: number(stock), Price: number(price) });
      return { message: `Added new product "${name}" (${sku})` };
    }
    if (path === '/delete-product') {
      const index = state.products.findIndex(p => p.SKU === body.sku);
      if (index < 0) throw new Error('Product not found');
      state.products.splice(index, 1);
      return { message: `Deleted product ${body.sku}` };
    }
    if (path === '/checkout') {
      const { cashier, cart, cash } = body;
      if (!cart?.length) throw new Error('Cart is empty');
      const total = cart.reduce((sum, item) => sum + number(item.price) * number(item.qty), 0);
      if (number(cash) < total) throw new Error('Insufficient cash');
      for (const item of cart) {
        const product = state.products.find(p => p.SKU === item.sku);
        if (!product) throw new Error(`Product not found: ${item.name}`);
        if (product.Stock < item.qty) throw new Error(`Insufficient stock for ${item.name}`);
      }
      for (const item of cart) state.products.find(p => p.SKU === item.sku).Stock -= item.qty;
      const transactionID = `R${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
      const change = number(cash) - total;
      const transaction = {
        TransactionID: transactionID, Date: date, Time: time, Cashier: cashier || 'cashier',
        TotalAmount: total, ItemCount: cart.reduce((sum, item) => sum + item.qty, 0), Cash: number(cash), Change: change,
        items: cart.map(item => ({ ...item }))
      };
      state.sales.push(transaction);
      return { message: 'Sale recorded', transactionID, total, cash: number(cash), change, time: `${date} ${time}` };
    }
    if (path === '/set-min-stock') {
      const product = state.products.find(p => p.SKU === body.sku);
      if (!product) throw new Error('Product not found');
      product.MinStock = number(body.minStock);
      return { message: `Min stock for ${body.sku} set to ${body.minStock}` };
    }
    if (path === '/adjust-stock') {
      const product = state.products.find(p => p.SKU === body.sku);
      if (!product) throw new Error('Product not found');
      const before = product.Stock;
      const after = Math.max(0, before + number(body.adjustment));
      product.Stock = after;
      state.adjustments.push({ Date: date, Time: time, SKU: body.sku, Name: product.Name, Adjustment: number(body.adjustment), StockBefore: before, StockAfter: after, Reason: body.reason || 'Manual adjustment' });
      return { message: `Stock adjusted: ${before} → ${after}`, stockBefore: before, stockAfter: after };
    }
    throw new Error(`Unknown local request: ${path}`);
  });
}

async function exportBackup() {
  await ensureInitialized();
  return {
    format: 'mannas-tinadhan-pos',
    version: 1,
    exportedAt: new Date().toISOString(),
    state: await readState()
  };
}

async function importBackup(backup) {
  const state = backup?.format === 'mannas-tinadhan-pos' && backup.version === 1 ? backup.state : null;
  const requiredTables = ['products', 'sales', 'restocks', 'priceChanges', 'adjustments'];
  if (!state || requiredTables.some(table => !Array.isArray(state[table]))) {
    throw new Error('This is not a valid POS device backup.');
  }
  await updateState(current => {
    for (const table of requiredTables) current[table] = state[table];
  });
}

window.PosOfflineStore = { get, post, exportBackup, importBackup };
