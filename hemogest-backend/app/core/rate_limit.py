"""
HemoGest — Rate limiting (slowapi). Chave por IP do cliente.

Atrás de um proxy reverso (PaaS: Render/Railway/Fly.io), o Uvicorn precisa
rodar com --proxy-headers (e --forwarded-allow-ips apontando para a rede do
proxy) para que request.client.host reflita o IP real do cliente via
X-Forwarded-For, em vez do IP interno do proxy — sem isso, todo o tráfego
externo cai no mesmo balde de rate limit e o limite vira inútil (ou, pior,
um usuário legítimo é bloqueado pelo tráfego de todos os outros).
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
