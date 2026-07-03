import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, SignupData, SignupResponse } from '../services/auth.service';
import { CommonModule, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './signup.component.html',
  styleUrl: './signup.component.css'
})
export class SignupComponent {
  username: string = '';
  password: string = '';
  confirmPassword: string = '';
  errorMessage: string = '';
  successMessage: string = '';
  loading: boolean = false;

  constructor(private authService: AuthService, private router: Router) { }

  signup(): void {
    if (this.password !== this.confirmPassword) {
      this.errorMessage = 'Passwords do not match';
      return;
    }

    const signupData: SignupData = {
      username: this.username,
      password: this.password,
      passphrase: this.password
    };

    this.loading = true;

    this.authService.signup(signupData).subscribe({
      next: (res: SignupResponse) => {
        console.log('Signup successful', res);
        this.successMessage = 'Signup successful, redirect to login';
        setTimeout(() => {
          this.router.navigate(['/login']);
          this.loading = false;
        }, 5000);
      },
      error: (err) => {
        console.error('Signup error:', err);
        this.errorMessage = err.error.error || 'Signup failed';
        this.loading = false;
      }
    });
  }

  toLogin(): void {
    this.router.navigate(['/login']);
  }
}