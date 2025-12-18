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

  async initializeHolidays() {
    const holidays = [
      // --- 2025 ---
      { date: '2025-01-01', type: 'holiday', comment: 'Újév' },
      { date: '2025-03-15', type: 'holiday', comment: 'Nemzeti ünnep' },
      { date: '2025-04-18', type: 'holiday', comment: 'Nagypéntek' },
      { date: '2025-04-21', type: 'holiday', comment: 'Húsvét hétfő' },
      { date: '2025-05-01', type: 'holiday', comment: 'Munka ünnepe' },
      { date: '2025-05-02', type: 'holiday', comment: 'Pihenőnap (máj. 17. helyett)' }, // Hosszú hétvége
      { date: '2025-05-17', type: 'workday', comment: 'Munkanap (máj. 2. helyett)' },  // LEDOLGOZÓS
      { date: '2025-06-09', type: 'holiday', comment: 'Pünkösd hétfő' },
      { date: '2025-08-20', type: 'holiday', comment: 'Államalapítás ünnepe' },
      { date: '2025-10-18', type: 'workday', comment: 'Munkanap (okt. 24. helyett)' }, // LEDOLGOZÓS
      { date: '2025-10-23', type: 'holiday', comment: '1956-os forradalom' },
      { date: '2025-10-24', type: 'holiday', comment: 'Pihenőnap (okt. 18. helyett)' }, // Hosszú hétvége
      { date: '2025-11-01', type: 'holiday', comment: 'Mindenszentek' },
      { date: '2025-12-13', type: 'workday', comment: 'Munkanap (dec. 24. helyett)' }, // LEDOLGOZÓS
      { date: '2025-12-24', type: 'holiday', comment: 'Szenteste (Pihenőnap)' },
      { date: '2025-12-25', type: 'holiday', comment: 'Karácsony' },
      { date: '2025-12-26', type: 'holiday', comment: 'Karácsony' },

      // --- 2026 ---
      { date: '2026-01-01', type: 'holiday', comment: 'Újév' },
      { date: '2026-01-02', type: 'holiday', comment: 'Pihenőnap (jan. 10. helyett)' }, // Hosszú hétvége
      { date: '2026-01-10', type: 'workday', comment: 'Munkanap (jan. 2. helyett)' },   // LEDOLGOZÓS
      { date: '2026-03-15', type: 'holiday', comment: 'Nemzeti ünnep' },
      { date: '2026-04-03', type: 'holiday', comment: 'Nagypéntek' },
      { date: '2026-04-06', type: 'holiday', comment: 'Húsvét hétfő' },
      { date: '2026-05-01', type: 'holiday', comment: 'Munka ünnepe' },
      { date: '2026-05-25', type: 'holiday', comment: 'Pünkösd hétfő' },
      { date: '2026-08-08', type: 'workday', comment: 'Munkanap (aug. 21. helyett)' },  // LEDOLGOZÓS
      { date: '2026-08-20', type: 'holiday', comment: 'Államalapítás ünnepe' },
      { date: '2026-08-21', type: 'holiday', comment: 'Pihenőnap (aug. 8. helyett)' }, // Hosszú hétvége
      { date: '2026-10-23', type: 'holiday', comment: '1956-os forradalom' },
      { date: '2026-11-01', type: 'holiday', comment: 'Mindenszentek' },
      { date: '2026-12-12', type: 'workday', comment: 'Munkanap (dec. 24. helyett)' }, // LEDOLGOZÓS
      { date: '2026-12-24', type: 'holiday', comment: 'Szenteste (Pihenőnap)' },
      { date: '2026-12-25', type: 'holiday', comment: 'Karácsony' },
      { date: '2026-12-26', type: 'holiday', comment: 'Karácsony' }
    ];

    const batchPromises = holidays.map(h => {
      // Azonosító a dátum maga, így nem lesz duplikáció ha többször futtatod
      const docRef = doc(this.firestore, 'calendarOverrides', h.date);
      return setDoc(docRef, h);
    });

    await Promise.all(batchPromises);
    return holidays.length;
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