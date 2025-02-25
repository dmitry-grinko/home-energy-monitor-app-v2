import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { ErrorHandlerService } from '../../services/error-handler.service';
import { Router } from '@angular/router';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-new-password',
  templateUrl: './new-password.component.html',
  styleUrls: ['../../auth.scss'],
  standalone: true,
  imports: [RouterModule, CommonModule, ReactiveFormsModule]
})
export class NewPasswordComponent implements OnInit {
  resetPasswordForm: FormGroup;
  isLoading = false;
  email: string | null = null;
  errorMessage: string | null = null;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private errorHandler: ErrorHandlerService,
    private router: Router
  ) {
    this.resetPasswordForm = this.fb.group({
      code: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(8)]]
    });
  }

  ngOnInit() {
    this.email = this.authService.getResetEmail();
    if (!this.email) {
      this.router.navigate(['/auth/forgot-password']);
    }
  }

  async onSubmit() {
    if (this.resetPasswordForm.valid && this.email) {
      this.isLoading = true;
      this.errorMessage = null;
      try {
        await this.authService.confirmPasswordReset(
          this.email,
          this.resetPasswordForm.get('code')?.value,
          this.resetPasswordForm.get('newPassword')?.value
        );
        await this.router.navigate(['/auth/login']);
      } catch (error) {
        this.errorMessage = error instanceof Error ? error.message : 'Failed to reset password';
        this.errorHandler.handleError(error);
      } finally {
        this.isLoading = false;
      }
    }
  }
}
