import { Injectable, inject } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { User, ShiftEntry, OvertimeEntry } from '../models/app.models';
import { SalaryService } from './salary.service';
import { HolidayService } from './holiday.service';

@Injectable({
  providedIn: 'root'
})
export class PdfService {
  private salaryService = inject(SalaryService);
  private holidayService = inject(HolidayService);

  constructor() { }

  async exportWorktimeAccounting(
    user: User, 
    shifts: ShiftEntry[], 
    overtimes: OvertimeEntry[], 
    stdStart: Date,
    stdEnd: Date,
    otStart: Date,
    otEnd: Date,
    extraOvertimeIds: string[] = []
  ) {
    const doc = new jsPDF('p'); 

    try {
        await this.loadFonts(doc);
    } catch (error) {
        console.warn('Betűtípus hiba:', error);
    }

    const safeDate = new Date(stdStart);
    safeDate.setHours(12, 0, 0, 0); 
    const year = safeDate.getFullYear();
    const monthIndex = safeDate.getMonth(); 
    const monthName = this.getMonthName(monthIndex).toLowerCase();

    // FEJLÉC
    doc.setFontSize(14);
    doc.setFont('Roboto', 'bold'); 
    doc.text(`Havi összesítő - ${year}. ${monthName}`, 14, 15);
    
    doc.setFontSize(10);
    doc.setFont('Roboto', 'normal'); 
    doc.text(`Név: ${user.name} (${user.role})`, 14, 22);

    // ADATOK
    const uShifts = shifts.filter(s => s.userId === user.id);
    const uOvertimes = overtimes.filter(o => o.userId === user.id);
    const stats = this.salaryService.calculateStats(uShifts, uOvertimes, stdStart, stdEnd, otStart, otEnd);

    // 1. ÖSSZESÍTŐ
    const summaryData = [
      ['Megnevezés', 'Mértéke', 'Idő'],
      ['Műszakpótlék', '30%', `${this.formatHour(stats.shiftAllowanceMins)} óra`],
      ['Készenlét', '20%', this.formatHm(stats.standbyMins)],
      ['Túlóra (Hétköznap)', '150%', this.formatHm(stats.weekdayOtMins)],
      ['Túlóra (Pihenőnap)', '200%', this.formatHm(stats.restDayOtMins)],
      ['Éjszakai munkavégzés', '-', this.formatHm(stats.nightStandbyWorkMins)],
      ['Szabadság', '-', `${stats.vacationDays} nap`],
      ['Betegállomány', '-', `${stats.sickDays} nap`]
    ];

    autoTable(doc, {
      startY: 28, 
      head: [['Megnevezés', 'Mértéke', 'Idő']],
      body: summaryData.slice(1),
      theme: 'grid',
      styles: { font: 'Roboto', fontStyle: 'normal', fontSize: 8, cellPadding: 1.5, overflow: 'linebreak' },
      headStyles: { fillColor: [44, 62, 80], font: 'Roboto', fontStyle: 'bold', fontSize: 8 },
      columnStyles: { 0: { cellWidth: 80 }, 1: { halign: 'center' }, 2: { halign: 'right' } }
    });

    // 2. RÉSZLETES LISTA
    // @ts-ignore
    let y = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    doc.setFont('Roboto', 'bold');
    doc.text('Részletes túlórajegyzék', 14, y);
    y += 4;

    const detailedOvertimes: any[] = [];
    uOvertimes.forEach(ot => {
        const d = new Date(ot.date);
        let include = false;
        if (extraOvertimeIds.includes(ot.id)) include = true;
        else if (ot.type === 'substitution') { if (d >= stdStart && d <= stdEnd) include = true; }
        else { if (d >= otStart && d <= otEnd) include = true; }

        if (include) {
            let typeLabel = '';
            let reason = '';
            if (ot.type === 'substitution') typeLabel = 'Helyettesítés';
            else if (ot.type === 'ticket') typeLabel = `Ticket #ID:${ot.comment || '-'}`; 
            else if (ot.type === 'other') { typeLabel = 'Egyéb'; reason = ot.comment || ''; }
            else typeLabel = 'Túlóra';

            const finalReason = reason ? `${typeLabel} (${reason})` : typeLabel;
            const startMins = this.salaryService.timeToMins(ot.startTime);
            let endMins = this.salaryService.timeToMins(ot.endTime);
            if (endMins < startMins) endMins += 1440;
            const durationStr = this.formatHm(endMins - startMins);

            detailedOvertimes.push([ot.date, ot.startTime, ot.endTime, durationStr, finalReason]);
        }
    });
    
    detailedOvertimes.sort((a, b) => a[0].localeCompare(b[0]));

autoTable(doc, {
        startY: y,
        head: [['Dátum', 'Kezdés', 'Vége', 'Idő', 'Megjegyzés']],
        body: detailedOvertimes,
        theme: 'striped',
        styles: { 
            font: 'Roboto', 
            fontStyle: 'normal', 
            fontSize: 8, 
            cellPadding: 1.5
        },
        // Alapértelmezés: a FEJLÉC középen van (jó a középső 3 oszlopnak)
        headStyles: { 
            fillColor: [220, 53, 69], 
            font: 'Roboto', 
            fontStyle: 'bold', 
            fontSize: 8,
            halign: 'center', 
            valign: 'middle'
        },
        // Az ADATOK igazítása
        columnStyles: { 
            0: { halign: 'right' },  // <--- ÚJ: Dátum adatok jobbra
            1: { halign: 'center' }, 
            2: { halign: 'center' }, 
            3: { halign: 'center' }, 
            4: { halign: 'left' }    // Megjegyzés adatok balra
        },
        // A FEJLÉC kivételeinek kezelése
        didParseCell: function(data) {
            // Csak a fejléc sorban avatkozunk be
            if (data.section === 'head') {
                // Ha az első oszlop (Dátum), legyen jobbra
                if (data.column.index === 0) {
                    data.cell.styles.halign = 'right';
                }
                // Ha az utolsó oszlop (Megjegyzés), legyen balra
                if (data.column.index === 4) {
                    data.cell.styles.halign = 'left';
                }
            }
        }
    });

    // ALÁÍRÁSOK
    // @ts-ignore
    let finalY = doc.lastAutoTable.finalY + 20;
    if (finalY > 270) { doc.addPage(); finalY = 30; }

    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    const margin = 14;
    const width = 182; 
    const sectionW = width / 3;

    doc.line(margin, finalY, margin + 40, finalY);
    doc.setFont('Roboto', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0);
    doc.text('Dolgozó', margin + 20, finalY + 4, { align: 'center' });

    const midX = margin + sectionW + 10;
    doc.line(midX, finalY, midX + 40, finalY);
    doc.text('Ellenőrizte', midX + 20, finalY + 4, { align: 'center' });

    const rightX = margin + 2 * sectionW + 20;
    doc.line(rightX, finalY, rightX + 40, finalY);
    doc.text('Jóváhagyta', rightX + 20, finalY + 4, { align: 'center' });

    window.open(doc.output('bloburl'), '_blank');
  }

  // --- SEGÉDEK ---
  private async loadFonts(doc: jsPDF) {
      const regular = await this.fetchFontAsBase64('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf');
      doc.addFileToVFS('Roboto-Regular.ttf', regular);
      doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');

      const bold = await this.fetchFontAsBase64('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Medium.ttf');
      doc.addFileToVFS('Roboto-Bold.ttf', bold);
      doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');
  }
  private async fetchFontAsBase64(url: string): Promise<string> {
      const res = await fetch(url);
      const blob = await res.blob();
      return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(blob);
      });
  }
  private formatHour(mins: number) { return `${this.salaryService.getRoundedHoursForPayroll(mins)}`; }
  private formatHm(mins: number) { 
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `${h}:${String(m).padStart(2, '0')}`;
  }
  private getMonthName(i: number) { return ['Január','Február','Március','Április','Május','Június','Július','Augusztus','Szeptember','Október','November','December'][i]; }
}