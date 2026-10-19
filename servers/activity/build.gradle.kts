import io.spring.gradle.dependencymanagement.dsl.DependencyManagementExtension
import org.springframework.boot.gradle.plugin.SpringBootPlugin

plugins {
	id("org.springframework.boot") version "4.1.1" apply false
	id("io.spring.dependency-management") version "1.1.7" apply false
	id("com.google.protobuf") version "0.9.6" apply false
	// format: ./gradlew format, 검사: checkFormat (Spring 코드 스타일, 탭)
	id("io.spring.javaformat") version "0.0.48" apply false
}

subprojects {
	apply(plugin = "java")
	apply(plugin = "io.spring.dependency-management")
	apply(plugin = "io.spring.javaformat")

	repositories {
		mavenCentral()
	}

	configure<JavaPluginExtension> {
		toolchain {
			languageVersion = JavaLanguageVersion.of(25)
		}
	}

	// 버전은 Spring Boot BOM 이 정한다
	configure<DependencyManagementExtension> {
		imports {
			mavenBom(SpringBootPlugin.BOM_COORDINATES)
		}
	}

	dependencies {
		"testImplementation"("org.springframework.boot:spring-boot-starter-test")
		"testRuntimeOnly"("org.junit.platform:junit-platform-launcher")
	}

	tasks.withType<Test> {
		useJUnitPlatform()
	}

	// lint: 컴파일러 경고를 오류로 (serial: 예외 클래스는 직렬화하지 않는다)
	tasks.withType<JavaCompile> {
		options.compilerArgs.addAll(listOf("-Xlint:all,-serial", "-Werror"))
	}

	// 생성 코드(build/generated, proto)는 포맷하지 않는다
	tasks.withType<io.spring.javaformat.gradle.tasks.CheckFormat>().configureEach {
		exclude { it.file.path.contains("/build/") }
	}
	tasks.withType<io.spring.javaformat.gradle.tasks.Format>().configureEach {
		exclude { it.file.path.contains("/build/") }
	}
}
