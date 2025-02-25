import { Component, OnInit, OnDestroy } from '@angular/core';
import { NgbToastModule } from '@ng-bootstrap/ng-bootstrap';
import { CommonModule } from '@angular/common';
import { WebSocketService, WebSocketMessage } from '../../services/websocket.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule, NgbToastModule],
  template: `
    <div class="toast-container position-fixed top-0 end-0 p-3">
      <ngb-toast
        *ngFor="let toast of toasts"
        [class]="'bg-' + toast.type"
        [autohide]="true"
        [delay]="5000"
        (hidden)="removeToast(toast)"
      >
        <div class="d-flex">
          <div class="toast-body text-white">
            {{ toast.data?.message || JSON.stringify(toast.data) }}
          </div>
          <button type="button" class="btn-close btn-close-white me-2 m-auto" (click)="removeToast(toast)"></button>
        </div>
      </ngb-toast>
    </div>
  `,
  styles: [`
    :host {
      z-index: 1200;
    }
  `]
})
export class ToastComponent implements OnInit, OnDestroy {
  toasts: WebSocketMessage[] = [];
  private destroy$ = new Subject<void>();

  constructor(private webSocketService: WebSocketService) {}

  ngOnInit(): void {
    this.webSocketService.messages$
      .pipe(takeUntil(this.destroy$))
      .subscribe(message => {
        this.toasts.push(message);
      });

    this.webSocketService.connectionStatus$
      .pipe(takeUntil(this.destroy$))
      .subscribe(isConnected => {
        if (!isConnected) {
          this.toasts.push({
            type: 'warning',
            data: { message: 'WebSocket connection lost. Attempting to reconnect...' },
            timestamp: new Date().toISOString()
          });
        }
      });
  }

  removeToast(toast: WebSocketMessage): void {
    this.toasts = this.toasts.filter(t => t !== toast);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
} 