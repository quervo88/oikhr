import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, doc, setDoc, deleteDoc, updateDoc, query, where, getDocs } from '@angular/fire/firestore';
import { Observable, from, map } from 'rxjs';
import { User, ShiftEntry, OvertimeEntry, CalendarDayOverride } from '../models/app.models';

@Injectable({
  providedIn: 'root'
})
export class DataService {
  private firestore = inject(Firestore);

  // --- FELHASZNÁLÓK (USERS) ---
  
  getAllUsers(): Observable<User[]> {
    const usersCol = collection(this.firestore, 'users');
    return collectionData(usersCol, { idField: 'id' }) as Observable<User[]>;
  }

  updateUserRole(userId: string, newRole: any): Promise<void> {
    const userRef = doc(this.firestore, 'users', userId);
    return updateDoc(userRef, { role: newRole });
  }

  updateUserProfile(userId: string, data: { baseSalary?: number }): Promise<void> {
    const userRef = doc(this.firestore, 'users', userId);
    return updateDoc(userRef, data);
  }

  async deleteUser(userId: string): Promise<void> {
    // 1. Töröljük a user dokumentumot
    await deleteDoc(doc(this.firestore, 'users', userId));
    // Megjegyzés: A Firebase Auth-ból kliens oldalon admin nem törölhet egyszerűen,
    // ahhoz Cloud Function kellene. Itt most csak az adatbázisból töröljük a jogait/adatait.
  }

  // --- MŰSZAKOK (SHIFTS) ---

  getShifts(): Observable<ShiftEntry[]> {
    const shiftsCol = collection(this.firestore, 'shifts');
    return collectionData(shiftsCol, { idField: 'id' }) as Observable<ShiftEntry[]>;
  }

  saveShift(entry: ShiftEntry): Promise<void> {
    // Ha nincs ID (új), generáljunk egyet a Firestore-ral
    const id = entry.id || doc(collection(this.firestore, 'shifts')).id;
    const shiftRef = doc(this.firestore, 'shifts', id);
    // Biztosítjuk, hogy az ID benne legyen az objektumban
    const payload = { ...entry, id };
    return setDoc(shiftRef, payload);
  }

  async deleteShift(date: string, userId: string): Promise<void> {
    // Mivel a naptár nem ID alapján kérte a törlést, hanem dátum+user alapján,
    // először meg kell keresnünk a dokumentumot.
    const shiftsCol = collection(this.firestore, 'shifts');
    const q = query(shiftsCol, where('date', '==', date), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    
    const deletePromises = snapshot.docs.map(d => deleteDoc(d.ref));
    await Promise.all(deletePromises);
  }

  // --- TÚLÓRÁK (OVERTIMES) ---

  getOvertimes(): Observable<OvertimeEntry[]> {
    const otCol = collection(this.firestore, 'overtimes');
    return collectionData(otCol, { idField: 'id' }) as Observable<OvertimeEntry[]>;
  }

  saveOvertime(entry: OvertimeEntry): Promise<void> {
    const id = entry.id || doc(collection(this.firestore, 'overtimes')).id;
    const otRef = doc(this.firestore, 'overtimes', id);
    const payload = { ...entry, id };
    return setDoc(otRef, payload);
  }

  async deleteOvertime(id: string): Promise<void> {
    const otRef = doc(this.firestore, 'overtimes', id);
    await deleteDoc(otRef);
  }

  async updateOvertimesForDay(date: string, userId: string, newOvertimes: OvertimeEntry[]): Promise<void> {
    // 1. Töröljük a régieket erre a napra
    const otCol = collection(this.firestore, 'overtimes');
    const q = query(otCol, where('date', '==', date), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    const deletePromises = snapshot.docs.map(d => deleteDoc(d.ref));
    await Promise.all(deletePromises);

    // 2. Mentjük az újakat
    const savePromises = newOvertimes.map(ot => this.saveOvertime(ot));
    await Promise.all(savePromises);
  }

  async migrateUserData(oldUserId: string, newUserId: string): Promise<number> {
    let count = 0;

    // 1. Műszakok átírása
    const shiftsCol = collection(this.firestore, 'shifts');
    const shiftsQuery = query(shiftsCol, where('userId', '==', oldUserId));
    const shiftsSnap = await getDocs(shiftsQuery);

    const shiftPromises = shiftsSnap.docs.map(d => {
      count++;
      return updateDoc(d.ref, { userId: newUserId });
    });
    await Promise.all(shiftPromises);

    // 2. Túlórák átírása
    const otCol = collection(this.firestore, 'overtimes');
    const otQuery = query(otCol, where('userId', '==', oldUserId));
    const otSnap = await getDocs(otQuery);

    const otPromises = otSnap.docs.map(d => {
      count++;
      return updateDoc(d.ref, { userId: newUserId });
    });
    await Promise.all(otPromises);

    return count; // Visszaadjuk, hány bejegyzést mozgattunk át
  }

  // --- NAPTÁR KIVÉTELEK (OVERRIDES) ---

  getCalendarOverrides(): Observable<CalendarDayOverride[]> {
    const calCol = collection(this.firestore, 'calendarOverrides');
    return collectionData(calCol) as Observable<CalendarDayOverride[]>;
  }
}