import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router'; 
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  username = '';
  password = ''; // ÚJ MEZŐ
  errorMsg = '';
  
  private authService = inject(AuthService);
  private router = inject(Router);

  onLogin() {
    if (!this.username || !this.password) { // Jelszó ellenőrzése is
      this.errorMsg = 'Kérlek add meg a felhasználónevet és a jelszót!';
      return;
    }

    // Átadjuk a jelszót is
    const success = this.authService.login(this.username, this.password);
    if (!success) {
      this.errorMsg = 'Hibás felhasználónév vagy jelszó!';
    }
  }

  goToRegister() {
    this.router.navigate(['/register']);
  }
}