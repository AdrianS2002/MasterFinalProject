import { AfterViewInit, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgChartsModule } from 'ng2-charts';
import { ChartType, ChartData, ChartOptions } from 'chart.js';
import { Router } from '@angular/router';
import { TransitionService } from '../services/transition.service';
import { AuthService } from '../services/auth.service';
import { User, UsersService } from '../services/users.service';
import { Contract, ContractService } from '../services/contract.service';
import { LocationService, Location } from '../services/location.service';
import { FormsModule } from '@angular/forms';
import { FrozenBreakdownHour, NodeService } from '../services/node.service';
import { LoadingSpinnerChartComponent } from "../loading-spinner-chart/loading-spinner-chart.component";

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, NgChartsModule, FormsModule, LoadingSpinnerChartComponent],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements AfterViewInit {

  public userRole: 'MANAGER' | 'USER' | null = null;
  public username: string | null = null;
  public userConsumptionPoint: any = null;
  public currentUser: User | null = null;
  public userLocation: Location | null = null;
  public isLoadingChart: boolean = false;



  public frozenBreakdown: FrozenBreakdownHour[] = [];


  public userChartOptions: any = {
    responsive: true,
    plugins: {
      legend: {
        labels: { color: '#e8fdfd' }
      }
    },
    scales: {
      x: { ticks: { color: '#a7bfc9' } },
      y: { ticks: { color: '#a7bfc9' } }
    }
  };
  constructor(private router: Router, private transitionService: TransitionService, private authService: AuthService, private usersService: UsersService, private contractService: ContractService, private locationService: LocationService, private nodeService: NodeService) {
    this.authService.user$.subscribe(user => {
      this.userRole = user?.roles?.[0] || null;
      this.username = user?.username || null;
      this.currentUser = user || null;

      console.log('CSSSSSSSSSSSSSSSSSSsurrent user:', this.currentUser?.id);

      if (this.userRole === 'USER' && this.username) {
        this.loadUserConsumptionPoint(this.username);
        this.loadUnassignedNodes();
      }
      console.log('User role:', this.userRole);
    })
  }

  public unassignedNodes: Contract[] = [];
  public selectedNodeId: number | null = null;


  public lineChartType: ChartType = 'line';

  public lineChartData: any = {
    labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
    datasets: [
      {
        data: [5, 4, 4, 4, 3, 2, 2, 3, 4, 5, 6, 7, 8, 8, 7, 6, 5, 4, 3, 3, 4, 5, 5, 4],
        label: 'Global Energy Consumption (kWh)',
        fill: true,
        tension: 0.3,
        borderColor: '#00ffc8',
        backgroundColor: 'rgba(0, 255, 200, 0.2)',
        pointBackgroundColor: '#3fe66c',
        pointBorderColor: '#00bcd4'
      }
    ]
  };

  public lineChartOptions: any = {
    responsive: true,
    plugins: {
      legend: {
        labels: {
          color: '#e8fdfd'
        }
      }
    },
    scales: {
      x: {
        ticks: { color: '#a7bfc9' }
      },
      y: {
        ticks: { color: '#a7bfc9' }
      }
    }
  };

  loadUserConsumptionPoint(username: string): void {
    this.usersService.getConsumptionPointByUsername(username).subscribe({
      next: (point) => {
        this.userConsumptionPoint = point;
        this.contractService.getAllContracts().subscribe(contracts => {
          const matchedContract = contracts.find(c => c.address === point.address);
          if (matchedContract?.id != null) {
            this.locationService.getLocationByContractId(matchedContract.id).subscribe({
              next: (loc) => this.userLocation = loc,
              error: (err) => {
                console.error("❌ Eroare la obținerea locației:", err);
                this.userLocation = null;
              }
            });
          }
        });

        if (this.username) {
          this.isLoadingChart = true;
          this.nodeService.getFrozenBreakdown(this.username).subscribe({
            next: (data) => {
              console.log("✅ Breakdown loaded:", data);
              this.frozenBreakdown = data;
              setTimeout(() => {
                this.isLoadingChart = false;
              }, 10000); 
            },
            error: (err) => {console.error('❌ Failed to load breakdown:', err)
              this.isLoadingChart = false;
            }
          });
        }

      },
      error: err => console.error('❌ Error fetching user consumption point:', err)
    });
  }
  ngAfterViewInit(): void {
    const elements = document.querySelectorAll('.fade-in, .fade-out');

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
        } else {
          entry.target.classList.remove('in-view');
        }
      });
    }, {
      threshold: 0.2
    });

    elements.forEach(el => observer.observe(el));

    this.contractService.getUnassignedNodes().subscribe({
      next: (nodes) => {
        this.unassignedNodes = nodes;
        console.log("🔍 Unassigned nodes:", nodes);
      },
      error: (err) => console.error("❌ Failed to load unassigned nodes:", err)
    });

  }

  loadUnassignedNodes(): void {
    this.contractService.getUnassignedNodes().subscribe({
      next: (nodes) => this.unassignedNodes = nodes,
      error: err => console.error('Error loading unassigned nodes', err)
    });
  }

  assignNodeToUser(): void {
    console.log("🧪 Assigning node:", this.selectedNodeId);
    console.log("🧪 Current user ID:", this.currentUser?.id);
    if (!this.selectedNodeId || !this.currentUser?.id) {
      console.error("❌ Missing node ID or userId");
      return;
    }

    this.usersService.getUserById(this.currentUser.id).subscribe({
      next: (user) => {
        if (!user.address) {
          console.error("❌ Address not found for user.");
          return;
        }

        console.log("🧪 Using fallback address:", user.address);
        this.contractService.updateContractOwner(this.selectedNodeId!, user.address).subscribe({
          next: () => {
            console.log("✅ Node assigned!");
            this.loadUserConsumptionPoint(this.username!);
            this.loadUnassignedNodes();
            this.selectedNodeId = null;
          },
          error: err => console.error("❌ Failed to assign node:", err)
        });
      },
      error: err => console.error("❌ Failed to fetch user for assignment", err)
    });
  }


  unassignConsumptionPoint(): void {
    if (!this.userConsumptionPoint?.address) {
      console.error("❌ No consumption point address to unassign.");
      return;
    }

    const currentContract = this.unassignedNodes.find(
      node => node.address === this.userConsumptionPoint.address
    );

    const addressToUnassign = this.userConsumptionPoint.address;

    this.contractService.getAllContracts().subscribe({
      next: (contracts) => {
        const matched = contracts.find(c =>
          c.address.toLowerCase() === addressToUnassign.toLowerCase()
        );

        if (matched) {
          this.contractService.updateContract(matched.id!, {
            owner: '0x0000000000000000000000000000000000000000'
          }).subscribe({
            next: () => {
              console.log("✅ Consumption point unassigned.");
              this.userConsumptionPoint = null;
              this.loadUnassignedNodes();
            },
            error: err => console.error("❌ Failed to unassign:", err)
          });
        } else {
          console.warn("❗ No contract found for this address");
        }
      },
      error: err => console.error("❌ Failed to fetch contracts for unassigning", err)
    });
  }

  public breakdownMetricOptions = [
    { key: 'consumption', label: 'Consumption' },
    { key: 'fromRenewable', label: 'From Renewable' },
    { key: 'fromBattery', label: 'From Battery' },
    { key: 'fromGrid', label: 'From Grid' },
    { key: 'globalTarget', label: 'Global Plan Target' }
  ];
  public selectedMetric: string = 'consumption';
  
  public get breakdownChartData() {
    if (!this.frozenBreakdown?.length || !this.selectedMetric) return { labels: [], datasets: [] };
  
    const values = this.frozenBreakdown.map((hour: any) => hour[this.selectedMetric]);
  
    return {
      labels: this.frozenBreakdown.map((_, i) => `${i}:00`),
      datasets: [
        {
          label: this.breakdownMetricOptions.find(opt => opt.key === this.selectedMetric)?.label || '',
          data: values,
          backgroundColor: 'rgb(255, 242, 0)',
          borderColor: '#3fe66c',
          borderWidth: 1
        }
      ]
    };
  }
  
  public breakdownChartOptions = {
    responsive: true,
    scales: {
      x: { ticks: { color: '#a7bfc9' } },
      y: { beginAtZero: true, ticks: { color: '#a7bfc9' } }
    },
    plugins: {
      legend: { labels: { color: '#e8fdfd' } }
    }
  };
  



  navigateWithTransition(path: string): void {
    this.transitionService.animateTransition().then(() => {
      this.router.navigateByUrl(path);
    });
  }

  navigateToLogin(): void {
    this.navigateWithTransition('/login');
  }


  navigateToSignUp(): void {
    this.navigateWithTransition('/signup');
  }

  navigateToOptimization(): void {
    this.navigateWithTransition('/optimization');
  }


  navigateToManageUsers(): void {
    this.navigateWithTransition('/manage-users');
  }

}
