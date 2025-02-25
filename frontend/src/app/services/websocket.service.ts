import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject, timer } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { retryWhen, delay, takeUntil } from 'rxjs/operators';

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
}

@Injectable({
  providedIn: 'root'
})
export class WebSocketService implements OnDestroy {
  private socket: WebSocket | null = null;
  private destroy$ = new Subject<void>();
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly RECONNECT_INTERVAL = 3000; // 3 seconds

  private messageSubject = new Subject<WebSocketMessage>();
  private connectionStatusSubject = new BehaviorSubject<boolean>(false);

  public messages$ = this.messageSubject.asObservable();
  public connectionStatus$ = this.connectionStatusSubject.asObservable();

  constructor(private authService: AuthService) {
    this.connect();
  }

  private connect(): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      console.log('WebSocket is already connected');
      return;
    }

    const idToken = this.authService.getIdToken();
    const wsUrl = `${environment.webSocketUrl}?token=${idToken}`;

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        console.log('WebSocket connected');
        this.connectionStatusSubject.next(true);
        this.reconnectAttempts = 0;
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('WebSocket message received:', data);
          this.messageSubject.next({
            type: data.type || 'info',
            data: data,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.socket.onclose = () => {
        console.log('WebSocket connection closed');
        this.connectionStatusSubject.next(false);
        this.handleReconnection();
      };

      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.connectionStatusSubject.next(false);
      };

    } catch (error) {
      console.error('Error creating WebSocket:', error);
      this.handleReconnection();
    }
  }

  private handleReconnection(): void {
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      console.log('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})...`);

    timer(this.RECONNECT_INTERVAL)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.connect());
  }

  public send(message: any): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    } else {
      console.error('WebSocket is not connected');
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.socket) {
      this.socket.close();
    }
  }
} 