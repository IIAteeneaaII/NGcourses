"""
Endpoints de progreso de lecciones y generación automática de certificados.
"""
import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException
from sqlmodel import SQLModel, select

from app import crud
from app.api.deps import CurrentUser, SessionDep
from app.models.contenido import Leccion, Modulo
from app.models.inscripcion import ProgresoLeccion

router = APIRouter(prefix="/progreso", tags=["progreso"])


# ── Schemas ────────────────────────────────────────────────────────────────────

class ProgresoUpdate(SQLModel):
    inscripcion_id: uuid.UUID
    leccion_id: uuid.UUID
    visto_seg: int
    progreso_pct: int  # 0-100


class ProgresoPublic(SQLModel):
    id: uuid.UUID
    inscripcion_id: uuid.UUID
    leccion_id: uuid.UUID
    visto_seg: int
    progreso_pct: int
    completado: bool
    completado_en: datetime | None = None
    actualizado_en: datetime | None = None


class CursoProgresoResponse(SQLModel):
    inscripcion_id: uuid.UUID
    curso_id: uuid.UUID
    total_lecciones: int
    lecciones_completadas: int
    progreso_pct: float
    progreso_por_leccion: list[ProgresoPublic]
    certificado_generado: bool


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/", response_model=ProgresoPublic)
def registrar_progreso(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    progreso_in: ProgresoUpdate,
) -> Any:
    """
    Registra o actualiza el progreso del usuario en una lección.
    Si el progreso supera el umbral de completado, marca la lección.
    Si todas las lecciones están completas, genera el certificado automáticamente.
    """
    # Verificar que la inscripción pertenece al usuario
    inscripcion = crud.get_inscripcion(session=session, inscripcion_id=progreso_in.inscripcion_id)
    if not inscripcion:
        raise HTTPException(status_code=404, detail="Inscripción no encontrada")
    if inscripcion.usuario_id != current_user.id:
        raise HTTPException(status_code=403, detail="Sin acceso a esta inscripción")

    # Obtener umbral de la lección
    db_leccion = session.get(Leccion, progreso_in.leccion_id)
    if not db_leccion:
        raise HTTPException(status_code=404, detail="Lección no encontrada")

    # Upsert progreso
    db_prog = crud.upsert_progreso(
        session=session,
        inscripcion_id=progreso_in.inscripcion_id,
        leccion_id=progreso_in.leccion_id,
        visto_seg=progreso_in.visto_seg,
        progreso_pct=progreso_in.progreso_pct,
        umbral_completado_pct=db_leccion.umbral_completado_pct,
    )

    # Actualizar último acceso
    crud.update_ultimo_acceso(session=session, inscripcion=inscripcion)

    # Intentar generar certificado si todo está completo
    crud.check_and_emit_certificate(session=session, inscripcion_id=progreso_in.inscripcion_id)

    return ProgresoPublic.model_validate(db_prog, from_attributes=True)


@router.get("/curso/{curso_id}", response_model=CursoProgresoResponse)
def progreso_curso(
    curso_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Obtiene el progreso completo del usuario actual en un curso.
    Requiere que el usuario esté inscrito.
    """
    inscripcion = crud.get_inscripcion_by_usuario_curso(
        session=session, usuario_id=current_user.id, curso_id=curso_id
    )
    if not inscripcion:
        raise HTTPException(status_code=404, detail="No estás inscrito en este curso")

    # Obtener todas las lecciones del curso
    stmt = (
        select(Leccion)
        .join(Modulo, Leccion.modulo_id == Modulo.id)
        .where(Modulo.curso_id == curso_id)
    )
    todas_lecciones = list(session.exec(stmt).all())
    total = len(todas_lecciones)

    # Obtener progreso del usuario en esta inscripción
    progreso_list = crud.get_progreso_curso(session=session, inscripcion_id=inscripcion.id)
    completadas = sum(1 for p in progreso_list if p.completado)

    pct = round((completadas / total) * 100, 1) if total > 0 else 0.0

    # ¿Hay certificado?
    from app.models.inscripcion import Certificado
    certificado = session.exec(
        select(Certificado).where(Certificado.inscripcion_id == inscripcion.id)
    ).first()

    return CursoProgresoResponse(
        inscripcion_id=inscripcion.id,
        curso_id=curso_id,
        total_lecciones=total,
        lecciones_completadas=completadas,
        progreso_pct=pct,
        progreso_por_leccion=[ProgresoPublic.model_validate(p, from_attributes=True) for p in progreso_list],
        certificado_generado=certificado is not None,
    )
