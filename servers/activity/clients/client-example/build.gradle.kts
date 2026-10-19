// 외부 시스템 example 의 HTTP 클라이언트 (Spring HTTP 서비스 인터페이스 + RestClient). 쓰는 쪽은 ExampleClient 만 본다
// 새 외부 시스템이 생기면 이 모듈을 복사해 이름을 바꾼다
dependencies {
	implementation("org.springframework.boot:spring-boot-starter-restclient")
}
