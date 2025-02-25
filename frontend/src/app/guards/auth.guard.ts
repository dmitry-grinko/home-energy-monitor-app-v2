import { Injectable } from '@angular/core';
import { 
  CanActivate, 
  ActivatedRouteSnapshot, 
  RouterStateSnapshot, 
  Router,
  UrlTree
} from '@angular/router';
import { Observable, firstValueFrom } from 'rxjs';
import { map, take, filter, switchMap } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  async canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Promise<boolean | UrlTree> {
    // Wait for initialization
    await firstValueFrom(this.authService.isInitialized().pipe(
      filter(initialized => initialized)
    ));

    // Check authentication
    const isAuthenticated = await firstValueFrom(this.authService.isAuthenticated$.pipe(
      take(1)
    ));

    if (!isAuthenticated) {
      return this.router.parseUrl(`/auth/login?returnUrl=${state.url}`);
    }

    return true;
  }
}
