import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; 
import { DataService } from '../../../core/services/data.service';
import { ShiftEntry, OvertimeEntry, CalendarDayOverride, User, SalaryStats } from '../../../core/models/app.models';
import { AuthService } from '../../../core/services/auth.service';
import { EntryModalComponent } from '../entry-modal/entry-modal.component';
import { SalaryService } from '../../../core/services/salary.service';
import { ExportModalComponent } from '../export-modal/export-modal.component';

@Component({
  selector: 'app-calendar-view',
  standalone: true,
  imports: [CommonModule, FormsModule, EntryModalComponent, ExportModalComponent],
  templateUrl: './calendar-view.component.html',
  styleUrl: './calendar-view.component.scss'
})
export class CalendarViewComponent implements OnInit {
  private dataService = inject(DataService);
  public authService = inject(AuthService);
  private salaryService = inject(SalaryService);

  isExportModalOpen = false;
  currentDate = new Date();
  daysInMonth: any[] = [];
  monthNames = ['Január','Február','Március','Április','Május','Június','Július','Augusztus','Szeptember','Október','November','December'];
  
  shifts: ShiftEntry[] = [];
  overtimes: OvertimeEntry[] = [];
  overrides: CalendarDayOverride[] = [];

  isModalOpen = false;
  selectedDate: string = '';
  selectedShift: ShiftEntry | undefined;
  selectedOvertimes: OvertimeEntry[] = [];
  selectedIsWeekend = false;
  currentStats: SalaryStats | null = null;
  viewMode: 'planning' | 'accounting' = 'planning'; 
  currentUserRole: string = '';
  users: User[] = [];             
  selectedUserIds: string[] = []; 
  accountingUserId: string = '';  

  ngOnInit() {
    const user = this.authService.getCurrentUser();
    this.currentUserRole = user?.role || '';
    
    this.authService.currentUser$.subscribe(u => {
        if(u) {
            this.currentUserRole = u.role;
            this.initData(u);
        }
    });
  }

  initData(currentUser: User) {
    this.dataService.getAllUsers().subscribe(u => {
        this.users = u.filter(x => x.role === 'dispatcher');
        
        if (this.selectedUserIds.length === 0) {
             if (this.currentUserRole === 'dispatcher') {
                this.selectedUserIds = this.users.map(x => x.id);
                this.accountingUserId = currentUser.id; 
            } else {
                this.selectedUserIds = this.users.map(x => x.id);
                this.accountingUserId = this.users[0]?.id || ''; 
            }
        }
        
        this.loadData();
    });
  }

  loadData() {
    this.dataService.getShifts().subscribe(res => {
        this.shifts = res;
        this.generateCalendar();
    });
    this.dataService.getOvertimes().subscribe(res => {
        this.overtimes = res;
        this.generateCalendar();
    });
    this.dataService.getCalendarOverrides().subscribe(res => {
        this.overrides = res;
        this.generateCalendar();
    });
  }

  // --- TEMPLATE METÓDUSOK ---
  
  setViewMode(mode: 'planning' | 'accounting') {
    this.viewMode = mode;
    this.generateCalendar();
  }

  toggleUserSelection(userId: string) {
    if (this.selectedUserIds.includes(userId)) {
        this.selectedUserIds = this.selectedUserIds.filter(id => id !== userId);
    } else {
        this.selectedUserIds.push(userId);
    }
    this.generateCalendar();
  }

  setAccountingUser(userId: string) {
    this.accountingUserId = userId;
    this.generateCalendar();
  }
  
  generateCalendar() {
      const year = this.currentDate.getFullYear();
      const month = this.currentDate.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      let firstDayIndex = new Date(year, month, 1).getDay() - 1;
      if (firstDayIndex === -1) firstDayIndex = 6;
      this.daysInMonth = [];
      for (let i = 0; i < firstDayIndex; i++) this.daysInMonth.push({ type: 'empty' });

      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const override = this.overrides.find(o => o.date === dateStr);
        const dayOfWeek = new Date(dateStr).getDay();
        let isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
        if (override) isWeekend = (override.type !== 'workday');
        const holidayName = override ? override.comment : ''; 

        let dayObj: any = { type: 'day', dateStr: dateStr, dayNum: day, isWeekend: isWeekend, holidayName: holidayName, viewMode: this.viewMode };

        if (this.viewMode === 'accounting') {
            const targetId = this.accountingUserId;
            dayObj.shift = this.shifts.find(s => s.date === dateStr && s.userId === targetId);
            dayObj.overtimes = this.overtimes.filter(o => o.date === dateStr && o.userId === targetId);
        } else {
            const planningItems: any[] = [];
            this.selectedUserIds.forEach(uid => {
                const userObj = this.users.find(u => u.id === uid);
                const userName = userObj ? userObj.name.split(' ')[0] : '???'; 
                const shift = this.shifts.find(s => s.date === dateStr && s.userId === uid);
                
                if (shift) {
                   if (shift.type === 'nappal') planningItems.push({ text: `08:00-16:00 ${userName}`, color: 'bg-amber-100 text-amber-800', sort: '08:00' });
                   else if (shift.type === 'este') planningItems.push({ text: `16:00-00:00 ${userName}`, color: 'bg-indigo-100 text-indigo-800', sort: '16:00' });
                   else if (shift.type === 'ejszaka') planningItems.push({ text: `00:00-08:00 ${userName}`, color: 'bg-slate-700 text-slate-100', sort: '00:00' });
                   else if (shift.type === 'keszenlet') {
                       const timeStr = (shift.startTime === '00:00' && shift.endTime === '00:00') ? '0-24' : `${shift.startTime}-${shift.endTime}`;
                       planningItems.push({ text: `${timeStr} ${userName} (K)`, color: 'bg-purple-100 text-purple-800', sort: '99:99' }); 
                   } else if (shift.type === 'szabadsag') planningItems.push({ text: `SZABI ${userName}`, color: 'bg-green-100 text-green-800', sort: '00:00' });
                   else if (shift.type === 'betegseg') planningItems.push({ text: `BETEG ${userName}`, color: 'bg-red-100 text-red-800', sort: '00:00' });
                }
                const subs = this.overtimes.filter(o => o.date === dateStr && o.userId === uid && o.type === 'substitution');
                subs.forEach(sub => planningItems.push({ text: `${sub.startTime}-${sub.endTime} ${userName} (H)`, color: 'bg-rose-100 text-rose-800 font-bold border border-rose-300', sort: sub.startTime }));
            });
            planningItems.sort((a, b) => a.sort.localeCompare(b.sort));
            dayObj.planningItems = planningItems;
        }
        this.daysInMonth.push(dayObj);
      }
      
      if (this.viewMode === 'accounting' && this.accountingUserId) {
         this.calculateStatsForUser(this.accountingUserId);
      } else {
         this.currentStats = null;
      }
  }

  calculateStatsForUser(userId: string) {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();

    const stdStart = new Date(year, month, 1, 12, 0, 0);
    const stdEnd = new Date(year, month + 1, 0, 12, 0, 0);

    const otStart = new Date(year, month - 1, 16, 12, 0, 0);
    const otEnd = new Date(year, month, 15, 12, 0, 0);

    const targetShifts = this.shifts.filter(s => s.userId === userId);
    const targetOvertimes = this.overtimes.filter(o => o.userId === userId);

    this.currentStats = this.salaryService.calculateStats(targetShifts, targetOvertimes, stdStart, stdEnd, otStart, otEnd);
  }

  onDayClick(day: any) {
    if (day.type === 'empty') return;
    this.selectedDate = day.dateStr;
    this.selectedIsWeekend = day.isWeekend;
    
    // Alaphelyzetbe állítás
    this.selectedShift = undefined;
    this.selectedOvertimes = [];

    if (this.viewMode === 'accounting') {
        const userId = this.accountingUserId;
        this.selectedShift = this.shifts.find(s => s.date === day.dateStr && s.userId === userId);
        this.selectedOvertimes = this.overtimes.filter(o => o.date === day.dateStr && o.userId === userId);
    } else {
        // Tervező módban csak akkor töltjük be szerkesztésre, ha EGY emberre szűrtünk
        if (this.selectedUserIds.length === 1) {
             const uid = this.selectedUserIds[0];
             this.selectedShift = this.shifts.find(s => s.date === day.dateStr && s.userId === uid);
             this.selectedOvertimes = this.overtimes.filter(o => o.date === day.dateStr && o.userId === uid);
        }
    }
    this.isModalOpen = true;
  }

  async onModalSave(event: {main: ShiftEntry | null, overtimes: OvertimeEntry[]}) {
    // 1. TÖRLÉS ESETE
    if (event.main === null) {
        // Ha van kiválasztott shiftünk, tudjuk kitől kell törölni
        if (this.selectedShift) {
             await this.dataService.deleteShift(this.selectedDate, this.selectedShift.userId);
        } else if (this.accountingUserId) {
             // Biztonsági tartalék: ha accounting módban vagyunk, a kiválasztott user a célpont
             await this.dataService.deleteShift(this.selectedDate, this.accountingUserId);
        } else if (this.selectedUserIds.length === 1) {
             // Tervező módban, ha egy user van
             await this.dataService.deleteShift(this.selectedDate, this.selectedUserIds[0]);
        }
    } 
    // 2. MENTÉS ESETE
    else {
        await this.dataService.saveShift(event.main);
    }

    // 3. TÚLÓRÁK KEZELÉSE
    // Ha törlés volt, akkor a túlórát is törölni kell (üres lista mentése), vagy ha mentés volt, akkor frissíteni.
    let targetUserIdForOt = '';
    
    if (event.main) {
        targetUserIdForOt = event.main.userId;
    } else if (this.selectedShift) {
        targetUserIdForOt = this.selectedShift.userId;
    } else if (this.accountingUserId) {
        targetUserIdForOt = this.accountingUserId;
    } else if (this.selectedUserIds.length === 1) {
        targetUserIdForOt = this.selectedUserIds[0];
    }

    if (targetUserIdForOt) {
         // Ha törlés (event.main === null), akkor is lefuthat a updateOvertimes, 
         // de ilyenkor az event.overtimes valószínűleg üres, vagy amit a modal visszaküldött.
         // Ha a modal törléskor visszaküldi a túlórákat, azokat megtartjuk? 
         // Általában ha a napot töröljük, mindent törlünk. 
         // A kódodban a modal visszaküldi a túlórákat törléskor is. 
         // Ha azt szeretnéd, hogy a törlés mindent vigyen, akkor itt []-t kellene menteni.
         // Jelenlegi logika: Megtartja a túlórákat, ha a modal visszaküldi őket, csak a fő műszakot törli.
         await this.dataService.updateOvertimesForDay(this.selectedDate, targetUserIdForOt, event.overtimes);
    }

    this.isModalOpen = false;
  }
  
  openQuickFill() { /* ... */ }
  applyTemplate(userId: string, type: string, mondayDate: Date) { /* ... */ }
  prevMonth() { this.currentDate.setMonth(this.currentDate.getMonth() - 1); this.generateCalendar(); }
  nextMonth() { this.currentDate.setMonth(this.currentDate.getMonth() + 1); this.generateCalendar(); }
  formatTime(mins: number) { return this.salaryService.minsToHm(mins); }
  getShiftColor(type: string) { return ''; } 
  getShiftLabel(type: string) { return type; } 
}