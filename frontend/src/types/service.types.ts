export interface Service {
  id: string;
  external_id: string | null;
  name: string;
  category_id: string | null;
  type: string | null;
  formatted_address: string | null;
  location: string | { coordinates?: [number, number] } | null;
  opening_hours: string | null;
  phone: string | null;
  website: string | null;
  wheelchair: string | null;
  sourcename: string;
  status: string;
  submitted_by: string | null;
  reviewed_by: string | null;
  review_note: string | null;
  imported_at: string | null;
  created_at: string;
  updated_at: string;
  category?: {
    id: string;
    name: string;
    slug: string;
    parent_id: string | null;
  } | null;
}

export type Category = string;

export type Place = Omit<Service, 'category'> & {
  category: Category;
  lat: number;
  lng: number;
};
