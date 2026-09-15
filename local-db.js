const path = require('path');
const XLSX = require('xlsx');

const workbookPath = path.join(__dirname, 'pos_database.xlsx');
let writeQueue = Promise.resolve();
const tableSheets = {
  products: 'Products',
  sales: 'Sales',
  sales_summary: 'Sales_Summary',
  restock_history: 'Restock_History',
  price_change_log: 'Price_Change_Log',
  stock_adjustments: 'Stock_Adjustments'
};

const columns = {
  products: { sku: 'SKU', name: 'Name', category: 'Category', price: 'Price', stock: 'Stock', min_stock: 'MinStock', updated_at: 'UpdatedAt' },
  sales: { id: 'ID', transaction_id: 'TransactionID', date: 'Date', time: 'Time', cashier: 'Cashier', product_name: 'ProductName', sku: 'SKU', category: 'Category', quantity: 'Quantity', unit_price: 'UnitPrice', subtotal: 'Subtotal', total_amount: 'TotalAmount', created_at: 'CreatedAt' },
  sales_summary: { id: 'ID', transaction_id: 'TransactionID', date: 'Date', time: 'Time', cashier: 'Cashier', total_amount: 'TotalAmount', item_count: 'ItemCount', cash: 'Cash', change: 'Change', created_at: 'CreatedAt' },
  restock_history: { id: 'ID', date: 'Date', time: 'Time', sku: 'SKU', name: 'Name', category: 'Category', qty_added: 'QtyAdded', stock_before: 'StockBefore', stock_after: 'StockAfter', price: 'Price', created_at: 'CreatedAt' },
  price_change_log: { id: 'ID', date: 'Date', time: 'Time', sku: 'SKU', name: 'Name', old_price: 'OldPrice', new_price: 'NewPrice', changed_by: 'ChangedBy', created_at: 'CreatedAt' },
  stock_adjustments: { id: 'ID', date: 'Date', time: 'Time', sku: 'SKU', name: 'Name', adjustment: 'Adjustment', stock_before: 'StockBefore', stock_after: 'StockAfter', reason: 'Reason', created_at: 'CreatedAt' }
};

function readDatabase() {
  const workbook = XLSX.readFile(workbookPath);
  const database = {};

  for (const [table, sheetName] of Object.entries(tableSheets)) {
    const sheet = workbook.Sheets[sheetName];
    const sourceRows = sheet ? XLSX.utils.sheet_to_json(sheet, { defval: null }) : [];
    const mapping = columns[table];
    database[table] = sourceRows.map((source, index) => {
      const row = {};
      for (const [databaseColumn, excelColumn] of Object.entries(mapping)) {
        if (source[excelColumn] !== undefined && source[excelColumn] !== null) row[databaseColumn] = source[excelColumn];
      }
      if (table !== 'products' && row.id == null) row.id = index + 1;
      if (table === 'products' && row.min_stock == null) row.min_stock = 5;
      return row;
    });
  }

  return { workbook, database };
}

function saveDatabase(database, workbook) {
  for (const [table, sheetName] of Object.entries(tableSheets)) {
    const mapping = columns[table];
    const rows = database[table].map(row => Object.fromEntries(
      Object.entries(mapping)
        .filter(([databaseColumn]) => row[databaseColumn] !== undefined)
        .map(([databaseColumn, excelColumn]) => [excelColumn, row[databaseColumn]])
    ));
    workbook.Sheets[sheetName] = XLSX.utils.json_to_sheet(rows);
    if (!workbook.SheetNames.includes(sheetName)) workbook.SheetNames.push(sheetName);
  }
  XLSX.writeFile(workbook, workbookPath);
}

function nextId(rows) {
  return rows.reduce((highest, row) => Math.max(highest, Number(row.id) || 0), 0) + 1;
}

class LocalQuery {
  constructor(table) {
    this.table = table;
    this.filters = [];
    this.sorting = null;
    this.operation = 'select';
    this.payload = null;
    this.columns = '*';
    this.returnRows = false;
    this.headOnly = false;
  }

  select(columns = '*', options = {}) {
    this.columns = columns;
    this.returnRows = true;
    this.headOnly = options.head === true;
    return this;
  }

  order(column, options = {}) {
    this.sorting = { column, ascending: options.ascending !== false };
    return this;
  }

  eq(column, value) {
    this.filters.push(row => row[column] === value);
    return this;
  }

  ilike(column, value) {
    const expected = String(value).toLowerCase();
    this.filters.push(row => String(row[column] || '').toLowerCase() === expected);
    return this;
  }

  in(column, values) {
    this.filters.push(row => values.includes(row[column]));
    return this;
  }

  insert(rows) {
    this.operation = 'insert';
    this.payload = Array.isArray(rows) ? rows : [rows];
    return this;
  }

  upsert(rows, options = {}) {
    this.operation = 'upsert';
    this.payload = Array.isArray(rows) ? rows : [rows];
    this.conflictColumn = options.onConflict;
    return this;
  }

  update(changes) {
    this.operation = 'update';
    this.payload = changes;
    return this;
  }

  delete() {
    this.operation = 'delete';
    return this;
  }

  then(resolve, reject) {
    return this.execute().then(resolve, reject);
  }

  async execute() {
    const run = async () => {
      try {
      const { database, workbook } = readDatabase();
      const rows = database[this.table];
      if (!rows) throw new Error(`Unknown table: ${this.table}`);

      if (this.operation === 'select') {
        let result = rows.filter(row => this.filters.every(filter => filter(row)));
        if (this.sorting) {
          const direction = this.sorting.ascending ? 1 : -1;
          result = result.slice().sort((a, b) => {
            if (a[this.sorting.column] === b[this.sorting.column]) return 0;
            return a[this.sorting.column] > b[this.sorting.column] ? direction : -direction;
          });
        }
        if (this.headOnly) return { data: null, count: result.length, error: null };
        if (this.columns !== '*') {
          const columns = this.columns.split(',').map(column => column.trim());
          result = result.map(row => Object.fromEntries(columns.map(column => [column, row[column]])));
        }
        return { data: result, count: result.length, error: null };
      }

      const matches = rows.filter(row => this.filters.every(filter => filter(row)));

      if (this.operation === 'insert') {
        let id = nextId(rows);
        const inserted = this.payload.map(row => ({
          ...row,
          ...(this.table === 'products' ? {} : { id: row.id || id++ }),
          created_at: row.created_at || new Date().toISOString()
        }));
        rows.push(...inserted);
        saveDatabase(database, workbook);
        return { data: this.returnRows ? inserted : null, error: null };
      }

      if (this.operation === 'upsert') {
        const inserted = [];
        this.payload.forEach(row => {
          const existing = this.conflictColumn
            ? rows.find(item => item[this.conflictColumn] === row[this.conflictColumn])
            : null;
          if (existing) {
            Object.assign(existing, row);
            inserted.push(existing);
          } else {
            const newRow = {
              ...row,
              ...(this.table === 'products' ? {} : { id: nextId(rows) }),
              created_at: row.created_at || new Date().toISOString()
            };
            rows.push(newRow);
            inserted.push(newRow);
          }
        });
        saveDatabase(database, workbook);
        return { data: this.returnRows ? inserted : null, error: null };
      }

      if (this.operation === 'update') {
        matches.forEach(row => Object.assign(row, this.payload));
        saveDatabase(database, workbook);
        return { data: this.returnRows ? matches : null, error: null };
      }

      if (this.operation === 'delete') {
        database[this.table] = rows.filter(row => !matches.includes(row));
        saveDatabase(database, workbook);
        return { data: null, error: null };
      }
      } catch (error) {
        return { data: null, error };
      }
    };

    if (this.operation === 'select') return run();

    writeQueue = writeQueue.then(run, run);
    return writeQueue;
  }
}

const localDb = {
  from(table) {
    return new LocalQuery(table);
  },
  getPath() {
    return workbookPath;
  }
};

module.exports = localDb;
