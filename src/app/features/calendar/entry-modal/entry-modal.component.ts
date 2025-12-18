import { Component, EventEmitter, Input, Output, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ShiftEntry, OvertimeEntry, ShiftType, OvertimeType, Role, User } from '../../../core/models/app.models';
import { AuthService } from '../../../core/services/auth.service';
import { MockDataService } from '../../../core/services/mock-data.service';

@Component({
  selector: 'app-entry-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  // JAVÍTÁS: Inline template használata, hogy a HTML hivatkozásokat is javítani tudjuk (details -> comment)
  template: `
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 fade-in" (click)="onBackdropClick($event)">
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        
        <div class="px-6 py-4 bg-slate-800 text-white flex justify-between items-center shrink-0">
            <div>
                <h3 class="text-xl font-bold">{{ date }}</h3>
                <p class="text-xs text-slate-300" *ngIf="isWeekendOrHoliday">Hétvége / Ünnepnap</p>
            </div>
            <button (click)="close.emit()" class="text-slate-400 hover:text-white transition-colors">
                <span class="material-symbols-outlined">close</span>
            </button>
        </div>

        <div class="p-6 overflow-y-auto custom-scrollbar">

            <div class="mb-6" *ngIf="availableUsers.length > 1">
                <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Dolgozó Kiválasztása</label>
                <select [(ngModel)]="targetUserId" class="w-full p-2 border border-slate-300 rounded font-bold">
                    <option *ngFor="let u of availableUsers" [value]="u.id">{{ u.name }}</option>
                </select>
            </div>

            <div class="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <label class="block text-xs font-bold text-slate-500 uppercase mb-3">Műszak</label>
                
                <div class="grid grid-cols-3 gap-2 mb-4">
                    <button *ngFor="let type of shiftTypes" 
                            (click)="setShiftType(type.value)"
                            class="py-2 px-1 rounded border text-xs font-bold uppercase"
                            [ngClass]="mainType === type.value ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'">
                        {{ type.label }}
                    </button>
                </div>

                <div class="grid grid-cols-2 gap-4" *ngIf="mainType && !['szabadsag','betegseg'].includes(mainType)">
                    <div>
                        <label class="text-[10px] font-bold text-slate-400 uppercase">Kezdés</label>
                        <input type="time" [(ngModel)]="mainStart" class="w-full p-2 border rounded font-bold">
                    </div>
                    <div>
                        <label class="text-[10px] font-bold text-slate-400 uppercase">Vége</label>
                        <input type="time" [(ngModel)]="mainEnd" class="w-full p-2 border rounded font-bold">
                    </div>
                </div>
            </div>

            <div class="mb-4">
                <label class="block text-xs font-bold text-slate-500 uppercase mb-2">Rögzített Túlórák</label>
                
                <div *ngIf="tempOvertimes.length === 0" class="text-sm text-slate-400 italic mb-2">Nincs rögzítve.</div>

                <div *ngFor="let ot of tempOvertimes; let i = index" class="flex items-center gap-2 p-2 bg-orange-50 border border-orange-100 rounded mb-2">
                    <div class="flex-1">
                        <div class="flex justify-between items-center">
                            <span class="font-bold text-orange-800 text-sm">
                                {{ ot.type === 'substitution' ? 'Helyettesítés' : (ot.type === 'ticket' ? 'Ticket' : 'Egyéb') }}
                            </span>
                            <span class="text-xs font-mono bg-white px-1 rounded border">{{ ot.startTime }} - {{ ot.endTime }}</span>
                        </div>
                        <div class="text-xs text-slate-500 mt-1" *ngIf="ot.comment">
                            {{ ot.type === 'ticket' ? 'ID: ' : 'Indok: ' }} {{ ot.comment }}
                        </div>
                    </div>
                    <button (click)="removeOvertime(i)" class="text-red-400 hover:text-red-600">
                        <span class="material-symbols-outlined text-sm">close</span>
                    </button>
                </div>
            </div>

            <div class="p-3 border-t border-slate-100 pt-4">
                <label class="block text-xs font-bold text-blue-600 uppercase mb-2">+ Új Túlóra Hozzáadása</label>
                
                <div class="grid grid-cols-2 gap-2 mb-2">
                    <select [(ngModel)]="newOtType" class="p-2 border rounded text-sm font-bold">
                        <option value="substitution">Helyettesítés</option>
                        <option value="ticket">Ticket</option>
                        <option value="other">Egyéb</option>
                    </select>
                    <input type="text" [(ngModel)]="newOtComment" 
                           [placeholder]="newOtType === 'ticket' ? 'Ticket ID' : 'Indoklás'"
                           class="p-2 border rounded text-sm">
                </div>
                
                <div class="flex gap-2">
                    <input type="time" [(ngModel)]="newOtStart" class="w-1/3 p-2 border rounded text-sm">
                    <input type="time" [(ngModel)]="newOtEnd" [disabled]="newOtType === 'ticket'" class="w-1/3 p-2 border rounded text-sm">
                    <button (click)="addTempOvertime()" class="flex-1 bg-blue-100 text-blue-700 font-bold rounded hover:bg-blue-200 text-sm">
                        Hozzáad
                    </button>
                </div>
            </div>

        </div>

        <div class="p-4 border-t bg-slate-50 flex justify-between shrink-0">
            <button *ngIf="existingShift || existingOvertimes.length > 0" (click)="onDelete()" class="text-red-600 font-bold text-sm">Bejegyzés Törlése</button>
            <div *ngIf="!existingShift && existingOvertimes.length === 0"></div>
            <button (click)="onSave()" class="bg-blue-600 text-white px-6 py-2 rounded font-bold shadow hover:bg-blue-700">Mentés</button>
        </div>

      </div>
    </div>
  `
})
export class EntryModalComponent implements OnInit {
  // Bemenő adatok a Naptárból
  @Input() date!: string;
  @Input() existingShift?: ShiftEntry;
  @Input() existingOvertimes: OvertimeEntry[] = [];
  @Input() isWeekendOrHoliday: boolean = false;
  @Input() defaultUserId: string = '';

  // Kimenő események
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<{main: ShiftEntry | null, overtimes: OvertimeEntry[]}>();
  // JAVÍTVA: deleteEvent hozzáadva, ha a naptár ezt várja a törléshez
  @Output() deleteEvent = new EventEmitter<void>();

  // Service-ek
  authService = inject(AuthService);
  dataService = inject(MockDataService);

  // Állapotváltozók
  availableUsers: User[] = [];
  targetUserId: string = '';
  currentUserRole: string = '';

  // Űrlap adatok - Műszak
  mainType: ShiftType | null = null;
  mainStart: string = '';
  mainEnd: string = '';

  // Űrlap adatok - Túlóra (Ideiglenes lista)
  tempOvertimes: OvertimeEntry[] = [];

  // Új túlóra inputok
  newOtType: OvertimeType = 'substitution';
  newOtStart: string = '16:00';
  newOtEnd: string = '20:00';
  // JAVÍTVA: newOtDetails átnevezve newOtComment-re
  newOtComment: string = '';

  shiftTypes: {value: ShiftType, label: string}[] = [
    { value: 'nappal', label: 'Nappal' },
    { value: 'este', label: 'Este' },
    { value: 'ejszaka', label: 'Éjszaka' },
    { value: 'keszenlet', label: 'Készenlét' },
    { value: 'szabadsag', label: 'Szabadság' },
    { value: 'betegseg', label: 'Betegség' }
  ];

  ngOnInit() {
    // 1. Jogosultság és userek betöltése
    const currUser = this.authService.getCurrentUser();
    this.currentUserRole = currUser?.role || '';
    
    this.dataService.getAllUsers().subscribe(users => {
        if (this.currentUserRole === 'dispatcher') {
            this.availableUsers = users.filter(u => u.role === 'dispatcher');
        } else {
            this.availableUsers = users; // Admin/HR mindenkit lát
        }

        // Target user beállítása
        if (this.defaultUserId) {
            this.targetUserId = this.defaultUserId;
        } else if (this.availableUsers.length > 0) {
            this.targetUserId = this.availableUsers[0].id;
        }
    });

    // 2. Meglévő adatok betöltése formba
    if (this.existingShift) {
        this.mainType = this.existingShift.type;
        this.mainStart = this.existingShift.startTime;
        this.mainEnd = this.existingShift.endTime;
        if (this.existingShift.userId) this.targetUserId = this.existingShift.userId;
    }

    if (this.existingOvertimes) {
        // Deep copy
        this.tempOvertimes = this.existingOvertimes.map(o => ({...o}));
    }
  }

  onBackdropClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('fixed')) {
      this.close.emit();
    }
  }

  // --- MŰSZAK KEZELÉS ---

  setShiftType(type: ShiftType) {
    if (this.mainType === type) {
        this.mainType = null; // Kikapcsolás
        this.mainStart = '';
        this.mainEnd = '';
    } else {
        this.mainType = type;
        // Auto-fill
        if (type === 'nappal') { this.mainStart = '08:00'; this.mainEnd = '16:00'; }
        else if (type === 'este') { this.mainStart = '16:00'; this.mainEnd = '00:00'; }
        else if (type === 'ejszaka') { this.mainStart = '00:00'; this.mainEnd = '08:00'; }
        else if (type === 'keszenlet') { this.mainStart = '00:00'; this.mainEnd = '00:00'; }
    }
  }

  // --- TÚLÓRA KEZELÉS ---

  addTempOvertime() {
    if (!this.newOtStart) return;

    // Ticket esetén auto 20 perc számolás
    if (this.newOtType === 'ticket') {
        const [h, m] = this.newOtStart.split(':').map(Number);
        let endM = m + 20;
        let endH = h;
        if (endM >= 60) { endM -= 60; endH++; }
        if (endH >= 24) endH = 0;
        this.newOtEnd = `${String(endH).padStart(2,'0')}:${String(endM).padStart(2,'0')}`;
    }

    const newEntry: OvertimeEntry = {
      id: Date.now().toString() + Math.random().toString(),
      userId: this.targetUserId,
      date: this.date,
      type: this.newOtType,
      startTime: this.newOtStart,
      endTime: this.newOtEnd,
      // JAVÍTVA: newOtComment használata
      comment: this.newOtComment
    };

    this.tempOvertimes.push(newEntry);

    // Reset form
    this.newOtStart = '';
    this.newOtEnd = '';
    this.newOtComment = ''; // Reset
  }

  removeOvertime(index: number) {
    this.tempOvertimes.splice(index, 1);
  }

  // --- MENTÉS és TÖRLÉS ---

  onDelete() {
      // JAVÍTÁS: A deleteEvent kibocsátása, ha a szülő komponens erre hallgat
      if(confirm('Biztosan törlöd ezt a napot?')) {
          this.deleteEvent.emit();
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
            id: this.existingShift?.id || Date.now().toString(),
            userId: this.targetUserId,
            date: this.date,
            type: this.mainType,
            startTime: this.mainStart,
            endTime: this.mainEnd
        };
    }

    // Túlórák ID-jának frissítése is (ha esetleg váltottunk usert közben)
    this.tempOvertimes.forEach(ot => ot.userId = this.targetUserId);

    this.save.emit({
        main: shiftPayload,
        overtimes: this.tempOvertimes
    });
  }
}