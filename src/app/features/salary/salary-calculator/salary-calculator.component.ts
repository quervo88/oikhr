import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SalaryService } from '../../../core/services/salary.service'; // Ellenőrizd az útvonalat
import { AuthService } from '../../../core/services/auth.service';
import { DataService } from '../../../core/services/data.service';
import { ShiftEntry, OvertimeEntry } from '../../../core/models/app.models';

@Component({
  selector: 'app-salary-calculator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './salary-calculator.component.html',
  styleUrls: ['./salary-calculator.component.scss']
})
export class SalaryCalculatorComponent implements OnInit {
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

  ngOnInit() {
    // 1. Jelenlegi felhasználó bérének betöltése
    const user = this.authService.getCurrentUser();
    if (user && user.baseSalary) {
      this.baseSalary = user.baseSalary;
    } else {
      this.baseSalary = 0; 
    }

    // 2. Dátumok beállítása (Jelenlegi hónap)
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    // Naptári hónap (pl. 01-31)
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // Túlóra időszak (előző hó 16 - tárgyhó 15)
    // Megjegyzés: Ez csak alapértelmezés, a felületen átírható
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    
    this.standardStartStr = firstDay.toISOString().split('T')[0];
    this.standardEndStr = lastDay.toISOString().split('T')[0];
    
    this.otStartStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-16`;
    this.otEndStr = `${year}-${String(month + 1).padStart(2, '0')}-15`;

    // 3. Adatok lekérése és számolás
    this.loadDataAndCalculate();
  }

  loadDataAndCalculate() {
    // Párhuzamosan lekérjük a műszakokat és túlórákat
    // (A valóságban itt szűrni kéne dátumra vagy ID-re, de a MockDataService memóriából dolgozik)
    this.dataService.getShifts().subscribe(shifts => {
      this.shifts = shifts;
      this.dataService.getOvertimes().subscribe(ots => {
        this.overtimes = ots;
        this.calculate();
      });
    });
  }

  calculate() {
    if (!this.baseSalary) return;

    // Dátum objektumok készítése a stringekből
    const stdStart = new Date(this.standardStartStr);
    const stdEnd = new Date(this.standardEndStr);
    const otStart = new Date(this.otStartStr);
    const otEnd = new Date(this.otEndStr);

    // Kiszámoltatjuk a statisztikát a Service-szel
    // Itt feltételezzük, hogy a felhasználó saját adatait nézi, vagy szűrni kell
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

    // Pénzügyi számítások (Financials)
    this.calculateFinancials();
  }

  calculateFinancials() {
    const hourlyRate = this.baseSalary / 174; // Általános osztószám (vagy 160)

    // Kerekített órák a megjelenítéshez
    const hours = {
      shiftAllowance: Math.round(this.stats.shiftAllowanceMins / 60),
      standby: Math.round(this.stats.standbyMins / 60),
      weekdayOt: Math.round(this.stats.weekdayOtMins / 60),
      restDayOt: Math.round(this.stats.restDayOtMins / 60)
    };

    // Fizetések számolása (Percre pontosan számolunk a háttérben)
    // 30% műszakpótlék
    const shiftAllowancePay = (this.stats.shiftAllowanceMins / 60) * hourlyRate * 0.30;
    
    // 20% készenlét
    const standbyPay = (this.stats.standbyMins / 60) * hourlyRate * 0.20;
    
    // 150% hétköznapi túlóra (Alapbér + 50% pótlék, vagy csak a pótlék? Itt most a teljes kifizetést veszem)
    // Általában túlóra = (Órabér * 1.5)
    const weekdayOtPay = (this.stats.weekdayOtMins / 60) * hourlyRate * 1.5;

    // 200% pihenőnapi túlóra
    const restDayOtPay = (this.stats.restDayOtMins / 60) * hourlyRate * 2.0;

    const grossTotal = this.baseSalary + shiftAllowancePay + standbyPay + weekdayOtPay + restDayOtPay;
    const netTotal = grossTotal * 0.665; // Kb 33.5% levonás (szja, tb)

    this.financials = {
      hours: hours,
      basePay: this.baseSalary,
      shiftAllowancePay: shiftAllowancePay,
      standbyPay: standbyPay,
      weekdayOtPay: weekdayOtPay,
      restDayOtPay: restDayOtPay,
      grossTotal: grossTotal,
      netTotal: netTotal
    };
  }

  // Segédfüggvény a HTML-nek
  toHours(mins: number): number {
    return Math.round(mins / 60);
  }
}