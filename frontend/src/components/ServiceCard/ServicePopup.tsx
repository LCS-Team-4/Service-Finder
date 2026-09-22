import { Bookmark, Clock3, MapPinned, Navigation, Phone, X, Globe, Accessibility } from 'lucide-react';
import { CategoryIcon } from '../common/CategoryIcon';
import { categoryColor } from '../../utils/constants';
import type { Place } from '../../types/service.types';

interface ServicePopupProps {
  place: Place;
  saved: boolean;
  onClose: () => void;
  onSave: () => void;
  onViewDetails: () => void;
}

export default function ServicePopup({
  place,
  saved,
  onClose,
  onSave,
  onViewDetails,
}: ServicePopupProps) {
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`;

  return (
    <section className="service-popup">
      <button className="service-close" aria-label="Close service" onClick={onClose}>
        <X size={18} />
      </button>

      <div className="service-title">
        <span className="service-icon" style={{ background: categoryColor(place.category) }}>
          <CategoryIcon category={place.category} size={18} />
        </span>
        <div>
          <h2>{place.name}</h2>
          <p>{place.category}</p>
        </div>
      </div>

      <div className="service-info">
        <p>
          <MapPinned size={17} />
          <span>{place.formatted_address ?? 'Address unavailable'}</span>
        </p>
        {place.opening_hours && (
          <p><Clock3 size={17} />{place.opening_hours}</p>
        )}
        {place.phone && (
          <p><Phone size={17} />{place.phone}</p>
        )}
        {place.website && (
          <p>
            <Globe size={17} />
            <a href={place.website} target="_blank" rel="noreferrer">Visit website</a>
          </p>
        )}
        {place.wheelchair && (
          <p><Accessibility size={17} />Wheelchair access: {place.wheelchair}</p>
        )}
      </div>

      <div className="service-actions">
        <button onClick={onViewDetails}>View Details</button>
        <button
          className="directions"
          onClick={() => window.open(directionsUrl, '_blank', 'noopener,noreferrer')}
        >
          <Navigation size={14} />
          Get Directions
        </button>
        <button className={saved ? 'saved' : ''} onClick={onSave}>
          <Bookmark size={15} />
          {saved ? 'Saved' : 'Save'}
        </button>
      </div>
    </section>
  );
}