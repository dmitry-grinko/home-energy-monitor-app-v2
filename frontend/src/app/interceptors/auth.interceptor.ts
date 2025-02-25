import { HttpHandlerFn, HttpInterceptorFn, HttpRequest, HttpErrorResponse, HttpEvent, HttpHeaders } from "@angular/common/http";
import { inject } from "@angular/core";
import { AuthService } from "../services/auth.service";
import { catchError, switchMap, throwError, Observable, from } from "rxjs";
import { environment } from "../../environments/environment";

interface RouteSettings {
  path: string;
  accessToken: boolean;
  idToken: boolean;
}

const routeSettings: RouteSettings[] = [
  { path: 'auth', accessToken: false, idToken: false },
  { path: 'csv-storage-bucket-dev', accessToken: false, idToken: false },
  { path: 'energy', accessToken: true, idToken: true },
  { path: 'alerts', accessToken: true, idToken: true },
  { path: 'presigned-url', accessToken: true, idToken: true },
  { path: 'prediction', accessToken: true, idToken: true },
  { path: 'model', accessToken: true, idToken: true }, // run step functions
  { path: 'execute', accessToken: true, idToken: true }, // send email
  // Default settings for other routes
  { path: '/', accessToken: false, idToken: false }
];

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>, 
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {  
  const authService = inject(AuthService);
  const modifiedReq = addApiUrl(req);
  return handleAuthenticatedRequest(modifiedReq, next, authService);
};

function addApiUrl(req: HttpRequest<unknown>): HttpRequest<unknown> {
  if (!req.url.startsWith('http')) {
    const url = `${environment.apiUrl}${req.url}`;
    return req.clone({ url });
  }
  return req;
}

function getRouteSettings(url: string): RouteSettings {
  return routeSettings.find(setting => url.includes(setting.path)) || 
         routeSettings[routeSettings.length - 1];
}

function handleAuthenticatedRequest(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  authService: AuthService
): Observable<HttpEvent<unknown>> {
  const settings = getRouteSettings(req.url);
  
  if (!settings.accessToken) {
    return next(req);
  }

  const token = authService.getAccessToken();
  if (!token) {
    return next(req);
  }

  const authenticatedReq = req.clone({ 
    headers: createAuthHeaders(req.url, token, authService, req.headers) 
  });

  return next(authenticatedReq).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        return handleTokenRefresh(authenticatedReq, next, authService);
      }
      return throwError(() => error);
    })
  );
}

function handleTokenRefresh(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  authService: AuthService
): Observable<HttpEvent<unknown>> {
  return from(authService.refreshToken()).pipe(
    switchMap(() => {
      const newToken = authService.getAccessToken();
      

      if (!newToken) {
        return throwError(() => new Error('Token refresh failed'));
      }


      const retryReq = req.clone({ 
        headers: createAuthHeaders(req.url, newToken, authService, req.headers)
      });
      return next(retryReq);
    }),
    catchError(error => throwError(() => error))
  );
}

function createAuthHeaders(
  url: string, 
  accessToken: string, 
  authService: AuthService,
  existingHeaders: HttpHeaders
): HttpHeaders {
  let headers = existingHeaders.set('Authorization', `Bearer ${accessToken}`);
  
  const settings = getRouteSettings(url);
  if (settings.idToken) {
    const idToken = authService.getIdToken();
    if (idToken) {
      headers = headers.set('X-Id-Token', idToken);
    }
  }
  
  return headers;
}