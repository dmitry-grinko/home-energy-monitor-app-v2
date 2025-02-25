import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { LoginComponent } from './auth/login/login.component';
import { ForgotPasswordComponent } from './auth/forgot-password/forgot-password.component';
import { SignupComponent } from './auth/signup/signup.component';
import { AuthGuard } from './guards/auth.guard';
import { ConfirmEmailComponent } from './auth/confirm-email/confirm-email.component';
import { NewPasswordComponent } from './auth/new-password/new-password.component';
export const routes: Routes = [
  { path: '', component: HomeComponent },
  { 
    path: 'auth',
    children: [
      { path: 'login', component: LoginComponent },
      { path: 'signup', component: SignupComponent },
      { path: 'forgot-password', component: ForgotPasswordComponent },
      { path: 'confirm-email', component: ConfirmEmailComponent },
      { path: 'new-password', component: NewPasswordComponent }
    ]
  },
  { 
    path: 'dashboard', 
    component: DashboardComponent,
    canActivate: [AuthGuard]
  }
];
