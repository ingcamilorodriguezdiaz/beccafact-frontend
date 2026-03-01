import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-wrap">

      <!-- Left panel: form -->
      <div class="login-form-panel">
        <div class="lf-inner">

          <!-- Logo -->
          <div class="login-logo">
            <div class="logo-mark">
              <svg viewBox="0 0 28 28" fill="none">
                <path d="M4 20L10 9L16 15L20 9L25 18" stroke="#00c6a0" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <div>
              <div class="logo-name">BeccaFact</div>
              <div class="logo-sub">ERP Cloud · Beccasoft</div>
            </div>
          </div>

          <h1 class="form-headline">Iniciar sesión</h1>
          <p class="form-desc">Accede al panel de tu empresa</p>

          <form (ngSubmit)="login()" class="login-form">

            <!-- Email -->
            <div class="field-group">
              <label class="field-label" for="email">Correo electrónico</label>
              <div class="field-input-wrap">
                <div class="field-icon">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="16"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/></svg>
                </div>
                <input id="email" type="email" [(ngModel)]="email" name="email" required
                       placeholder="admin@empresa.com" autocomplete="email"
                       class="field-input" />
              </div>
            </div>

            <!-- Password -->
            <div class="field-group">
              <label class="field-label" for="password">Contraseña</label>
              <div class="field-input-wrap">
                <div class="field-icon">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="16"><path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"/></svg>
                </div>
                <input id="password" [type]="showPwd() ? 'text' : 'password'"
                       [(ngModel)]="password" name="password" required
                       placeholder="••••••••" autocomplete="current-password"
                       class="field-input" style="padding-right:44px" />
                <button type="button" class="pwd-toggle" (click)="togglePassword()">
                  @if (showPwd()) {
                    <svg viewBox="0 0 20 20" fill="currentColor" width="16"><path d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.451l1.514 1.514a4 4 0 00-5.478-5.48z"/><path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z"/></svg>
                  } @else {
                    <svg viewBox="0 0 20 20" fill="currentColor" width="16"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
                  }
                </button>
              </div>
            </div>

            <!-- Error -->
            @if (error()) {
              <div class="error-banner" role="alert">
                <svg viewBox="0 0 16 16" fill="currentColor" width="14"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"/></svg>
                {{ error() }}
              </div>
            }

            <!-- Submit -->
            <button type="submit" class="btn-login"
                    [disabled]="auth.isLoading() || !email || !password">
              @if (auth.isLoading()) {
                <span class="spinner"></span>
                Autenticando...
              } @else {
                Iniciar sesión
                <svg viewBox="0 0 20 20" fill="currentColor" width="16"><path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"/></svg>
              }
            </button>
          </form>

          <div class="form-footer">
            ¿Problemas para acceder?
            <a href="mailto:soporte@beccasoft.com">Contactar soporte</a>
          </div>
        </div>
      </div>

      <!-- Right panel: hero -->
      <div class="login-hero">
        <div class="hero-inner">
          <div class="hero-badge">✦ Certificado DIAN Colombia</div>
          <h2 class="hero-headline">Facturación electrónica<br>para empresas<br>que crecen.</h2>
          <p class="hero-desc">
            Emite facturas electrónicas, gestiona inventario y controla tu cartera,
            todo desde un solo panel integrado con la DIAN.
          </p>

          <div class="hero-features">
            @for (f of features; track f.label) {
              <div class="hf-item">
                <div class="hf-dot"></div>
                <span>{{ f.label }}</span>
              </div>
            }
          </div>

          <div class="hero-stats">
            <div class="hs-item">
              <div class="hs-val">+2.400</div>
              <div class="hs-label">Empresas activas</div>
            </div>
            <div class="hs-item">
              <div class="hs-val">+1.2M</div>
              <div class="hs-label">Facturas emitidas</div>
            </div>
            <div class="hs-item">
              <div class="hs-val">99.9%</div>
              <div class="hs-label">Uptime garantizado</div>
            </div>
          </div>
        </div>

        <!-- Decorative grid lines -->
        <div class="hero-grid" aria-hidden="true"></div>
        <!-- Decorative glow -->
        <div class="hero-glow" aria-hidden="true"></div>
      </div>
    </div>
  `,
  styles: [`
    .login-wrap {
      display: flex; min-height: 100vh; background: #f0f4f9;
    }

    /* ── Form panel ── */
    .login-form-panel {
      flex: 0 0 460px; background: #fff;
      display: flex; flex-direction: column; justify-content: center;
      box-shadow: 4px 0 32px rgba(12,28,53,0.08);
      position: relative; z-index: 2;
    }
    .lf-inner { padding: 56px 52px; }

    .login-logo {
      display: flex; align-items: center; gap: 14px; margin-bottom: 44px;
    }
    .logo-mark {
      width: 46px; height: 46px; border-radius: 12px;
      background: #0c1c35;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .logo-mark svg { width: 26px; height: 26px; }
    .logo-name {
      font-family: 'Sora', sans-serif; font-size: 20px; font-weight: 700; color: #0c1c35;
    }
    .logo-sub { font-size: 11px; color: #9ab5cc; margin-top: 1px; }

    .form-headline {
      font-family: 'Sora', sans-serif; font-size: 26px; font-weight: 700;
      color: #0c1c35; margin: 0 0 6px; letter-spacing: -0.03em;
    }
    .form-desc { font-size: 14px; color: #7ea3cc; margin: 0 0 32px; }

    .login-form { display: flex; flex-direction: column; gap: 0; }

    .field-group { margin-bottom: 20px; }
    .field-label {
      display: block; font-size: 13px; font-weight: 600;
      color: #3d5a80; margin-bottom: 7px; letter-spacing: 0.01em;
    }
    .field-input-wrap { position: relative; }
    .field-icon {
      position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
      color: #9ab5cc; display: flex; pointer-events: none;
    }
    .field-input {
      width: 100%; padding: 11px 14px 11px 38px;
      border: 1.5px solid #dce6f0; border-radius: 9px;
      font-size: 14px; color: #0c1c35; background: #f9fbfd;
      transition: border-color 0.18s, box-shadow 0.18s, background 0.18s;
      box-sizing: border-box;
    }
    .field-input:focus {
      outline: none; border-color: #1a407e; background: #fff;
      box-shadow: 0 0 0 3px rgba(26,64,126,0.1);
    }
    .field-input::placeholder { color: #b0c8df; }
    .pwd-toggle {
      position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
      background: none; border: none; cursor: pointer; color: #9ab5cc;
      display: flex; align-items: center; transition: color 0.15s; padding: 2px;
    }
    .pwd-toggle:hover { color: #1a407e; }

    .error-banner {
      display: flex; align-items: center; gap: 8px;
      background: #fee2e2; color: #991b1b; padding: 10px 14px;
      border-radius: 8px; font-size: 13.5px; margin-bottom: 16px;
      border-left: 3px solid #ef4444;
    }

    .btn-login {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      width: 100%; padding: 13px;
      background: linear-gradient(135deg, #1a407e, #1e4d94);
      color: #fff; border: none; border-radius: 9px;
      font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 700;
      cursor: pointer; letter-spacing: -0.01em; margin-top: 8px;
      box-shadow: 0 4px 16px rgba(26,64,126,0.28);
      transition: all 0.2s;
    }
    .btn-login:hover:not(:disabled) {
      background: linear-gradient(135deg, #122f5c, #1a407e);
      transform: translateY(-1px);
      box-shadow: 0 6px 22px rgba(26,64,126,0.38);
    }
    .btn-login:disabled { opacity: 0.6; cursor: not-allowed; }
    .spinner {
      width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3);
      border-top-color: #fff; border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .form-footer {
      text-align: center; margin-top: 28px; font-size: 13px; color: #9ab5cc;
    }
    .form-footer a { color: #1a407e; font-weight: 600; }
    .form-footer a:hover { color: #00c6a0; }

    /* ── Hero panel ── */
    .login-hero {
      flex: 1; background: #0c1c35; position: relative;
      display: flex; flex-direction: column; justify-content: center;
      overflow: hidden;
    }
    .hero-inner {
      position: relative; z-index: 2; padding: 72px 64px;
    }
    .hero-badge {
      display: inline-flex; align-items: center; gap: 7px;
      background: rgba(0,198,160,0.12); color: #00c6a0;
      border: 1px solid rgba(0,198,160,0.25); padding: 5px 14px;
      border-radius: 9999px; font-size: 12.5px; font-weight: 700;
      letter-spacing: 0.04em; margin-bottom: 28px;
    }
    .hero-headline {
      font-family: 'Sora', sans-serif; font-size: 40px; font-weight: 800;
      color: #fff; line-height: 1.18; margin: 0 0 20px;
      letter-spacing: -0.04em;
    }
    .hero-desc { font-size: 15px; color: #5a80a8; line-height: 1.7; margin: 0 0 36px; max-width: 420px; }

    .hero-features { display: flex; flex-direction: column; gap: 12px; margin-bottom: 48px; }
    .hf-item { display: flex; align-items: center; gap: 12px; }
    .hf-dot {
      width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
      background: linear-gradient(135deg, #1a407e, #00c6a0);
      box-shadow: 0 0 8px rgba(0,198,160,0.4);
    }
    .hf-item span { font-size: 14.5px; color: #d4e4f7; font-weight: 500; }

    .hero-stats {
      display: flex; gap: 0;
      background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
      border-radius: 12px; overflow: hidden;
    }
    .hs-item {
      flex: 1; padding: 18px 20px; text-align: center;
      border-right: 1px solid rgba(255,255,255,0.08);
    }
    .hs-item:last-child { border-right: none; }
    .hs-val {
      font-family: 'Sora', sans-serif; font-size: 22px; font-weight: 800;
      color: #00c6a0; margin-bottom: 2px;
    }
    .hs-label { font-size: 11.5px; color: #4d7ab3; }

    /* Decorative */
    .hero-grid {
      position: absolute; inset: 0; z-index: 1; pointer-events: none;
      background-image:
        linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
      background-size: 48px 48px;
    }
    .hero-glow {
      position: absolute; bottom: -100px; right: -100px;
      width: 500px; height: 500px; border-radius: 50%;
      background: radial-gradient(circle, rgba(0,198,160,0.12) 0%, transparent 70%);
      pointer-events: none; z-index: 1;
    }

    @media (max-width: 900px) {
      .login-hero { display: none; }
      .login-form-panel { flex: 1; }
      .lf-inner { padding: 40px 28px; }
    }
  `],
})
export class LoginComponent {
  email = '';
  password = '';
  showPwd = signal(false);
  error = signal('');

  features = [
    { label: 'Facturación electrónica certificada DIAN' },
    { label: 'Inventario y cartera integrados' },
    { label: 'Importación masiva de productos' },
    { label: 'Multi-empresa en un solo panel' },
    { label: 'Nómina electrónica incluida' },
  ];

  constructor(protected auth: AuthService) {}

  login() {
    this.error.set('');
    this.auth.login(this.email, this.password).subscribe({
      error: (err) => {
        this.error.set(err.error?.error?.message || err.error?.message || 'Credenciales inválidas. Verifica tu email y contraseña.');
      },
    });
  }

  togglePassword() {
  this.showPwd.update(v => !v);
}
}
