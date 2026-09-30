# BlogStudio: Blog Automation

AI-assisted blog creation with research, outline approval and human-in-the-loop editing.

- `backend/`: FastAPI
- `frontend/`: React + Vite + TypeScript + Tailwind

## Run locally

### Backend

```bash
cd backend
python3 -m venv venv
venv/bin/pip install -r requirements.txt
cp .env.example .env   # then set ADMIN_EMAIL, ADMIN_PASSWORD, JWT_SECRET
venv/bin/uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. In dev, Vite proxies `/api` to `localhost:8000`.

## Auth

There is a single dashboard user, configured through env vars. There is no signup.

| Endpoint | Purpose |
|---|---|
| `POST /api/auth/login` | Checks `ADMIN_EMAIL`/`ADMIN_PASSWORD`, returns an access token and sets an httpOnly refresh cookie |
| `POST /api/auth/refresh` | Issues a new access token from the refresh cookie and rotates the cookie |
| `POST /api/auth/logout` | Clears the refresh cookie |
| `GET /api/auth/me` | Returns the current user (requires `Authorization: Bearer <token>`) |

The frontend keeps the access token in memory only. After a reload it restores the session through `/auth/refresh`. Login is rate-limited to 5 attempts per minute per IP.

In production, set `COOKIE_SECURE=true`, serve over HTTPS, and serve the frontend and API from the same domain (or configure `CORS_ORIGINS`).
