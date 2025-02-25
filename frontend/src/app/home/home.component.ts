import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { firstValueFrom } from 'rxjs';
import { NgFor } from '@angular/common';

interface Feature {
  icon: string;
  title: string;
  description: string;
}

interface TechnologyItem {
  title: string;
  description: string;
}

interface TechnologySection {
  title: string;
  items: TechnologyItem[];
}

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  standalone: true,
  imports: [NgFor]
})
export class HomeComponent {
  features: Feature[] = [
    {
      icon: 'bi-shield-lock-fill',
      title: 'Secure Authentication',
      description: 'Protected access using AWS Cognito authentication services'
    },
    {
      icon: 'bi-database-fill-gear',
      title: 'Data Management',
      description: 'Manual data entry and bulk CSV uploads for historical data'
    },
    {
      icon: 'bi-bell-fill',
      title: 'Smart Alerts',
      description: 'Real-time notifications via AWS SNS when usage exceeds thresholds'
    }
  ];

  technologySections: TechnologySection[] = [
    {
      title: 'Cloud Infrastructure',
      items: [
        { title: 'AWS Lambda', description: 'Serverless Computing' },
        { title: 'DynamoDB', description: 'NoSQL Database' },
        { title: 'API Gateway', description: 'RESTful Endpoints' },
        { title: 'CloudFront', description: 'Global Content Delivery' },
        { title: 'S3', description: 'Static and Data Storage' },
        { title: 'AWS Cognito', description: 'Authentication Service' },
        { title: 'AWS SNS', description: 'Notification Service' },
        { title: 'AWS SES', description: 'Email Service' }
      ]
    },
    {
      title: 'DevOps & Infrastructure as Code',
      items: [
        { title: 'GitHub Actions', description: 'CI/CD Pipeline' },
        { title: 'Terraform', description: 'Infrastructure Management' }
      ]
    },
    {
      title: 'Frontend',
      items: [
        { title: 'Angular', description: 'Modern Web Framework with REST API Integration' },
        { title: 'ng-bootstrap', description: 'UI Components Framework' }
      ]
    }
  ];

  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  async navigateToApp(): Promise<void> {
    const isAuthenticated = await firstValueFrom(this.authService.isAuthenticated$);
    
    if (isAuthenticated) {
      await this.router.navigate(['/dashboard']);
    } else {
      await this.router.navigate(['/auth/login']);
    }
  }
}
