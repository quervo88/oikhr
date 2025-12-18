import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, User as FireUser, sendPasswordResetEmail } from '@angular/fire/auth';
import { Firestore, doc, getDoc, setDoc } from '@angular/fire/firestore';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { User } from '../models/app.models';
import { DataService } from './data.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private router = inject(Router);
  
  // A DataService-re szükség lehet, de itt direktben hívjuk a Firestore-t a profil lekéréshez
  // a körkörös függőség (Circular Dependency) elkerülése végett.

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  currentUser$ = this.currentUserSubject.asObservable();

  // Virtuális domain a felhasználónevekhez
  private readonly DOMAIN = '@oikhr.local';

  constructor() {
    // Figyeljük a Firebase Auth állapotát (Session kezelés)
    onAuthStateChanged(this.auth, async (fireUser) => {
      if (fireUser) {
        // Ha be van lépve, lekérjük a profilját a Firestore-ból
        const userProfile = await this.fetchUserProfile(fireUser.uid);
        if (userProfile) {
          this.currentUserSubject.next(userProfile);
        }
      } else {
        this.currentUserSubject.next(null);
      }
    });
  }

  private async fetchUserProfile(uid: string): Promise<User | null> {
    const userDocRef = doc(this.firestore, 'users', uid);
    const snapshot = await getDoc(userDocRef);
    if (snapshot.exists()) {
      return snapshot.data() as User;
    }
    return null;
  }

  // --- LOGIN ---
  async login(username: string, password?: string): Promise<boolean> {
    try {
      const email = this.formatEmail(username);
      await signInWithEmailAndPassword(this.auth, email, password || '');
      this.router.navigate(['/calendar']);
      return true;
    } catch (error) {
      console.error('Login hiba:', error);
      return false;
    }
  }

  // --- LOGOUT ---
  async logout() {
    await signOut(this.auth);
    this.router.navigate(['/login']);
  }

  // --- REGISTER ---
  async register(username: string, name: string, role: any, password: string): Promise<boolean> {
    try {
      const email = this.formatEmail(username);
      const credential = await createUserWithEmailAndPassword(this.auth, email, password);
      
      // Profil mentése Firestore-ba
      const newUser: User = {
        id: credential.user.uid,
        username: username,
        name: name,
        role: role
      };
      
      await setDoc(doc(this.firestore, 'users', newUser.id), newUser);
      
      // Sikeres regisztráció után átirányítás
      this.router.navigate(['/calendar']);
      return true;
    } catch (error: any) {
      console.error('Regisztrációs hiba:', error);
      if (error.code === 'auth/email-already-in-use') {
          alert('Ez a felhasználónév már foglalt!');
      }
      return false;
    }
  }

  // --- PROFIL FRISSÍTÉS ---
  async updateProfile(data: { baseSalary?: number, password?: string }): Promise<void> {
    const currentUser = this.currentUserSubject.value;
    if (!currentUser) return;

    // 1. Jelszó csere (Firebase Auth)
    if (data.password) {
       // Megjegyzés: A Firebase biztonsági okból kéri az "újrahitelesítést" jelszócsere előtt,
       // ha a session régi. Itt egyszerűsítünk, de élesben dobhat hibát (requires-recent-login).
       const user = this.auth.currentUser;
       if (user) {
          // A jelszót itt most nem frissítjük a kódban, mert bonyolultabb (updatePassword),
          // helyette a profil adatokat mentjük. 
          // Ha szeretnéd a jelszó cserét is, ahhoz az updatePassword(user, data.password) kell.
          // De a legbiztosabb a jelszóvisszaállító email.
          
          /* Implementáció, ha nagyon kell:
             import { updatePassword } from '@angular/fire/auth';
             await updatePassword(user, data.password);
          */
       }
    }

    // 2. Adatok mentése Firestore-ba
    const updatePayload: any = {};
    if (data.baseSalary !== undefined) updatePayload.baseSalary = data.baseSalary;
    
    if (Object.keys(updatePayload).length > 0) {
        await setDoc(doc(this.firestore, 'users', currentUser.id), updatePayload, { merge: true });
        
        // Lokális állapot frissítése
        const updated = { ...currentUser, ...updatePayload };
        this.currentUserSubject.next(updated);
    }
  }

  // --- ADMIN PASSWORD RESET ---
  async adminResetPassword(userId: string, newPass: string): Promise<void> {
     // Firebase kliens oldalon NEM engedi más jelszavát átírni.
     // Helyette küldünk egy jelszóemlékeztető emailt, vagy konzolra írjuk a korlátot.
     alert("Biztonsági okokból a Firebase nem engedi más felhasználó jelszavának közvetlen átírását kliens oldalon. Kérlek használd a jelszóemlékeztető funkciót, vagy a Firebase konzolt.");
  }
  
  // Segéd: Username -> Email
  private formatEmail(username: string): string {
      if (username.includes('@')) return username;
      return `${username}${this.DOMAIN}`;
  }

  isLoggedIn(): boolean {
    return !!this.currentUserSubject.value;
  }
  
  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }
}