# NGcourses

Plataforma de cursos en línea con panel de administración, instructor y vista de estudiante.

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 16 (App Router), React 19, TypeScript |
| Estilos | CSS Modules + variables CSS personalizadas |
| Backend | FastAPI (Python 3.10+), SQLModel, Alembic |
| Base de datos | PostgreSQL 17 |
| Video CDN | Bunny.net (Stream) |
| Contenedor | Docker Compose |

## Estructura del repositorio

```
NGcourses/
├── backend/           # API FastAPI
│   ├── app/
│   │   ├── api/       # Rutas y dependencias
│   │   ├── core/      # Configuración, seguridad, BD
│   │   ├── models/    # Modelos SQLModel / Pydantic
│   │   ├── services/  # Integraciones externas (Bunny.net)
│   │   └── crud.py    # Operaciones de base de datos
│   └── tests/         # Tests de integración (pytest)
├── frontend/          # Aplicación Next.js
│   └── src/
│       ├── app/       # Páginas (App Router)
│       │   ├── admin/       # Panel administrador
│       │   ├── instructor/  # Panel instructor
│       │   └── curso/       # Vista estudiante
│       ├── components/      # Componentes reutilizables
│       ├── lib/             # Clientes API, utilidades
│       └── types/           # Tipos TypeScript
├── .env.example       # Plantilla de variables de entorno
└── docker-compose.yml # Orquestación de servicios
```

## Roles de usuario

```
Admin > Supervisor > Instructor > Estudiante
```

## Configuración inicial

1. Copiar la plantilla de variables de entorno:
   ```bash
   cp .env.example .env
   ```

2. Editar `.env` con los valores reales (ver cada sección del archivo).

3. Levantar los servicios con Docker Compose:
   ```bash
   docker compose up -d
   ```

4. El backend queda disponible en `http://localhost:8000`
   La documentación de la API en `http://localhost:8000/api/v1/docs`

## Desarrollo local (sin Docker)

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
alembic upgrade head
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
# Crear frontend/.env.local con NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

## Ejecutar tests (backend)

```bash
cd backend
pytest tests/ -v
```

## Variables de entorno requeridas

Ver `.env.example` para la lista completa. Las más críticas:

| Variable | Descripción |
|----------|-------------|
| `SECRET_KEY` | Clave JWT — debe ser aleatoria en producción |
| `POSTGRES_PASSWORD` | Contraseña de la base de datos |
| `BUNNY_API_KEY` | Llave de la API de Bunny.net |
| `BUNNY_WEBHOOK_SECRET` | Secret para validar webhooks de Bunny (recomendado) |

## Deuda tecnica conocida

- JWT almacenado en `localStorage` — migrar a `HttpOnly` cookies (requiere cambio backend)
- Autenticación del frontend no está integrada con guardias de ruta
- Rate limiting en endpoints de autenticación pendiente

## Calidad de codigo

El proyecto sigue la norma **ISO/IEC 25010** para calidad del producto software.

- Backend: `ruff` (linting), `mypy --strict` (tipos)
- Frontend: ESLint con `eslint-config-next`, TypeScript `strict: true`
- Tests: pytest con cobertura en backend
