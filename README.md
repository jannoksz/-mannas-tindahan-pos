# 🛒 Manna's Tinadhan POS

A lightweight, tablet-friendly Point of Sale system for small businesses. Built with vanilla HTML/CSS/JS, Node.js + Express, and a local Microsoft Excel workbook for initial data.

The installable web app keeps its working inventory, sales, and logs in a separate IndexedDB database on each device. After the first load, sales and inventory edits work offline. The Node.js server can provide the initial workbook data, but it is not used for ongoing sales.

---

## ✨ Features

### Cashier
- Browse products by category
- Search products instantly
- Add to cart with quantity control
- Checkout with cash payment and change calculation
- Official receipt display and print

### Admin
- Add new products or restock existing ones (auto-fill or manual mode)
- Delete products
- Manual stock adjustment with reason logging
- Set minimum stock per product

### Analytics
- **Sales** — View transactions by date
- **Inventory Dashboard** — Total items, stock value, low stock alerts
- **Best Sellers** — Ranked by units sold with revenue totals
- **Restock History** — Every restock event logged with before/after stock
- **Price Change Log** — Automatic log whenever a price is updated
- **Table View** — Sortable, filterable product table with export

### Inventory
- Low stock banner alert (visible to both cashier and admin)
- Export inventory as CSV or JSON
- Per-product minimum stock thresholds

---

## 🖥️ Tech Stack

| Layer    | Technology                        |
|----------|-----------------------------------|
| Frontend | HTML, CSS, Vanilla JavaScript     |
| Backend  | Node.js, Express (initial data import) |
| Database | IndexedDB per device; Excel workbook for initial data |
| Fonts    | Google Fonts — DM Sans, DM Mono  |

---

## 📁 Project Structure

```
pos-backend/
├── index.html              # Frontend — all UI, cashier & admin views
├── server.js               # Backend — REST API and Excel database access
├── local-db.js             # Microsoft Excel database adapter
├── package.json            # Node.js dependencies
├── .gitignore               # Excludes node_modules and .env
└── pos_database.xlsx        # Live Microsoft Excel database
```

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) v16 or higher

### Installation

**1. Clone the private repository**
```bash
git clone <your-private-repository-url>
cd mannas-tinadhan-pos
```

Only give repository access to trusted staff or collaborators. The Excel workbook contains business data and should remain private.

**2. Install dependencies**
```bash
npm install
```

**3. Start the local server**
```bash
npm start
```

**4. Open the app**

Go to **http://localhost:3000** in your browser or tablet. The server will display the Excel workbook path when it starts.

---

## 💾 Excel Database

On first launch, the app tries to import the current workbook data from the local server. If launched without a connection, it starts with an empty local inventory instead. Once a device has local edits, those edits are kept on that device and a later server connection will not merge or replace them.

Each installation has independent stock and sales. Data is not synchronized between devices. In the admin Table View, use **Backup device data** to export all local products and history, and **Import device backup** to restore that file on a device. Import replaces that device's current data, so export a backup first.

The app shell is cached for offline launch. Service workers require a secure context: use `http://localhost:3000` on the Windows computer, or serve the app over HTTPS for browser installation on Android. Do not expose this current server to the public internet; its API has no authentication and the bootstrap endpoint returns the workbook's sales and inventory data.

The workbook setup below applies to the initial server-side data source. Local device sales are stored in that device's browser storage, not written back to the workbook.

`pos_database.xlsx` is the live database. The server reads the workbook when handling a request and writes changes back to the workbook after product changes, sales, restocking, price changes, and stock adjustments.

The workbook contains these worksheets:

| Worksheet | Contents |
|-----------|----------|
| `Products` | Product names, categories, prices, stock, and minimum stock levels |
| `Sales` | One row for each product item sold |
| `Sales_Summary` | One row for each completed transaction |
| `Restock_History` | Product restocking records |
| `Price_Change_Log` | Product price change records |
| `Stock_Adjustments` | Manual stock adjustment records |

Keep the workbook closed in Microsoft Excel while the POS server is running. Excel can lock the file and prevent the server from saving changes. Back up `pos_database.xlsx` regularly.

For tablet access, run the server on the computer that contains the workbook, allow Node.js through the local firewall if needed, and open `http://<computer-ip>:3000` on the tablet.

---


## 🔐 Default Login Credentials

| Role    | Username  | Password     |
|---------|-----------|--------------|
| Admin   | `admin`   | `admin123`   |
| Cashier | `cashier` | `cashier123` |

> ⚠️ Change these credentials in `server.js` before deploying.

---

## 📊 Excel Worksheets

| Table               | Description                              |
|----------------------|------------------------------------------|
| `products`          | Product catalog, stock levels, and per-product min stock threshold |
| `sales`             | One row per item per transaction         |
| `sales_summary`     | One row per transaction                  |
| `restock_history`   | Every restock event                      |
| `price_change_log`  | Automatic log of price changes           |
| `stock_adjustments` | Manual stock corrections with reason     |

The workbook is the single source of truth for the complete product, sales, restock, price, and adjustment history.

---

## 📱 Recommended Usage

- Best used on a **10–12" tablet** in landscape mode
- Run the Node.js server on a local PC or mini PC
- Connect the tablet to the same local network and open via IP address (e.g. `http://192.168.1.x:3000`)

---

## 🗂️ Product Categories

- 🥛 Dairy Products
- 🍞 Bread & Buns
- 🥫 Sauces & Condiments
- 🍖 Meat Products
- 🍟 Frozen Products
- 📦 Packaging Supplies

---

## 📄 License

This project is private and intended for personal/business use by Manna's Tinadhan.
