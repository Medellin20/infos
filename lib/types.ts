export interface ScheduleSlot {
  start_time: string;
  end_time: string;
  class_name: string;
  establishment: string;
}

export interface DayData {
  day_of_week: number;
  day_label: string;
  has_courses: boolean;
  slots: ScheduleSlot[];
}

export interface TeacherFormData {
  last_name: string;
  first_names: string;
  professional_status: string;
  establishments: string;
  days: DayData[];
}

export interface Teacher {
  id: string;
  last_name: string;
  first_names: string;
  professional_status: string;
  establishments: string;
  created_at: string;
}

export interface ScheduleDay {
  id: string;
  teacher_id: string;
  day_of_week: number;
  has_courses: boolean;
}

export interface ScheduleSlotRow {
  id: string;
  day_id: string;
  start_time: string;
  end_time: string;
  class_name: string;
  establishment: string;
}

export interface TeacherWithDetails extends Teacher {
  days: (ScheduleDay & {
    slots: ScheduleSlotRow[];
  })[];
}

export const DAYS = [
  { value: 0, label: 'Lundi' },
  { value: 1, label: 'Mardi' },
  { value: 2, label: 'Mercredi' },
  { value: 3, label: 'Jeudi' },
  { value: 4, label: 'Vendredi' },
];
