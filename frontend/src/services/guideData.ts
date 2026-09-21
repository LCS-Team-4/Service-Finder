import { CategoryOption, Place } from '../types/guide.types';

export const categories: CategoryOption[] = [
  { name: 'Clinics', symbol: '+', color: '#b94b3c' }, { name: 'Libraries', symbol: '▮', color: '#4f876f' },
  { name: 'Shelters', symbol: '⌂', color: '#cb8c38' }, { name: 'Hospitals', symbol: '+', color: '#3b77a2' },
  { name: 'Police Stations', symbol: '●', color: '#375f93' }, { name: 'Pharmacies', symbol: '●', color: '#81528d' },
  { name: 'Dentists', symbol: '●', color: '#77909c' }, { name: 'SPCA', symbol: '♥', color: '#815c54' },
  { name: 'Fire Stations', symbol: '♦', color: '#bd6240' }, { name: 'Home Affairs', symbol: '▦', color: '#75664b' },
  { name: 'Malls', symbol: '●', color: '#a45b83' }, { name: 'Transport', symbol: '▰', color: '#847337' },
  { name: 'Schools / Universities', symbol: '◆', color: '#43858a' },
];

const placeRows: [string, string, string, number, number][] = [
  ['Cape Town Civic Centre', 'Home Affairs', 'Cape Town', -33.925, 18.424], ['Groote Schuur Hospital', 'Hospitals', 'Observatory', -33.941, 18.465],
  ['Sea Point Police Station', 'Police Stations', 'Sea Point', -33.918, 18.386], ['Cape Town Central Library', 'Libraries', 'CBD', -33.925, 18.423],
  ['Woodstock Clinic', 'Clinics', 'Woodstock', -33.927, 18.448], ['Mowbray Maternity Hospital', 'Hospitals', 'Mowbray', -33.948, 18.475],
  ['Rondebosch Library', 'Libraries', 'Rondebosch', -33.961, 18.476], ['Khayelitsha Mall', 'Malls', 'Khayelitsha', -34.037, 18.678],
  ['Mitchells Plain Clinic', 'Clinics', 'Mitchells Plain', -34.048, 18.617], ['Bellville Police Station', 'Police Stations', 'Bellville', -33.9, 18.628],
  ['Tygerberg Hospital', 'Hospitals', 'Parow', -33.908, 18.596], ['Milnerton Library', 'Libraries', 'Milnerton', -33.879, 18.496],
  ['Hout Bay Fire Station', 'Fire Stations', 'Hout Bay', -34.044, 18.348], ['Wynberg SPCA', 'SPCA', 'Wynberg', -34.003, 18.468],
  ['Claremont Transport Hub', 'Transport', 'Claremont', -33.981, 18.465], ['UCT', 'Schools / Universities', 'Rondebosch', -33.957, 18.461],
  ['Table View Shelter', 'Shelters', 'Table View', -33.824, 18.488], ['Kloof Street Pharmacy', 'Pharmacies', 'Gardens', -33.932, 18.41],
];

export const places: Place[] = placeRows.map(([name, category, area, lat, lng]) => ({
  name, category: category as Place['category'], area, lat, lng,
}));