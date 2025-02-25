import { Component, OnInit, OnDestroy } from '@angular/core';
import { ManualDataInputComponent } from './components/manual-data-input/manual-data-input.component';
import { NgbNavModule } from '@ng-bootstrap/ng-bootstrap';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { FileUploadComponent } from './components/file-upload/file-upload.component';
import { HistoricalDataComponent } from './components/historical-data/historical-data.component';
import { DataVisualizationComponent } from './components/data-visualization/data-visualization.component';
import { AlertsNotificationsComponent } from './components/alerts-notifications/alerts-notifications.component';
import { NgIf } from '@angular/common';
import { PredictionComponent } from './components/prediction/prediction.component';
import { WebSocketService, WebSocketMessage } from '../services/websocket.service';
import { Subscription } from 'rxjs';
import { ToastComponent } from './components/toast/toast.component';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  standalone: true,
  imports: [
    ManualDataInputComponent, 
    NgbNavModule, 
    FileUploadComponent,
    HistoricalDataComponent,
    DataVisualizationComponent,
    AlertsNotificationsComponent,
    PredictionComponent,
    NgIf,
    ToastComponent
  ]
})
export class DashboardComponent implements OnInit, OnDestroy {
  selectedContent: string = 'manual-input';  // Default selected content
  private wsSubscription?: Subscription;

  constructor(
    private modalService: NgbModal,
    private webSocketService: WebSocketService
  ) {}

  ngOnInit() {
    this.webSocketService.connect();  // Explicitly connect when component initializes
    this.wsSubscription = this.webSocketService.messages$.subscribe(
      (message: WebSocketMessage) => {
        console.log('Received WebSocket message:', message);
        
        // Show toast notification for the message
        const modalRef = this.modalService.open(ToastComponent);
        modalRef.componentInstance.title = message.type;
        modalRef.componentInstance.message = message.data;
      }
    );
  }

  ngOnDestroy() {
    this.wsSubscription?.unsubscribe();
  }
}
