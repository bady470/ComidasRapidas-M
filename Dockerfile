# Imagen única: sirve el frontend Angular como archivos estáticos del backend Spring Boot.
# Build: docker build -t leinei .
# Run:   docker run -p 8080:8080 --env-file .env leinei

FROM node:24-alpine AS frontend
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend .
RUN npm run build

FROM maven:3.9-eclipse-temurin-21 AS backend
WORKDIR /app
COPY backend/pom.xml .
RUN mvn -q dependency:go-offline
COPY backend/src src
COPY --from=frontend /app/dist/leinei-web/browser src/main/resources/static
RUN mvn -q -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=backend /app/target/leinei-api-1.0.0.jar app.jar
ENV TZ=America/Bogota
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
