pluginManagement {
	repositories {
		mavenCentral()
		gradlePluginPortal()
	}
}

rootProject.name = "activity"

// 모듈 = 레이어. core = 실행 앱 · 업무, storage = DB, clients = 외부 시스템 하나당 하나 (client-example 은 복사해 쓰는 예시)
include(
	"core:core-api",
	"storage:db-core",
	"clients:client-example",
)
