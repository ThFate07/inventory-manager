# Crockery Inventory Manager

This app now separates the public customer catalog from the protected admin dashboard.

## Routes

- `/` customer-safe product catalog
- `/admin/login` admin login
- `/admin` protected admin inventory dashboard

## PostgreSQL design based on the sample data

The sample inventory fields were analyzed into these tables:

- `categories`: normalized product grouping from the sample `category` field
- `products`: `code`, `name`, `stock_quantity`, `unit_price_inr`, `image_url`, and a foreign key to `categories`
- `admin_users`: admin credentials for the protected dashboard

Price is stored numerically as `unit_price_inr` instead of formatted text so the app can calculate totals cleanly.

## Setup

1. Copy `.env.example` to `.env.local` and update the values.
2. Run `npm install`
3. Run `npm run db:setup`
4. Run `npm run dev`

The app reads inventory data from PostgreSQL. The sample products are only used by `npm run db:setup` to seed the database.
