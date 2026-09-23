import Dexie, { type Table } from 'dexie';
import type { Service } from '../types/service.types';

export interface MetaRow {
  key: string;
  value: string;
}

class ServiceFinderDB extends Dexie {
  services!: Table<Service, string>;
  meta!: Table<MetaRow, string>;

  constructor() {
    super('servicefinder');
    this.version(1).stores({
      services: 'id, category_id, name',
      meta: 'key',
    });
  }
}

export const db = new ServiceFinderDB();