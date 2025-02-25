import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { EnergyService } from '../../../services/energy.service';
import { Chart } from 'angular-highcharts';
import { ChartModule } from 'angular-highcharts';

@Component({
  selector: 'app-data-visualization',
  templateUrl: './data-visualization.component.html',
  styleUrls: ['./data-visualization.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, NgbModule, ChartModule]
})
export class DataVisualizationComponent implements OnInit {
  selectedPeriod: string = 'weekly';
  periods = [
    { id: 'daily', name: 'Daily' },
    { id: 'weekly', name: 'Weekly' },
    { id: 'monthly', name: 'Monthly' }
  ];
  summaryData: any;
  chart?: Chart;
  isLoading = true;

  constructor(private energyService: EnergyService) {}

  ngOnInit() {
    this.loadSummaryData();
  }

  async onPeriodChange() {
    this.isLoading = true;
    await this.loadSummaryData();
  }

  private async loadSummaryData() {
    try {
      this.summaryData = await this.energyService.getEnergySummary(this.selectedPeriod);
      this.updateChartData();
    } catch (error) {
      console.error('Error loading summary data:', error);
    } finally {
      this.isLoading = false;
    }
  }

  private updateChartData() {
    if (!this.summaryData?.data) return;

    // Prepare data
    const categories = this.summaryData.data.map((item: any) => item.period);
    const totalUsageData = this.summaryData.data.map((item: any) => item.totalUsage);
    const avgUsageData = this.summaryData.data.map((item: any) => item.avgUsage);

    this.chart = new Chart({
      chart: {
        type: 'column'
      },
      title: {
        text: 'Energy Consumption'
      },
      xAxis: {
        categories: categories,
        title: {
          text: 'Period'
        }
      },
      yAxis: {
        title: {
          text: 'Energy Usage (kWh)'
        }
      },
      series: [
        {
          name: 'Total Usage',
          type: 'column',
          data: totalUsageData,
          color: 'rgba(0, 123, 255, 0.5)'
        },
        {
          name: 'Average Usage',
          type: 'column',
          data: avgUsageData,
          color: 'rgba(40, 167, 69, 0.5)'
        }
      ],
      credits: {
        enabled: false
      }
    });
  }
} 