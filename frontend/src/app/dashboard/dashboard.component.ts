import { Component } from '@angular/core';
import { ManualDataInputComponent } from './components/manual-data-input/manual-data-input.component';
import { NgbNavModule } from '@ng-bootstrap/ng-bootstrap';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { FileUploadComponent } from './components/file-upload/file-upload.component';
import { HistoricalDataComponent } from './components/historical-data/historical-data.component';
import { DataVisualizationComponent } from './components/data-visualization/data-visualization.component';
import { AlertsNotificationsComponent } from './components/alerts-notifications/alerts-notifications.component';
import { NgIf } from '@angular/common';
import { PredictionComponent } from './components/prediction/prediction.component';


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
    NgIf
  ]
})
export class DashboardComponent {
  selectedContent: string = 'manual-input';  // Default selected content
  constructor(private modalService: NgbModal) {}
}
