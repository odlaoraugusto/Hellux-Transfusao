FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Usuário não-root — se um dia um RCE explorar uma lib do requirements.txt,
# ele não vai rodar como root dentro do container. `--system` porque é um
# usuário de serviço, sem senha/login/home real.
# LOCAL_STORAGE_PATH (STORAGE_BACKEND=local) grava em ./storage — dono do
# diretório precisa ser o mesmo usuário que roda o uvicorn, senão vira
# PermissionError no primeiro upload. Em produção o backend usa MinIO/S3
# (STORAGE_BACKEND=minio, default), então esse diretório normalmente fica
# vazio — mas criamos e ajustamos o dono mesmo assim pra não quebrar quem
# rodar com STORAGE_BACKEND=local.
RUN groupadd --system hemogest && useradd --system --gid hemogest --no-create-home hemogest \
    && mkdir -p /app/storage \
    && chown -R hemogest:hemogest /app

USER hemogest

EXPOSE 8000

# --proxy-headers + --forwarded-allow-ips='*': obrigatório atrás do proxy
# do Fly.io. Sem isso, request.client.host sempre reflete o IP interno do
# proxy, não o do cliente — quebra o rate limiting por IP do /auth/login e
# o ip_origem gravado na auditoria. '*' é seguro aqui porque o Fly já
# controla quem chega até a máquina (edge dele é a única borda de rede);
# não é um proxy arbitrário de terceiros na frente.
# Sem --reload: isso é comportamento de dev (recarrega em cada mudança de
# arquivo), não deve rodar em produção.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips=*"]
