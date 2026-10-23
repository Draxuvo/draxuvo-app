import { api } from "./client";

/** Un turno de quien tiene la sesión (spec 026). */
export interface Shift {
  id: number;
  checkin_at: string;
  checkout_at: string | null;
  open: boolean;
  duration_minutes: number | null;
}

/** Estado de hoy: `GET /my_attendance/today`. `eligible: false` si la persona no es empleada de la empresa. */
export interface MyAttendance {
  eligible: boolean;
  state: "none" | "working" | "done";
  current: Shift | null;
  last: Shift | null;
  server_time: string;
}

const base = "/api/v1/my_attendance";

export const getMyAttendance = () => api.get<MyAttendance>(`${base}/today`);
export const checkIn = () => api.post<MyAttendance>(`${base}/check_in`);
export const checkOut = () => api.post<MyAttendance>(`${base}/check_out`);

/** Una marca de asistencia con quién la registró (spec 036). */
export interface TeamShift extends Shift {
  checkin_by: { id: number; name: string } | null;
  checkout_by: { id: number; name: string } | null;
  checkin_captured: boolean;
  checkout_captured: boolean;
}

/** Fila de la lista del día por empleado: `GET /attendances/roster`. */
export interface RosterRow {
  employee: { id: number; name: string; position: string | null };
  state: "none" | "working" | "done";
  attendance: TeamShift | null;
}

export const getRoster = () => api.get<{ date: string; results: RosterRow[] }>("/api/v1/attendances/roster");
/** Marca de otro empleado (administrador y dueño); `at` es una hora pasada opcional con desfase, nunca futura. */
export const markEmployeeIn = (employeeId: number, at?: string) => api.post<TeamShift>(`/api/v1/employees/${employeeId}/checkin`, { body: { at } });
export const markEmployeeOut = (employeeId: number, at?: string) => api.post<TeamShift>(`/api/v1/employees/${employeeId}/checkout`, { body: { at } });
