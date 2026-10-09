"""
HemoGest — Rotas de Anexos.
IMPORTANTE: as rotas de download usam prefixos literais (`/download/`,
`/arquivo/`) em vez de `/{anexo_id}/download` e são registradas ANTES da rota
genérica `/{entidade}/{entidade_id}` — caso contrário, o Starlette casaria
"/anexos/<uuid>/download" com a rota genérica (entidade=<uuid>,
entidade_id="download") e falharia a validação de UUID antes de alcançar o
endpoint certo. Path literal + ordem de registro resolve a ambiguidade.
"""
import re
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.permissions import require_permission
from app.core.tenant import TenantContext, require_unidade_resolvida
from app.db.session import get_db
from app.models.anexo import Anexo
from app.schemas.anexo import AnexoDownloadOut, AnexoOut
from app.services import anexo_service
from app.services.storage import LocalStorageService, get_storage_service, verify_local_token

router = APIRouter(prefix="/anexos", tags=["Anexos"])
_pode_escrever = require_permission("anexos_gerenciar")


def _nome_arquivo_seguro(nome: str) -> str:
    """Remove aspas/CR/LF do nome antes de usá-lo num header HTTP — evita
    quebra ou injeção de header a partir de um nome de arquivo malicioso."""
    return re.sub(r'[\r\n"]', "_", nome)


@router.get("/download/{anexo_id}", response_model=AnexoDownloadOut)
def baixar(
    anexo_id: uuid.UUID,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_unidade_resolvida),
    user=Depends(get_current_user),
):
    url = anexo_service.get_download_url(db, anexo_id, ctx.unidade_hospitalar_id, actor_id=user.id)
    return AnexoDownloadOut(url=url)


@router.get("/arquivo/{token}")
def baixar_arquivo_local(token: str, db: Session = Depends(get_db)):
    """Serve o conteúdo do anexo quando STORAGE_BACKEND=local. Equivale à URL
    pré-assinada do MinIO: o token HMAC com expiração já é a autorização —
    não exige um novo login, assim como uma presigned URL não exigiria."""
    storage = get_storage_service()
    if not isinstance(storage, LocalStorageService):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Não encontrado.")

    try:
        object_name = verify_local_token(token)
    except ValueError as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from exc

    anexo = db.scalar(select(Anexo).where(Anexo.object_name == object_name))
    if anexo is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Anexo não encontrado.")

    conteudo = storage.read(object_name)
    # attachment (não inline): o navegador baixa o arquivo em vez de
    # renderizá-lo no domínio da API — fecha o vetor de stored-XSS via
    # upload malicioso disfarçado de imagem/PDF.
    return Response(
        content=conteudo,
        media_type=anexo.content_type,
        headers={
            "Content-Disposition": f'attachment; filename="{_nome_arquivo_seguro(anexo.nome_arquivo)}"',
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.get("/{entidade}/{entidade_id}", response_model=list[AnexoOut])
def listar(
    entidade: str,
    entidade_id: uuid.UUID,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_unidade_resolvida),
):
    return anexo_service.listar(db, entidade, entidade_id, ctx.unidade_hospitalar_id)


@router.post("/{entidade}/{entidade_id}", response_model=AnexoOut, status_code=status.HTTP_201_CREATED)
def enviar(
    entidade: str,
    entidade_id: uuid.UUID,
    db: Session = Depends(get_db),
    ctx: TenantContext = Depends(require_unidade_resolvida),
    user=Depends(_pode_escrever),
    arquivo: UploadFile = File(...),
):
    return anexo_service.upload(
        db, entidade, entidade_id, arquivo, unidade_hospitalar_id=ctx.unidade_hospitalar_id, actor_id=user.id
    )
