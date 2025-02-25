import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ErrorHandlerService } from '../../services/error-handler.service';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-confirm-email',
  templateUrl: './confirm-email.component.html',
  styleUrls: ['../../auth.scss'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink]
})
export class ConfirmEmailComponent implements OnInit {
  confirmationForm: FormGroup;
  isLoading = false;
  email: string | null = null;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private errorHandler: ErrorHandlerService
  ) {
    this.confirmationForm = this.fb.group({
      code: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  ngOnInit() {
    this.email = localStorage.getItem('confirmationEmail');
    if (!this.email) {
      // If no email found, redirect to signup
      this.router.navigate(['/auth/signup']);
    }
  }

  async onSubmit() {
    if (this.confirmationForm.valid && this.email) {
      this.isLoading = true;
      try {
        await this.authService.confirmEmail(
          this.email,
          this.confirmationForm.get('code')?.value
        );
        localStorage.removeItem('confirmationEmail');
        // After successful confirmation, redirect to login
        this.router.navigate(['/auth/login']);
      } catch (error) {
        this.errorHandler.handleError(error);
      } finally {
        this.isLoading = false;
      }
    }
  }

  async resendCode() {
    if (this.email) {
      this.isLoading = true;
      try {
        // You'll need to add this method to your AuthService
        await this.authService.resendConfirmationCode(this.email);
        this.errorHandler.showSuccess('New confirmation code sent!');
      } catch (error) {
        this.errorHandler.handleError(error);
      } finally {
        this.isLoading = false;
      }
    }
  }
}
