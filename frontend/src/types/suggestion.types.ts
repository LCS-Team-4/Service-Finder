export type SuggestionStatus = 'pending' | 'approved' | 'rejected';

export interface Suggestion {
  id: string;
  user_id: string;
  name: string;
  type: string | null;
  formatted_address: string | null;
  phone: string | null;
  website: string | null;
  opening_hours: string | null;
  status: SuggestionStatus;
  admin_note: string | null;
  created_at: string;
  reviewed_at: string | null;
}
