import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Avisos } from './core/avisos';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <router-outlet />
    @if (avisos.texto()) { <div class="toast" role="status">{{ avisos.texto() }}</div> }
  `,
})
export class App {
  protected avisos = inject(Avisos);
}
