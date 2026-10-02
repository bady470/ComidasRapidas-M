package co.leinei.api.repositorio;

import co.leinei.api.dominio.ContactoCliente;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface ContactoClienteRepositorio extends JpaRepository<ContactoCliente, Long> {

    /** Última vez que se le escribió a cada cliente. Filas: [celular, instante]. */
    @Query("select c.celular, max(c.creado) from ContactoCliente c group by c.celular")
    List<Object[]> ultimosContactos();
}
