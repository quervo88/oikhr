import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login.component';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';
import { inject } from '@angular/core';
import { AuthService } from './core/services/auth.service';
import { Router } from '@angular/router';
import { RegisterComponent } from './features/auth/register/register.component';
import { ProfileComponent } from './features/profile/profile.component';
import { UserListComponent } from './features/admin/user-list/user-list.component';


// Egyszerű Guard (Védelem): Ha nincs belépve, visszadob a loginra
const authGuard = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  
  if (auth.isLoggedIn()) {
    return true;
  }
  return router.parseUrl('/login');
};

const adminGuard = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const user = auth.getCurrentUser();
  
  if (user && user.role === 'admin') {
    return true;
  }
  // Ha nem admin, de be van lépve -> főoldal, ha nincs belépve -> login
  return router.parseUrl(auth.isLoggedIn() ? '/' : '/login');
};

export const routes: Routes = [
  // 1. Login oldal (publikus)
  { 
    path: 'register', 
    component: RegisterComponent 
  },
  { 
    path: 'login', 
    component: LoginComponent 
  },
  
  // 2. Védett felület (Main Layout)
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard], // Csak belépve!
    children: [
      { path: '', redirectTo: 'calendar', pathMatch: 'full' },
      
      // Később itt hozzuk létre a calendar komponenst
      { 
        path: 'calendar', 
        loadComponent: () => import('./features/calendar/calendar-view/calendar-view.component').then(m => m.CalendarViewComponent) 
      },
      { 
        path: 'salary', 
        loadComponent: () => import('./features/salary/salary-calculator/salary-calculator.component').then(m => m.SalaryCalculatorComponent) 
      },
      { 
        path: 'profile', 
        component: ProfileComponent 
      },
      { 
        path: 'admin', 
        component: UserListComponent,
        canActivate: [adminGuard] // Csak admin léphet ide
      },
    ]
  },

  // Minden más -> Login
  { path: '**', redirectTo: 'login' }
];