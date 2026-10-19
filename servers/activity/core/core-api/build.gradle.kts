// 실행 앱: HTTP API · gRPC 서비스 · 업무 로직. 저장은 storage:db-core, 외부 시스템은 clients:client-* 에 맡긴다
plugins {
	id("org.springframework.boot")
	id("com.google.protobuf")
}

// 서버 간 gRPC 계약: 레포 공통 proto 에서 바로 생성한다 (복사하지 않음)
sourceSets {
	main {
		proto {
			srcDir("../../../../contract/proto")
		}
	}
}

// grpc 생성 플러그인은 선언만: 버전 · 태스크 연결은 Spring Boot 플러그인이 맞춘다
protobuf {
	plugins {
		create("grpc")
	}
}

dependencies {
	implementation(project(":storage:db-core"))
	implementation(project(":clients:client-example"))
	implementation("org.springframework.boot:spring-boot-starter-webmvc")
	implementation("org.springframework.boot:spring-boot-starter-validation")
	implementation("org.springframework.boot:spring-boot-starter-grpc-server")

	testImplementation("org.springframework.boot:spring-boot-starter-grpc-server-test")
	testImplementation("org.springframework.boot:spring-boot-restclient")
	testImplementation("org.springframework.boot:spring-boot-resttestclient")
	// openapi 문서(OpenApiExport → contract/openapi/activity.json)를 뽑을 때만. 운영 앱에는 넣지 않는다
	testImplementation("org.springdoc:springdoc-openapi-starter-webmvc-api:3.1.1")
}

// pnpm gen: 실제 서버가 내는 openapi 문서 → contract/openapi/activity.json
tasks.register<Test>("openapi") {
	testClassesDirs = sourceSets.test.get().output.classesDirs
	classpath = sourceSets.test.get().runtimeClasspath
	filter { includeTestsMatching("app.OpenApiExport") }
	systemProperty("openapi.out", file("../../../../contract/openapi/activity.json").absolutePath)
	systemProperty("logging.level.root", "WARN")
	outputs.upToDateWhen { false }
}
