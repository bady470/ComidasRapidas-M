# Imagen del backend (API Spring Boot). El frontend va en su propia imagen (frontend/Dockerfile).
# Build: docker build -t leinei-backend ./backend
# Run:   docker run -p 8080:8080 -e DB_HOST=... -e DB_OWNER_USER=... -e DB_OWNER_PASSWORD=... -e LEINEI_LLAVE_MAESTRA=... leinei-backend

FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -q dependency:go-offline
COPY src src
RUN mvn -q -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/target/leinei-api-1.0.0.jar app.jar
ENV TZ=America/Bogota
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
