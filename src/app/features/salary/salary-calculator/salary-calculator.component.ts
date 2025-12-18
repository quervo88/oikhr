import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SalaryService } from '../../../core/services/salary.service';
import { AuthService } from '../../../core/services/auth.service';
import { DataService } from '../../../core/services/data.service';
import { ShiftEntry, OvertimeEntry, User } from '../../../core/models/app.models';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-salary-calculator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './salary-calculator.component.html',
  styleUrls: ['./salary-calculator.component.scss']
})
export class SalaryCalculatorComponent implements OnInit, OnDestroy {
  private salaryService = inject(SalaryService);
  private authService = inject(AuthService);
  private dataService = inject(DataService);

  // Alapértékek
  baseSalary: number = 0;
  
  // Dátumok (string formátum az inputokhoz)
  standardStartStr: string = '';
  standardEndStr: string = '';
  otStartStr: string = '';
  otEndStr: string = '';

  // Eredmények
  stats: any = {
    shiftAllowanceMins: 0,
    standbyMins: 0,
    weekdayOtMins: 0,
    restDayOtMins: 0,
    nightStandbyWorkMins: 0,
    vacationDays: 0,
    sickDays: 0
  };

  financials: any = null;

  // Betöltött adatok
  shifts: ShiftEntry[] = [];
  overtimes: OvertimeEntry[] = [];

  private userSub?: Subscription;

  ngOnInit() {
    // 1. Dátumok beállítása (Jelenlegi hónap - Helyi idő szerint)
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // Előző hó 16 - Tárgyhó 15
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    
    this.standardStartStr = this.formatDateLocal(firstDay);
    this.standardEndStr = this.formatDateLocal(lastDay);
    
    this.otStartStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-16`;
    this.otEndStr = `${year}-${String(month + 1).padStart(2, '0')}-15`;

    // 2. Feliratkozás a felhasználó változására (Így azonnal frissül a bér, ha betöltődik)
    this.userSub = this.authService.currentUser$.subscribe(user => {
      if (user && user.baseSalary) {
        this.baseSalary = user.baseSalary;
        // Ha megjött a bér, és már vannak adatok, számoljunk újra!
        if (this.shifts.length > 0) {
          this.calculate();
        }
      }
    });

    // 3. Adatok lekérése és kezdeti számolás
    this.loadDataAndCalculate();
  }

  ngOnDestroy() {
    if (this.userSub) this.userSub.unsubscribe();
  }

  // Segéd: Helyi idő szerinti dátum string (YYYY-MM-DD)
  private formatDateLocal(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  loadDataAndCalculate() {
    // Párhuzamosan lekérjük a műszakokat és túlórákat
    this.dataService.getShifts().subscribe(shifts => {
      this.shifts = shifts;
      this.dataService.getOvertimes().subscribe(ots => {
        this.overtimes = ots;
        // Ha megérkeztek az adatok, számolunk (a baseSalary már be lehet állítva a userSub-ból)
        this.calculate();
      });
    });
  }

  calculate() {
    // Dátum objektumok készítése - 12:00-ra állítva a Timezone hibák ellen
    const stdStart = new Date(this.standardStartStr);
    stdStart.setHours(12, 0, 0, 0);

    const stdEnd = new Date(this.standardEndStr);
    stdEnd.setHours(12, 0, 0, 0);

    const otStart = new Date(this.otStartStr);
    otStart.setHours(12, 0, 0, 0);

    const otEnd = new Date(this.otEndStr);
    otEnd.setHours(12, 0, 0, 0);

    // Aktuális felhasználó ID
    const currentUser = this.authService.getCurrentUser();
    const userId = currentUser ? currentUser.id : '';

    const myShifts = this.shifts.filter(s => s.userId === userId);
    const myOvertimes = this.overtimes.filter(o => o.userId === userId);

    this.stats = this.salaryService.calculateStats(
      myShifts, 
      myOvertimes, 
      stdStart, 
      stdEnd, 
      otStart, 
      otEnd
    );

    // Csak akkor számolunk pénzt, ha van megadva bér
    if (this.baseSalary > 0) {
      this.calculateFinancials();
    } else {
      this.financials = null;
    }
  }

  calculateFinancials() {
    const hourlyRate = this.baseSalary / 174;

    const shiftAllowancePay = (this.stats.shiftAllowanceMins / 60) * hourlyRate * 0.30;
    const standbyPay = (this.stats.standbyMins / 60) * hourlyRate * 0.20;
    const weekdayOtPay = (this.stats.weekdayOtMins / 60) * hourlyRate * 1.5;
    const restDayOtPay = (this.stats.restDayOtMins / 60) * hourlyRate * 2.0;

    const grossTotal = this.baseSalary + shiftAllowancePay + standbyPay + weekdayOtPay + restDayOtPay;
    const netTotal = grossTotal * 0.665; // Kb 33.5% levonás

    this.financials = {
      hours: {
        shift: Math.round(this.stats.shiftAllowanceMins / 60),
        standby: Math.round(this.stats.standbyMins / 60),
        weekdayOt: Math.round(this.stats.weekdayOtMins / 60),
        restDayOt: Math.round(this.stats.restDayOtMins / 60)
      },
      basePay: this.baseSalary,
      shiftAllowancePay: shiftAllowancePay,
      standbyPay: standbyPay,
      weekdayOtPay: weekdayOtPay,
      restDayOtPay: restDayOtPay,
      totalGross: grossTotal,
      net: netTotal,
      deductions: grossTotal - netTotal
    };
  }

  toHours(mins: number): number {
    return Math.round(mins / 60);
  }
}