import { Injectable } from '@angular/core';
import { ShiftEntry, OvertimeEntry, SalaryStats } from '../models/app.models';
import { HolidayService } from './holiday.service';

@Injectable({
  providedIn: 'root'
})
export class SalaryService {

  constructor(private holidayService: HolidayService) { }

  /**
   * Fő statisztika kalkulátor (Elszámolás / Tervezés nézethez)
   * Most már a SalaryStats interface-t adja vissza
   */
  calculateStats(
    shifts: ShiftEntry[], 
    overtimes: OvertimeEntry[], 
    stdStart: Date, 
    stdEnd: Date, 
    otStart: Date, 
    otEnd: Date
  ): SalaryStats {
    
    let stats: SalaryStats = {
      shiftAllowanceMins: 0,
      standbyMins: 0,
      weekdayOtMins: 0,
      restDayOtMins: 0,
      nightStandbyWorkMins: 0,
      vacationDays: 0,
      sickDays: 0
    };

    // 1. Műszakok feldolgozása (Naptári hónap: stdStart -> stdEnd)
    shifts.forEach(shift => {
      const d = new Date(shift.date);
      // Csak ami a naptári hónapba esik
      if (d >= stdStart && d <= stdEnd) {
        if (shift.type === 'szabadsag') {
          stats.vacationDays++;
        } else if (shift.type === 'betegseg') {
          stats.sickDays++;
        } else if (shift.type === 'keszenlet') {
          stats.standbyMins += this.calculateDurationMins(shift.startTime, shift.endTime);
        } else if (['nappal', 'este', 'ejszaka'].includes(shift.type)) {
          // Műszakpótlék számítása
          stats.shiftAllowanceMins += this.calculateShiftAllowance(shift);
        }
      }
    });

    // 2. Túlórák feldolgozása (Kettős időszak logika)
    overtimes.forEach(ot => {
      const d = new Date(ot.date);
      let include = false;

      // Helyettesítés: Naptári hónap (stdStart -> stdEnd)
      if (ot.type === 'substitution') {
        if (d >= stdStart && d <= stdEnd) {
          include = true;
        }
      } 
      // Ticket / Egyéb: Elszámolási időszak (otStart -> otEnd)
      else {
        if (d >= otStart && d <= otEnd) {
          include = true;
        }
      }

      if (include) {
        // Túlóra típusának eldöntése (150% vagy 200%)
        // A calculateOvertime függvényed ezt szépen kezeli
        const otResult = this.calculateOvertime(ot);
        stats.weekdayOtMins += otResult.weekdayMins;
        stats.restDayOtMins += otResult.restDayMins;
        
        // Ha lenne éjszakai munkavégzés készenlét alatt, azt itt lehetne kezelni,
        // de a te logikádban ez külön van, vagy a calculateOvertime kezeli?
        // Egyelőre hagyjuk a te logikádat.
      }
    });

    return stats;
  }

  // --- BELSŐ KALKULÁCIÓK (Megtartva az eredeti logikádat) ---

  private calculateShiftAllowance(shift: ShiftEntry): number {
    // 18:00 - 06:00 közötti időszak
    // Ez a te eredeti logikád, nem nyúlok hozzá
    const shiftStart = this.timeToMins(shift.startTime);
    let shiftEnd = this.timeToMins(shift.endTime);
    if (shiftEnd < shiftStart) shiftEnd += 1440;

    // Két sáv: 18:00-24:00 (1080-1440) és 00:00-06:00 (0-360)
    // De mivel a shiftEnd > 1440 lehet, egyszerűbb abszolút percekkel számolni
    
    // Sáv 1: Ma este 18:00 - Ma éjfél
    const p1 = this.getOverlap(shiftStart, shiftEnd, 1080, 1440);
    
    // Sáv 2: Holnap reggel 00:00 - 06:00 (ami a shiftben 1440-1800)
    // VAGY Ma reggel 00:00 - 06:00 (ha a műszak éjfél után indult)
    
    // A te egyszerűsített logikádhoz igazodva, vagy a standard módszer:
    // Nézzük meg, mennyi esik 18:00 és 06:00 közé.
    
    let allowance = 0;
    
    // Vizsgáljuk a percről percre
    // Ez nem a leghatékonyabb, de pontos. Vagy használjuk a getOverlap-ot okosan.
    
    // Egyszerűsítve: 
    // Este sáv: 18:00 -> 24:00
    allowance += this.getOverlap(shiftStart, shiftEnd, 1080, 1440);
    
    // Reggel sáv (ha átnyúlik másnapra): 24:00 -> 30:00 (06:00)
    allowance += this.getOverlap(shiftStart, shiftEnd, 1440, 1800);
    
    // Reggel sáv (ha aznap kezdődött éjfél után): 00:00 -> 06:00
    if (shiftStart < 360) {
        allowance += this.getOverlap(shiftStart, shiftEnd, 0, 360);
    }

    return allowance;
  }

  private calculateOvertime(ot: OvertimeEntry): { weekdayMins: number, restDayMins: number } {
    const duration = this.calculateDurationMins(ot.startTime, ot.endTime);
    const isWeekend = this.holidayService.isWeekendOrHoliday(ot.date);
    
    // Eredeti logikád:
    if (isWeekend) {
      return { weekdayMins: 0, restDayMins: duration };
    } else {
      return { weekdayMins: duration, restDayMins: 0 };
    }
  }

  private getOverlap(start1: number, end1: number, start2: number, end2: number): number {
    const maxStart = Math.max(start1, start2);
    const minEnd = Math.min(end1, end2);
    return Math.max(0, minEnd - maxStart);
  }

  // Pénzügyi számító (ha használod valahol)
  public calculateFinancials(baseSalary: number, stats: SalaryStats) {
      const hourlyRate = this.calculateHourlyRate(baseSalary);
      
      return {
          shiftAllowancePay: (stats.shiftAllowanceMins / 60) * hourlyRate * 0.30,
          standbyPay: (stats.standbyMins / 60) * hourlyRate * 0.20,
          weekdayOtPay: (stats.weekdayOtMins / 60) * hourlyRate * 1.50, // 150%
          restDayOtPay: (stats.restDayOtMins / 60) * hourlyRate * 2.00  // 200%
      };
  }

  public calculateHourlyRate(baseSalary: number): number {
      // A te fix osztószámod
      return baseSalary / 174;
  }


  // --- SEGÉDFÜGGVÉNYEK (ÁTÁLLÍTVA PUBLIC-RA AZ EXCEL/PDF MIATT) ---

  // Eredetileg private volt, most public
  public timeToMins(time: string): number {
    if (!time) return 0;
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  // Eredetileg private volt, most public
  public minsToHm(totalMins: number): string {
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return `${h}:${String(m).padStart(2, '0')}`;
  }

  // Eredetileg private volt, most public
  public calculateDurationMins(start: string, end: string): number {
    if (!start || !end) return 0;
    const s = this.timeToMins(start);
    let e = this.timeToMins(end);
    
    // Speciális eset: 00:00 - 00:00 (Készenlét 24 óra)
    if (start === '00:00' && end === '00:00') return 24 * 60;

    if (e < s) e += 1440; // Átnyúlik éjfélen
    return e - s;
  }

  // --- ÚJ FÜGGVÉNY (Ezt hiányolta az Excel Service) ---
  public getRoundedHoursForPayroll(mins: number): number {
      return Math.round(mins / 60);
  }
  
}