# Deploy a AWS EC2 (nextgenia.lat)

Despliegue de la EC2 **propia** (cuenta `582367504828`), build **en el servidor** (sin ECR).
Cada `push` a `main` que toque `frontend/`, `backend/` o los compose dispara
[.github/workflows/deploy.yml](../.github/workflows/deploy.yml), que:

1. Empaqueta el commit (`git archive`) y lo copia por SSH a la EC2.
2. Lo extrae en `~/NGcourses` (preserva `.env.prod`, que no está en git).
3. Hace `docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build`.

Las migraciones Alembic corren solas dentro del servicio `prestart` del compose
(el `backend` depende de que termine correctamente), así que no se orquestan desde el workflow.

## Arquitectura

- **Traefik** (reverse proxy + Let's Encrypt) en `docker-compose.traefik.yml`, red externa
  `traefik-public`. Rutea por subdominio: `app.${DOMAIN}` → frontend, `api.${DOMAIN}` → backend,
  `traefik.${DOMAIN}` → dashboard.
- **App** en `docker-compose.prod.yml`: `frontend` (Next.js, build local), `backend` (FastAPI),
  `db` (PostgreSQL local, volumen `app-db-data`), `prestart` (migraciones).
- El frontend usa un **proxy BFF** (`/api/*` → `BACKEND_URL` server-side), por eso el navegador
  solo habla con `app.${DOMAIN}` (sin CORS).

## Setup inicial (una sola vez en una EC2 nueva)

1. Instalar Docker, crear swap, clonar el repo en `~/NGcourses`.
2. `docker network create traefik-public`.
3. Crear `~/NGcourses/.env.prod` (ver `.env.prod.example`) con los valores reales.
4. Levantar Traefik: `docker compose -f docker-compose.traefik.yml --env-file .env.prod up -d`.
5. Primer arranque de la app: `docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build`.

## GitHub Secrets requeridos

En `Settings → Secrets and variables → Actions` (requiere rol **Admin** del repo):

| Secret | Valor |
| --- | --- |
| `EC2_HOST` | IP/EIP pública de la EC2 |
| `EC2_USER` | usuario SSH (`ubuntu` en Ubuntu) |
| `EC2_SSH_KEY` | contenido completo del `.pem` (incluye `-----BEGIN/END-----`) |

## DNS (Namecheap / proveedor del dominio)

Registros **A** apuntando a la EIP de la EC2:

- `app` → EIP  (**requerido**, único punto de entrada de la app)
- `api` → EIP  (recomendado: webhooks Bunny/PayPal y acceso directo al API)
- `traefik` → EIP  (opcional: dashboard)

Si se usa Cloudflare, los registros deben ir en **"DNS only"** (sin proxy) para que funcione
el challenge TLS de Let's Encrypt. Tras propagar el DNS, Traefik emite los certificados solo.

## Verificación post-deploy

```bash
ssh -i <key.pem> <user>@<EIP> 'cd ~/NGcourses && docker compose -f docker-compose.prod.yml --env-file .env.prod ps'
# health del backend (dentro del contenedor; no expone puerto al host):
ssh -i <key.pem> <user>@<EIP> 'docker exec ngcourses-backend-1 curl -s http://localhost:8000/api/v1/utils/health-check/'
```

## Rollback

El build es del código del commit desplegado. Para volver atrás: hacer `git revert`/checkout del
commit estable en `main` (re-dispara el deploy) o, en el server, `git`-extraer una versión previa
y re-`up -d --build`.

## Pausar el auto-deploy

- **Temporal**: `Actions → Deploy to EC2 → ··· → Disable workflow`.
- **Permanente**: borrar `.github/workflows/deploy.yml`.

> Nota: `scripts/deploy-frontend.sh` y el flujo basado en ECR quedaron **obsoletos** (eran de la
> infra del ex-empleado). No usar.
