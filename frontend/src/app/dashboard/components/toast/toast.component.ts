import { Component, Input } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-toast',
  template: `
    <div class="modal-header">
      <h4 class="modal-title">{{ title }}</h4>
      <button type="button" class="btn-close" aria-label="Close" (click)="activeModal.dismiss()"></button>
    </div>
    <div class="modal-body">
      <p>{{ message }}</p>
    </div>
  `,
  standalone: true
})
export class ToastComponent {
  @Input() title: string = '';
  @Input() message: string = '';

  constructor(public activeModal: NgbActiveModal) {}
} 