import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; // <--- FormsModule importálása az inputhoz
import { MockDataService } from '../../../core/services/mock-data.service';
import { AuthService } from '../../../core/services/auth.service';
import { User } from '../../../core/models/app.models';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [CommonModule, FormsModule], // <--- FormsModule hozzáadva
  templateUrl: './user-list.component.html',
  styleUrl: './user-list.component.scss'
})
export class UserListComponent implements OnInit {
  dataService = inject(MockDataService);
  authService = inject(AuthService);

  users: User[] = [];
  currentUserId = '';

  // Modal állapotváltozók
  isPasswordModalOpen = false;
  selectedUserForPassword: User | null = null;
  newPassword = '';

  ngOnInit() {
    this.currentUserId = this.authService.getCurrentUser()?.id || '';
    this.loadUsers();
  }

  loadUsers() {
    this.dataService.getAllUsers().subscribe(res => {
      this.users = res;
    });
  }

  deleteUser(user: User) {
    if (user.id === this.currentUserId) {
      alert('Saját magadat nem törölheted!');
      return;
    }

    if (confirm(`Biztosan törölni szeretnéd ${user.name} felhasználót? Minden adata elvész!`)) {
      this.dataService.deleteUser(user.id).subscribe(() => {
        this.loadUsers(); // Lista frissítése
      });
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

    this.authService.adminResetPassword(this.selectedUserForPassword.id, this.newPassword);
    
    // Visszajelzés és bezárás
    alert(`${this.selectedUserForPassword.name} jelszava sikeresen módosítva!`);
    this.closePasswordModal();
  }

  // --- SZEREPKÖR KEZELÉS ---

  onRoleChange(user: User, event: any) {
    const newRole = event.target.value;
    
    // Nem engedjük, hogy a saját jogát elvegye (biztonsági okból)
    if (user.id === this.currentUserId) {
        alert("Saját magad jogát nem módosíthatod itt!");
        this.loadUsers(); // Visszaállítjuk a select-et
        return;
    }

    this.dataService.updateUserRole(user.id, newRole).subscribe(success => {
        if (success) {
            console.log(`${user.name} új szerepköre: ${newRole}`);
        }
    });
  }
}