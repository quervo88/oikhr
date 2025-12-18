import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { User } from '../models/app.models';
import { MockDataService } from './mock-data.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private mockDb = inject(MockDataService);
  private router = inject(Router);

  // Ez a változó tárolja, ki van belépve. Bárki feliratkozhat rá (subscribe).
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  currentUser$ = this.currentUserSubject.asObservable();

  constructor() {
    // Ha újratöltjük az oldalt, megpróbáljuk visszatölteni a felhasználót
    const savedUser = localStorage.getItem('hr_current_user');
    if (savedUser) {
      this.currentUserSubject.next(JSON.parse(savedUser));
    }
  }

  // MÓDOSÍTVA: Jelszó is kell
  login(username: string, password?: string): boolean {
    // Itt hívjuk a mock adatbázist, most már jelszóval
    let success = false;
    this.mockDb.getUserByCredentials(username, password).subscribe(user => {
      if (user) {
        this.currentUserSubject.next(user);
        localStorage.setItem('hr_current_user', JSON.stringify(user));
        this.router.navigate(['/calendar']); // Sikeres login -> Naptár
        success = true;
      }
    });
    return success;
  }

  logout() {
    this.currentUserSubject.next(null);
    localStorage.removeItem('hr_current_user');
    this.router.navigate(['/login']);
  }

  // Segédmetódus: van-e joga a felhasználónak valamihez?
  isLoggedIn(): boolean {
    return !!this.currentUserSubject.value;
  }
  
  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }


  register(username: string, name: string, role: any, password: string): void {
    const newUser: User = {
      id: Date.now().toString(), // Generálunk egy ID-t
      username: username,
      name: name,
      role: role
      // baseSalary nincs, azt majd a profilban állítja be
    };

    this.mockDb.registerUser(newUser, password).subscribe(success => {
      if (success) {
        // Sikeres regisztráció után azonnal be is léptetjük
        this.currentUserSubject.next(newUser);
        localStorage.setItem('hr_current_user', JSON.stringify(newUser));
        this.router.navigate(['/calendar']);
      } else {
        alert('Hiba: Ez a felhasználónév már foglalt!');
      }
    });
  }

  // Profil frissítése és a session (helyi tároló) aktualizálása
  updateProfile(data: { baseSalary?: number, password?: string }): void {
    const currentUser = this.currentUserSubject.value;
    if (!currentUser) return;

    this.mockDb.updateUserProfile(currentUser.id, data).subscribe(success => {
        if (success) {
            // Frissítjük a helyi user objektumot is, hogy a kalkulátor azonnal lássa az új bért
            const updatedUser = { ...currentUser, ...data };
            // A jelszót nem tároljuk a publikus objektumban, így azt kivesszük
            if (data.password) delete (updatedUser as any).password;
            
            this.currentUserSubject.next(updatedUser);
            localStorage.setItem('hr_current_user', JSON.stringify(updatedUser));
        }
    });
  }

  // Admin funkció: Más felhasználó jelszavának resetelése
  adminResetPassword(userId: string, newPass: string): void {
     this.mockDb.resetUserPassword(userId, newPass).subscribe();
  }
}