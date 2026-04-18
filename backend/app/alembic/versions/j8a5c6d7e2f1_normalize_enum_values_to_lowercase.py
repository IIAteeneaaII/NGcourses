"""normalize_enum_values_to_lowercase

Revision ID: j8a5c6d7e2f1
Revises: i7f4d3a6b129
Branch labels: None
Depends on: None
Create Date: 2026-04-18

Renombra todos los labels de enums PostgreSQL de UPPERCASE a lowercase
para coincidir con los valores de los enums Python (str, enum.Enum).
"""
from alembic import op

revision = 'j8a5c6d7e2f1'
down_revision = 'i7f4d3a6b129'
branch_labels = None
depends_on = None

_RENAMES = {
    'canalnotificacion':     [('EMAIL','email'), ('WHATSAPP','whatsapp'), ('PUSH','push'), ('INAPP','inapp')],
    'categoriaevento':       [('AUTH','auth'), ('CRUD','crud'), ('ADMIN','admin'), ('SISTEMA','sistema')],
    'estadocalificacion':    [('PUBLICA','publica'), ('OCULTA','oculta'), ('PENDIENTE','pendiente')],
    'estadocurso':           [('BORRADOR','borrador'), ('REVISION','revision'), ('PUBLICADO','publicado'), ('ARCHIVADO','archivado')],
    'estadoinscripcion':     [('ACTIVA','activa'), ('FINALIZADA','finalizada'), ('CANCELADO','cancelado')],
    'estadolicencia':        [('ACTIVA','activa'), ('AGOTADA','agotada'), ('EXPIRADA','expirada')],
    'estadonotificacion':    [('PENDIENTE','pendiente'), ('ENVIADA','enviada'), ('FALLIDA','fallida'), ('LEIDA','leida')],
    'estadoorganizacion':    [('ACTIVA','activa'), ('INACTIVA','inactiva')],
    'estadosolicitud':       [('ABIERTA','abierta'), ('EN_REVISION','en_revision'), ('APROBADA','aprobada'), ('RECHAZADA','rechazada'), ('CERRADA','cerrada')],
    'estadousuario':         [('ACTIVO','activo'), ('SUSPENDIDO','suspendido')],
    'proveedornotificacion': [('TWILIO','twilio'), ('EMAIL','email'), ('INTERNAL','internal')],
    'rolorganizacion':       [('MIEMBRO','miembro'), ('ADMIN_ORG','admin_org')],
    'rolusuario':            [('ESTUDIANTE','estudiante'), ('INSTRUCTOR','instructor'), ('SUPERVISOR','supervisor'), ('USUARIO_CONTROL','usuario_control'), ('ADMINISTRADOR','administrador')],
    'tipoleccion':           [('VIDEO','video'), ('QUIZ','quiz'), ('LECTURA','lectura')],
    'tiponotificacion':      [('INSCRIPCION','inscripcion'), ('CERTIFICADO','certificado'), ('SOLICITUD','solicitud'), ('SISTEMA','sistema')],
    'tiporecurso':           [('PDF','pdf'), ('LINK','link'), ('ARCHIVO','archivo'), ('DOCX','docx'), ('XLSX','xlsx'), ('PPTX','pptx')],
}


def upgrade():
    for type_name, pairs in _RENAMES.items():
        for old, new in pairs:
            op.execute(f"ALTER TYPE {type_name} RENAME VALUE '{old}' TO '{new}'")


def downgrade():
    for type_name, pairs in _RENAMES.items():
        for old, new in reversed(pairs):
            op.execute(f"ALTER TYPE {type_name} RENAME VALUE '{new}' TO '{old}'")
