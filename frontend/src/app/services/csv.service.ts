import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class CsvService {
  private readonly baseUrl = environment.apiUrl;
  private presignedUrl: string | null = null;

  constructor(private http: HttpClient) {}

  getPresignedUrl(): Observable<{ presignedUrl: string }> {
    return this.http.get<{ presignedUrl: string }>(`${this.baseUrl}/presigned-url`);
  }

  setPresignedUrl(presignedUrl: string): void {
    this.presignedUrl = presignedUrl;
  }

  getStoredPresignedUrl(): string | null {
    return this.presignedUrl;
  }

  uploadCsvFile(file: File): Observable<any> {
    if (!this.presignedUrl) {
      throw new Error('No presigned URL available. Please get a presigned URL first.');
    }

    const headers = new HttpHeaders({
      'Content-Type': file.type,
      'Content-Length': file.size.toString()
    });

    return this.http.put(this.presignedUrl, file, { 
      headers,
      reportProgress: true,
      observe: 'events'
    });
  }
}
