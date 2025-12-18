import { Injectable, inject } from '@angular/core';
import { ShiftEntry, OvertimeEntry, User } from '../models/app.models';
import { SalaryService } from './salary.service';
import * as XLSX from 'xlsx-js-style';

@Injectable({
  providedIn: 'root'
})
export class ExcelService {
  private salaryService = inject(SalaryService);

  constructor() { }

  exportWorktimeAccounting(
    user: User,
    shifts: ShiftEntry[],
    overtimes: OvertimeEntry[],
    calendarStart: Date, 
    calendarEnd: Date,  
    variableStart: Date,
    variableEnd: Date,
    extraIds: string[] = []
  ) {
    const safeDate = new Date(calendarStart);
    safeDate.setHours(12,0,0,0);
    const year = safeDate.getFullYear();
    const monthIndex = safeDate.getMonth();
    const monthName = ['január','február','március','április','május','június','július','augusztus','szeptember','október','november','december'][monthIndex];

    // --- ADATELŐKÉSZÍTÉS ---
    
    // 1. Statisztikák
    const uShifts = shifts.filter(s => s.userId === user.id);
    const uOvertimes = overtimes.filter(o => o.userId === user.id);
    const stats = this.salaryService.calculateStats(uShifts, uOvertimes, calendarStart, calendarEnd, variableStart, variableEnd);

    // 2. Részletes lista gyűjtése
    const detailedList: any[] = [];
    uOvertimes.forEach(ot => {
        const d = new Date(ot.date);
        let include = false;
        
        if (extraIds.includes(ot.id)) include = true;
        else if (ot.type === 'substitution') { if (d >= calendarStart && d <= calendarEnd) include = true; }
        else { if (d >= variableStart && d <= variableEnd) include = true; }

        if (include) {
            const durationMins = this.salaryService.calculateDurationMins(ot.startTime, ot.endTime);
            let typeLabel = '';
            let reason = '';
            if (ot.type === 'substitution') typeLabel = 'Helyettesítés';
            else if (ot.type === 'ticket') typeLabel = `Ticket #ID:${ot.comment || '-'}`;
            else if (ot.type === 'other') { typeLabel = 'Egyéb'; reason = ot.comment || ''; }
            else typeLabel = 'Túlóra';

            const finalReason = reason ? `${typeLabel} (${reason})` : typeLabel;

            detailedList.push({
                date: ot.date,
                start: ot.startTime,
                end: ot.endTime,
                duration: this.formatHm(durationMins),
                reason: finalReason
            });
        }
    });
    detailedList.sort((a, b) => a.date.localeCompare(b.date));

    // --- EXCEL GENERÁLÁS (WORKSHEET) ---

    // Adatok tömbje (Array of Arrays)
    const aoaData: any[][] = [];

    // Fejléc
    aoaData.push([`Havi összesítő - ${year}. ${monthName}`]);
    aoaData.push([`Név: ${user.name} (${user.role})`]);
    aoaData.push([]); // Üres sor

    // Összesítő tábla fejléce
    aoaData.push(['Megnevezés', 'Mértéke', 'Idő']);
    
    // Összesítő adatok
    aoaData.push(['Műszakpótlék', '30%', `${this.salaryService.getRoundedHoursForPayroll(stats.shiftAllowanceMins)} óra`]);
    aoaData.push(['Készenlét', '20%', this.formatHm(stats.standbyMins)]);
    aoaData.push(['Túlóra (Hétköznap)', '150%', this.formatHm(stats.weekdayOtMins)]);
    aoaData.push(['Túlóra (Pihenőnap)', '200%', this.formatHm(stats.restDayOtMins)]);
    aoaData.push(['Éjszakai munkavégzés', '-', this.formatHm(stats.nightStandbyWorkMins)]);
    aoaData.push(['Szabadság', '-', `${stats.vacationDays} nap`]);
    aoaData.push(['Betegállomány', '-', `${stats.sickDays} nap`]);

    aoaData.push([]); // Üres sor

    // Részletes lista fejléce
    aoaData.push(['Részletes túlórajegyzék']);
    aoaData.push(['Dátum', 'Kezdés', 'Vége', 'Idő', 'Megjegyzés']);

    // Részletes adatok
    detailedList.forEach(item => {
        aoaData.push([item.date, item.start, item.end, item.duration, item.reason]);
    });

    // Munkalap létrehozása
    const ws = XLSX.utils.aoa_to_sheet(aoaData);

    // --- FORMÁZÁS (Oszlopszélesség + Stílusok) ---
    
    // Oszlopszélességek
    ws['!cols'] = [
        { wch: 20 }, // A: Dátum/Megnevezés
        { wch: 15 }, // B: Kezdés/Mérték
        { wch: 15 }, // C: Vége/Idő
        { wch: 15 }, // D: Idő
        { wch: 40 }  // E: Megjegyzés
    ];

    // Stílusok alkalmazása (Félkövér fejlécek)
    // AOA indexek alapján:
    // 0. sor: Cím
    this.styleCell(ws, 'A1', { font: { bold: true, sz: 14 } });
    this.styleCell(ws, 'A2', { font: { bold: true } });
    
    // 4. sor: Összesítő fejléc (0-based index = 3-as sor az Excelben? Nem, 0->1, 3->4)
    // Az 'aoa_to_sheet' sorfolytonos.
    // A4, B4, C4 (Index: 3)
    ['A4', 'B4', 'C4'].forEach(ref => this.styleCell(ws, ref, { font: { bold: true }, fill: { fgColor: { rgb: "CCCCCC" } } }));

    // Részletes lista címe (Index függ a táblázat hosszától, de fixen számolható: 0,1,2,3(head),4..10(data),11(empty),12(Title),13(Head))
    const detailsHeaderRowIndex = 13; // A 14. sor
    const detailsHeadRowRef = detailsHeaderRowIndex + 1;
    
    this.styleCell(ws, `A${detailsHeadRowRef - 1}`, { font: { bold: true, sz: 12 } }); // Cím
    
    // Fejléc sor (A, B, C, D, E)
    ['A', 'B', 'C', 'D', 'E'].forEach(col => {
        this.styleCell(ws, `${col}${detailsHeadRowRef}`, { font: { bold: true }, fill: { fgColor: { rgb: "E6E6E6" } } });
    });

    // --- MENTÉS ---
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Munkaidő");

    const filename = `Munkaido_Osszesito_${user.name.replace(/ /g, '_')}_${year}_${monthIndex+1}.xlsx`;
    XLSX.writeFile(wb, filename);
  }

  private styleCell(ws: any, cellRef: string, style: any) {
      if (ws[cellRef]) {
          ws[cellRef].s = style;
      }
  }

  private formatHm(mins: number): string {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `${h}:${String(m).padStart(2, '0')}`;
  }
}