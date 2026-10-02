package co.leinei.api.config;

import co.leinei.api.plataforma.servicio.SuperadminAuthService;
import co.leinei.api.servicio.AuthService;
import jakarta.servlet.DispatcherType;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.nio.charset.StandardCharsets;
import java.util.List;

@Configuration
public class SecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /**
     * Los usuarios se validan con tokens propios (TokenAuthFilter), no con usuario/clave de Spring.
     * Este bean vacío evita que Spring Boot cree un usuario "user" con clave aleatoria en el log.
     */
    @Bean
    public UserDetailsService sinUsuariosSpring() {
        return new InMemoryUserDetailsManager();
    }

    @Bean
    public SecurityFilterChain cadena(HttpSecurity http, AuthService auth, SuperadminAuthService superadmins) throws Exception {
        http
            .csrf(c -> c.disable())               // API sin cookies: el token va en un encabezado
            .cors(Customizer.withDefaults())
            .httpBasic(b -> b.disable())
            .formLogin(f -> f.disable())
            .logout(l -> l.disable())
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(a -> a
                // Las conexiones de tiempo real (SSE) terminan en un despacho asíncrono: ya se autorizaron al abrirse.
                .dispatcherTypeMatchers(DispatcherType.ASYNC, DispatcherType.ERROR).permitAll()
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                // Tienda de cada empresa: pública.
                .requestMatchers("/api/t/*/public/**").permitAll()
                // Portal de cada empresa: su administrador (token validado en la base de ESA empresa).
                .requestMatchers(HttpMethod.POST, "/api/t/*/admin/auth/login").permitAll()
                .requestMatchers("/api/t/*/admin/**").hasRole("ADMIN")
                // Plataforma: solo el superadmin, salvo el logo y la búsqueda por dominio.
                .requestMatchers("/api/plataforma/publico/**").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/plataforma/auth/login").permitAll()
                .requestMatchers("/api/plataforma/**").hasRole("SUPERADMIN")
                .requestMatchers("/api/**").denyAll()
                .requestMatchers("/error").permitAll()
                // Frontend Angular servido desde el mismo jar (archivos estáticos y rutas del SPA).
                .requestMatchers(HttpMethod.GET, "/**").permitAll()
                .anyRequest().denyAll())
            .exceptionHandling(e -> e
                .authenticationEntryPoint((req, res, ex) -> escribir(res, HttpStatus.UNAUTHORIZED,
                        "Tu sesión terminó. Vuelve a entrar."))
                .accessDeniedHandler((req, res, ex) -> escribir(res, HttpStatus.FORBIDDEN,
                        "No tienes permiso para esta acción.")))
            .addFilterBefore(new TokenAuthFilter(auth, superadmins), UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource(LeineiProperties props) {
        CorsConfiguration c = new CorsConfiguration();
        c.setAllowedOrigins(props.listaOrigenes());
        c.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        c.setAllowedHeaders(List.of("Authorization", "Content-Type", "X-Sede"));
        c.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", c);
        return source;
    }

    private static void escribir(jakarta.servlet.http.HttpServletResponse res, HttpStatus estado, String mensaje)
            throws java.io.IOException {
        res.setStatus(estado.value());
        res.setContentType("application/problem+json");
        res.setCharacterEncoding(StandardCharsets.UTF_8.name());
        String json = "{\"status\":" + estado.value() + ",\"title\":\"" + estado.getReasonPhrase()
                + "\",\"detail\":\"" + mensaje + "\"}";
        res.getWriter().write(json);
    }
}
