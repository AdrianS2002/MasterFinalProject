import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';

export interface Contract {
  id?: number;
  name?: string;
  address: string;
  owner: string;
  description?: string;
  type?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ContractService {
  private apiUrl = 'http://localhost:3000/blockchain-api/contracts';

  constructor(private http: HttpClient) {}

  getAllContracts(): Observable<Contract[]> {
    return this.http.get<Contract[]>(this.apiUrl);
  }

  getContractById(id: number): Observable<Contract> {
    return this.http.get<Contract>(`${this.apiUrl}/${id}`);
  }
   getClusters(): Observable<Contract[]> {
    return this.http.get<Contract[]>(this.apiUrl).pipe(
      map(contracts => contracts.filter(c => c.type === 'Cluster'))
    );
  }

  createContract(contract: Contract): Observable<any> {
    return this.http.post(`${this.apiUrl}`, contract);
  }

  updateContract(id: number, contract: Partial<Contract>): Observable<any> {
    console.log('📡 Sending updateContract:', id, contract);
    return this.http.put(`${this.apiUrl}/${id}`, contract);
  }

  deleteContract(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  updateContractOwner(id: number, newOwner: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}/owner`, { newOwner });
  }

  getUnassignedNodes(): Observable<Contract[]> {
    return this.http.get<Contract[]>(this.apiUrl).pipe(
      map(contracts =>
        contracts.filter(c =>
          c.type === 'Node' &&
          c.owner?.toLowerCase() === '0x0000000000000000000000000000000000000000'
        )
      )
    );
  }
  
}
