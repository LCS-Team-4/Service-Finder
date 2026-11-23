import { memo, useState } from 'react';
import { Bookmark, Clock3, MapPinned, Navigation, Phone, X, Globe, Accessibility, MapPin } from 'lucide-react';
import { CategoryIcon } from '../common/CategoryIcon';
import { categoryColor } from '../../utils/constants';
import { distanceKm, formatDistance } from '../../utils/geo';
import type { Place } from '../../types/service.types';

interface ServicePopupProps {
  place: Place;
  saved: boolean;
  userLocation?: { lat: number; lng: number } | null; // <-- ADDED THIS
  onClose: () => void;
  onSave: () => void;
  onGetDirections: () => void;
}

function ServicePopup({
  place,
  saved,
  userLocation,
  onClose,
  onSave,
  onGetDirections,
}: ServicePopupProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Calculate distance if we have the user's location
  const dist = userLocation 
    ? distanceKm(userLocation, { lat: place.lat, lng: place.lng }) 
    : null;

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
        
        {/* NEW DISTANCE DISPLAY */}
        {dist !== null && (
          <p style={{ color: '#8a653d', fontWeight: 600 }}>
            <Navigation size={17} />
            <span>{formatDistance(dist)} away</span>
          </p>
        )}

        {detailsOpen && (
          <>
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
          </>
        )}
      </div>

      <div className="service-actions">
        <button onClick={() => setDetailsOpen((open) => !open)}>
          {detailsOpen ? 'Hide Details' : 'View Details'}
        </button>
        <button className="directions" onClick={onGetDirections}>
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

export default memo(ServicePopup);