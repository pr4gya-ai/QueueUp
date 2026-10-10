# QueueUp: Social Media Automation

Compose posts (or have AI write them), schedule them, and publish to X/Twitter, LinkedIn,
Facebook and Instagram through [Zernio](https://zernio.com).

- `backend/`: Express 5 + TypeScript + MongoDB (Mongoose). A cron job publishes due posts every minute.
- `frontend/`: React 19 + Vite + Tailwind CSS 4.

## Setup

Requires Node.js 22+ and a MongoDB instance.

```bash
# backend
cd backend
cp .env.example .env      # then fill in the values
npm install
npm run server            # dev (nodemon + tsx), or `npm start`

# frontend (second terminal)
cd frontend
cp .env.example .env
npm install
npm run dev
```

`MONGODB_URL` and `JWT_SECRET` are required; the server refuses to start without them. The
other keys are optional at boot, and the feature that needs a missing key reports a clear error.

## Checks

```bash
cd backend  && npm run typecheck
cd frontend && npm run lint && npm run build
```
