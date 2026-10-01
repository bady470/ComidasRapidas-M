import { DestroyRef, inject, signal } from '@angular/core';
import { environment } from '../../environments/environment';
import { SesionSuperadmin } from '../core/sesion';
import { escucharCanal } from '../core/tiempo-real';

/**
 * Canal en vivo del superadmin: avisa cuando una empresa cambia (creación, pasos del aprovisionamiento,
 * estado, marca, módulos). Se cierra solo al salir de la página.
 */
export function enVivoPlataforma(alCambio: () => void): { enVivo: () => boolean } {
  const sesion = inject(SesionSuperadmin);
  const enVivo = signal(false);
  let espera: ReturnType<typeof setTimeout> | undefined;
  const cerrar = escucharCanal(`${environment.apiUrl}/plataforma/eventos`, {
    token: () => sesion.token(),
    alEvento: (e) => {
      if (e.tipo !== 'empresa') return;
      clearTimeout(espera);
      espera = setTimeout(alCambio, 200);
    },
    alReconectar: alCambio,
  }, (v) => enVivo.set(v));
  inject(DestroyRef).onDestroy(() => { clearTimeout(espera); cerrar(); });
  return { enVivo };
}
