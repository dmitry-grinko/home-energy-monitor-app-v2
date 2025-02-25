import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { provideRouter } from '@angular/router';
import { routes } from './app/app.routes';
import { authInterceptor } from './app/interceptors/auth.interceptor';
import { HttpInterceptorFn, withFetch, withInterceptors, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClient } from '@angular/common/http';
import { Chart } from 'chart.js';
import { CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';

Chart.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const appConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor ]), withFetch()),
  ]
}

bootstrapApplication(AppComponent, appConfig).catch((err) => console.error(err));
