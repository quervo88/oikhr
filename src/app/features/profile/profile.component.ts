import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss'
})
export class ProfileComponent implements OnInit {
  authService = inject(AuthService);
  
  // Adatok
  username = '';
  name = '';
  role = '';
  
  // Szerkeszthető adatok
  baseSalary: number | null = null;
  newPassword = '';

  // UI állapot
  isSalaryVisible = false;
  successMsg = '';

  ngOnInit() {
    const user = this.authService.getCurrentUser();
    if (user) {
        this.username = user.username;
        this.name = user.name;
        this.role = user.role;
        this.baseSalary = user.baseSalary || null;
    }
  }

  toggleSalary() {
    this.isSalaryVisible = !this.isSalaryVisible;
  }

  onSave() {
    this.authService.updateProfile({
        baseSalary: this.baseSalary || 0,
        password: this.newPassword || undefined
    });

    this.successMsg = 'A profilod sikeresen frissült!';
    this.newPassword = ''; // Jelszó mező ürítése
    
    setTimeout(() => this.successMsg = '', 3000); // Üzenet eltüntetése
  }
}