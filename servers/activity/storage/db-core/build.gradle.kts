// DB: 저장소(JdbcClient) + 스키마(Flyway, src/main/resources/db/migration). 쓰는 쪽은 *Repository 만 본다
plugins {
	`java-library`
}

dependencies {
	api("org.springframework.boot:spring-boot-starter-jdbc")
	implementation("org.springframework.boot:spring-boot-starter-flyway")
	implementation("org.flywaydb:flyway-database-postgresql")
	runtimeOnly("org.postgresql:postgresql")
}
