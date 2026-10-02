import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { gsap } from 'gsap';
import { sinMovimiento } from './core/animar';
import { EmpresaActual, identificadorValido } from './core/empresa';
import { Tema } from './core/tema';

/** Página de inicio de la plataforma (fuera de cualquier tienda). */
@Component({
  selector: 'app-inicio',
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="pl">
      <section class="pl-hero">
        <span class="lp-blob b1" aria-hidden="true"></span><span class="lp-blob b2" aria-hidden="true"></span>
        <form class="pl-form pl-centro" (ngSubmit)="ir()">
          <h1>Leinei</h1>
          <p class="muted">Escribe el identificador de tu tienda (lo ves en tu dirección, por ejemplo <b>/la-parrilla</b>).</p>
          <div class="field"><label for="tienda">Identificador</label>
            <input id="tienda" name="tienda" autocomplete="off" autocapitalize="none" placeholder="la-parrilla" [(ngModel)]="tienda"></div>
          @if (error()) { <p class="err" role="alert">{{ error() }}</p> }
          <div class="pl-dos">
            <button class="primary" type="submit" (click)="destino = ''">Ver la tienda</button>
            <button class="btn" type="submit" (click)="destino = '/admin/entrar'">Entrar a mi portal</button>
          </div>
          <a class="linkbtn" routerLink="/superadmin">Administrar la plataforma</a>
        </form>
      </section>
    </main>
  `,
})
export class InicioPage {
  private router = inject(Router);
  protected tienda = '';
  protected destino = '';
  protected error = signal('');

  constructor() {
    inject(EmpresaActual).fijar('');
    inject(Tema).restablecer();
    const r = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    afterNextRender(() => {
      if (sinMovimiento()) return;
      gsap.timeline({ defaults: { ease: 'power3.out' } })
        .fromTo(r.querySelector('.pl-form'), { opacity: 0, y: 30, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.6, clearProps: 'all' });
      gsap.to(r.querySelectorAll('.lp-blob'), { x: 30, y: -20, duration: 7, ease: 'sine.inOut', yoyo: true, repeat: -1, stagger: 1.5 });
    });
  }

  protected ir(): void {
    const slug = this.tienda.trim().toLowerCase();
    if (!identificadorValido(slug)) { this.error.set('Ese identificador no es válido.'); return; }
    this.router.navigateByUrl('/' + slug + this.destino);
  }
}
