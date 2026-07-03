import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';

// ── Domain interfaces ──────────────────────────────────────────────────────

/** 24-hour Day-Ahead Market Clearing Price array (strings, ×100 fixed-point). */
export interface DayAheadMCP {
  mcp: string[];
}

/** 96-slot Intra-Day MCP array (strings, ×100 fixed-point). */
export interface IntradayMCP {
  mcp: string[];
}

/** DA market forecast data committed on-chain by the LSTM engine. */
export interface MarketForecast {
  forecastRenewable: string[];
  forecastDemand:    string[];
}

/** Accepted DA schedule for a prosumer node (24 values ×100 kWh). */
export interface NodeSchedule {
  schedule: string[];
}

/** Imbalance cost for a node over a range of intraday intervals. */
export interface ImbalanceCost {
  imbalanceCost: string;
}

/** Combined DA dashboard payload. */
export interface DayAheadDashboard {
  mcp:             string[];
  forecastRenewable: string[];
  forecastDemand:    string[];
  state: {
    biddingOpen:   boolean;
    marketCleared: boolean;
    marketDay:     string;
    bidderCount:   string;
  };
}

/** Combined ID dashboard payload. */
export interface IntradayDashboard {
  mcp:                   string[];
  forecastRenewable15min: string[];
  state: {
    currentInterval:  string;
    lastUpdateBlock:  string;
    marketDay:        string;
    penaltyPositive:  string;
    penaltyNegative:  string;
  };
}

/** Bid payload for DA market participation. */
export interface BidPayload {
  quantity: number[];
  price:    number[];
}

/** Forecast payload for openBidding (sent by the Python engine via backend). */
export interface ForecastPayload {
  renewable: number[];
  demand:    number[];
}

// ── Service ────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class MarketService {
  private daUrl = 'http://localhost:3000/blockchain-api/dayahead';
  private idUrl = 'http://localhost:3000/blockchain-api/intraday';

  constructor(private http: HttpClient) {}

  // ── Day-Ahead read methods ───────────────────────────────────────────────

  /** Fetches all DA dashboard data (MCP + forecast + state) in one call. */
  getDayAheadDashboard(username: string): Observable<DayAheadDashboard> {
    return this.http.get<DayAheadDashboard>(`${this.daUrl}/dashboard/${username}`);
  }

  /** Returns the cleared 24-hour MCP array. */
  getDayAheadMCP(username: string): Observable<string[]> {
    return this.http.get<string[]>(`${this.daUrl}/mcp/${username}`);
  }

  /** Returns the renewable + demand forecast stored on-chain. */
  getForecast(username: string): Observable<MarketForecast> {
    return this.http.get<MarketForecast>(`${this.daUrl}/forecast/${username}`);
  }

  /** Returns the accepted schedule for a specific node address. */
  getNodeSchedule(username: string, nodeAddress: string): Observable<string[]> {
    return this.http.get<string[]>(`${this.daUrl}/schedule/${username}/${nodeAddress}`);
  }

  /** Returns current DA market state flags. */
  getDayAheadState(username: string): Observable<DayAheadDashboard['state']> {
    return this.http.get<DayAheadDashboard['state']>(`${this.daUrl}/state/${username}`);
  }

  // ── Day-Ahead write methods ──────────────────────────────────────────────

  /** Opens DA bidding and commits the LSTM forecast on-chain. */
  openBidding(username: string, payload: ForecastPayload): Observable<any> {
    return this.http.post(`${this.daUrl}/open-bidding/${username}`, payload);
  }

  /** Submits a 24-hour bid for the node owned by username. */
  submitBid(username: string, bid: BidPayload): Observable<any> {
    return this.http.post(`${this.daUrl}/submit-bid/${username}`, bid);
  }

  /** Clears the DA market after the bid window closes. */
  clearMarket(username: string): Observable<any> {
    return this.http.post(`${this.daUrl}/compute/${username}`, {});
  }

  // ── Intra-Day read methods ───────────────────────────────────────────────

  /** Fetches all ID dashboard data (96-slot MCP + renewable forecast + state). */
  getIntradayDashboard(username: string): Observable<IntradayDashboard> {
    return this.http.get<IntradayDashboard>(`${this.idUrl}/dashboard/${username}`);
  }

  /** Returns the full 96-slot intraday MCP array. */
  getIntradayMCP(username: string): Observable<string[]> {
    return this.http.get<string[]>(`${this.idUrl}/mcp/${username}`);
  }

  /** Returns deviation of a node from its DA schedule for one interval. */
  getDeviation(username: string, nodeAddress: string, interval: number): Observable<{ deviation: string }> {
    return this.http.get<{ deviation: string }>(
      `${this.idUrl}/deviation/${username}/${nodeAddress}/${interval}`
    );
  }

  /** Returns imbalance cost for a node over a range of intervals. */
  getImbalanceCost(username: string, nodeAddress: string, from = 0, to = 95): Observable<ImbalanceCost> {
    return this.http.get<ImbalanceCost>(
      `${this.idUrl}/imbalance-cost/${username}/${nodeAddress}?from=${from}&to=${to}`
    );
  }

  /** Returns the 96-slot renewable forecast stored on-chain. */
  getRenewableForecast15min(username: string): Observable<string[]> {
    return this.http.get<string[]>(`${this.idUrl}/renewable-forecast/${username}`);
  }

  /** Returns current ID market state. */
  getIntradayState(username: string): Observable<IntradayDashboard['state']> {
    return this.http.get<IntradayDashboard['state']>(`${this.idUrl}/state/${username}`);
  }

  // ── Convenience: load both dashboards in parallel ──────────────────────

  /** Loads DA + ID dashboard data simultaneously for the combined market view. */
  loadAllDashboards(username: string): Observable<{
    dayAhead:  DayAheadDashboard;
    intraday:  IntradayDashboard;
  }> {
    return forkJoin({
      dayAhead: this.getDayAheadDashboard(username),
      intraday: this.getIntradayDashboard(username),
    });
  }

  // ── Helpers: convert fixed-point strings to floats ─────────────────────

  /**
   * Converts an array of ×100 fixed-point strings to float values.
   * e.g. "525" → 5.25
   */
  toFloatArray(values: string[]): number[] {
    return values.map(v => Number(v) / 100);
  }

  /** Generates human-readable hour labels for a 24-element DA array. */
  getHourLabels(): string[] {
    return Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);
  }

  /** Generates human-readable 15-min interval labels for a 96-element ID array. */
  getIntervalLabels(): string[] {
    return Array.from({ length: 96 }, (_, i) => {
      const h = Math.floor(i / 4);
      const m = (i % 4) * 15;
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    });
  }
}
