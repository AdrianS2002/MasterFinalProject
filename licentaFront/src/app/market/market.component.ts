import {
  Component, OnInit, OnDestroy,
  ViewChild, AfterViewInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BaseChartDirective, NgChartsModule } from 'ng2-charts';
import { ChartConfiguration, ChartOptions, Chart, registerables } from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import { LoadingSpinnerChartComponent } from "../loading-spinner-chart/loading-spinner-chart.component";

import { AuthService } from '../services/auth.service';
import {
  MarketService,
  DayAheadDashboard,
  IntradayDashboard
} from '../services/market.service';
import { Subscription } from 'rxjs';

// Register Chart.js built-ins + zoom plugin
Chart.register(...registerables, zoomPlugin);

/**
 * MarketComponent
 * ───────────────
 * Displays a dual-tab dashboard for the Day-Ahead and Intra-Day energy markets.
 *
 * DA tab  : 24-hour MCP line chart, renewable vs demand forecast bar chart,
 *           and the current market state card.
 *
 * ID tab  : 96-slot (15-min) real-time MCP line chart, renewable forecast chart,
 *           and imbalance summary table.
 *
 * Data is loaded via MarketService which calls the /blockchain-api/dayahead/*
 * and /blockchain-api/intraday/* endpoints.
 */
@Component({
  selector:    'app-market',
  standalone:  true,
  imports:     [CommonModule, FormsModule, NgChartsModule, LoadingSpinnerChartComponent],
  templateUrl: './market.component.html',
  styleUrls:   ['./market.component.css'],
})
export class MarketComponent implements OnInit, OnDestroy, AfterViewInit {

  // ── State ─────────────────────────────────────────────────────────────────
  activeTab:   'da' | 'id' = 'da';
  loading      = false;
  errorMessage = '';
  username     = '';
  public isLoadingChart: boolean = false;

  daData:  DayAheadDashboard  | null = null;
  idData:  IntradayDashboard  | null = null;

  private userSub: Subscription | null = null;

  // ── DA Chart 1: 24-hour MCP line chart ────────────────────────────────────
  daMCPData: ChartConfiguration<'line'>['data'] = {
    labels:   [],
    datasets: [{
      label: 'DA MCP (€/kWh)',
      data:  [],
      borderColor:     '#4f81bd',
      backgroundColor: 'rgba(79,129,189,0.15)',
      tension: 0.3,
      fill: true,
    }]
  };
  daMCPOptions: ChartOptions<'line'> = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title:  { display: true, text: 'Day-Ahead Market Clearing Price (24h)' },
      zoom:   { zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' } },
    },
    scales: {
      x: { title: { display: true, text: 'Hour of Day' } },
      y: { title: { display: true, text: 'MCP (€/kWh)' } },
    }
  };

  // ── DA Chart 2: renewable vs demand forecast bar chart ────────────────────
  daForecastData: ChartConfiguration<'bar'>['data'] = {
    labels:   [],
    datasets: [
      {
        label:           'Forecast Renewable (kWh)',
        data:            [],
        backgroundColor: 'rgba(0,176,80,0.7)',
      },
      {
        label:           'Forecast Demand (kWh)',
        data:            [],
        backgroundColor: 'rgba(231,76,60,0.6)',
      }
    ]
  };
  daForecastOptions: ChartOptions<'bar'> = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title:  { display: true, text: 'LSTM Forecast: Renewable vs Demand' },
    },
    scales: {
      x: { title: { display: true, text: 'Hour of Day' } },
      y: { title: { display: true, text: 'Energy (kWh)' } },
    }
  };

  // ── ID Chart: 96-slot intraday MCP line chart ─────────────────────────────
  idMCPData: ChartConfiguration<'line'>['data'] = {
    labels:   [],
    datasets: [
      {
        label:           'ID MCP (€/kWh)',
        data:            [],
        borderColor:     '#f39c12',
        backgroundColor: 'rgba(243,156,18,0.1)',
        tension: 0.2,
        fill: true,
      },
      {
        label:           'Renewable Forecast (kWh)',
        data:            [],
        borderColor:     '#27ae60',
        backgroundColor: 'rgba(39,174,96,0.1)',
        tension: 0.2,
        fill: false,
        yAxisID: 'y2',
      }
    ]
  };
  idMCPOptions: ChartOptions<'line'> = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title:  { display: true, text: 'Intra-Day MCP & Renewable Forecast (15-min intervals)' },
      zoom:   { zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' } },
    },
    scales: {
      x:  { title: { display: true, text: 'Time of Day (15-min slots)' } },
      y:  { title: { display: true, text: 'MCP (€/kWh)' }, position: 'left' },
      y2: { title: { display: true, text: 'Renewable (kWh)' }, position: 'right', grid: { drawOnChartArea: false } },
    }
  };

  constructor(
    private authService:  AuthService,
    private marketService: MarketService,
  ) {}

  ngOnInit(): void {
    // Resolve username from the auth service
    this.userSub = this.authService.user$.subscribe(user => {
      if (user?.username) {
        this.username = user.username;
        this.loadDashboards();
      }
    });
  }

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {
    this.userSub?.unsubscribe();
  }

  // ── Data loading ───────────────────────────────────────────────────────────

  loadDashboards(): void {
    if (!this.username) return;
    this.loading = true;
    this.isLoadingChart = true; // Show chart spinners
    this.errorMessage = '';

    this.marketService.loadAllDashboards(this.username).subscribe({
      next: ({ dayAhead, intraday }) => {
        this.daData = dayAhead;
        this.idData = intraday;
        this.buildDACharts();
        this.buildIDCharts();
        this.loading = false; // Hide main overlay
        
        // Add a slight delay for the charts to render the spinner animation
        setTimeout(() => {
          this.isLoadingChart = false;
        }, 4000); // Adjust this delay (in ms) to match your home component's feel
      },
      error: err => {
        this.errorMessage = err.message || 'Failed to load market data';
        this.loading = false;
        this.isLoadingChart = false;
      }
    });
  }

  /** Refreshes only the active tab's data. */
  refresh(): void {
    this.loadDashboards();
  }

  // ── Chart builders ─────────────────────────────────────────────────────────

  private buildDACharts(): void {
    if (!this.daData) return;
    const labels = this.marketService.getHourLabels();

    // MCP chart
    this.daMCPData = {
      labels,
      datasets: [{
        label:           'DA MCP (€/kWh)',
        data:            this.marketService.toFloatArray(this.daData.mcp),
        borderColor:     '#4f81bd',
        backgroundColor: 'rgba(79,129,189,0.15)',
        tension: 0.3,
        fill: true,
      }]
    };

    // Forecast chart
    this.daForecastData = {
      labels,
      datasets: [
        {
          label:           'Forecast Renewable (kWh)',
          data:            this.marketService.toFloatArray(this.daData.forecastRenewable),
          backgroundColor: 'rgba(0,176,80,0.7)',
        },
        {
          label:           'Forecast Demand (kWh)',
          data:            this.marketService.toFloatArray(this.daData.forecastDemand),
          backgroundColor: 'rgba(231,76,60,0.6)',
        }
      ]
    };
  }

  private buildIDCharts(): void {
    if (!this.idData) return;
    const labels = this.marketService.getIntervalLabels();

    this.idMCPData = {
      labels,
      datasets: [
        {
          label:           'ID MCP (€/kWh)',
          data:            this.marketService.toFloatArray(this.idData.mcp),
          borderColor:     '#f39c12',
          backgroundColor: 'rgba(243,156,18,0.1)',
          tension: 0.2,
          fill: true,
        },
        {
          label:           'Renewable Forecast (kWh)',
          data:            this.marketService.toFloatArray(this.idData.forecastRenewable15min),
          borderColor:     '#27ae60',
          backgroundColor: 'rgba(39,174,96,0.1)',
          tension: 0.2,
          fill: false,
          yAxisID: 'y2',
        }
      ]
    };
  }

  // ── Computed helpers for template ─────────────────────────────────────────

  /** Average DA MCP across 24 hours. */
  get avgDaMCP(): string {
    if (!this.daData?.mcp?.length) return '—';
    const avg = this.marketService.toFloatArray(this.daData.mcp)
      .reduce((a, b) => a + b, 0) / 24;
    return avg.toFixed(3) + ' €/kWh';
  }

  /** Peak renewable hour label. */
  get peakRenewableHour(): string {
    if (!this.daData?.forecastRenewable?.length) return '—';
    const vals  = this.marketService.toFloatArray(this.daData.forecastRenewable);
    const peak  = Math.max(...vals);
    const hour  = vals.indexOf(peak);
    return `${hour.toString().padStart(2, '0')}:00 (${peak.toFixed(2)} kWh)`;
  }

  /** Current ID interval label (from contract state). */
  get currentIntervalLabel(): string {
    if (!this.idData?.state) return '—';
    const slot = Number(this.idData.state.currentInterval);
    const h    = Math.floor(slot / 4);
    const m    = (slot % 4) * 15;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} (slot ${slot})`;
  }

  /** Imbalance penalty positive in human-readable units. */
  get penaltyPositive(): string {
    if (!this.idData?.state) return '—';
    return (Number(this.idData.state.penaltyPositive) / 100).toFixed(2) + ' €/kWh';
  }

  /** Imbalance rebate negative in human-readable units. */
  get penaltyNegative(): string {
    if (!this.idData?.state) return '—';
    return (Number(this.idData.state.penaltyNegative) / 100).toFixed(2) + ' €/kWh';
  }
}
