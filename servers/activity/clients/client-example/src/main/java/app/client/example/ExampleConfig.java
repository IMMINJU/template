package app.client.example;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.service.registry.ImportHttpServices;

/**
 * ExampleApi 프록시를 group example 로 만든다: 주소 · timeout 은 spring.http.serviceclient.example
 * (client-example.yml)
 */
@Configuration(proxyBeanMethods = false)
@ImportHttpServices(group = "example", types = ExampleApi.class)
class ExampleConfig {

}
