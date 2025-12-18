import { Injectable } from '@angular/core';
import { User, ShiftEntry, OvertimeEntry, CalendarDayOverride } from '../models/app.models';
import { Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class MockDataService {
  private readonly STORAGE_KEY = 'hr_mester_db_v1';

  // Kezdeti adatbázis állapot (seed data)
  private db: {
    users: User[];
    shifts: ShiftEntry[];
    overtimes: OvertimeEntry[];
    calendarOverrides: CalendarDayOverride[];
  } = {
    users: [
      // Jelszavak a kódolásban: a mock miatt itt "password" propertyként tároljuk őket, 
      // de a publikus User interface nem tartalmazza.
      // @ts-ignore
      { id: '1', username: 'admin', name: 'Rendszergazda', role: 'admin', password: 'admin' },
      // @ts-ignore
      { id: '2', username: 'hr', name: 'HR Marika', role: 'hr', password: 'hr' },
      // @ts-ignore
      { id: '3', username: 'disp1', name: 'Kovács János (Disp)', role: 'dispatcher', baseSalary: 650000, password: 'disp' },
      // @ts-ignore
      { id: '4', username: 'disp2', name: 'Nagy Éva (Disp)', role: 'dispatcher', baseSalary: 620000, password: 'disp' },
    ],
    shifts: [],
    overtimes: [],
    calendarOverrides: []
  };

  constructor() {
    this.loadFromStorage();
  }

  // --- BELSŐ MŰKÖDÉS (LOCALSTORAGE) ---
  
  private loadFromStorage() {
    const data = localStorage.getItem(this.STORAGE_KEY);
    if (data) {
      this.db = JSON.parse(data);
    } else {
      this.saveToStorage(); // Ha még nincs adat, mentsük el az alapértelmezettet
    }
  }

  private saveToStorage() {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.db));
  }

  // Új felhasználó regisztrálása
  registerUser(user: User, password: string): Observable<boolean> {
    // 1. Ellenőrzés: Létezik már ilyen felhasználónév?
    const exists = this.db.users.some(u => u.username === user.username);
    if (exists) {
      return of(false); // Hiba: már van ilyen
    }

    // 2. Felhasználó mentése
    // A db.users tömbünkben a valóságban van 'password' mező is (any típus miatt átmegy),
    // de a publikus User interface-ben nincs. A MockDB itt "csal" kicsit, de működik.
    const newUser = {
      ...user,
      password: password // Hozzácsapjuk a jelszót a belső tároláshoz
    };

    // @ts-ignore - A TypeScript szólna, hogy a User típusban nincs password, de a DB-ben kell
    this.db.users.push(newUser);
    
    this.saveToStorage();
    return of(true);
  }

  // Felhasználói profil frissítése (Saját profil)
  updateUserProfile(userId: string, data: { baseSalary?: number, password?: string }): Observable<boolean> {
    const userIndex = this.db.users.findIndex(u => u.id === userId);
    if (userIndex === -1) return of(false);

    // Adatok frissítése
    if (data.baseSalary !== undefined) {
        this.db.users[userIndex].baseSalary = data.baseSalary;
    }
    if (data.password) {
        // @ts-ignore
        this.db.users[userIndex].password = data.password;
    }

    this.saveToStorage();
    return of(true);
  }

  // Jelszó visszaállítása (Admin funkció)
  resetUserPassword(userId: string, newPassword: string): Observable<boolean> {
    const userIndex = this.db.users.findIndex(u => u.id === userId);
    if (userIndex === -1) return of(false);

    // @ts-ignore
    this.db.users[userIndex].password = newPassword;
    
    this.saveToStorage();
    return of(true);
  }

  // MÓDOSÍTVA: Most már jelszót is vár és ellenőriz
  getUserByCredentials(username: string, password?: string): Observable<User | undefined> {
    // @ts-ignore
    const user = this.db.users.find(u => u.username === username && u.password === password);
    
    // Biztonsági másolatot adunk vissza, hogy ne lehessen közvetlenül módosítani
    if (user) {
        // Fontos: A jelszót NE adjuk vissza a frontendnek a User objektumban
        const safeUser = { ...user };
        // @ts-ignore
        delete safeUser.password;
        return of(safeUser);
    }
    
    return of(undefined);
  }

  // 2. Beosztások lekérése
  getShifts(): Observable<ShiftEntry[]> {
    return of(this.db.shifts);
  }

  // 3. Beosztás mentése (HR)
  saveShift(entry: ShiftEntry): Observable<boolean> {
    // Megnézzük, van-e már bejegyzés erre a napra az adott embernek
    const index = this.db.shifts.findIndex(s => s.date === entry.date && s.userId === entry.userId);
    
    if (index >= 0) {
      this.db.shifts[index] = entry; // Frissítés
    } else {
      this.db.shifts.push(entry); // Új felvitel
    }
    
    this.saveToStorage();
    return of(true);
  }

  deleteShift(date: string, userId: string): Observable<boolean> {
    this.db.shifts = this.db.shifts.filter(s => !(s.date === date && s.userId === userId));
    this.saveToStorage();
    return of(true);
  }

  // 4. Túlórák lekérése
  getOvertimes(): Observable<OvertimeEntry[]> {
    return of(this.db.overtimes);
  }

  // 5. Túlóra mentése (Diszpécser)
  saveOvertime(entry: OvertimeEntry): Observable<boolean> {
    this.db.overtimes.push(entry);
    this.saveToStorage();
    return of(true);
  }
  
  // 6. Túlóra törlése
  deleteOvertime(id: string): Observable<boolean> {
    this.db.overtimes = this.db.overtimes.filter(o => o.id !== id);
    this.saveToStorage();
    return of(true);
  }

  // 7. Naptár felülírások lekérése (Admin)
  getCalendarOverrides(): Observable<CalendarDayOverride[]> {
    return of(this.db.calendarOverrides);
  }

  // Túlórák csoportos frissítése egy napra
  updateOvertimesForDay(date: string, userId: string, newOvertimes: OvertimeEntry[]) {
    // 1. Töröljük a régieket erre a napra/userre
    this.db.overtimes = this.db.overtimes.filter(o => !(o.date === date && o.userId === userId));
    
    // 2. Hozzáadjuk az újakat
    newOvertimes.forEach(ot => {
        ot.userId = userId; // Biztos ami biztos
        this.db.overtimes.push(ot);
    });
    
    this.saveToStorage();
  }

  // Minden felhasználó lekérése (Adminnak)
  getAllUsers(): Observable<User[]> {
    // Biztonsági másolatot adunk vissza, jelszavak és fizetések nélkül
    const safeUsers = this.db.users.map(u => ({
      id: u.id,
      username: u.username,
      name: u.name,
      role: u.role,
      baseSalary: u.baseSalary
      // password NEM kerül bele
    }));
    return of(safeUsers);
  }

  // Felhasználó törlése
  deleteUser(userId: string): Observable<boolean> {
    const initialLength = this.db.users.length;
    this.db.users = this.db.users.filter(u => u.id !== userId);
    
    // Töröljük a hozzá tartozó adatokat is? (Opcionális, de tisztább)
    this.db.shifts = this.db.shifts.filter(s => s.userId !== userId);
    this.db.overtimes = this.db.overtimes.filter(o => o.userId !== userId);

    this.saveToStorage();
    return of(this.db.users.length < initialLength);
  }

  // Szerepkör módosítása (Admin)
  updateUserRole(userId: string, newRole: any): Observable<boolean> {
    const userIndex = this.db.users.findIndex(u => u.id === userId);
    if (userIndex !== -1) {
      this.db.users[userIndex].role = newRole;
      this.saveToStorage();
      return of(true);
    }
    return of(false);
  }
}