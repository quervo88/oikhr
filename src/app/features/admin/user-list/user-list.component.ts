import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../../core/services/data.service'; // MÓDOSULT
import { AuthService } from '../../../core/services/auth.service';
import { User } from '../../../core/models/app.models';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-list.component.html',
  styleUrl: './user-list.component.scss'
})
export class UserListComponent implements OnInit {
  dataService = inject(DataService); // MÓDOSULT
  authService = inject(AuthService);

  users: User[] = [];
  currentUserId = '';

  // Modal állapotváltozók
  isPasswordModalOpen = false;
  selectedUserForPassword: User | null = null;
  newPassword = '';

  migrationSourceId = '';
  migrationTargetId = '';

  ngOnInit() {
    this.currentUserId = this.authService.getCurrentUser()?.id || '';
    this.loadUsers();
  }

  loadUsers() {
    // A getAllUsers Observable-t ad vissza, ez maradhat subscribe
    this.dataService.getAllUsers().subscribe(res => {
      this.users = res;
    });
  }

  async deleteUser(user: User) { // ASYNC lett
    if (user.id === this.currentUserId) {
      alert('Saját magadat nem törölheted!');
      return;
    }

    if (confirm(`Biztosan törlöd ${user.name} felhasználót? Minden adata elvész!`)) {
      // MÓDOSULT: Promise kezelése await-tel
      await this.dataService.deleteUser(user.id);
      // Nem kell külön loadUsers(), mert a getAllUsers subscribe (fent) automatikusan frissül a Firestore-ból!
    }
  }

  // --- JELSZÓ MODAL KEZELÉS ---

  openPasswordModal(user: User) {
    this.selectedUserForPassword = user;
    this.newPassword = ''; // Reset
    this.isPasswordModalOpen = true;
  }

  closePasswordModal() {
    this.isPasswordModalOpen = false;
    this.selectedUserForPassword = null;
    this.newPassword = '';
  }

  saveNewPassword() {
    if (!this.selectedUserForPassword || !this.newPassword) return;

    // Az AuthService adminResetPassword csak egy alertet dob Firebase esetén,
    // de hívjuk meg a kompatibilitás kedvéért.
    this.authService.adminResetPassword(this.selectedUserForPassword.id, this.newPassword);
    
    this.closePasswordModal();
  }

  async migrateData() {
    if (!this.migrationSourceId || !this.migrationTargetId) {
      alert('Kérlek válassz ki egy forrás és egy cél felhasználót!');
      return;
    }

    if (this.migrationSourceId === this.migrationTargetId) {
      alert('A forrás és a cél nem lehet ugyanaz!');
      return;
    }

    const sourceUser = this.users.find(u => u.id === this.migrationSourceId)?.name;
    const targetUser = this.users.find(u => u.id === this.migrationTargetId)?.name;

    if (!confirm(`BIZTOSAN átmozgatod az összes adatot (műszakok, túlórák) innen: ${sourceUser} --> ide: ${targetUser}?`)) {
      return;
    }

    try {
      const count = await this.dataService.migrateUserData(this.migrationSourceId, this.migrationTargetId);
      alert(`Sikeres költöztetés! Összesen ${count} bejegyzés került átmozgatásra.`);
      
      // Opcionális: A forrás törlése
      if (confirm(`Szeretnéd most törölni a régi, kiürített felhasználót (${sourceUser})?`)) {
         await this.dataService.deleteUser(this.migrationSourceId);
         this.migrationSourceId = ''; // Reset
      }

    } catch (error) {
      console.error(error);
      alert('Hiba történt a költöztetés során! Nézd meg a konzolt.');
    }
  }

  // --- SZEREPKÖR KEZELÉS ---

  async onRoleChange(user: User, event: any) { // ASYNC lett
    const newRole = event.target.value;
    
    if (user.id === this.currentUserId) {
        alert("Saját magad jogát nem módosíthatod itt!");
        this.loadUsers(); // Mivel a Firestore-ból jön, ez lehet, hogy nem állítja vissza azonnal a selectet, de a frissítés bejön.
        return;
    }

    // MÓDOSULT: Promise kezelése
    await this.dataService.updateUserRole(user.id, newRole);
    console.log(`${user.name} új szerepköre: ${newRole}`);
  }
}