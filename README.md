# 🛒 Manna's Tinadhan POS

A lightweight, tablet-friendly Point of Sale system for small businesses. Built with vanilla HTML/CSS/JS on the frontend, Node.js + Express on the backend, and Supabase (Postgres) as the database.

**🌐 Live demo:** (not currently hosted) — to host the frontend as a static site use GitHub Pages or any static host.

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
| Backend  | Node.js, Express                  |
| Database | Supabase (hosted Postgres)        |
| Fonts    | Google Fonts — DM Sans, DM Mono  |

---

## 📁 Project Structure

```
pos-backend/
├── index.html              # Frontend — all UI, cashier & admin views
├── server.js               # Backend — REST API, talks to Supabase
├── supabase-schema.sql     # Run once in Supabase SQL Editor to create tables
├── migrate-to-supabase.js  # One-time import of old pos_database.xlsx data
├── package.json            # Node.js dependencies
├── .env.example            # Template for SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
├── .gitignore               # Excludes node_modules and .env
└── pos_database.xlsx        # Legacy data file, only used by the migration script
```

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) v16 or higher
- A free [Supabase](https://supabase.com) account

### Installation

**1. Clone the repository**
```bash
git clone https://github.com/jannoksz/mannas-tinadhan-pos.git
cd mannas-tinadhan-pos
```

**2. Install dependencies**
```bash
npm install
```

**3. Create a Supabase project**

At [supabase.com](https://supabase.com), create a new project, then go to **SQL Editor → New query**, paste in the contents of [`supabase-schema.sql`](./supabase-schema.sql), and run it. This creates all the tables the app needs (`products`, `sales`, `sales_summary`, `restock_history`, `price_change_log`, `stock_adjustments`).

**4. Configure environment variables**

Copy `.env.example` to `.env` and fill in your project's credentials (found in **Project Settings → API**):
```
SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```
> ⚠️ Use the **service role** key here, not the anon/public key — the backend needs full read/write access. Never expose this key in frontend code or commit it to git (`.env` is already gitignored).

**5. (Optional) Migrate your existing data**

If you have an existing `pos_database.xlsx` with real data, import it once:
```bash
node migrate-to-supabase.js
```

**6. Start the server**
```bash
node server.js
```

**7. Open the app**

Go to **http://localhost:3000** in your browser or tablet.

---

## ☁️ Deployment

Frontend only: you can publish `index.html` as a static site (for example on GitHub Pages) to get a github.io URL. That serves the UI but does not run the backend API.

Backend: `server.js` is a Node/Express server that requires the Supabase service role key. Keep the backend hosted on a server or platform that supports environment variables (e.g., Railway, Heroku, Fly, or a VPS). Do NOT expose the service role key in frontend code — it must remain in server-side environment variables.

Recommended approach to get a `github.io` frontend:
- Push the repo to GitHub and enable GitHub Pages for the repository (use the `gh-pages` branch or the `main` branch `/docs` folder).
- Optionally, point the frontend to a separate hosted backend by setting `const API = 'https://your-backend.example.com'` in `index.html` or by proxying requests.

Note: After publishing to GitHub Pages, edit `index.html` and set the `API` constant near the top to your backend URL, for example:

```html
<!-- in index.html -->
const API = 'https://your-backend.example.com';
```

If your backend is not yet hosted, the app will try to call same-origin APIs on the github.io domain and will fail; let me know the backend URL and I can set this for you.

If you want, I can add a simple GitHub Pages deployment guide or create a GitHub Actions workflow to build/publish the frontend.

---


## 🔐 Default Login Credentials

| Role    | Username  | Password     |
|---------|-----------|--------------|
| Admin   | `admin`   | `admin123`   |
| Cashier | `cashier` | `cashier123` |

> ⚠️ Change these credentials in `server.js` before deploying.

---

## 📊 Supabase Tables

| Table               | Description                              |
|----------------------|------------------------------------------|
| `products`          | Product catalog, stock levels, and per-product min stock threshold |
| `sales`             | One row per item per transaction         |
| `sales_summary`     | One row per transaction                  |
| `restock_history`   | Every restock event                      |
| `price_change_log`  | Automatic log of price changes           |
| `stock_adjustments` | Manual stock corrections with reason     |

Schema defined in [`supabase-schema.sql`](./supabase-schema.sql). Row Level Security is enabled on every table with no public policies — only the backend's service role key can read or write.

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
