import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EnergyService } from '../../../services/energy.service';

interface EnergyData {
  EnergyUsage: number;
  UserId: string;
  Date: string;
  TTL: number;
  Source: string;
  CreatedAt: string;
}

@Component({
  selector: 'app-historical-data',
  templateUrl: './historical-data.component.html',
  styleUrls: ['./historical-data.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class HistoricalDataComponent {
  startDate: string = '';
  endDate: string = '';
  energyData: EnergyData[] = [];
  isLoading: boolean = false;
  error: string | null = null;

  constructor(private energyService: EnergyService) {}

  async onRetrieveData() {
    this.isLoading = true;
    this.error = null;
    
    try {
      const data = await this.energyService.getEnergyHistory({
        startDate: this.startDate,
        endDate: this.endDate
      });
      this.energyData = data.data; // {"message":"Energy history retrieved successfully","data":[{"Usage":123,"UserId":"746834b8-20c1-70cd-2b31-b10a5849b3be","Date":"2025-02-18","TTL":1771708396,"Source":"manual","CreatedAt":"2025-02-21T21:13:16.664Z"}]}
    } catch (err) {
      this.error = 'Failed to retrieve energy data';
      console.error('Error retrieving energy data:', err);
    } finally {
      this.isLoading = false;
    }
  }

  async onDownloadData() {
    try {
      await this.energyService.downloadEnergyData();
    } catch (err) {
      this.error = 'Failed to download energy data';
      console.error('Error downloading energy data:', err);
    }
  }
} 