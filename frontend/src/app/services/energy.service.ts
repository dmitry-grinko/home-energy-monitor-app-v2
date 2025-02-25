import { Injectable } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class EnergyService {
  constructor(private http: HttpClient) {}

  public async inputEnergyData(data: any): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`${environment.apiUrl}/energy/input`, data));
    } catch (error) {
      throw error;
    }
  }

  public async getEnergyHistory(params?: { 
    startDate?: string, 
    endDate?: string 
  }): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.http.get(`${environment.apiUrl}/energy/history`, { params })
      );
      return response;
    } catch (error) {
      throw error;
    }
  }

  public async getEnergySummary(period: string): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.http.get(`${environment.apiUrl}/energy/summary?period=${period}`)
      );
      return response;
    } catch (error) {
      throw error;
    }
  }

  public async setAlertThreshold(threshold: number): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(`${environment.apiUrl}/alerts`, { threshold })
      );
    } catch (error) {
      throw error;
    }
  }

  public async getAlertThreshold(): Promise<number> {
    const response = await this.http.get<{threshold: number}>('/alerts').toPromise();
    return response?.threshold ?? 0;
  }

  public async downloadEnergyData(): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.http.get(`${environment.apiUrl}/energy/download`, {
          responseType: 'blob',
          observe: 'response'
        })
      );
      
      // Create a download link and trigger the download
      const blob = new Blob([response.body!], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'energy-data.csv';
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      throw error;
    }
  }

  public async getPrediction(date: string): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.http.get(`${environment.apiUrl}/prediction`, { params: { date } })
      );
      return response;
    } catch (error) {
      throw error;
    }
  }
} 