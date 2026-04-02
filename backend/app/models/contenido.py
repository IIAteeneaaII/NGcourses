import uuid
from datetime import datetime

from sqlalchemy import Column, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, Relationship, SQLModel

from app.models._enums import EstadoCurso, TipoLeccion, TipoRecurso


# ── Categorias ──────────────────────────────────────────────────────────────


class Categoria(SQLModel, table=True):
    __tablename__ = "categorias"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    nombre: str = Field(max_length=255)
    slug: str = Field(max_length=255, unique=True, index=True)
    descripcion: str | None = Field(default=None)
    orden: int = Field(default=0)
    activa: bool = Field(default=True)
    creado_en: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    cursos: list["Curso"] = Relationship(back_populates="categoria")


# ── Etiquetas ───────────────────────────────────────────────────────────────


class Etiqueta(SQLModel, table=True):
    __tablename__ = "etiquetas"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    nombre: str = Field(max_length=255)
    slug: str = Field(max_length=255, unique=True, index=True)
    creado_en: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    curso_etiquetas: list["CursoEtiqueta"] = Relationship(back_populates="etiqueta")


# ── Curso-Etiqueta (junction) ──────────────────────────────────────────────


class CursoEtiqueta(SQLModel, table=True):
    __tablename__ = "curso_etiquetas"
    __table_args__ = (UniqueConstraint("curso_id", "etiqueta_id"),)

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    curso_id: uuid.UUID = Field(foreign_key="cursos.id", nullable=False)
    etiqueta_id: uuid.UUID = Field(foreign_key="etiquetas.id", nullable=False)
    creado_en: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    curso: "Curso" = Relationship(back_populates="curso_etiquetas")
    etiqueta: Etiqueta = Relationship(back_populates="curso_etiquetas")


# ── Cursos ──────────────────────────────────────────────────────────────────


class Curso(SQLModel, table=True):
    __tablename__ = "cursos"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    categoria_id: uuid.UUID | None = Field(default=None, foreign_key="categorias.id", nullable=True)
    instructor_id: uuid.UUID = Field(foreign_key="user.id", nullable=False)
    titulo: str = Field(max_length=255)
    slug: str = Field(max_length=255, unique=True, index=True)
    descripcion: str | None = Field(default=None)
    estado: EstadoCurso = Field(default=EstadoCurso.BORRADOR)
    duracion_seg: int = Field(default=0)
    calificacion_prom: float = Field(default=0.0)
    total_resenas: int = Field(default=0)
    es_gratis: bool = Field(default=False)
    portada_url: str | None = Field(default=None, max_length=500)
    bunny_library_id: str | None = Field(default=None, max_length=50)
    bunny_collection_id: str | None = Field(default=None, max_length=100)
    metadata_: dict | None = Field(default=None, sa_column=Column("metadata", JSONB))
    publicado_en: datetime | None = Field(default=None)
    creado_en: datetime = Field(default_factory=datetime.utcnow)
    actualizado_en: datetime | None = Field(default=None)

    # Relationships
    categoria: Categoria = Relationship(back_populates="cursos")
    instructor: "User" = Relationship(back_populates="cursos_instructor")  # noqa: F821
    modulos: list["Modulo"] = Relationship(back_populates="curso", cascade_delete=True)
    curso_etiquetas: list[CursoEtiqueta] = Relationship(back_populates="curso")
    inscripciones: list["Inscripcion"] = Relationship(back_populates="curso")  # noqa: F821
    calificaciones: list["Calificacion"] = Relationship(back_populates="curso")  # noqa: F821
    licencias: list["LicenciaCurso"] = Relationship(back_populates="curso")  # noqa: F821


# ── Modulos ─────────────────────────────────────────────────────────────────


class Modulo(SQLModel, table=True):
    __tablename__ = "modulos"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    curso_id: uuid.UUID = Field(foreign_key="cursos.id", nullable=False, ondelete="CASCADE")
    titulo: str = Field(max_length=255)
    descripcion: str | None = Field(default=None)
    orden: int = Field(default=0)
    creado_en: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    curso: Curso = Relationship(back_populates="modulos")
    lecciones: list["Leccion"] = Relationship(back_populates="modulo", cascade_delete=True)


# ── Lecciones ───────────────────────────────────────────────────────────────


class Leccion(SQLModel, table=True):
    __tablename__ = "lecciones"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    modulo_id: uuid.UUID = Field(foreign_key="modulos.id", nullable=False, ondelete="CASCADE")
    titulo: str = Field(max_length=255)
    tipo: TipoLeccion = Field(default=TipoLeccion.VIDEO)
    orden: int = Field(default=0)
    duracion_seg: int = Field(default=0)
    umbral_completado_pct: int = Field(default=90)
    bunny_video_id: str | None = Field(default=None, max_length=255)
    hls_url: str | None = Field(default=None)
    thumbnail_url: str | None = Field(default=None)
    contenido: str | None = Field(default=None)  # JSON string con QuizData para lecciones tipo quiz
    metadata_: dict | None = Field(default=None, sa_column=Column("metadata", JSONB))
    creado_en: datetime = Field(default_factory=datetime.utcnow)
    actualizado_en: datetime | None = Field(default=None)

    # Relationships
    modulo: Modulo = Relationship(back_populates="lecciones")
    recursos: list["RecursoLeccion"] = Relationship(back_populates="leccion", cascade_delete=True)
    progreso: list["ProgresoLeccion"] = Relationship(back_populates="leccion")  # noqa: F821
    eventos_analytics: list["EventoAnalytics"] = Relationship(back_populates="leccion")  # noqa: F821


# ── Recursos de Leccion ────────────────────────────────────────────────────


class RecursoLeccion(SQLModel, table=True):
    __tablename__ = "recursos_leccion"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    leccion_id: uuid.UUID = Field(foreign_key="lecciones.id", nullable=False, ondelete="CASCADE")
    tipo: TipoRecurso = Field(default=TipoRecurso.PDF)
    titulo: str = Field(max_length=255)
    url: str
    metadata_: dict | None = Field(default=None, sa_column=Column("metadata", JSONB))
    creado_en: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    leccion: Leccion = Relationship(back_populates="recursos")


# ── Schemas (Pydantic) ────────────────────────────────────────────────────────

# -- Categoría --

class CategoriaPublic(SQLModel):
    id: uuid.UUID
    nombre: str
    slug: str
    descripcion: str | None = None
    orden: int
    activa: bool
    creado_en: datetime


class CategoriaCreate(SQLModel):
    nombre: str
    slug: str | None = None  # auto-generado desde nombre si no se provee
    descripcion: str | None = None
    orden: int = 0
    activa: bool = True


class CategoriaUpdate(SQLModel):
    nombre: str | None = None
    slug: str | None = None
    descripcion: str | None = None
    orden: int | None = None
    activa: bool | None = None


# -- Etiqueta --

class EtiquetaPublic(SQLModel):
    id: uuid.UUID
    nombre: str
    slug: str
    creado_en: datetime


class EtiquetaCreate(SQLModel):
    nombre: str
    slug: str


class EtiquetaUpdate(SQLModel):
    nombre: str | None = None
    slug: str | None = None


# -- Recurso de Lección --

class RecursoLeccionPublic(SQLModel):
    id: uuid.UUID
    tipo: TipoRecurso
    titulo: str
    url: str
    creado_en: datetime


class RecursoLeccionCreate(SQLModel):
    tipo: TipoRecurso = TipoRecurso.PDF
    titulo: str
    url: str


# -- Lección --

class LeccionPublic(SQLModel):
    id: uuid.UUID
    modulo_id: uuid.UUID
    titulo: str
    tipo: TipoLeccion
    orden: int
    duracion_seg: int
    umbral_completado_pct: int
    bunny_video_id: str | None = None
    hls_url: str | None = None
    thumbnail_url: str | None = None
    contenido: str | None = None
    creado_en: datetime
    actualizado_en: datetime | None = None
    recursos: list[RecursoLeccionPublic] = []


class LeccionCreate(SQLModel):
    titulo: str
    tipo: TipoLeccion = TipoLeccion.VIDEO
    orden: int = 0
    duracion_seg: int = 0
    umbral_completado_pct: int = 90
    bunny_video_id: str | None = None
    hls_url: str | None = None
    thumbnail_url: str | None = None


class LeccionUpdate(SQLModel):
    titulo: str | None = None
    tipo: TipoLeccion | None = None
    orden: int | None = None
    duracion_seg: int | None = None
    umbral_completado_pct: int | None = None
    bunny_video_id: str | None = None
    hls_url: str | None = None
    thumbnail_url: str | None = None
    contenido: str | None = None  # JSON string con QuizData


# -- Módulo --

class ModuloPublic(SQLModel):
    id: uuid.UUID
    curso_id: uuid.UUID
    titulo: str
    descripcion: str | None = None
    orden: int
    creado_en: datetime
    lecciones: list[LeccionPublic] = []


class ModuloCreate(SQLModel):
    titulo: str
    descripcion: str | None = None
    orden: int = 0


class ModuloUpdate(SQLModel):
    titulo: str | None = None
    descripcion: str | None = None
    orden: int | None = None


# -- Curso --

class CursoPublic(SQLModel):
    id: uuid.UUID
    instructor_id: uuid.UUID
    categoria_id: uuid.UUID | None = None
    titulo: str
    slug: str
    descripcion: str | None = None
    estado: EstadoCurso
    duracion_seg: int
    calificacion_prom: float
    total_resenas: int
    es_gratis: bool
    portada_url: str | None = None
    bunny_library_id: str | None = None
    bunny_collection_id: str | None = None
    publicado_en: datetime | None = None
    creado_en: datetime
    actualizado_en: datetime | None = None
    nivel: str | None = None
    lo_que_aprenderas: list[str] = []
    requisitos: str | None = None


class CursoDetalle(CursoPublic):
    modulos: list[ModuloPublic] = []
    instructor_nombre: str | None = None


class CursosPublic(SQLModel):
    data: list[CursoPublic]
    count: int


class CursoCreate(SQLModel):
    titulo: str
    slug: str
    categoria_id: uuid.UUID | None = None
    descripcion: str | None = None
    estado: EstadoCurso = EstadoCurso.BORRADOR
    es_gratis: bool = False
    bunny_library_id: str | None = None
    nivel: str | None = None
    lo_que_aprenderas: list[str] = []
    requisitos: str | None = None


class CursoUpdate(SQLModel):
    titulo: str | None = None
    slug: str | None = None
    categoria_id: uuid.UUID | None = None
    descripcion: str | None = None
    estado: EstadoCurso | None = None
    es_gratis: bool | None = None
    portada_url: str | None = None
    bunny_library_id: str | None = None
    nivel: str | None = None
    lo_que_aprenderas: list[str] | None = None
    requisitos: str | None = None


# -- Bunny.net Video Upload --

class BunnyVideoInitResponse(SQLModel):
    """Respuesta al iniciar un upload de video a Bunny.net."""
    bunny_video_id: str
    tus_upload_url: str
    tus_headers: dict[str, str]
    embed_url: str


class BunnyVideoStatusResponse(SQLModel):
    """Estado de encoding del video en Bunny.net."""
    bunny_video_id: str
    status: str  # queued, processing, encoding, finished, failed
    is_ready: bool
    hls_url: str | None = None
    thumbnail_url: str | None = None
    embed_url: str | None = None
