import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable, tap } from 'rxjs';
export interface FrozenBreakdownHour {
  consumption: number;
  isInjection: boolean;
  fromRenewable: number;
  fromBattery: number;
  fromGrid: number;
  globalTarget: number;
}

export interface PSOResult {
  iteration: number;
  totalConsumption?: number;   // dacă adaugi consumul în obiect
  renewableUsed?: number;      // dacă adaugi și asta
  totalCost?: number;          // dacă vrei și costul
}
@Injectable({
  providedIn: 'root'
})
export class NodeService {
  private apiUrl = 'http://localhost:3000/blockchain-api/nodes';

  constructor(private http: HttpClient) { }

  getPosition(username: string): Observable<number[]> {
    return this.http.get<{ position: (string | number)[] }>(`${this.apiUrl}/position/${username}`).pipe(
      map(response => response.position.map(Number))
    );
  }

  getPersonalBestPosition(username: string): Observable<number[]> {
    return this.http.get<{ position: (number | string)[] }>(`${this.apiUrl}/personalBestPosition/${username}`).pipe(
      map(response => response.position.map(Number))
    );
  }



  getPersonalBestScore(username: string): Observable<number> {
    return this.http.get<number>(`${this.apiUrl}/personalBestScore/${username}`);
  }

  getFrozenCost(username: string): Observable<{ frozenCost: number }> {
    return this.http.get<{ frozenCost: number }>(`${this.apiUrl}/frozenCost/${username}`);
  }


  getObjectiveFunction(username: string): Observable<{ result: number | string }> {
    return this.http.get<{ result: number | string }>(`${this.apiUrl}/objectiveFunction/${username}`);
  }

  getEffectiveTariff(username: string, hour: number, consumption: number): Observable<number> {
    return this.http.get<number>(`${this.apiUrl}/effectiveTariff/${username}/${hour}/${consumption}`);
  }

  updateBestPositions(username: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/updateBestPositions/${username}`, {});
  }

  updateVelocity(username: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/updateVelocity/${username}`, {});
  }

  getTariff(username: string): Observable<number[]> {
    return this.http.get<{ tariff: number[] }>(`${this.apiUrl}/tariff/${username}`).pipe(
      tap(res => console.log('🔌 Tarif response:', res)),
      map(response => response.tariff)
    );
  }

  getCapacity(username: string): Observable<number[]> {
    return this.http.get<{ capacity: number[] }>(`${this.apiUrl}/capacity/${username}`).pipe(
      map(response => response.capacity)
    );
  }

  getBatteryCharge(username: string): Observable<number[]> {
    return this.http.get<(number | string)[]>(`${this.apiUrl}/batteryCharge/${username}`).pipe(
      map((response) => response.map(Number))
    );
  }

  getBatteryCapacity(username: string): Observable<number[]> {
    return this.http.get<{ batteryCapacity: (number | string)[] }>(`${this.apiUrl}/batteryCapacity/${username}`).pipe(
      map(response => response.batteryCapacity.map(Number))
    );
  }

  getRenewableGeneration(username: string): Observable<number[]> {
    return this.http.get<{ renewableGeneration: (number | string)[] }>(`${this.apiUrl}/renewableGeneration/${username}`).pipe(
      map(response => response.renewableGeneration.map(Number))
    );
  }

  getRenewableUsedPlan(username: string): Observable<number[]> {
  return this.http.get<number[]>(`${this.apiUrl}/renewableUsed/${username}`);
}


  getFlexibilityAbove(username: string): Observable<number[]> {
    return this.http.get<number[]>(`${this.apiUrl}/flexibilityAbove/${username}`);
  }

  getFlexibilityBelow(username: string): Observable<number[]> {
    return this.http.get<number[]>(`${this.apiUrl}/flexibilityBelow/${username}`);
  }
  getFlexibility(username: string): Observable<number[]> {
    return this.http.get<number[]>(`${this.apiUrl}/flexibilityLoad/${username}`); 
  }
  getFrozenBreakdown(username: string): Observable<FrozenBreakdownHour[]> {
    return this.http.get<{ breakdown: FrozenBreakdownHour[] }>(`${this.apiUrl}/frozenBreakdown/${username}`).pipe(
      map(res => res.breakdown)
    );
  }


  getNodeAddresses(): Observable<string[]> {
    return this.http.get<{ nodeAddresses: string[] }>('http://localhost:3000/blockchain-api/global/node-addresses')
      .pipe(map(res => res.nodeAddresses));
  }

  getPersonalBestScoreByAddress(address: string): Observable<number> {
    return this.http.get<{ score: string }>(`http://localhost:3000/blockchain-api/global/personalBestScoreByAddress/${address}`)
      .pipe(map(res => +res.score));
  }
  
  getPSOResults(): Observable<PSOResult[]> {
  return this.http.get<PSOResult[]>('http://localhost:3000/blockchain-api/global/pso-results');
}

}
