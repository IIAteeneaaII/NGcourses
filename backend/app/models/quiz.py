"""
Modelos para el sistema de quiz: intentos y respuestas de alumnos.
Las preguntas/opciones se leen del campo `contenido` (JSON) de la Leccion.
"""
import uuid
from datetime import datetime

from sqlmodel import Field, Relationship, SQLModel


class QuizIntento(SQLModel, table=True):
    """Un intento del alumno en un quiz (lección tipo 'quiz')."""
    __tablename__ = "quiz_intentos"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    inscripcion_id: uuid.UUID = Field(foreign_key="inscripciones.id", nullable=False, ondelete="CASCADE")
    leccion_id: uuid.UUID = Field(foreign_key="lecciones.id", nullable=False)
    aprobado: bool = Field(default=False)
    total_preguntas: int = Field(default=0)
    correctas: int = Field(default=0)
    creado_en: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    respuestas: list["QuizRespuesta"] = Relationship(back_populates="intento", cascade_delete=True)


class QuizRespuesta(SQLModel, table=True):
    """Respuesta del alumno a una pregunta dentro de un intento."""
    __tablename__ = "quiz_respuestas"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    intento_id: uuid.UUID = Field(foreign_key="quiz_intentos.id", nullable=False, ondelete="CASCADE")
    pregunta_id: str = Field(max_length=100)   # UUID local del JSON de preguntas
    opcion_id: str = Field(max_length=100)     # UUID local de la opción seleccionada
    es_correcta: bool = Field(default=False)

    # Relationships
    intento: QuizIntento = Relationship(back_populates="respuestas")


# ── Schemas (Pydantic) ────────────────────────────────────────────────────────

class RespuestaIn(SQLModel):
    """Una respuesta individual enviada por el alumno."""
    pregunta_id: str
    opcion_id: str


class QuizEnviarIn(SQLModel):
    """Payload para enviar un quiz completo."""
    inscripcion_id: uuid.UUID
    respuestas: list[RespuestaIn]


class RespuestaPublic(SQLModel):
    """Resultado de una respuesta individual — sin revelar cuál era la correcta."""
    pregunta_id: str
    opcion_id_seleccionada: str
    es_correcta: bool


class QuizIntentoPublic(SQLModel):
    """Resultado de un intento de quiz."""
    id: uuid.UUID
    leccion_id: uuid.UUID
    aprobado: bool
    total_preguntas: int
    correctas: int
    creado_en: datetime
    respuestas: list[RespuestaPublic] = []


class QuizResultadoAlumno(SQLModel):
    """Resultado de quiz de un alumno — para vistas de instructor/admin."""
    intento_id: uuid.UUID
    usuario_id: uuid.UUID
    usuario_nombre: str
    usuario_email: str
    leccion_id: uuid.UUID
    leccion_titulo: str
    aprobado: bool
    total_preguntas: int
    correctas: int
    creado_en: datetime
