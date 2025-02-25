import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { EnergyService } from '../../../services/energy.service';

@Component({
  selector: 'app-alerts-notifications',
  templateUrl: './alerts-notifications.component.html',
  styleUrls: ['./alerts-notifications.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, NgbModule]
})
export class AlertsNotificationsComponent implements OnInit {
  threshold: number = 0;
  thresholdError: string | null = null;
  thresholdSuccess = false;
  currentThreshold: number | null = null;
  
  // These can be removed if you're not using ngb-alert anymore
  alertMessage: string = '';
  alertType: 'success' | 'danger' = 'success';
  showAlert: boolean = false;

  constructor(private energyService: EnergyService) {}

  ngOnInit() {
    this.loadCurrentThreshold();
  }

  async loadCurrentThreshold() {
    try {
      this.currentThreshold = await this.energyService.getAlertThreshold();
      this.threshold = this.currentThreshold; // Pre-fill the input with current value
    } catch (error) {
      this.thresholdError = 'Failed to load current threshold.';
    }
  }

  async setThreshold() {
    try {
      await this.energyService.setAlertThreshold(this.threshold);
      this.thresholdSuccess = true;
      this.thresholdError = null;
      this.currentThreshold = this.threshold;

      // Clear success message after 3 seconds
      setTimeout(() => {
        this.thresholdSuccess = false;
      }, 3000);
    } catch (error) {
      this.thresholdError = 'Failed to set threshold. Please try again.';
      this.thresholdSuccess = false;

      // Clear error message after 3 seconds
      setTimeout(() => {
        this.thresholdError = null;
      }, 3000);
    }
  }
} 