# Imagen del frontend: compila Angular y lo sirve con Nginx.
# Nginx también reenvía /api/** al backend, así el navegador ve un solo origen (sin CORS).
# Build: docker build -t leinei-frontend ./frontend
# Run:   docker run -p 8080:80 -e API_URL=http://leinei-backend:8080 leinei-frontend

FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
# Dirección del backend dentro de la red de Docker (se reemplaza en nginx.conf al arrancar).
ENV API_URL=http://backend:8080
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist/leinei-web/browser /usr/share/nginx/html
EXPOSE 80
