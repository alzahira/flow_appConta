"""Router /api/v1/backup: Exportación, vaciado y restauración de datos para Flow."""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Response, UploadFile, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app_conta.db import get_db
from app_conta.services.backup import (
    exportar_datos_completos,
    resetear_saldos_a_cero,
    restaurar_datos_completos,
    vaciar_base_de_datos,
)
from app_conta.services.errors import ErrorValidacion

router = APIRouter(prefix="/backup", tags=["backup"])


class VaciarConfirmacion(BaseModel):
    model_config = ConfigDict(extra="ignore")
    confirmar: bool = False


@router.get("/exportar")
def get_exportar_backup(db: Session = Depends(get_db)) -> Response:
    """Descarga un archivo JSON con la copia completa de la base de datos."""
    backup_data = exportar_datos_completos(db)
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
    payload: VaciarConfirmacion, db: Session = Depends(get_db)
) -> dict[str, Any]:
    """Vacía todos los datos de usuario para permitir probar la app en limpio."""
    if not payload.confirmar:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debe confirmar explícitamente el vaciado de datos.",
        )
    return vaciar_base_de_datos(db, guardar_copia_seguridad=True)


@router.post("/poner-a-cero", response_model=dict[str, Any])
def post_poner_a_cero(
    payload: VaciarConfirmacion, db: Session = Depends(get_db)
) -> dict[str, Any]:
    """Pone saldos y movimientos a cero conservando botes, cuentas y plantillas."""
    if not payload.confirmar:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debe confirmar explícitamente el reseteo a cero.",
        )
    return resetear_saldos_a_cero(db, guardar_copia_seguridad=True)


@router.post("/restaurar", response_model=dict[str, Any])
async def post_restaurar_backup(
    archivo: UploadFile | None = None,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Restaura la base de datos a partir de un archivo JSON subido."""
    if archivo is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debe proporcionar un archivo de copia de seguridad (.json).",
        )

    try:
        raw_bytes = await archivo.read()
        texto = raw_bytes.decode("utf-8")
        backup_dict = json.loads(texto)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error al leer el archivo JSON: {exc}",
        ) from exc

    try:
        resultado = restaurar_datos_completos(db, backup_dict)
        return resultado
    except ErrorValidacion as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error durante la restauración: {exc}",
        ) from exc

