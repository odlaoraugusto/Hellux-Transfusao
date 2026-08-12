# Dockerfile — HemoGest Frontend (SPA estática, servida por nginx)
#
# Multi-stage: build com Node (gera /dist), runtime só com nginx servindo
# arquivos estáticos. A imagem final não tem Node, npm nem node_modules —
# só HTML/JS/CSS compilados + nginx.
#
# VITE_API_BASE_URL é uma build arg (não runtime env var!) porque Vite
# resolve import.meta.env.* em tempo de build, embutindo o valor no bundle
# JS final. Se precisar apontar pra uma API diferente, é preciso rebuildar
# a imagem — não dá pra trocar isso com `fly secrets set` depois do build.
# Ver hemogest-backend/DEPLOY.md para o valor de produção.

FROM node:20-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build

FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

# nginx:alpine já roda o worker process como usuário "nginx" (não-root) por
# padrão nos processos de request; o master process precisa iniciar como
# root só pra abrir a porta e dropar privilégio — isso é comportamento
# padrão da imagem oficial, não precisamos mexer em USER aqui.

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
