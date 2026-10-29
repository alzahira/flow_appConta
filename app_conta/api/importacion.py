"""Router /api/v1/importacion (T050, US5) — contract en contracts/importador.md.

Multi-part (UploadFile). previsualizar NUNCA escribe; aplicar exige
`?confirmar_repetido=true` si la huella ya existe (FR-010).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, Query, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app_conta.db import get_db
from app_conta.models.importacion import Importacion
from app_conta.services.errors import ErrorValidacion
from app_conta.services.importador import importador

router = APIRouter(prefix="/importacion", tags=["importacion"])


def _leer_fichero(fichero: UploadFile) -> tuple[str, bytes]:
    datos = fichero.file.read()
    if not datos or not fichero.filename or not fichero.filename.lower().endswith(".xlsx"):
        raise ErrorValidacion("Sube un fichero .xlsx válido")
    if len(datos) > 10 * 1024 * 1024:
        raise ErrorValidacion("El fichero supera los 10 MB")
    return fichero.filename, datos


@router.post("/previsualizar")
def post_previsualizar(
    fichero: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> dict:
    nombre, datos = _leer_fichero(fichero)
    return importador.previsualizar(db, nombre, datos)


@router.post("/aplicar")
def post_aplicar(
    fichero: UploadFile = File(...),
    confirmar_repetido: bool = Query(default=False),
    db: Session = Depends(get_db),
) -> dict:
    nombre, datos = _leer_fichero(fichero)
    resultado = importador.aplicar(db, nombre, datos, confirmar_repetido)
    db.commit()
    return resultado


@router.get("/historial")
def get_historial(db: Session = Depends(get_db)) -> dict:
    filas = db.scalars(select(Importacion).order_by(Importacion.importado_en.desc())).all()
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
