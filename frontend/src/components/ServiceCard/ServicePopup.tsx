import { Bookmark, Clock3, MapPinned, Navigation, Phone, X } from 'lucide-react';
import { CategoryIcon } from '../common/CategoryIcon';
import { categories } from '../../services/guideData';
import { Place } from '../../types/guide.types';

export default function ServicePopup({ place, saved, onClose, onSave, onNotice }: { place: Place; saved: boolean; onClose: () => void; onSave: () => void; onNotice: (message: string) => void }) {
  const details = { address: place.category === 'SPCA' ? '1 Bird Street, Grassy Park' : `${place.area} service centre, Cape Town`, hours: place.category === 'Hospitals' ? 'Open 24 hours' : '08:00 – 16:30', phone: place.category === 'SPCA' ? '021 700 4158' : '021 400 0000' };
  const color = categories.find((category) => category.name === place.category)?.color;
  return <section className="service-popup">
    <button className="service-close" aria-label="Close service" onClick={onClose}><X size={18} /></button>
    <div className="service-title"><span className="service-icon" style={{ background: color }}><CategoryIcon category={place.category} size={18} /></span><div><h2>{place.name}</h2><p>{place.category}</p></div></div>
    <div className="service-info"><p><MapPinned size={17} /><span>{details.address}<br />Cape Town</span></p><p><Clock3 size={17} />{details.hours}</p><p><Phone size={17} />{details.phone}</p></div>
    <div className="service-actions"><button onClick={() => onNotice(`More details for ${place.name} coming soon.`)}>View Details</button><button className="directions" onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`, '_blank', 'noopener,noreferrer')}><Navigation size={14} />Get Directions</button><button className={saved ? 'saved' : ''} onClick={onSave}><Bookmark size={15} />{saved ? 'Saved' : 'Save'}</button></div>
  </section>;
}