import { Component, EventEmitter, Input, inject, OnInit, Output } from '@angular/core'; // Input hozzáadva
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../../core/services/data.service';
import { ExcelService } from '../../../core/services/excel.service';
import { PdfService } from '../../../core/services/pdf.service';
import { AuthService } from '../../../core/services/auth.service';
import { OvertimeEntry, User } from '../../../core/models/app.models';

@Component({
  selector: 'app-export-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './export-modal.component.html',
  styleUrl: './export-modal.component.scss'
})
export class ExportModalComponent implements OnInit {
  // JAVÍTÁS: Ez hiányzott, ezért szállt el a build!
  // A CalendarView átadja a [currentUser]-t, itt fogadjuk:
  @Input() currentUser!: User; 

  @Output() close = new EventEmitter<void>();

  dataService = inject(DataService);
  excelService = inject(ExcelService);
  pdfService = inject(PdfService);
  authService = inject(AuthService);

  targetMonthStr = '2025-12';
  stdStartStr = '';
  stdEndStr = '';
  otStartStr = '';
  otEndStr = '';

  allOvertimes: OvertimeEntry[] = [];
  users: User[] = [];
  
  // Kiválasztott felhasználó az exporthoz
  selectedUserId: string = '';

  pendingSubstitutions: { entry: OvertimeEntry, userName: string, selected: boolean }[] = [];

  ngOnInit() {
    // Alapból a mostani dátum (vagy amit szeretnél)
    const now = new Date();
    this.targetMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    this.calculateDates();
    
    // Adatok betöltése
    this.dataService.getAllUsers().subscribe(u => {
        // Itt szűrhetünk, hogy kik jelenjenek meg (pl. csak diszpécserek)
        this.users = u; 
        
        // Alapértelmezett user beállítása
        // JAVÍTÁS: Először megnézzük, kaptunk-e Input-ot (ez a biztos), ha nem, akkor AuthService
        const userToSelect = this.currentUser || this.authService.getCurrentUser();
        
        if (userToSelect && this.users.find(u => u.id === userToSelect.id)) {
            this.selectedUserId = userToSelect.id;
        } else if (this.users.length > 0) {
            this.selectedUserId = this.users[0].id;
        }
    });

    this.dataService.getOvertimes().subscribe(ots => {
        this.allOvertimes = ots;
        this.findPendingSubstitutions();
    });
  }

  calculateDates() {
    if (!this.targetMonthStr) return;
    const [y, m] = this.targetMonthStr.split('-').map(Number);
    
    // Naptári hónap (pl. 1-től 31-ig)
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0);
    
    // Túlóra időszak (előző hó 16 - tárgyhó 15)
    const otStart = new Date(y, m - 2, 16);
    const otEnd = new Date(y, m - 1, 15);

    this.stdStartStr = this.formatDate(start);
    this.stdEndStr = this.formatDate(end);
    this.otStartStr = this.formatDate(otStart);
    this.otEndStr = this.formatDate(otEnd);
  }

  findPendingSubstitutions() {
      if (!this.targetMonthStr) return;
      const [y, m] = this.targetMonthStr.split('-').map(Number);
      
      // Előző hónap meghatározása a "függőben lévő" helyettesítések kereséséhez
      const prevMonthStart = new Date(y, m - 2, 1);
      const prevMonthEnd = new Date(y, m - 1, 0);
      
      const prevStartStr = this.formatDate(prevMonthStart);
      const prevEndStr = this.formatDate(prevMonthEnd);

      this.pendingSubstitutions = this.allOvertimes
        .filter(ot => ot.type === 'substitution' && ot.date >= prevStartStr && ot.date <= prevEndStr)
        .map(ot => ({
            entry: ot,
            userName: this.users.find(u => u.id === ot.userId)?.name || 'Ismeretlen',
            selected: false
        }));
  }

  startExport(format: 'excel' | 'pdf') {
      if (!this.selectedUserId) {
          alert('Válassz ki egy dolgozót!');
          return;
      }

      const userToExport = this.users.find(u => u.id === this.selectedUserId);
      if (!userToExport) return;

      // Extra ID-k összegyűjtése (amiket bepipáltál a listában)
      // Csak azokat gyűjtjük, amik a KIVÁLASZTOTT USERHEZ tartoznak!
      const extraIds = this.pendingSubstitutions
          .filter(item => item.selected && item.entry.userId === this.selectedUserId)
          .map(item => item.entry.id);

      this.dataService.getShifts().subscribe(allShifts => {
          
          if (format === 'excel') {
              this.excelService.exportWorktimeAccounting(
                  userToExport,          // 1. user (User)
                  allShifts,             // 2. shifts (ShiftEntry[])
                  this.allOvertimes,     // 3. overtimes (OvertimeEntry[])
                  new Date(this.stdStartStr), // 4. stdStart
                  new Date(this.stdEndStr),   // 5. stdEnd
                  new Date(this.otStartStr),  // 6. otStart
                  new Date(this.otEndStr),    // 7. otEnd
                  extraIds                    // 8. extraOvertimeIds
              );
          } else {
              this.pdfService.exportWorktimeAccounting(
                  userToExport,
                  allShifts,
                  this.allOvertimes,
                  new Date(this.stdStartStr),
                  new Date(this.stdEndStr),
                  new Date(this.otStartStr),
                  new Date(this.otEndStr),
                  extraIds
              );
          }
      });
  }

  // Dátum formázás (YYYY-MM-DD) helyi idő szerint
  private formatDate(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  onMonthChange() {
      this.calculateDates();
      this.findPendingSubstitutions();
  }
}