import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ErrorHandlerService } from '../../services/error-handler.service';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['../../auth.scss'],
  standalone: true,
  imports: [RouterModule, CommonModule, ReactiveFormsModule]
})
export class LoginComponent {
  loginForm: FormGroup;
  isLoading = false;
  errorMessage: string = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private errorHandler: ErrorHandlerService
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });
  }

  async onSubmit() {
    if (this.loginForm.valid) {
      this.isLoading = true;
      this.errorMessage = '';
      try {
        await this.authService.login(
          this.loginForm.get('email')?.value,
          this.loginForm.get('password')?.value
        );
        this.router.navigate(['/dashboard']);
      } catch (error: any) {
        console.error('Login Error:', error.message);
        this.errorMessage = 'An error occurred during login';
        this.errorHandler.handleError(error);
      } finally {
        this.isLoading = false;
      }
    }
  }
}
