# Backend

Express + TypeScript + MongoDB API for Property Finance.

## Setup

```bash
cp .env.example .env
# set MONGODB_URI in .env
npm install
```

## Run

```bash
npm run dev
```

API: [http://localhost:3000](http://localhost:3000)

## Main routes

- `POST /auth/register` `POST /auth/login` `POST /auth/logout`
- `POST /auth/forgot-password` `POST /auth/reset-password` `GET /auth/me`
- `GET|PATCH /profile` `POST /profile/change-password`
- `GET|POST /properties` `GET|PUT /properties/:id` `POST /properties/:id/archive`
- `GET|POST /rent` `PUT|DELETE /rent/:id`
- `GET|POST /mortgages` `PUT /mortgages/:id`
- `GET /mortgages/payments/views` `POST /mortgages/payments/:id/pay` `PUT /mortgages/payments/:id`
- `GET|POST /expenses` `PUT|DELETE /expenses/:id`
- `GET /dashboard` `GET /reports`
