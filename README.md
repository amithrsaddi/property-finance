# Mortgage Manager / Property Finance

Property finance management app for landlords and property owners.

- `backend/` — Express + MongoDB API (auth, properties, rent, mortgages, expenses, dashboard, reports)
- `webclient/` — browser UI

## Quick start

Terminal 1:

```bash
cd backend
cp .env.example .env
# set MONGODB_URI
npm install
npm run dev
```

Terminal 2:

```bash
cd webclient
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Deploy on Netlify

This repo is set up as a Netlify site: the UI is static files from `webclient/public`, and the Express API runs as a Netlify Function at `/api/*`.

1. Push the repo to GitHub and create a new Netlify site from that repository. `netlify.toml` already sets the build command and publish directory.
2. In **Site configuration → Environment variables**, add:

| Variable | Example |
| --- | --- |
| `MONGODB_URI` | `mongodb+srv://USER:PASSWORD@cluster.mongodb.net/property-finance` |
| `JWT_SECRET` | a long random string |
| `WEBCLIENT_ORIGIN` | `https://your-site.netlify.app` |

3. In MongoDB Atlas, allow network access from `0.0.0.0/0` so Netlify functions can connect.
4. Deploy. The production API base is `/api` (same origin). Local development still uses `http://localhost:3000`.

Password reset links use `WEBCLIENT_ORIGIN` when set, otherwise Netlify's `URL`.

## MVP features

- Email/password register, login, logout, password reset
- JWT session protection on API routes
- User profile (name, currency, password change, portfolio overview)
- Properties (add/edit/archive) with financial summary
- Rent payments with overdue detection
- Mortgages with upcoming / current / past payment views
- Property and portfolio-level expenses
- Dashboard cash-flow metrics with month/property filters
- Basic monthly/yearly reports by property
# property-finance
