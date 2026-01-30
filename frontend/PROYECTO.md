# NGcourses - Frontend Next.js

Plataforma de cursos online con integración de Bunny.net para streaming de videos.

## Stack Tecnológico

- **Next.js 15** - Framework React con App Router
- **TypeScript** - Tipado estático
- **TailwindCSS** - Estilos
- **Bunny.net** - Streaming de videos
- **FastAPI** - Backend (http://localhost:8000)

## Estructura del Proyecto

```
frontend/
├── src/
│   ├── app/                    # App Router de Next.js
│   │   └── curso-videos/       # Página de videos del curso
│   ├── components/
│   │   ├── video/              # Componentes de video
│   │   │   └── VideoPlayer.tsx # Reproductor Bunny.net
│   │   └── course/             # Componentes del curso
│   │       ├── LessonsSidebar.tsx
│   │       └── VideoControls.tsx
│   ├── lib/
│   │   └── api/                # Cliente API
│   │       └── client.ts       # Configuración FastAPI
│   ├── types/                  # Tipos TypeScript
│   │   └── course.ts
│   └── hooks/                  # Custom hooks
└── .env.local                  # Variables de entorno
```

## Variables de Entorno

Archivo `.env.local`:

```env
# FastAPI Backend
NEXT_PUBLIC_API_URL=http://localhost:8000

# Bunny.net Video Configuration
NEXT_PUBLIC_BUNNY_LIBRARY_ID=583601
NEXT_PUBLIC_BUNNY_VIDEO_ID=2694e857-a403-4f27-8b00-32b9ba4049c3

# Bunny.net API Keys (Server-side only)
BUNNY_API_KEY=f8370c09-4192-4941-bcde72f3c50e-ad1d-4367
BUNNY_TOKEN_KEY=5e74ac0b-bb86-45c1-945b-e6f18ba8ebf5
```

## Instalación

### Opción 1: Desde la raíz del proyecto (Recomendado)

```bash
npm install
npm run dev
```

### Opción 2: Desde la carpeta frontend

```bash
cd frontend
npm install
npm run dev
```

## Páginas

- `/curso-videos?id=1` - Página de videos del curso
