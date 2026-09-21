import { Bus, Flame, GraduationCap, Heart, Hospital, House, Landmark, Library, Pill, Shield, ShoppingBag, Smile, Stethoscope } from 'lucide-react';
import { Category } from '../../types/guide.types';

export function CategoryIcon({ category, size = 14 }: { category: Category; size?: number }) {
  const props = { size, strokeWidth: 2.2 };
  switch (category) {
    case 'Clinics': return <Stethoscope {...props} />; case 'Libraries': return <Library {...props} />;
    case 'Shelters': return <House {...props} />; case 'Hospitals': return <Hospital {...props} />;
    case 'Police Stations': return <Shield {...props} />; case 'Pharmacies': return <Pill {...props} />;
    case 'Dentists': return <Smile {...props} />; case 'SPCA': return <Heart {...props} />;
    case 'Fire Stations': return <Flame {...props} />; case 'Home Affairs': return <Landmark {...props} />;
    case 'Malls': return <ShoppingBag {...props} />; case 'Transport': return <Bus {...props} />;
    case 'Schools / Universities': return <GraduationCap {...props} />;
  }
}