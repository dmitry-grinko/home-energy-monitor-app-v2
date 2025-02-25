import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { EnergyService } from '../../../services/energy.service';

interface PredictionData {
  date: string;
  prediction: number;
}

@Component({
  selector: 'app-prediction',
  standalone: true,
  imports: [CommonModule, FormsModule, NgbModule],
  templateUrl: './prediction.component.html',
  styles: [`
    .container {
      padding: 20px;
    }
  `]
})
export class PredictionComponent {
  selectedDate: string = '';
  prediction: PredictionData | null = null;
  loading: boolean = false;
  error: string = '';
  today: string = new Date().toISOString().split('T')[0];

  constructor(private energyService: EnergyService) {}

  async getPrediction() {
    if (!this.selectedDate) return;
    
    this.loading = true;
    this.error = '';
    this.prediction = null;

    try {
      this.prediction = await this.energyService.getPrediction(this.selectedDate);
      console.log('Prediction:', this.prediction);
    } catch (err: any) {
      console.error('Prediction error:', err);
      
      // Handle API error responses
      if (err.error) {
        this.error = err.error.message;
        
        // Handle special cases
        if (err.error.status) {
          this.error = `The prediction model is currently ${err.error.status}. Please try again in a few minutes.`;
        }
      } else if (err.status === 0) {
        this.error = 'Unable to connect to the server. Please check your internet connection.';
      } else if (err.status === 401) {
        this.error = 'Your session has expired. Please sign in again.';
      } else {
        this.error = 'Unable to make prediction at this time. Please try again later.';
      }
    } finally {
      this.loading = false;
    }
  }
} 