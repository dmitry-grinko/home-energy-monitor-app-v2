import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { ErrorHandlerService } from '../../services/error-handler.service';
import { Router } from '@angular/router';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.component.html',
  styleUrls: ['../../auth.scss'],
  standalone: true,
  imports: [RouterModule, CommonModule, ReactiveFormsModule]
})
export class ForgotPasswordComponent {
  forgotPasswordForm: FormGroup;
  isLoading = false;
  errorMessage: string | null = null;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private errorHandler: ErrorHandlerService,
    private router: Router
  ) {
    this.forgotPasswordForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  async onSubmit() {
    if (this.forgotPasswordForm.valid) {
      this.isLoading = true;
      this.errorMessage = null;
      try {
        await this.authService.requestPasswordReset(
          this.forgotPasswordForm.get('email')?.value
        );
        await this.router.navigate(['/auth/new-password']);
      } catch (error) {
        this.errorMessage = error instanceof Error ? error.message : 'Failed to send reset code';
        this.errorHandler.handleError(error);
      } finally {
        this.isLoading = false;
      }
    }
  }
}
