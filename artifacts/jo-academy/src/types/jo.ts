export type Profile = { id: string; full_name: string | null; role: 'student' | 'supervisor'; xp: number; streak: number; study_hours: number; phone_number?: string | null; is_banned?: boolean };
export type Subject = { id: string; name: string; description: string | null; icon?: string | null; order_index?: number };
export type Unit = { id: string; subject_id: string; title: string; order_index?: number };
export type Lesson = { id: string; unit_id: string; title: string; video_url?: string | null; drive_url?: string | null; order_index?: number };
export type LessonResource = {
  id: string;
  lesson_id: string;
  title: string;
  resource_type: 'video' | 'file' | 'link';
  url: string;
  description?: string | null;
  order_index?: number;
  is_published?: boolean;
};
export type Exam = { id: string; subject_id?: string; title: string; description: string | null; duration_minutes: number; is_published: boolean; start_time?: string | null; end_time?: string | null; subject?: { name: string } };
export type Question = { id: string; exam_id: string; question_text: string; options: string[]; correct_answer: string; explanation?: string | null; order_index?: number };
export type Task = { id: string; user_id: string; title: string; completed: boolean; created_at?: string };
export type Camp = { id: string; title: string; description: string | null; subject_id?: string | null; is_open: boolean; start_date?: string | null; end_date?: string | null };