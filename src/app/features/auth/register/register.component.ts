import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { Role } from '../../../core/models/app.models';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss'
})
export class RegisterComponent {
  authService = inject(AuthService);
  
  username = '';
  name = '';
  password = '';
  role: Role = 'dispatcher';
  errorMsg = '';
  isLoading = false;

  async onRegister() {
    if (!this.username || !this.name || !this.password) {
      this.errorMsg = 'Minden mező kitöltése kötelező!';
      return;
    }

    this.isLoading = true;
    await this.authService.register(this.username, this.name, this.role, this.password);
    this.isLoading = false;
  }
}