# TeamPilot — README

## Deployment — Staging

This project includes a helper script and a GitHub Actions workflow to deploy a staging stack with Traefik and Let's Encrypt.

Quick links
- File: [.env.staging](.env.staging)
- Script: [deploy-staging.sh](deploy-staging.sh)
- Workflow: [.github/workflows/deploy-staging.yml](.github/workflows/deploy-staging.yml)

Prerequisites (server)
- A Linux host (Ubuntu recommended) with Docker and Docker Compose installed.
- DNS A records for your FRONTEND_DOMAIN and BACKEND_DOMAIN pointing to the server IP.
- Ports 80 and 443 open to the public for ACME http-01 challenge and HTTPS traffic.

Local prerequisites (optional)
- Docker Desktop installed for local validation.

GitHub Actions deployment — required secrets
- `SSH_PRIVATE_KEY`: SSH private key (PEM) for the deploy user (no passphrase recommended). Example: the contents of `~/.ssh/id_rsa` (keep private).
- `SSH_HOST`: Server hostname or IP (e.g., `203.0.113.12`).
- `SSH_USER`: SSH username (e.g., `deploy`).
- `SSH_PORT`: SSH port (usually `22`).
- `DEPLOY_PATH`: Absolute path on server where repo should be deployed (e.g., `/home/deploy/projectmanagement`).
- `ENV_STAGING` (optional): the full text of `.env.staging` if you want the workflow to write the file on the server. If omitted, ensure `.env.staging` is present on the server before deploying.

ENV_STAGING example (the entire file contents; store as a single secret)

```text
# FRONTEND and BACKEND domains
FRONTEND_DOMAIN=staging.example.com
BACKEND_DOMAIN=api.staging.example.com

# Traefik / Let's Encrypt email
TRAEFIK_LETSENCRYPT_EMAIL=ops@example.com

# Database URI (optional)
MONGODB_URI=mongodb://mongo:27017/project_management
```

How to add the secrets
1. Go to your repository on GitHub → Settings → Secrets and variables → Actions.
2. Add a new repository secret for each of the names above.
3. For `ENV_STAGING` paste the entire `.env.staging` file contents.

One-shot deploy script (server)
On the server you can run:

```bash
chmod +x deploy-staging.sh
./deploy-staging.sh
```

What the script does
- Validates `docker-compose.staging.yml` with `docker compose config`.
- Ensures `traefik/acme.json` exists and is `chmod 600`.
- Pulls images, builds, and starts services with `docker compose up --build -d`.
- Performs quick curl checks against your configured domains.

Manual server deploy steps (if not using Actions)
1. SSH to server.
2. Clone repo into `DEPLOY_PATH` and edit `.env.staging`.
3. Create `traefik/acme.json` and `chmod 600` it.
4. Run `./deploy-staging.sh`.

Troubleshooting
- If Traefik fails to obtain certificates, check `docker compose logs -f traefik` and ensure port 80 is reachable by Let's Encrypt.
- If services fail to start, inspect `docker compose logs -f` for the service name.

Security notes
- Do NOT store private keys or unencrypted secrets in version control.
- Use repository secrets or a secret manager for production.
- `ENV_STAGING` is optional; prefer managing secrets externally when possible.

Contact
- If you want me to run the first deploy or create the GitHub secrets file for you, tell me which server to use and provide the required secrets (prefer using GitHub secrets UI or a secure channel).