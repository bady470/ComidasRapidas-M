package co.leinei.api.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;
import java.time.ZoneId;

@Configuration
public class RelojConfig {

    /** Reloj en hora de Colombia. En las pruebas se reemplaza por un reloj fijo. */
    @Bean
    public Clock reloj(LeineiProperties props) {
        return Clock.system(ZoneId.of(props.zonaHoraria()));
    }
}
