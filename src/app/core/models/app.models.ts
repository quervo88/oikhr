// src/app/core/models/app.models.ts

export type Role = 'admin' | 'dispatcher' | 'hr';

export type ShiftType = 'nappal' | 'este' | 'ejszaka' | 'keszenlet' | 'szabadsag' | 'betegseg';

export type OvertimeType = 'ticket' | 'substitution' | 'other';

export interface User {
  id: string;
  username: string;
  name: string;
  role: Role;
  baseSalary?: number;
}

export interface ShiftEntry {
  id: string;
  userId: string;
  date: string;
  type: ShiftType;
  startTime: string;
  endTime: string;
}

export interface OvertimeEntry {
  id: string;
  userId: string;
  date: string;
  type: OvertimeType;
  startTime: string;
  endTime: string;
  // JAVÍTVA: details helyett comment, hogy egységes legyen a Modal-lal
  comment?: string; 
}

export interface CalendarDayOverride {
  date: string;
  type: 'workday' | 'restday';
  comment?: string;
}

// JAVÍTVA: Ez hiányzott, emiatt pirosodott a SalaryService
export interface SalaryStats {
  shiftAllowanceMins: number;
  standbyMins: number;
  weekdayOtMins: number;
  restDayOtMins: number;
  nightStandbyWorkMins: number;
  vacationDays: number;
  sickDays: number;
}