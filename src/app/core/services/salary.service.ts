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
      // Dátum normalizálás (délre állítjuk, hogy elkerüljük a timezone csúszást)
      const d = new Date(shift.date);
      d.setHours(12, 0, 0, 0);

      // Csak ami a naptári hónapba esik
      if (d >= stdStart && d <= stdEnd) {
        if (shift.type === 'szabadsag') {
          stats.vacationDays++;
        } else if (shift.type === 'betegseg') {
          stats.sickDays++;
        } else if (shift.type === 'keszenlet') {
          // Készenlét számítása Ticket levonással
          let duration = this.calculateDurationMins(shift.startTime, shift.endTime);
          
          // Megnézzük, volt-e Ticket ebben az időben, és levonjuk a TELJES hosszát
          const ticketMins = this.calculateTicketDeduction(shift, overtimes);
          duration = Math.max(0, duration - ticketMins);

          stats.standbyMins += duration;

        } else if (['nappal', 'este', 'ejszaka'].includes(shift.type)) {
          // Műszakpótlék számítása
          stats.shiftAllowanceMins += this.calculateShiftAllowance(shift);
        }
      }
    });

    // 2. Túlórák feldolgozása (Kettős időszak logika)
    overtimes.forEach(ot => {
      const d = new Date(ot.date);
      d.setHours(12, 0, 0, 0);
      
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
        const otResult = this.calculateOvertime(ot);
        stats.weekdayOtMins += otResult.weekdayMins;
        stats.restDayOtMins += otResult.restDayMins;
      }
    });

    return stats;
  }

  // --- BELSŐ KALKULÁCIÓK ---

  // MÓDOSÍTVA: Nem csak a metszetet nézi, hanem ha a ticket a készenlét alatt KEZDŐDIK,
  // akkor a teljes hosszát levonja (akár éjfélen túl is).
  private calculateTicketDeduction(shift: ShiftEntry, allOvertimes: OvertimeEntry[]): number {
    // Csak az aznapi ticketeket nézzük
    const tickets = allOvertimes.filter(ot => ot.date === shift.date && ot.type === 'ticket');
    if (tickets.length === 0) return 0;

    let totalDeductionMins = 0;

    const shiftStart = this.timeToMins(shift.startTime);
    let shiftEnd = this.timeToMins(shift.endTime);
    // Készenlét: 00:00 - 00:00 -> 0 - 1440
    if (shiftStart === 0 && shiftEnd === 0) shiftEnd = 1440; 
    else if (shiftEnd < shiftStart) shiftEnd += 1440; // Átnyúlik éjfélen (pl 16:00 - 08:00)

    tickets.forEach(ticket => {
      const ticketStart = this.timeToMins(ticket.startTime);
      
      // Ellenőrizzük, hogy a Ticket kezdete beleesik-e a Készenlét sávjába
      let startsInShift = false;

      // Ha a shift átnyúlik éjfélen (pl. 960 -> 1920)
      if (shiftEnd > 1440) {
         // A ticket kezdhet 960..1440 között VAGY 0..(shiftEnd-1440) között
         if (ticketStart >= shiftStart) startsInShift = true;
         if (ticketStart < (shiftEnd - 1440)) startsInShift = true;
      } else {
         // Normál napon belüli shift
         if (ticketStart >= shiftStart && ticketStart < shiftEnd) startsInShift = true;
      }

      if (startsInShift) {
        // Ha a ticket a készenlét alatt indult, a TELJES időtartamát levonjuk,
        // függetlenül attól, hogy átlóg-e másnapra.
        totalDeductionMins += this.calculateDurationMins(ticket.startTime, ticket.endTime);
      }
    });

    return totalDeductionMins;
  }

  private calculateShiftAllowance(shift: ShiftEntry): number {
    // 18:00 - 06:00 közötti időszak
    const shiftStart = this.timeToMins(shift.startTime);
    let shiftEnd = this.timeToMins(shift.endTime);
    if (shiftEnd < shiftStart) shiftEnd += 1440;

    let allowance = 0;
    
    // Este sáv: 18:00 -> 24:00 (1080 - 1440)
    allowance += this.getOverlap(shiftStart, shiftEnd, 1080, 1440);
    
    // Reggel sáv (ha átnyúlik másnapra): 24:00 -> 30:00 (1440 - 1800)
    allowance += this.getOverlap(shiftStart, shiftEnd, 1440, 1800);
    
    // Reggel sáv (ha aznap kezdődött éjfél után): 00:00 -> 06:00 (0 - 360)
    if (shiftStart < 360) {
        allowance += this.getOverlap(shiftStart, shiftEnd, 0, 360);
    }

    return allowance;
  }

  private calculateOvertime(ot: OvertimeEntry): { weekdayMins: number, restDayMins: number } {
    const duration = this.calculateDurationMins(ot.startTime, ot.endTime);
    const isWeekend = this.holidayService.isWeekendOrHoliday(ot.date);
    
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

  // Pénzügyi számító
  public calculateFinancials(baseSalary: number, stats: SalaryStats) {
      const hourlyRate = this.calculateHourlyRate(baseSalary);
      
      return {
          shiftAllowancePay: (stats.shiftAllowanceMins / 60) * hourlyRate * 0.30,
          standbyPay: (stats.standbyMins / 60) * hourlyRate * 0.20,
          weekdayOtPay: (stats.weekdayOtMins / 60) * hourlyRate * 1.50,
          restDayOtPay: (stats.restDayOtMins / 60) * hourlyRate * 2.00
      };
  }

  public calculateHourlyRate(baseSalary: number): number {
      return baseSalary / 174;
  }

  // --- SEGÉDFÜGGVÉNYEK ---

  public timeToMins(time: string): number {
    if (!time) return 0;
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  public minsToHm(totalMins: number): string {
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return `${h}:${String(m).padStart(2, '0')}`;
  }

  public calculateDurationMins(start: string, end: string): number {
    if (!start || !end) return 0;
    const s = this.timeToMins(start);
    let e = this.timeToMins(end);
    
    // Speciális eset: 00:00 - 00:00 (Készenlét 24 óra)
    if (start === '00:00' && end === '00:00') return 24 * 60;

    if (e < s) e += 1440; // Átnyúlik éjfélen
    return e - s;
  }

  public getRoundedHoursForPayroll(mins: number): number {
      return Math.round(mins / 60);
  }
}