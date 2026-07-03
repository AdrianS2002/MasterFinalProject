import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { take, map } from 'rxjs/operators';
import { AuthService } from './services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> {
    return this.authService.user$.pipe(
      take(1),
      map(user => {
        console.log('AuthGuard - current user:', user);
        if (!user) {
          console.log('AuthGuard - user not logged in. Redirecting.');
          return this.router.createUrlTree(['/auth']);
        }

        if (route.data && route.data['roles']) {
          const allowedRoles: string[] = route.data['roles'];
          const hasRole = allowedRoles.some(role => user.roles && user.roles.includes(role));
          console.log('AuthGuard - allowed roles:', allowedRoles, 'hasRole:', hasRole);
          if (!hasRole) {
            console.log('AuthGuard - user does not have required role. Redirecting.');
            return this.router.createUrlTree(['/unauthorized']);
          }
        }
        console.log('AuthGuard - access granted');
        return true;
      })
    );
  }
}
