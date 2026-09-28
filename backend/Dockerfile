# Imagen para desplegar la API (Render, Railway, un VPS...).
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
