import { Component, EventEmitter, Input, Output, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ShiftEntry, OvertimeEntry, ShiftType, OvertimeType, User } from '../../../core/models/app.models';
import { AuthService } from '../../../core/services/auth.service';
import { DataService } from '../../../core/services/data.service';

@Component({
  selector: 'app-entry-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './entry-modal.component.html',
  styleUrl: './entry-modal.component.scss'
})
export class EntryModalComponent implements OnInit {
  // --- Bemenő adatok ---
  @Input() date!: string;
  @Input() existingShift?: ShiftEntry;
  @Input() existingOvertimes: OvertimeEntry[] = [];
  @Input() isWeekendOrHoliday: boolean = false;
  @Input() defaultUserId: string = '';

  // --- Kimenő események ---
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<{main: ShiftEntry | null, overtimes: OvertimeEntry[]}>();

  // --- Service-ek ---
  authService = inject(AuthService);
  dataService = inject(DataService);

  // --- Állapotváltozók ---
  activeTab: 'shift' | 'overtime' = 'shift';
  currentUserRole: string = '';
  users: User[] = [];
  targetUserId: string = '';

  // --- Űrlap adatok: Műszak ---
  mainType: ShiftType | null = null;
  mainStart: string = '';
  mainEnd: string = '';

  // --- Űrlap adatok: Túlóra ---
  tempOvertimes: OvertimeEntry[] = [];
  
  newOtType: string = 'ticket'; // Alapértelmezett: Ticket
  newOtStart: string = '';
  newOtEnd: string = '';
  newOtDetails: string = ''; // Ticket ID vagy Megjegyzés

  // --- Konfiguráció ---
  shiftTypes: ShiftType[] = ['nappal', 'este', 'ejszaka', 'keszenlet', 'szabadsag', 'betegseg'];
  
  shiftTypesConfig: Record<string, { label: string, color: string, start: boolean }> = {
    'nappal':    { label: 'Nappal (08-16)', color: 'text-amber-500', start: true },
    'este':      { label: 'Este (16-00)',   color: 'text-indigo-500', start: true },
    'ejszaka':   { label: 'Éjszaka (00-08)',color: 'text-slate-700',  start: true },
    'keszenlet': { label: 'Készenlét',      color: 'text-purple-500', start: true },
    'szabadsag': { label: 'Szabadság',      color: 'text-green-500',  start: false },
    'betegseg':  { label: 'Betegség',       color: 'text-red-500',    start: false }
  };

  ngOnInit() {
    const currUser = this.authService.getCurrentUser();
    this.currentUserRole = currUser?.role || '';

    this.dataService.getAllUsers().subscribe(u => {
      if (this.currentUserRole === 'dispatcher') {
        this.users = u.filter(x => x.role === 'dispatcher');
      } else {
        this.users = u;
      }

      if (this.defaultUserId) {
        this.targetUserId = this.defaultUserId;
      } else if (this.existingShift?.userId) {
        this.targetUserId = this.existingShift.userId;
      } else if (this.users.length > 0) {
        this.targetUserId = this.users[0].id;
      }
    });

    if (this.existingShift) {
      this.mainType = this.existingShift.type;
      this.mainStart = this.existingShift.startTime;
      this.mainEnd = this.existingShift.endTime;
    } else {
      this.mainType = null;
    }

    if (this.existingOvertimes) {
      this.tempOvertimes = this.existingOvertimes.map(o => ({...o}));
    }
  }

  selectMainType(type: ShiftType) {
    if (this.mainType === type) {
      this.mainType = null;
      this.mainStart = '';
      this.mainEnd = '';
    } else {
      this.mainType = type;
      if (type === 'nappal') { this.mainStart = '08:00'; this.mainEnd = '16:00'; }
      else if (type === 'este') { this.mainStart = '16:00'; this.mainEnd = '00:00'; }
      else if (type === 'ejszaka') { this.mainStart = '00:00'; this.mainEnd = '08:00'; }
      else if (type === 'keszenlet') { this.mainStart = '00:00'; this.mainEnd = '00:00'; }
    }
  }

  addOvertime() {
    if (!this.newOtStart) {
      alert('Kezdési idő megadása kötelező!');
      return;
    }

    // Ticket esetén +20 perc automatikus
    if (this.newOtType === 'ticket' && !this.newOtEnd) {
      const [h, m] = this.newOtStart.split(':').map(Number);
      let endM = m + 20;
      let endH = h;
      if (endM >= 60) { endM -= 60; endH++; }
      if (endH >= 24) endH = 0;
      this.newOtEnd = `${String(endH).padStart(2,'0')}:${String(endM).padStart(2,'0')}`;
    }

    // Validáció: Kötelező mezők típus szerint
    if (this.newOtType === 'ticket' && !this.newOtDetails.trim()) {
      alert('Hibajegy esetén a ticketszám megadása kötelező!');
      return;
    }
    if (this.newOtType === 'other' && !this.newOtDetails.trim()) {
      alert('Egyéb túlóra esetén az indoklás megadása kötelező!');
      return;
    }

    const newEntry: OvertimeEntry = {
      id: Date.now().toString() + Math.random().toString(),
      userId: this.targetUserId,
      date: this.date,
      type: this.newOtType as OvertimeType,
      startTime: this.newOtStart,
      endTime: this.newOtEnd,
      comment: this.newOtDetails
    };

    this.tempOvertimes.push(newEntry);
    
    // Reset form
    this.newOtStart = '';
    this.newOtEnd = '';
    this.newOtDetails = '';
  }

  removeOvertime(index: number) {
    this.tempOvertimes.splice(index, 1);
  }

  onDeleteMain() {
    if (confirm('Biztosan törölni szeretnéd a beosztást erről a napról?')) {
      this.save.emit({
        main: null, 
        overtimes: this.tempOvertimes
      });
    }
  }

  onSave() {
    if (!this.targetUserId) {
      alert('Válassz dolgozót!');
      return;
    }

    let shiftPayload: ShiftEntry | null = null;

    if (this.mainType) {
      shiftPayload = {
        id: this.existingShift?.id || '',
        userId: this.targetUserId,
        date: this.date,
        type: this.mainType,
        startTime: this.mainStart,
        endTime: this.mainEnd
      };
    }

    this.tempOvertimes.forEach(ot => ot.userId = this.targetUserId);

    this.save.emit({
      main: shiftPayload,
      overtimes: this.tempOvertimes
    });
  }
}