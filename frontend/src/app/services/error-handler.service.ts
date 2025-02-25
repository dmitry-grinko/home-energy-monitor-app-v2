import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface ErrorMessage {
  message: string;
  type: 'error' | 'warning' | 'info';
}

@Injectable({
  providedIn: 'root'
})
export class ErrorHandlerService {
  private errorSubject = new Subject<ErrorMessage>();
  public error$ = this.errorSubject.asObservable();

  handleError(error: any): void {
    let message = 'An unexpected error occurred';
    
    if (error.response) {
      message = error.response.data.message || error.response.data || message;
    } else if (error.message) {
      message = error.message;
    }

    this.errorSubject.next({
      message,
      type: 'error'
    });
  }

  showSuccess(message: string): void {
    this.errorSubject.next({
      message,
      type: 'info'
    });
  }
}
