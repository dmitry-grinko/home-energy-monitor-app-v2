import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject, timer, Subscription } from 'rxjs';
import { takeUntil, filter, map } from 'rxjs/operators';
// import { environment } from '../../environments/environment';

interface AuthTokens {
  accessToken: string;
  idToken: string;
  refreshToken?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService implements OnDestroy {
  private readonly REFRESH_INTERVAL = 55 * 60 * 1000; // 55 minutes
  // private readonly TOKEN_EXPIRY_BUFFER = 5 * 60 * 1000; // 5 minutes

  private accessTokenSubject = new BehaviorSubject<string | null>(null);
  private idTokenSubject = new BehaviorSubject<string | null>(null);
  private refreshInProgress = false;
  private refreshSubscription?: Subscription;
  private destroy$ = new Subject<void>();
  private initialized = new BehaviorSubject<boolean>(false);
  private resetEmailSubject = new BehaviorSubject<string | null>(null);

  public accessToken$ = this.accessTokenSubject.asObservable();
  public idToken$ = this.idTokenSubject.asObservable();
  public isAuthenticated$ = this.accessToken$.pipe(
    map(token => !!token)
  );
  public resetEmail$ = this.resetEmailSubject.asObservable();

  constructor(private http: HttpClient) {
    // Initialize authentication state
    this.refreshToken()
      .catch((error) => {
        // Clear both tokens on error
        this.accessTokenSubject.next(null);
        this.idTokenSubject.next(null);
        console.warn('Failed to refresh tokens on startup', error);
      })
      .finally(() => this.initialized.next(true));
    this.setupRefreshTimer();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.refreshSubscription?.unsubscribe();
  }

  private setupRefreshTimer() {
    this.refreshSubscription?.unsubscribe();
    
    this.refreshSubscription = timer(this.REFRESH_INTERVAL)
      .pipe(
        takeUntil(this.destroy$),
        filter(() => !!this.accessTokenSubject.value)
      )
      .subscribe(() => {
        this.refreshToken();
      });
  }

  private setTokens(tokens: AuthTokens) {
    this.accessTokenSubject.next(tokens.accessToken);
    this.idTokenSubject.next(tokens.idToken);
    this.setupRefreshTimer();
  }

  public async login(email: string, password: string): Promise<void> {
    try {
      const response = await this.http.post<AuthTokens>('/auth/login', 
        { email, password }, 
        { withCredentials: true }
      ).toPromise();
      
      if (response) {
        this.setTokens(response);
      }
    } catch (error) {
      this.logout();
      throw error;
    }
  }

  public async refreshToken(): Promise<void> {
    if (this.refreshInProgress) {
      return;
    }

    this.refreshInProgress = true;

    try {
      const response = await this.http.post<Omit<AuthTokens, 'refreshToken'>>(
        '/auth/refresh', 
        {}, 
        { withCredentials: true }
      ).toPromise();
      
      if (response) {
        this.accessTokenSubject.next(response.accessToken);
        this.idTokenSubject.next(response.idToken);
        this.setupRefreshTimer();
      }
    } catch (error) {
      this.accessTokenSubject.next(null);
      this.idTokenSubject.next(null);
      throw error;
    } finally {
      this.refreshInProgress = false;
    }
  }

  public logout(): void {
    this.accessTokenSubject.next(null);
    this.idTokenSubject.next(null);
    // Call logout endpoint which will clear the cookie
    this.http.post('/auth/logout', {}, { withCredentials: true }).subscribe();
    this.refreshSubscription?.unsubscribe();
  }

  public async signup(email: string, password: string): Promise<void> {
    try {
      await this.http.post('/auth/signup', 
        { email, password }
      ).toPromise();
      
      // Store email temporarily for confirmation page
      localStorage.setItem('confirmationEmail', email);
      
    } catch (error) {
      throw error;
    }
  }

  public async confirmEmail(email: string, code: string): Promise<void> {
    try {
      await this.http.post('/auth/verify', { email, code }).toPromise();
    } catch (error) {
      throw error;
    }
  }

  public async verify(token: string): Promise<void> {
    await this.http.post('/auth/verify', { token }).toPromise();
  }

  public async requestPasswordReset(email: string): Promise<void> {
    try {
      await this.http.post('/auth/forgot-password', { email }).toPromise();
      this.resetEmailSubject.next(email);
    } catch (error) {
      this.resetEmailSubject.next(null);
      throw error;
    }
  }

  public async confirmPasswordReset(email: string, code: string, newPassword: string): Promise<void> {
    try {
      await this.http.post('/auth/password-reset', { 
        email, 
        code, 
        newPassword 
      }).toPromise();
      this.resetEmailSubject.next(null);
    } catch (error) {
      throw error;
    }
  }

  public isInitialized(): Observable<boolean> {
    return this.initialized.asObservable();
  }

  public getAccessToken(): string | null {
    return this.accessTokenSubject.value;
  }

  public getIdToken(): string | null {
    return this.idTokenSubject.value;
  }

  public async resendConfirmationCode(email: string): Promise<void> {
    try {
      await this.http.post('/auth/resend-code', { email }).toPromise();
    } catch (error) {
      throw error;
    }
  }

  public getResetEmail(): string | null {
    return this.resetEmailSubject.value;
  }
}
