import { Component, ViewChild } from '@angular/core';
import { EnergyService } from '../../../services/energy.service';
import { NgForm } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';
import { NgbModal, NgbModalModule } from '@ng-bootstrap/ng-bootstrap';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-manual-data-input',
  templateUrl: './manual-data-input.component.html',
  styleUrls: ['./manual-data-input.component.scss'],
  standalone: true,
  imports: [NgIf, FormsModule, NgbModalModule]
})
export class ManualDataInputComponent {
  @ViewChild('myForm') myForm!: NgForm;
  successfullyUploaded = false;
  uploadError: string | null = null;
  
  formData = {
    usage: null,
    date: null
  };

  constructor(
    private energyService: EnergyService, 
    private authService: AuthService,
    private modalService: NgbModal
  ) {}
  
  async submitEnergyData(event: Event) {
    event.preventDefault();
    const date = this.myForm.value.date;
    const usage = this.myForm.value.usage;
    const source = 'manual';
    
    if (this.myForm.valid) {
      try {
        await this.energyService.inputEnergyData({ usage, date, source });
        // Reset the form
        this.myForm.resetForm();
        // Show success toast
        this.successfullyUploaded = true;


        setTimeout(() => {
          this.successfullyUploaded = false;
        }, 3000);


      } catch (error) {
        console.error('Failed to submit energy data:', error);
        this.uploadError = 'Failed to submit energy data. Please try again.';


        setTimeout(() => {
          this.uploadError = null;
        }, 3000);
      }
    } else {
      console.error('Form is invalid');
    }
  }


} 