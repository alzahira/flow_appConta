"""Router /api/v1/backup: Exportación, vaciado y restauración de datos para Flow.

Todas las operaciones están acotadas al hogar del administrador autenticado.
Las acciones destructivas exigen confirmación explícita y contraseña.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Form, HTTPException, Request, Response, UploadFile, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app_conta.api.dependencias import requerir_admin
from app_conta.db import get_db
from app_conta.models.usuario import Usuario
from app_conta.services.backup import (
    exportar_datos_completos,
    resetear_saldos_a_cero,
    restaurar_datos_completos,
    vaciar_base_de_datos,
)
from app_conta.services.errors import ErrorValidacion
from app_conta.services.seguridad import (
    comprobar_rate_limit,
    limpiar_intentos,
    obtener_ip_cliente,
    registrar_fallo,
    verificar_password,
)

logger = logging.getLogger("flow.security")

router = APIRouter(prefix="/backup", tags=["backup"])

_MAX_BACKUP = 25 * 1024 * 1024


class VaciarConfirmacion(BaseModel):
    model_config = ConfigDict(extra="ignore")
    confirmar: bool = False
    password_admin: str | None = None


def _comprobar_password_admin(
    request: Request, admin: Usuario, password: str | None
) -> None:
    """Valida la contraseña del admin con rate-limit para evitar fuerza bruta."""
    ip = f"backup:{obtener_ip_cliente(request)}"
    if not comprobar_rate_limit(ip, max_intentos=5, ventana_segundos=120):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Demasiados intentos. Espera unos minutos antes de volver a intentarlo.",
        )
    if not password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Debes introducir tu contraseña de administrador para autorizar esta acción.",
        )
    if not verificar_password(password, admin.password_hash):
        registrar_fallo(ip, ventana_segundos=120)
        logger.warning("Backup: contraseña incorrecta para usuario=%s", admin.username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Contraseña de administrador incorrecta.",
        )
    limpiar_intentos(ip)


@router.get("/exportar")
def get_exportar_backup(
    db: Session = Depends(get_db),
    admin: Usuario = Depends(requerir_admin),
) -> Response:
    """Descarga un JSON con la copia de datos del hogar del administrador."""
    backup_data = exportar_datos_completos(db, int(admin.hogar_id))
    contenido = json.dumps(backup_data, ensure_ascii=False, indent=2)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    nombre_archivo = f"flow_backup_{ts}.json"

    return Response(
        content=contenido,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{nombre_archivo}"'},
    )


@router.post("/vaciar", response_model=dict[str, Any])
def post_vaciar_datos(
    payload: VaciarConfirmacion,
    request: Request,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(requerir_admin),
) -> dict[str, Any]:
    """Vacía los datos del hogar para permitir probar la app en limpio (solo Admin)."""
    if not payload.confirmar:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debe confirmar explícitamente el vaciado de datos.",
        )
    _comprobar_password_admin(request, admin, payload.password_admin)
    return vaciar_base_de_datos(db, int(admin.hogar_id), guardar_copia_seguridad=True)


@router.post("/poner-a-cero", response_model=dict[str, Any])
def post_poner_a_cero(
    payload: VaciarConfirmacion,
    request: Request,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(requerir_admin),
) -> dict[str, Any]:
    """Pone saldos y movimientos a cero conservando botes, cuentas y plantillas."""
    if not payload.confirmar:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debe confirmar explícitamente el reseteo a cero.",
        )
    _comprobar_password_admin(request, admin, payload.password_admin)
    return resetear_saldos_a_cero(db, int(admin.hogar_id), guardar_copia_seguridad=True)


@router.post("/restaurar", response_model=dict[str, Any])
async def post_restaurar_backup(
    request: Request,
    archivo: UploadFile | None = None,
    password: str | None = Form(None),
    db: Session = Depends(get_db),
    admin: Usuario = Depends(requerir_admin),
) -> dict[str, Any]:
    """Restaura la copia de un hogar a partir de un JSON subido (solo Admin)."""
    _comprobar_password_admin(request, admin, password)

    if archivo is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debe proporcionar un archivo de copia de seguridad (.json).",
        )
    if not archivo.filename or not archivo.filename.lower().endswith(".json"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo debe tener extensión .json",
        )

    try:
        raw_bytes = await archivo.read(_MAX_BACKUP + 1)
        if len(raw_bytes) > _MAX_BACKUP:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El archivo supera el tamaño máximo permitido de 25 MB.",
            )
        texto = raw_bytes.decode("utf-8")
        backup_dict = json.loads(texto)
    except HTTPException:
        raise
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        logger.warning("Backup: JSON inválido: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo no es un JSON válido.",
        ) from exc
    except Exception:
        logger.exception("Backup: error inesperado leyendo el archivo")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se ha podido leer el archivo de copia.",
        ) from None

    if not isinstance(backup_dict, dict):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo no tiene el formato de copia de seguridad válido de Flow.",
        )

    try:
        return restaurar_datos_completos(db, backup_dict, int(admin.hogar_id))
    except ErrorValidacion as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc
    except Exception:
        db.rollback()
        logger.exception("Backup: error inesperado durante la restauración")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se ha podido restaurar la copia. No se han modificado tus datos.",
        ) from None
