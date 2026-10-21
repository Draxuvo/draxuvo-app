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
