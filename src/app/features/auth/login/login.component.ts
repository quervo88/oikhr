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
  password = '';
  errorMsg = '';
  isLoading = false; // ÚJ: Töltés jelző
  
  private authService = inject(AuthService);
  private router = inject(Router);

  async onLogin() {
    if (!this.username || !this.password) {
      this.errorMsg = 'Kérlek add meg a felhasználónevet és a jelszót!';
      return;
    }

    this.isLoading = true;
    this.errorMsg = '';

    const success = await this.authService.login(this.username, this.password);
    
    this.isLoading = false;
    if (!success) {
      this.errorMsg = 'Hibás felhasználónév vagy jelszó!';
    }
  }

  goToRegister() {
    this.router.navigate(['/register']);
  }
}