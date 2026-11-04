"""Estadísticas del panel de administración (solo admin/superusuario)."""
import uuid
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter
from sqlmodel import SQLModel, select

from app.api.deps import AdminOrSuperuser, SessionDep
from app.models import User
from app.models.contenido import Curso, Leccion, Modulo
from app.models.inscripcion import Certificado, Inscripcion, ProgresoLeccion
from app.models.organizacion import Organizacion, UsuarioOrganizacion

router = APIRouter(prefix="/admin", tags=["admin"])

SEMANAS = 12


class Embudo(SQLModel):
    inscritos: int
    sin_iniciar: int
    en_curso: int
    terminaron: int
    certificados: int


class Semana(SQLModel):
    inicio: str
    inscripciones: int
    lecciones_completadas: int


class CursoTop(SQLModel):
    id: uuid.UUID
    titulo: str
    inscritos: int
    terminaron: int
    avance_promedio: float


class OrgResumen(SQLModel):
    id: uuid.UUID
    nombre: str
    alumnos: int
    inscripciones: int
    avance_promedio: float


class AdminStats(SQLModel):
    cursos_por_estado: dict[str, int]
    usuarios: int
    alumnos: int
    organizaciones: int
    embudo: Embudo
    semanas: list[Semana]
    top_cursos: list[CursoTop]
    por_organizacion: list[OrgResumen]


def _val(e: Any) -> str:
    return e.value if hasattr(e, "value") else str(e)


def _naive(dt: datetime) -> datetime:
    return dt.replace(tzinfo=None) if dt.tzinfo else dt


@router.get("/stats", response_model=AdminStats)
def admin_stats(*, session: SessionDep, _admin: AdminOrSuperuser) -> Any:
    cursos = list(session.exec(select(Curso)).all())
    users = list(session.exec(select(User)).all())
    orgs = list(session.exec(select(Organizacion)).all())
    miembros = list(session.exec(select(UsuarioOrganizacion)).all())
    inscripciones = [
        i for i in session.exec(select(Inscripcion)).all() if _val(i.estado) != "cancelado"
    ]
    progreso = list(
        session.exec(select(ProgresoLeccion).where(ProgresoLeccion.completado == True)).all()  # noqa: E712
    )
    certificados = len(session.exec(select(Certificado.id)).all())

    # Lecciones visibles por curso (base para el % de avance).
    lecc_por_curso: Counter[uuid.UUID] = Counter()
    for leccion, modulo in session.exec(
        select(Leccion, Modulo).where(Leccion.modulo_id == Modulo.id)
    ).all():
        if getattr(leccion, "es_visible", True):
            lecc_por_curso[modulo.curso_id] += 1

    completadas_por_insc: Counter[uuid.UUID] = Counter(p.inscripcion_id for p in progreso)

    def avance(i: Inscripcion) -> float:
        if _val(i.estado) == "finalizada":
            return 100.0
        total = lecc_por_curso.get(i.curso_id, 0)
        if not total:
            return 0.0
        return min(100.0, 100.0 * completadas_por_insc.get(i.id, 0) / total)

    activas = [i for i in inscripciones if _val(i.estado) == "activa"]
    en_curso = sum(1 for i in activas if completadas_por_insc.get(i.id, 0) > 0)
    embudo = Embudo(
        inscritos=len(inscripciones),
        sin_iniciar=len(activas) - en_curso,
        en_curso=en_curso,
        terminaron=sum(1 for i in inscripciones if _val(i.estado) == "finalizada"),
        certificados=certificados,
    )

    # Últimas 12 semanas, de lunes a domingo, la más reciente al final.
    hoy = datetime.now(timezone.utc).replace(tzinfo=None)
    lunes = (hoy - timedelta(days=hoy.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    inicios = [lunes - timedelta(weeks=k) for k in range(SEMANAS - 1, -1, -1)]

    def idx(dt: datetime | None) -> int | None:
        if not dt:
            return None
        d = _naive(dt)
        if d < inicios[0]:
            return None
        return min(SEMANAS - 1, (d - inicios[0]).days // 7)

    ins_sem = [0] * SEMANAS
    for i in inscripciones:
        k = idx(i.inscrito_en)
        if k is not None:
            ins_sem[k] += 1
    lec_sem = [0] * SEMANAS
    for p in progreso:
        k = idx(p.completado_en)
        if k is not None:
            lec_sem[k] += 1
    semanas = [
        Semana(inicio=inicios[k].date().isoformat(), inscripciones=ins_sem[k], lecciones_completadas=lec_sem[k])
        for k in range(SEMANAS)
    ]

    # Cursos con más alumnos.
    por_curso: dict[uuid.UUID, list[Inscripcion]] = defaultdict(list)
    for i in inscripciones:
        por_curso[i.curso_id].append(i)
    titulos = {c.id: c.titulo for c in cursos}
    top = sorted(por_curso.items(), key=lambda kv: len(kv[1]), reverse=True)[:5]
    top_cursos = [
        CursoTop(
            id=cid,
            titulo=titulos.get(cid, "Curso"),
            inscritos=len(lst),
            terminaron=sum(1 for i in lst if _val(i.estado) == "finalizada"),
            avance_promedio=round(sum(avance(i) for i in lst) / len(lst), 1),
        )
        for cid, lst in top
    ]

    # Avance por organización.
    alumnos_org: dict[uuid.UUID, set[uuid.UUID]] = defaultdict(set)
    for m in miembros:
        alumnos_org[m.organizacion_id].add(m.usuario_id)
    por_usuario: dict[uuid.UUID, list[Inscripcion]] = defaultdict(list)
    for i in inscripciones:
        por_usuario[i.usuario_id].append(i)
    por_org = []
    for o in orgs:
        ins = [i for u in alumnos_org.get(o.id, set()) for i in por_usuario.get(u, [])]
        por_org.append(
            OrgResumen(
                id=o.id,
                nombre=o.nombre,
                alumnos=len(alumnos_org.get(o.id, set())),
                inscripciones=len(ins),
                avance_promedio=round(sum(avance(i) for i in ins) / len(ins), 1) if ins else 0.0,
            )
        )
    por_org.sort(key=lambda r: r.inscripciones, reverse=True)

    return AdminStats(
        cursos_por_estado=dict(Counter(_val(c.estado) for c in cursos)),
        usuarios=len(users),
        alumnos=sum(1 for u in users if _val(u.rol) == "estudiante"),
        organizaciones=len(orgs),
        embudo=embudo,
        semanas=semanas,
        top_cursos=top_cursos,
        por_organizacion=por_org[:6],
    )
