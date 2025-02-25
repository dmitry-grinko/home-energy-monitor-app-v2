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
    // Remove automatic connection from constructor
  }

  public connect(): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      console.log('[WebSocketService] WebSocket is already connected');
      return;
    }

    const idToken = this.authService.getIdToken();
    const wsUrl = `${environment.webSocketUrl}?auth=${idToken}`;
    console.log('[WebSocketService] Connecting to:', wsUrl);

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        console.log('[WebSocketService] WebSocket connection established successfully');
        this.connectionStatusSubject.next(true);
        this.reconnectAttempts = 0;
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[WebSocketService] Message received:', {
            type: data.type,
            timestamp: new Date().toISOString(),
            data: data
          });
          this.messageSubject.next({
            type: data.type || 'info',
            data: data,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          console.error('[WebSocketService] Error parsing message:', error, 'Raw message:', event.data);
        }
      };

      this.socket.onclose = (event) => {
        console.log('[WebSocketService] Connection closed:', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean
        });
        this.connectionStatusSubject.next(false);
        this.handleReconnection();
      };

      this.socket.onerror = (error) => {
        console.error('[WebSocketService] WebSocket error:', error);
        this.connectionStatusSubject.next(false);
      };

    } catch (error) {
      console.error('[WebSocketService] Error creating WebSocket:', error);
      this.handleReconnection();
    }
  }

  private handleReconnection(): void {
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      console.log('[WebSocketService] Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    console.log(`[WebSocketService] Attempting to reconnect (${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS}) in ${this.RECONNECT_INTERVAL}ms`);

    timer(this.RECONNECT_INTERVAL)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.connect());
  }

  public send(message: any): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      console.log('[WebSocketService] Sending message:', message);
      this.socket.send(JSON.stringify(message));
    } else {
      console.error('[WebSocketService] Cannot send message - WebSocket is not connected. Current state:', this.socket?.readyState);
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