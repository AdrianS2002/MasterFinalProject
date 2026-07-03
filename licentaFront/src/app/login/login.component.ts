import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService, LoginData, LoginResponse } from '../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  username: string = '';
  password: string = '';
  errorMessage: string = '';
  isLoading = false;

  constructor(private authService: AuthService, private router: Router) {}

  login(): void {
    const loginData: LoginData = {
      username: this.username,
      password: this.password
    };

    this.isLoading = true;

    this.authService.login(loginData).subscribe({
      next: (res: LoginResponse) => {
        console.log('Login successful', res);
        setTimeout(() => {
          this.router.navigate(['/home']);
          this.isLoading = false;
        }, 3000);
      },
      error: (err) => {
        console.error('Login error:', err);
        this.errorMessage = err.error.error || 'Login failed';
        this.isLoading = false;
      }
    });
  }

  toSignUp(): void {
    this.router.navigate(['/signup']);
  }
}
