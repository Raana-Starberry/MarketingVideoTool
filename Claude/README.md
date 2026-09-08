# AI Marketing Creative Video Generator

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full system design (data model, provider
abstraction, scene JSON schema, consistency strategy, MVP phases). The product spec this is built
from lives in the repo root [`README.md`](../README.md).

## Local development

```bash
# 1. Start Postgres (either works)
docker compose up -d
# or, if you have Postgres installed natively, create a DB matching .env.local

# 2. Install deps and generate the Prisma client
npm install
npx prisma generate

# 3. Apply the schema
npx prisma migrate dev

# 4. Run the app
npm run dev
```

Copy `.env.example` to `.env.local` and fill in provider API keys only when you reach the build
phase that needs them (see ARCHITECTURE.md §9) — the app runs end-to-end on mock providers with
none of them set.
