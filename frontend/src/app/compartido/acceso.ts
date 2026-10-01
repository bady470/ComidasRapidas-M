import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, inject, input, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { gsap } from 'gsap';
import { sinMovimiento } from '../core/animar';
import { Icono } from './icono';
import { Logo } from './logo';

/**
 * Pantalla de acceso compartida (portal de la empresa y superadmin): a un lado la marca y lo que se puede hacer,
 * al otro el formulario. Muestra/oculta la clave, avisa si está activada la tecla Bloq Mayús y lleva el foco al usuario.
 */
@Component({
  selector: 'app-acceso',
  imports: [FormsModule, Icono, Logo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="ac">
      <section class="ac-marca">
        <span class="lp-blob b1" aria-hidden="true"></span><span class="lp-blob b2" aria-hidden="true"></span>
        <div class="ac-marca-in">
          <app-logo [logoUrl]="logoUrl()" [nombre]="marca()" class="ac-logo" />
          <h2>{{ marca() }}</h2>
          <p>{{ lema() }}</p>
          <ul>
            @for (b of beneficios(); track b) { <li><app-icono nombre="ok" /> {{ b }}</li> }
          </ul>
        </div>
      </section>

      <section class="ac-form">
        <form (ngSubmit)="enviar.emit()" class="ac-caja">
          <div class="ac-cab">
            <app-logo [logoUrl]="logoUrl()" [nombre]="marca()" class="ac-logo-mini" />
            <h1>{{ titulo() }}</h1>
            <p class="muted">{{ subtitulo() }}</p>
          </div>

          <div class="field">
            <label for="usuario">Usuario</label>
            <div class="ac-campo"><app-icono nombre="cuenta" />
              <input id="usuario" name="usuario" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="Tu usuario" [(ngModel)]="usuario"></div>
          </div>
          <div class="field">
            <label for="clave">Clave</label>
            <div class="ac-campo"><app-icono nombre="candado" />
              <input id="clave" name="clave" [type]="ver() ? 'text' : 'password'" autocomplete="current-password" placeholder="Tu clave"
                     [(ngModel)]="clave" (keyup)="mayus.set($any($event).getModifierState?.('CapsLock') ?? false)" (keydown)="mayus.set($any($event).getModifierState?.('CapsLock') ?? false)">
              <button type="button" class="ac-ojo" (click)="ver.set(!ver())" [attr.aria-label]="ver() ? 'Ocultar la clave' : 'Mostrar la clave'" [attr.aria-pressed]="ver()">
                <app-icono [nombre]="ver() ? 'ojoNo' : 'ojo'" /></button></div>
            @if (mayus()) { <span class="ac-aviso">Tienes activadas las mayúsculas.</span> }
          </div>

          @if (error()) { <p class="err ac-error" role="alert">{{ error() }}</p> }
          <button class="primary ac-entrar" type="submit" [disabled]="cargando()">{{ cargando() ? 'Entrando…' : 'Entrar' }}</button>
          <div class="ac-pie"><ng-content /></div>
        </form>
      </section>
    </main>
  `,
})
export class Acceso {
  readonly marca = input('');
  readonly logoUrl = input<string | null | undefined>(null);
  readonly titulo = input('Iniciar sesión');
  readonly subtitulo = input('');
  readonly lema = input('');
  readonly beneficios = input<string[]>([]);
  readonly error = input('');
  readonly cargando = input(false);
  readonly usuario = model('');
  readonly clave = model('');
  readonly enviar = output<void>();

  protected ver = signal(false);
  protected mayus = signal(false);
  private raiz = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  constructor() {
    afterNextRender(() => {
      this.raiz.querySelector<HTMLInputElement>('#usuario')?.focus({ preventScroll: true });
      if (sinMovimiento()) return;
      gsap.timeline({ defaults: { ease: 'power3.out' } })
        .fromTo(this.raiz.querySelectorAll('.ac-marca-in > *'), { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.09, clearProps: 'all' })
        .fromTo(this.raiz.querySelector('.ac-caja'), { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 0.55, clearProps: 'all' }, 0.1);
      gsap.to(this.raiz.querySelectorAll('.lp-blob'), { x: 30, y: -20, duration: 7, ease: 'sine.inOut', yoyo: true, repeat: -1, stagger: 1.5 });
    });
  }
}
