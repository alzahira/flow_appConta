"""Router /api/v1/importacion (T050, US5) — contract en contracts/importador.md.

Multi-part (UploadFile). previsualizar NUNCA escribe; aplicar exige
`?confirmar_repetido=true` si la huella ya existe (FR-010).
"""

from __future__ import annotations

import io
import zipfile

from fastapi import APIRouter, Depends, File, Query, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app_conta.api.dependencias import requerir_admin
from app_conta.db import get_db
from app_conta.models.importacion import Importacion
from app_conta.models.usuario import Usuario
from app_conta.services.errors import ErrorValidacion
from app_conta.services.importador import importador

router = APIRouter(prefix="/importacion", tags=["importacion"])

_MAX_XLSX = 10 * 1024 * 1024
_MAX_DESCOMPRIMIDO = 100 * 1024 * 1024
_MAX_ENTRADAS_ZIP = 2_000


def _leer_fichero(fichero: UploadFile) -> tuple[str, bytes]:
    # Leer como máximo un byte por encima del límite evita cargar un archivo
    # arbitrariamente grande en memoria antes de rechazarlo.
    datos = fichero.file.read(_MAX_XLSX + 1)
    if not datos or not fichero.filename or not fichero.filename.lower().endswith(".xlsx"):
        raise ErrorValidacion("Sube un fichero .xlsx válido")
    if len(datos) > _MAX_XLSX:
        raise ErrorValidacion("El fichero supera los 10 MB")

    # Un .xlsx es un ZIP: comprobamos firma y tamaño descomprimido (zip bomb).
    try:
        with zipfile.ZipFile(io.BytesIO(datos)) as zf:
            entradas = zf.infolist()
            if len(entradas) > _MAX_ENTRADAS_ZIP:
                raise ErrorValidacion("El fichero contiene demasiadas entradas")
            if sum(e.file_size for e in entradas) > _MAX_DESCOMPRIMIDO:
                raise ErrorValidacion("El contenido descomprimido del fichero es demasiado grande")
    except zipfile.BadZipFile as exc:
        raise ErrorValidacion("El fichero no es un .xlsx válido") from exc

    return fichero.filename, datos


@router.post("/previsualizar")
def post_previsualizar(
    fichero: UploadFile = File(...),
    admin: Usuario = Depends(requerir_admin),
    db: Session = Depends(get_db),
) -> dict:
    nombre, datos = _leer_fichero(fichero)
    return importador.previsualizar(db, nombre, datos, int(admin.hogar_id))


@router.post("/aplicar")
def post_aplicar(
    fichero: UploadFile = File(...),
    confirmar_repetido: bool = Query(default=False),
    admin: Usuario = Depends(requerir_admin),
    db: Session = Depends(get_db),
) -> dict:
    nombre, datos = _leer_fichero(fichero)
    resultado = importador.aplicar(
        db,
        nombre,
        datos,
        confirmar_repetido=confirmar_repetido,
        hogar_id=int(admin.hogar_id),
    )
    db.commit()
    return resultado


@router.get("/historial")
def get_historial(
    admin: Usuario = Depends(requerir_admin),
    db: Session = Depends(get_db),
) -> dict:
    filas = db.scalars(
        select(Importacion)
        .where(
            (Importacion.hogar_id == int(admin.hogar_id))
            | (Importacion.hogar_id == str(admin.hogar_id))
        )
        .order_by(Importacion.importado_en.desc())
    ).all()
    return {
        "items": [
            {
                "id": r.id,
                "nombre_fichero": r.nombre_fichero,
                "huella": r.huella,
                "importado_en": r.importado_en.isoformat(),
                "resumen": r.resumen,
            }
            for r in filas
        ],
        "total": len(filas),
    }
