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
