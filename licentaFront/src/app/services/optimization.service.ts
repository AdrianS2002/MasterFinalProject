import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface GlobalPlanEntry {
  plan: string[];
  timestamp: string;
  blockNumber: number;
  txHash: string;
}

@Injectable({
  providedIn: 'root'
})
export class OptimizationService {
  private apiUrl = 'http://localhost:3000/blockchain-api/global';

  constructor(private http: HttpClient) {}

  getPlanHistory(): Observable<GlobalPlanEntry[]> {
    return this.http.get<GlobalPlanEntry[]>(`${this.apiUrl}/plan-history`);
  }

  computeGlobalPlan(): Observable<any> {
    return this.http.post(`${this.apiUrl}/compute`, {});
  }

  getOptimalPlanForHour(hour: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/optimal-plan-hour/${hour}`);
  }

  getOptimalPlanArray(): Observable<any> {
    return this.http.get(`${this.apiUrl}/optimal-plan-array`);
  }

  getLastUpdatedTimestamp(): Observable<any> {
    return this.http.get(`${this.apiUrl}/last-updated`);
  }

  updateNodeResult(newPosition: number[], newScore: number, newFlexibilityWeight: number[]): Observable<any> {
    return this.http.post(`${this.apiUrl}/update-node-result`, {
      newPosition,
      newScore,
      newFlexibilityWeight
    });
  }

  
  getBestPosition(nodeAddress: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/best-position/${nodeAddress}`);
  }

 
  getFrozenGlobalCost(): Observable<any> {
    return this.http.get(`${this.apiUrl}/frozen-global-cost`);
  }

 
  getBestGlobalPlan(): Observable<any> {
    return this.http.get(`${this.apiUrl}/best-global-plan`);
  }

}
