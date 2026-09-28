package co.leinei.api.servicio;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ArchivoServiceTest {

    @Test
    void reconoceImagenesPorSusPrimerosBytes() {
        assertThat(ArchivoService.tipoDe(new byte[]{(byte) 0x89, 'P', 'N', 'G', 1, 2})).isEqualTo("image/png");
        assertThat(ArchivoService.tipoDe(new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 0})).isEqualTo("image/jpeg");
        assertThat(ArchivoService.tipoDe("RIFF\0\0\0\0WEBPVP8 ".getBytes())).isEqualTo("image/webp");
        assertThat(ArchivoService.tipoDe("<svg onload=alert(1)>".getBytes())).isNull();
    }
}
