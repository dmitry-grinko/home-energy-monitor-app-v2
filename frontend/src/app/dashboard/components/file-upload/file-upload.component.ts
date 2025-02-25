import { Component, ViewChild } from '@angular/core';
import { NgIf } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { EnergyService } from '../../../services/energy.service';
import { CsvService } from '../../../services/csv.service';
import { finalize } from 'rxjs';
import { NgbModal, NgbModalModule } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-file-upload',
  templateUrl: './file-upload.component.html',
  styleUrls: ['./file-upload.component.scss'],
  standalone: true,
  imports: [NgIf, NgbModalModule, FormsModule]
})
export class FileUploadComponent {
  @ViewChild('uploadForm') uploadForm!: NgForm;
  @ViewChild('fileInput') fileInput: any;
  
  selectedFile: File | null = null;
  isUploading = false;
  uploadError: string | null = null;
  successfullyUploaded = false;
  constructor(
    private energyService: EnergyService,
    private csvService: CsvService,
    private modalService: NgbModal
  ) {}

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file && file.type === 'text/csv') {
      this.selectedFile = file;
      this.uploadError = null;
    } else {
      this.uploadError = 'Please select a CSV file';
      this.selectedFile = null;
    }
  }

  private resetState(): void {
    this.selectedFile = null;
    this.isUploading = false;
    this.uploadError = null;
    this.successfullyUploaded = false;
    
    // Reset the form and clear the file input
    if (this.uploadForm) {
      this.uploadForm.resetForm();
    }
    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
  }

  onSubmit(form: NgForm): void {
    if (!this.selectedFile || form.invalid) {
      return;
    }
    this.onUpload();
  }

  onUpload(): void {
    if (!this.selectedFile) {
      return;
    }

    this.isUploading = true;
    this.uploadError = null;

    this.csvService.getPresignedUrl().subscribe({
      next: (response) => {
        const { presignedUrl } = response;
        this.csvService.setPresignedUrl(presignedUrl);
        
        this.csvService.uploadCsvFile(this.selectedFile!)
          .pipe(
            finalize(() => {
              this.isUploading = false;
            })
          )
          .subscribe({
            next: () => {
              this.successfullyUploaded = true;
              this.uploadError = null;
              
              setTimeout(() => {
                this.resetState();
              }, 3000);
            },
            error: (error) => {
              console.error('Error uploading file:', error);
              this.uploadError = 'Failed to upload file. Please try again.';
              
              setTimeout(() => {
                this.resetState();
              }, 3000);
            }
          });
      },
      error: (error) => {
        console.error('Error getting presigned URL:', error);
        this.uploadError = 'Failed to initialize upload. Please try again.';
        
        setTimeout(() => {
          this.resetState();
        }, 3000);
      }
    });
  }
} 