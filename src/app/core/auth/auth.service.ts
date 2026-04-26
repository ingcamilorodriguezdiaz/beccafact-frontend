import { Injectable, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap, catchError, EMPTY } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface UserBranch {
  id: string;
  branchId: string;
  branch: { id: string; name: string; isMain: boolean; isActive: boolean };
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  isSuperAdmin: boolean;
  hasSeenTour: boolean;
  companyId: string | null;
  roles: string[];
  userBranches?: UserBranch[];
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
  private static readonly BRANCH_KEY = 'active_branch_id';

  private _user          = signal<User | null>(null);
  private _isLoading     = signal(false);
  private _authChecked   = signal(false);
  private _activeBranchId = signal<string | null>(null);

  readonly user            = this._user.asReadonly();
  readonly isLoading       = this._isLoading.asReadonly();
  readonly authChecked     = this._authChecked.asReadonly();
  readonly isAuthenticated = computed(() => !!this._user());
  readonly isSuperAdmin    = computed(() => this._user()?.isSuperAdmin ?? false);
  readonly activeBranchId  = this._activeBranchId.asReadonly();

  /** True when user has multiple branches and hasn't selected one yet */
  readonly needsBranchSelection = computed(() => {
    const u = this._user();
    console.log("validar sucursales:",u);
    if (!u || u.isSuperAdmin || !u.companyId) return false;
    const branches = u.userBranches ?? [];
    return branches.length > 1 && this._activeBranchId() === null;
  });

  readonly activeBranch = computed((): UserBranch | null => {
    const u = this._user();
    const id = this._activeBranchId();
    if (!id || !u?.userBranches) return null;
    return u.userBranches.find(ub => ub.branch.id === id) ?? null;
  });

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

  readonly isAdmin    = computed(() => this._user()?.roles?.includes('ADMIN') ?? false);
  readonly isManager  = computed(() => this._user()?.roles?.includes('MANAGER') ?? false);
  readonly isOperator = computed(() => this._user()?.roles?.includes('OPERATOR') ?? false);
  readonly isCajero   = computed(() => this._user()?.roles?.includes('CAJERO') ?? false);
  readonly isContador = computed(() => this._user()?.roles?.includes('CONTADOR') ?? false);

  /** Can manage (create/update/delete) — ADMIN or MANAGER */
  readonly canManage  = computed(() => this.isAdmin() || this.isManager() || this.isSuperAdmin());
  /** Can operate (create invoices, POS, basic ops) */
  readonly canOperate = computed(() => this.isAdmin() || this.isManager() || this.isOperator() || this.isCajero() || this.isSuperAdmin());

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
        next: (user) => {
          this._applyBranchDefaults(user);
          this._authChecked.set(true);
          resolve();
        },
        error: (err) => {
          console.warn('Session init failed:', err?.status);
          this.clearSession();
          resolve();
        },
      });
    });
  }

  login(email: string, password: string) {
    this._isLoading.set(true);
    return this.http.post<AuthTokens>(`${this.API}/login`, { email, password }).pipe(
      tap(({ accessToken, refreshToken, user }) => {
        this.saveTokens(accessToken, refreshToken);
        if (user && user.userBranches?.length === 1) {
          const onlyBranch = user.userBranches[0];
          this.selectBranch(onlyBranch.branch.id);
        }
        this._user.set(user);
        this._applyBranchDefaults(user);
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

  selectBranch(branchId: string): void {
    this._activeBranchId.set(branchId);
    localStorage.setItem(AuthService.BRANCH_KEY, branchId);
  }

  /** Clears the active branch so the selector modal re-appears */
  clearBranchSelection(): void {
    this._activeBranchId.set(null);
    localStorage.removeItem(AuthService.BRANCH_KEY);
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
    localStorage.removeItem(AuthService.BRANCH_KEY);
    this._user.set(null);
    this._activeBranchId.set(null);
    this._authChecked.set(true);
  }

  /** Auto-selects branch on login/session restore:
   *  - If stored in localStorage and still valid → restore it
   *  - If user has exactly 1 branch → auto-select it
   *  - Otherwise → leave null so needsBranchSelection triggers the modal
   */
  private _applyBranchDefaults(user: User): void {
    if (user.isSuperAdmin || !user.companyId) return;

    const branches = user.userBranches ?? [];
    const stored = localStorage.getItem(AuthService.BRANCH_KEY);

    if (stored && branches.some(ub => ub.branch.id === stored)) {
      this._activeBranchId.set(stored);
      return;
    }

    if (branches.length === 1) {
      this.selectBranch(branches[0].branch.id);
      return;
    }

    // Multiple branches with no stored selection: show modal
    this._activeBranchId.set(null);
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
