import { Component, HostListener, ElementRef } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { RouterModule, Router } from '@angular/router';
import { CommonModule, NgFor } from '@angular/common';

interface NavItem {
  path?: string;
  label: string;
  action?: (event: Event) => void;
  styleClass: string;
}

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterModule, NgFor]
})
export class HeaderComponent {
  private readonly _authService: AuthService;
  private readonly _router: Router;
  isMenuOpen = false;

  authenticatedNavItems: NavItem[] = [
    {
      path: '/dashboard',
      label: 'Dashboard',
      styleClass: 'nav-link px-3'
    },
    {
      label: 'Logout',
      action: (event: Event) => this.logout(event),
      styleClass: 'btn btn-outline-primary rounded-pill ms-2'
    }
  ];

  unauthenticatedNavItems: NavItem[] = [
    {
      path: '/auth/login',
      label: 'Login',
      styleClass: 'btn btn-primary rounded-pill me-2'
    },
    {
      path: '/auth/signup',
      label: 'Sign Up',
      styleClass: 'btn btn-outline-primary rounded-pill'
    }
  ];

  constructor(
    authService: AuthService,
    router: Router,
    private elementRef: ElementRef
  ) {
    this._authService = authService;
    this._router = router;
  }

  get isAuthenticated$() {
    return this._authService.isAuthenticated$;
  }

  logout(event: Event): void {
    event.preventDefault();
    this._authService.logout();
    this._router.navigate(['/']);
  }

  toggleMenu() {
    this.isMenuOpen = !this.isMenuOpen;
  }

  closeMenu() {
    this.isMenuOpen = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const clickedInside = this.elementRef.nativeElement.contains(event.target);
    if (!clickedInside) {
      this.closeMenu();
    }
  }

  onNavItemClick(event: Event, item: NavItem) {
    if (item.action) {
      item.action(event);
    }
    this.closeMenu();
  }
}
