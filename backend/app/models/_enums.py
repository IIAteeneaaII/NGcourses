import enum


class RolUsuario(str, enum.Enum):
    ESTUDIANTE = "estudiante"
    INSTRUCTOR = "instructor"
    USUARIO_CONTROL = "usuario_control"
    ADMINISTRADOR = "administrador"


class EstadoUsuario(str, enum.Enum):
    ACTIVO = "activo"
    SUSPENDIDO = "suspendido"


class EstadoCurso(str, enum.Enum):
    BORRADOR = "borrador"
    REVISION = "revision"
    PUBLICADO = "publicado"
    ARCHIVADO = "archivado"


class TipoLeccion(str, enum.Enum):
    VIDEO = "video"
    QUIZ = "quiz"
    LECTURA = "lectura"


class TipoRecurso(str, enum.Enum):
    PDF = "pdf"
    LINK = "link"
    ARCHIVO = "archivo"


class EstadoInscripcion(str, enum.Enum):
    ACTIVA = "activa"
    FINALIZADA = "finalizada"
    CANCELADO = "cancelado"


class EstadoCalificacion(str, enum.Enum):
    PUBLICA = "publica"
    OCULTA = "oculta"
    PENDIENTE = "pendiente"


class EstadoOrganizacion(str, enum.Enum):
    ACTIVA = "activa"
    INACTIVA = "inactiva"


class RolOrganizacion(str, enum.Enum):
    MIEMBRO = "miembro"
    ADMIN_ORG = "admin_org"


class EstadoLicencia(str, enum.Enum):
    ACTIVA = "activa"
    AGOTADA = "agotada"
    EXPIRADA = "expirada"


class EstadoSolicitud(str, enum.Enum):
    ABIERTA = "abierta"
    EN_REVISION = "en_revision"
    APROBADA = "aprobada"
    RECHAZADA = "rechazada"
    CERRADA = "cerrada"


class CanalNotificacion(str, enum.Enum):
    EMAIL = "email"
    WHATSAPP = "whatsapp"
    PUSH = "push"
    INAPP = "inapp"


class TipoNotificacion(str, enum.Enum):
    INSCRIPCION = "inscripcion"
    CERTIFICADO = "certificado"
    SOLICITUD = "solicitud"
    SISTEMA = "sistema"


class EstadoNotificacion(str, enum.Enum):
    PENDIENTE = "pendiente"
    ENVIADA = "enviada"
    FALLIDA = "fallida"
    LEIDA = "leida"


class ProveedorNotificacion(str, enum.Enum):
    TWILIO = "twilio"
    EMAIL = "email"
    INTERNAL = "internal"


class CategoriaEvento(str, enum.Enum):
    AUTH = "auth"
    CRUD = "crud"
    ADMIN = "admin"
    SISTEMA = "sistema"
