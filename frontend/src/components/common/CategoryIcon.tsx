import { Bus, Flame, GraduationCap, Heart, Hospital, House, Landmark, Library, Pill, Shield, ShoppingBag, Smile, Stethoscope, MapPinned } from 'lucide-react';
import type { Category } from '../../types/service.types';

export function CategoryIcon({ category, size = 14 }: { category: Category; size?: number }) {
  const props = { size, strokeWidth: 2.2 };
  switch (category) {
    case 'Clinic':         return <Stethoscope    {...props} />;
    case 'Library':        return <Library        {...props} />;
    case 'Shelter':        return <House          {...props} />;
    case 'Hospital':       return <Hospital       {...props} />;
    case 'Police station': return <Shield         {...props} />;
    case 'Pharmacy':       return <Pill           {...props} />;
    case 'Dentist':        return <Smile          {...props} />;
    case 'Fire station':   return <Flame          {...props} />;
    case 'Home Affairs':   return <Landmark       {...props} />;
    case 'School':         return <GraduationCap  {...props} />;
    case 'SPCA':           return <Heart          {...props} />;
    case 'Mall':           return <ShoppingBag    {...props} />;
    case 'Transport':      return <Bus            {...props} />;
    default:               return <MapPinned      {...props} />;
  }
}