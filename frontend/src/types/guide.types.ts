export type Category =
  | 'Clinics' | 'Libraries' | 'Shelters' | 'Hospitals' | 'Police Stations'
  | 'Pharmacies' | 'Dentists' | 'SPCA' | 'Fire Stations' | 'Home Affairs'
  | 'Malls' | 'Transport' | 'Schools / Universities';

export type Place = { name: string; category: Category; area: string; lat: number; lng: number };
export type CategoryOption = { name: Category; symbol: string; color: string };