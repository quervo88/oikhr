import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class HolidayService {

  // --- ÜNNEPNAPOK (Piros, 200% túlóra) ---
  private holidays = [
    // 2025
    '2025-01-01', // Újév
    '2025-03-15', // Nemzeti ünnep
    '2025-04-18', // Nagypéntek
    '2025-04-20', // Húsvét
    '2025-04-21', // Húsvéthétfő
    '2025-05-01', // Munka ünnepe
    '2025-05-02', // Pihenőnap (Május 17-én ledolgozva)
    '2025-06-08', // Pünkösd
    '2025-06-09', // Pünkösdhétfő
    '2025-08-20', // Államalapítás
    '2025-10-23', // 56-os forradalom
    '2025-10-24', // Pihenőnap (Okt 18-án ledolgozva)
    '2025-11-01', // Mindenszentek
    '2025-12-24', // Szenteste (Pihenőnap, Dec 13-án ledolgozva)
    '2025-12-25', // Karácsony
    '2025-12-26', // Karácsony

    // 2026 (Előzetes kalkuláció a fix ünnepekkel)
    '2026-01-01', // Újév
    '2026-01-02', // Feltételezett pihenőnap (Csütörtök az ünnep)
    '2026-03-15', // Nemzeti ünnep
    '2026-04-03', // Nagypéntek
    '2026-04-05', // Húsvét
    '2026-04-06', // Húsvéthétfő
    '2026-05-01', // Munka ünnepe
    '2026-05-24', // Pünkösd
    '2026-05-25', // Pünkösdhétfő
    '2026-08-20', // Államalapítás
    '2026-08-21', // Feltételezett pihenőnap (Csütörtök az ünnep)
    '2026-10-23', // 56-os forradalom
    '2026-11-01', // Mindenszentek
    '2026-12-24', // Szenteste (Csütörtök)
    '2026-12-25', // Karácsony
    '2026-12-26'  // Karácsony
  ];

  // --- LEDOLGOZÓS SZOMBATOK (Munkanap, 150% túlóra) ---
  private workSaturdays = [
    // 2025
    '2025-05-17', // Május 2. helyett
    '2025-10-18', // Október 24. helyett
    '2025-12-13', // December 24. helyett

    // 2026 (Becsült dátumok, a hivatalos rendelet alapján majd pontosítani kell)
    '2026-01-10', // Január 2. helyett (becslés)
    '2026-08-29'  // Augusztus 21. helyett (becslés)
  ];

  // Ellenőrzi, hogy egy adott nap hétvége vagy ünnep-e (Piros legyen-e?)
  isWeekendOrHoliday(dateStr: string): boolean {
    // 1. Ha ledolgozós szombat -> MUNKANAP (tehát NEM hétvége)
    if (this.workSaturdays.includes(dateStr)) {
      return false; 
    }

    // 2. Ha ünnepnap -> IGEN, hétvége
    if (this.holidays.includes(dateStr)) {
      return true;
    }

    // 3. Egyébként nézzük a naptárat (0=Vasárnap, 6=Szombat)
    const d = new Date(dateStr);
    const day = d.getDay(); 
    return day === 0 || day === 6;
  }

  // Visszaadja az ünnep nevét, ha van
  getHolidayName(dateStr: string): string | null {
    // 2025
    if (dateStr === '2025-01-01') return 'Újév';
    if (dateStr === '2025-03-15') return 'Nemzeti ünnep';
    if (dateStr === '2025-04-18') return 'Nagypéntek';
    if (dateStr === '2025-04-20') return 'Húsvét';
    if (dateStr === '2025-04-21') return 'Húsvét';
    if (dateStr === '2025-05-01') return 'Munka ünnepe';
    if (dateStr === '2025-05-02') return 'Pihenőnap';
    if (dateStr === '2025-06-08') return 'Pünkösd';
    if (dateStr === '2025-06-09') return 'Pünkösd';
    if (dateStr === '2025-08-20') return 'Aug. 20';
    if (dateStr === '2025-10-23') return 'Okt. 23';
    if (dateStr === '2025-10-24') return 'Pihenőnap';
    if (dateStr === '2025-11-01') return 'Mindenszentek';
    if (dateStr === '2025-12-24') return 'Szenteste';
    if (dateStr === '2025-12-25') return 'Karácsony';
    if (dateStr === '2025-12-26') return 'Karácsony';

    // 2026
    if (dateStr === '2026-01-01') return 'Újév';
    if (dateStr === '2026-03-15') return 'Nemzeti ünnep';
    if (dateStr === '2026-04-03') return 'Nagypéntek';
    if (dateStr === '2026-04-05') return 'Húsvét';
    if (dateStr === '2026-04-06') return 'Húsvét';
    if (dateStr === '2026-05-01') return 'Munka ünnepe';
    if (dateStr === '2026-05-24') return 'Pünkösd';
    if (dateStr === '2026-05-25') return 'Pünkösd';
    if (dateStr === '2026-08-20') return 'Aug. 20';
    if (dateStr === '2026-10-23') return 'Okt. 23';
    if (dateStr === '2026-11-01') return 'Mindenszentek';
    if (dateStr === '2026-12-24') return 'Szenteste';
    if (dateStr === '2026-12-25') return 'Karácsony';
    if (dateStr === '2026-12-26') return 'Karácsony';

    return null;
  }
}