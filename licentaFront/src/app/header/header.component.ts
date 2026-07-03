import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { TransitionService } from '../services/transition.service';
import { NgIf } from '@angular/common';
import { AuthService } from '../services/auth.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  standalone: true,
  imports: [NgIf],
  styleUrls: ['./header.component.css'] 
})
export class HeaderComponent implements OnInit, OnDestroy {
  isLoggedIn = false; 
  private userSub!: Subscription;

  constructor(private router: Router, private transitionService: TransitionService, private authService: AuthService) {}

  ngOnInit(): void {
    this.userSub = this.authService.user$.subscribe(user => {
      this.isLoggedIn = !!user; // true dacă există user, false dacă nu
    });
  }

  ngOnDestroy(): void {
    this.userSub.unsubscribe();
  }

  navigateWithTransition(path: string): void {
    this.transitionService.animateTransition().then(() => {
      this.router.navigateByUrl(path);
    });
  }

  navigateToHome(): void {
    this.navigateWithTransition('/home'); 
  }

  navigateToOptimization(): void {
    this.navigateWithTransition('/optimization');
  }

  navigateToAbout(): void {
    this.navigateWithTransition('/about');
  }

  navigateToMarket(): void {
    this.navigateWithTransition('/market');
  }

  navigateToLogin(): void {
    this.navigateWithTransition('/login');
  }

  logout(): void {
    this.authService.logout();
    this.navigateToLogin();
    this.isLoggedIn = false;
  }
}
