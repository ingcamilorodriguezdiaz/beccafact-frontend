import { Injectable, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap, catchError, EMPTY } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isSuperAdmin: boolean;
  companyId: string | null;
  roles: string[];
  company?: {
    id: string;
    name: string;
    nit: string;
    status: string;
    subscriptions: Array<{
      plan: {
        id: string;
        name: string;
        displayName: string;
        features: Array<{ key: string; value: string }>;
      };
    }>;
  };
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: User;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly API = `${environment.apiUrl}/auth`;

  private _user        = signal<User | null>(null);
  private _isLoading   = signal(false);
  private _authChecked = signal(false);

  readonly user            = this._user.asReadonly();
  readonly isLoading       = this._isLoading.asReadonly();
  readonly authChecked     = this._authChecked.asReadonly();
  readonly isAuthenticated = computed(() => !!this._user());
  readonly isSuperAdmin    = computed(() => this._user()?.isSuperAdmin ?? false);

  readonly currentPlan = computed(() => {
    const subs = this._user()?.company?.subscriptions;
    return subs?.[0]?.plan ?? null;
  });

  readonly planFeatures = computed(() => {
    const features = this.currentPlan()?.features ?? [];
    return features.reduce(
      (acc, f) => ({ ...acc, [f.key]: f.value }),
      {} as Record<string, string>,
    );
  });

  readonly hasFeature = (key: string) =>
    computed(() => {
      if (this.isSuperAdmin()) return true;
      const val = this.planFeatures()[key];
      return val !== undefined && val !== 'false' && val !== '0';
    });

  // ── CONSTRUCTOR LIMPIO: sin HttpClient ──────────────────────
  // La inicialización de sesión ocurre en APP_INITIALIZER (app.config.ts)
  // para evitar la dependencia circular con authInterceptor.
  constructor(private http: HttpClient, private router: Router) {}

  /**
   * Llamado desde APP_INITIALIZER — después de que HttpClient
   * e interceptores ya están completamente construidos.
   */
  initSession(): Promise<void> {
    const token = this.getAccessToken();
    if (!token) {
      this._authChecked.set(true);
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.loadProfile().subscribe({
        next: () => {
          this._authChecked.set(true);
          resolve();
        },
        error: (err) => {
          console.warn('Session init failed:', err?.status);
          this.clearSession();
          resolve(); // siempre resolver para no bloquear el arranque
        },
      });
    });
  }

  login(email: string, password: string) {
    this._isLoading.set(true);
    return this.http.post<AuthTokens>(`${this.API}/login`, { email, password }).pipe(
      tap(({ accessToken, refreshToken, user }) => {
        this.saveTokens(accessToken, refreshToken);
        this._user.set(user);
        this._authChecked.set(true);
        this._isLoading.set(false);
        if (user.isSuperAdmin) {
          this.router.navigate(['/super-admin']);
        } else {
          this.router.navigate(['/dashboard']);
        }
      }),
      catchError((err) => {
        this._isLoading.set(false);
        throw err;
      }),
    );
  }

  logout() {
    const token = this.getRefreshToken();
    if (token) {
      this.http.post(`${this.API}/logout`, {}).subscribe();
    }
    this.clearSession();
    this.router.navigate(['/auth/login']);
  }

  refreshToken() {
    const refreshToken = this.getRefreshToken();
    const userId = this._user()?.id ?? this.getUserIdFromToken();
    if (!refreshToken || !userId) return EMPTY;

    return this.http
      .post<{ accessToken: string; refreshToken: string }>(`${this.API}/refresh`, {
        userId,
        refreshToken,
      })
      .pipe(tap((res) => this.saveTokens(res.accessToken, res.refreshToken)));
  }

  loadProfile() {
    return this.http.get<User>(`${this.API}/me`).pipe(
      tap((user) => this._user.set(user)),
    );
  }

  hasAnyRole = (roles: string[]) => () => {
    const userRoles = this.user()?.roles ?? [];
    return userRoles.some(r => roles.includes(r));
  };

  getAccessToken(): string | null {
    return localStorage.getItem('access_token');
  }

  private getRefreshToken(): string | null {
    return localStorage.getItem('refresh_token');
  }

  private saveTokens(access: string, refresh: string) {
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
  }

  private clearSession() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    this._user.set(null);
    this._authChecked.set(true);
  }

  private getUserIdFromToken(): string | null {
    try {
      const token = this.getAccessToken();
      if (!token) return null;
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload?.sub ?? payload?.id ?? null;
    } catch {
      return null;
    }
  }
}