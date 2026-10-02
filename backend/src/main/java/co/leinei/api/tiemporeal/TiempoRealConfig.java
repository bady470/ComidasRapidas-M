package co.leinei.api.tiemporeal;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class TiempoRealConfig implements WebMvcConfigurer {

    private final TiempoReal tiempoReal;

    public TiempoRealConfig(TiempoReal tiempoReal) {
        this.tiempoReal = tiempoReal;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new CambiosCatalogoInterceptor(tiempoReal)).addPathPatterns("/api/t/*/admin/**");
    }
}
