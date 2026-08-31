export interface Service {
  id: string;
  name: string;
  type: 'clinic' | 'library' | 'shelter' | string;
  address: string;
  latitude: number;
  longitude: number;
  operatingHours?: string;
}
