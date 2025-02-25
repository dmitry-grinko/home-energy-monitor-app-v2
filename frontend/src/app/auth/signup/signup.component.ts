import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ErrorHandlerService } from '../../services/error-handler.service';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-signup',
  templateUrl: './signup.component.html',
  styleUrls: ['../../auth.scss'],
  standalone: true,
  imports: [RouterModule, CommonModule, ReactiveFormsModule]
})
export class SignupComponent {
  signupForm: FormGroup;
  isLoading = false;
  errorMessage: string = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private errorHandler: ErrorHandlerService
  ) {
    this.signupForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  async onSubmit() {
    if (this.signupForm.valid) {
      this.isLoading = true;
      this.errorMessage = '';
      try {
        await this.authService.signup(
          this.signupForm.get('email')?.value,
          this.signupForm.get('password')?.value
        );
        this.router.navigate(['/auth/confirm-email']);
      } catch (error: any) {
        console.error('Signup Error:', error.message);
        this.errorMessage = 'An error occurred during signup';
        this.errorHandler.handleError(error);
      } finally {
        this.isLoading = false;
      }
    }
  }
}
