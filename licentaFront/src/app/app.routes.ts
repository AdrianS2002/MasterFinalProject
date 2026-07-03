import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { SignupComponent } from './signup/signup.component';
import { HomeComponent } from './home/home.component';
import { LoadingSpinnerChartComponent } from './loading-spinner-chart/loading-spinner-chart.component';
import { AboutComponent } from './about/about.component';
import { AuthGuard } from './auth.guard';
import { OptimizationComponent } from './optimization/optimization.component';
import { ManageUsersComponent } from './manage-users/manage-users.component';
import { MarketComponent } from './market/market.component';

export const routes: Routes = [
    {path: 'login', component: LoginComponent},
    {path: 'signup', component: SignupComponent},
    {path: 'home', component: HomeComponent},
    {path: 'spinner1', component: LoadingSpinnerChartComponent},
    {path: 'about', component: AboutComponent},
    {path: 'optimization', component: OptimizationComponent, canActivate:[AuthGuard]},
    {path: 'manage-users', component: ManageUsersComponent, canActivate:[AuthGuard]},
    {path: 'market', component: MarketComponent, canActivate:[AuthGuard]},
    { path: '', redirectTo: 'login', pathMatch: 'full' },
    {path: '**', redirectTo: 'login'}
];
