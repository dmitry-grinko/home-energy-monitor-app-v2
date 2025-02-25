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
  trainingModel: boolean = false;

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
        if (err.error.requiresData) {
          this.error = 'You need to upload at least 100 energy consumption records before making predictions.';
        } else if (err.error.requiresRetrain) {
          this.error = 'Your prediction model is being updated. Please try again in a few minutes.';
        } else if (err.error.status) {
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

  async trainModel() {
    this.trainingModel = true;
    this.error = '';
    
    try {
      await this.energyService.trainModel();
      // Show success message in the existing error div
      this.error = 'Model training started successfully. Please wait a few minutes before making predictions.';
    } catch (err: any) {
      console.error('Training error:', err);
      
      if (err.error) {
        this.error = err.error.message || 'Failed to start model training.';
      } else if (err.status === 0) {
        this.error = 'Unable to connect to the server. Please check your internet connection.';
      } else if (err.status === 401) {
        this.error = 'Your session has expired. Please sign in again.';
      } else {
        this.error = 'Unable to start model training at this time. Please try again later.';
      }
    } finally {
      this.trainingModel = false;
    }
  }
} 