"""
Endpoints para el sistema de quiz:
- POST /quiz/lecciones/{leccion_id}/enviar  → el alumno envía sus respuestas
- GET  /quiz/lecciones/{leccion_id}/ultimo-intento → último intento del alumno
- GET  /quiz/cursos/{curso_id}/resultados  → instructor/admin: todos los intentos
"""
import json
import uuid
from typing import Any

from fastapi import APIRouter, HTTPException

from app import crud
from app.api.deps import CurrentUser, SessionDep
from app.models._enums import RolUsuario, TipoLeccion
from app.models.contenido import Leccion, Modulo
from app.models.quiz import (
    QuizEnviarIn,
    QuizIntentoPublic,
    QuizResultadoAlumno,
    QuizRespuesta,
    RespuestaPublic,
)

router = APIRouter(prefix="/quiz", tags=["quiz"])


def _require_instructor_or_admin(current_user: CurrentUser) -> None:
    allowed = {RolUsuario.INSTRUCTOR, RolUsuario.ADMINISTRADOR, RolUsuario.USUARIO_CONTROL}
    if not current_user.is_superuser and current_user.rol not in allowed:
        raise HTTPException(status_code=403, detail="Se requiere rol de instructor o administrador")


@router.post("/lecciones/{leccion_id}/enviar", response_model=QuizIntentoPublic)
def enviar_quiz(
    *,
    leccion_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
    quiz_in: QuizEnviarIn,
) -> Any:
    """
    El alumno envía sus respuestas para un quiz.
    - Verifica que la lección sea tipo 'quiz' y tenga preguntas.
    - Califica: aprobado = TODAS las preguntas correctas.
    - Si aprobado: registra progreso 100% → puede generar certificado.
    - Retorna resultado con qué preguntas acertó/falló (sin revelar correctas).
    """
    # Verificar que la lección existe y es tipo quiz
    db_leccion = session.get(Leccion, leccion_id)
    if not db_leccion:
        raise HTTPException(status_code=404, detail="Lección no encontrada")
    if db_leccion.tipo != TipoLeccion.QUIZ:
        raise HTTPException(status_code=400, detail="Esta lección no es un quiz")
    if not db_leccion.contenido:
        raise HTTPException(status_code=400, detail="El quiz no tiene preguntas configuradas")

    try:
        quiz_data = json.loads(db_leccion.contenido)
    except (json.JSONDecodeError, TypeError):
        raise HTTPException(status_code=500, detail="Datos del quiz inválidos")

    preguntas = quiz_data.get("preguntas", [])
    if not preguntas:
        raise HTTPException(status_code=400, detail="El quiz no tiene preguntas")

    # Verificar que la inscripción pertenece al usuario actual
    inscripcion = crud.get_inscripcion(session=session, inscripcion_id=quiz_in.inscripcion_id)
    if not inscripcion:
        raise HTTPException(status_code=404, detail="Inscripción no encontrada")
    if inscripcion.usuario_id != current_user.id:
        raise HTTPException(status_code=403, detail="Sin acceso a esta inscripción")

    # Crear y calificar el intento
    respuestas_in = [{"pregunta_id": r.pregunta_id, "opcion_id": r.opcion_id} for r in quiz_in.respuestas]
    intento = crud.crear_intento_quiz(
        session=session,
        inscripcion_id=quiz_in.inscripcion_id,
        leccion_id=leccion_id,
        respuestas_in=respuestas_in,
        quiz_data=quiz_data,
    )

    # Si aprobó: registrar progreso completado
    if intento.aprobado:
        crud.upsert_progreso(
            session=session,
            inscripcion_id=quiz_in.inscripcion_id,
            leccion_id=leccion_id,
            visto_seg=0,
            progreso_pct=100,
            umbral_completado_pct=db_leccion.umbral_completado_pct,
        )
        crud.update_ultimo_acceso(session=session, inscripcion=inscripcion)
        crud.check_and_emit_certificate(session=session, inscripcion_id=quiz_in.inscripcion_id)

    # Construir respuesta (sin revelar cuál era la correcta)
    from sqlmodel import select as sql_select
    respuestas_db = list(session.exec(
        sql_select(QuizRespuesta).where(QuizRespuesta.intento_id == intento.id)
    ).all())

    return QuizIntentoPublic(
        id=intento.id,
        leccion_id=intento.leccion_id,
        aprobado=intento.aprobado,
        total_preguntas=intento.total_preguntas,
        correctas=intento.correctas,
        creado_en=intento.creado_en,
        respuestas=[
            RespuestaPublic(
                pregunta_id=r.pregunta_id,
                opcion_id_seleccionada=r.opcion_id,
                es_correcta=r.es_correcta,
            )
            for r in respuestas_db
        ],
    )


@router.get("/lecciones/{leccion_id}/ultimo-intento", response_model=QuizIntentoPublic | None)
def ultimo_intento(
    *,
    leccion_id: uuid.UUID,
    inscripcion_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Devuelve el último intento del alumno en esta lección (o null si no hay).
    Requiere ?inscripcion_id=<uuid> como query param.
    """
    inscripcion = crud.get_inscripcion(session=session, inscripcion_id=inscripcion_id)
    if not inscripcion:
        raise HTTPException(status_code=404, detail="Inscripción no encontrada")
    if inscripcion.usuario_id != current_user.id:
        raise HTTPException(status_code=403, detail="Sin acceso")

    intento = crud.get_ultimo_intento(
        session=session,
        inscripcion_id=inscripcion_id,
        leccion_id=leccion_id,
    )
    if not intento:
        return None

    from sqlmodel import select as sql_select
    respuestas_db = list(session.exec(
        sql_select(QuizRespuesta).where(QuizRespuesta.intento_id == intento.id)
    ).all())

    return QuizIntentoPublic(
        id=intento.id,
        leccion_id=intento.leccion_id,
        aprobado=intento.aprobado,
        total_preguntas=intento.total_preguntas,
        correctas=intento.correctas,
        creado_en=intento.creado_en,
        respuestas=[
            RespuestaPublic(
                pregunta_id=r.pregunta_id,
                opcion_id_seleccionada=r.opcion_id,
                es_correcta=r.es_correcta,
            )
            for r in respuestas_db
        ],
    )


@router.get("/cursos/{curso_id}/resultados", response_model=list[QuizResultadoAlumno])
def resultados_curso(
    *,
    curso_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Instructor/admin: todos los intentos de quiz en un curso.
    Solo muestra el último intento por alumno+lección.
    """
    _require_instructor_or_admin(current_user)

    # Si es instructor, verificar que el curso le pertenece
    if current_user.rol == RolUsuario.INSTRUCTOR and not current_user.is_superuser:
        from sqlmodel import select as sql_select
        from app.models.contenido import Curso
        db_curso = session.exec(sql_select(Curso).where(Curso.id == curso_id)).first()
        if not db_curso:
            raise HTTPException(status_code=404, detail="Curso no encontrado")
        if db_curso.instructor_id != current_user.id:
            raise HTTPException(status_code=403, detail="Sin acceso a este curso")

    rows = crud.get_intentos_curso(session=session, curso_id=curso_id)

    # Deduplicar: solo último intento por (usuario, leccion)
    seen: set[tuple] = set()
    resultado: list[QuizResultadoAlumno] = []
    for intento, user, leccion in rows:
        key = (user.id, leccion.id)
        if key in seen:
            continue
        seen.add(key)
        resultado.append(
            QuizResultadoAlumno(
                intento_id=intento.id,
                usuario_id=user.id,
                usuario_nombre=user.full_name or user.email,
                usuario_email=user.email,
                leccion_id=leccion.id,
                leccion_titulo=leccion.titulo,
                aprobado=intento.aprobado,
                total_preguntas=intento.total_preguntas,
                correctas=intento.correctas,
                creado_en=intento.creado_en,
            )
        )
    return resultado
