Render + MongoDB Atlas deployment (free tier)
============================================

Quick plan
- Create a Render Web Service for the backend (Node/Express).
- Create a Render Static Site (or Web Service) for the frontend (Vite build).
- Create a MongoDB Atlas free cluster and add a database user + connection string.
- Set all secrets in Render service settings (do NOT put secrets in the repo).
- If you want a guided setup, use the checked-in [render.yaml](render.yaml) blueprint as the starting point.

Backend service (Render)
- Root directory: `backend`
- Build command: `npm install`
- Start command: `npm start`
- Environment variables (example keys):
  - `MONGODB_URI` — Atlas connection string (use the user you create)
  - `JWT_SECRET` — your JWT signing secret
  - `PORT` — optional, Render provides one via `PORT` env
  - Any other envs used by `backend/.env` or `ENV_STAGING`

Frontend service (Render)
- Option A: Static Site
  - Root directory: `frontend`
  - Build command: `npm install && npm run build`
  - Publish directory: `dist`
  - Set environment variable `VITE_API_URL` to your backend public URL (e.g. `https://project-backend.onrender.com/api`)
- Option B: Web Service (if you need server-side prerendering)
  - Use a Node service and serve the static output with a simple server

MongoDB Atlas (free)
- Create a free cluster and a database user with a strong password.
- Whitelist Render IPs (Render docs show recommended settings) or allow access from anywhere (0.0.0.0/0) temporarily.
- Get the connection string and set `MONGODB_URI` in Render Backend environment.

CI / GitHub Actions notes
- Keep `deploy-staging.yml` as a separate SSH-based deployment if you still use your own server.
- For Render automatic deploys, connect Render to your GitHub repo and set the branch to `staging` or `main`.
- Do NOT store any secrets in the repo. Use GitHub Secrets or Render environment settings.

Checklist before deploying
- Rotate any exposed secrets (SSH keys, DB passwords, API tokens).
- Ensure `paths-to-remove.txt` removed sensitive files and you scrubbed history (if you choose to).
- Confirm `frontend/src/config/runtimeUrls.js` uses `VITE_API_URL` (added).
- Add Render service environment variables and test.

Commands you can run locally to test build
```bash
# Backend
cd backend && npm install && npm run start

# Frontend dev
cd frontend && npm install && npm run dev

# Frontend build
cd frontend && npm install && npm run build
```

If you want, I can create Render-ready `render.yaml` manifests or a root-level `Procfile` and small start scripts. Tell me which services (frontend static or web; backend web) you prefer and I will generate the files.
