import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';

export interface SignupData {
  username: string;
  password: string;
  address?: string;
  passphrase: string;
}

export interface SignupResponse {
  message: string;
  userId: number;
}

export interface LoginData {
  username: string;
  password: string;
}

export interface LoginResponse {
  message: string;
  user: any;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:3000/blockchain-api/auth';
  private userSubject = new BehaviorSubject<any>(null);
  public user$ = this.userSubject.asObservable();
  
  constructor(private http: HttpClient) {
    console.log('AuthService initialized');
  }

  signup(data: SignupData): Observable<SignupResponse> {
    return this.http.post<SignupResponse>(`${this.apiUrl}/signup`, data);
  }

  login(data: LoginData): Observable<LoginResponse> {
    console.log('Sending login request with data:', data);
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, data).pipe(
      tap(response => {
        const mappedUser = {
          ...response.user,
          id: response.user.userId 
        };
        
        this.userSubject.next(mappedUser);
        console.log('✅ User updated in AuthServicEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEe:', mappedUser);
      })
    );
  }
  
  logout(): void {
    this.userSubject.next(null);
    console.log('User logged out');
  }
}
