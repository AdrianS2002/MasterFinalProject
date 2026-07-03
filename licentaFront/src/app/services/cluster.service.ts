import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
 
export interface ClusterSummary {
  name: string;
  address: string;
  nodeCount: number;
  nodeAddresses: string[];
  clusterBestCost: string | null;
  lastUpdatedTimestamp: string | null;
  clusterBestPlan: string[];
}
 
@Injectable({
  providedIn: 'root'
})
export class ClusterService {
  private apiUrl = 'http://localhost:3000/blockchain-api/clusters';
 
  constructor(private http: HttpClient) {}
 
  getClustersSummary(): Observable<ClusterSummary[]> {
    return this.http.get<ClusterSummary[]>(`${this.apiUrl}/summary`);
  }
 
  getClusterBestPlan(address: string): Observable<{ clusterBestPlan: string[] }> {
    return this.http.get<{ clusterBestPlan: string[] }>(`${this.apiUrl}/${address}/best-plan`);
  }
 
  getClusterNodes(address: string): Observable<{ nodeAddresses: string[] }> {
    return this.http.get<{ nodeAddresses: string[] }>(`${this.apiUrl}/${address}/nodes`);
  }
}