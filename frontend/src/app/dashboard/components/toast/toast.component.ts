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
      <p>{{ typeof message === 'string' ? message : JSON.stringify(message) }}</p>
    </div>
  `,
  standalone: true
})
export class ToastComponent {
  @Input() title: string = '';
  @Input() message: any = '';

  constructor(public activeModal: NgbActiveModal) {}

  protected JSON = JSON;
} 