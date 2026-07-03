import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface User {
  id: number;
  address: string;
  passphrase: string;
  username: string;
  user_password: string;
  role: string;
}

export interface ConsumptionPoint {
  name: string;
  address: string;
}

@Injectable({
  providedIn: 'root'
})
export class UsersService {
  private apiUrl = 'http://localhost:3000/blockchain-api/users';

  constructor(private http: HttpClient) {}

  getAllUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}`);
  }

  getUserById(id: number): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/${id}`);
  }

  createUser(user: Partial<User>): Observable<any> {
    return this.http.post(`${this.apiUrl}`, user);
  }

  updateUser(id: number, user: Partial<User>): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, user);
  }

  deleteUser(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  getConsumptionPointByUsername(username: string): Observable<ConsumptionPoint> {
    return this.http.get<ConsumptionPoint>(`${this.apiUrl}/consumption-point/${username}`);
  }
}
