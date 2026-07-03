import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Location {
  id?: number;
  contract_id: number;
  country: string;
  city: string;
  address: string;
}

@Injectable({
  providedIn: 'root'
})
export class LocationService {
  private apiUrl = 'http://localhost:3000/blockchain-api/locations'; 

  constructor(private http: HttpClient) {}

  getLocations(): Observable<Location[]> {
    return this.http.get<Location[]>(this.apiUrl);
  }

  getLocationById(id: number): Observable<Location> {
    return this.http.get<Location>(`${this.apiUrl}/${id}`);
  }

  
  getLocationByContractId(contractId: number): Observable<Location> {
    return this.http.get<Location>(`${this.apiUrl}/contract/${contractId}`);
  }


  addLocation(location: Location): Observable<{ id: number }> {
    return this.http.post<{ id: number }>(this.apiUrl, location);
  }


  updateLocation(id: number, location: Location): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, location);
  }


  deleteLocation(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}
