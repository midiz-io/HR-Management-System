/**
 * Utility to provide unique color coding for locations as per company requirements:
 * Hatchery - Blue
 * Live Center - Purple
 * Tropical Shell Fish (Pvt) ltd - Orange
 * Packing - Gray
 * Corporate Office - Green
 */

export const getLocationColor = (locationName: string = '') => {
  const name = locationName.toLowerCase();
  
  if (name.includes('hatchery')) {
    return {
      name: 'Blue',
      bg: 'bg-blue-100',
      text: 'text-blue-800',
      border: 'border-blue-200',
      dot: 'bg-blue-500',
      hex: [59, 130, 246], // RGB for Blue
      hexStr: '#3b82f6'
    };
  }
  
  if (name.includes('live center')) {
    return {
      name: 'Purple',
      bg: 'bg-purple-100',
      text: 'text-purple-800',
      border: 'border-purple-200',
      dot: 'bg-purple-500',
      hex: [168, 85, 247], // RGB for Purple
      hexStr: '#a855f7'
    };
  }
  
  if (name.includes('tropical shell fish')) {
    return {
      name: 'Orange',
      bg: 'bg-orange-100',
      text: 'text-orange-800',
      border: 'border-orange-200',
      dot: 'bg-orange-500',
      hex: [249, 115, 22], // RGB for Orange
      hexStr: '#f97316'
    };
  }
  
  if (name.includes('packing')) {
    return {
      name: 'Gray',
      bg: 'bg-gray-100',
      text: 'text-gray-800',
      border: 'border-gray-200',
      dot: 'bg-gray-500',
      hex: [107, 114, 128], // RGB for Gray
      hexStr: '#6b7280'
    };
  }
  
  if (name.includes('office') || name.includes('corporate')) {
    return {
      name: 'Green',
      bg: 'bg-green-100',
      text: 'text-green-800',
      border: 'border-green-200',
      dot: 'bg-green-500',
      hex: [34, 197, 94], // RGB for Green
      hexStr: '#22c55e'
    };
  }
  
  // Default fallback
  return {
    name: 'Default',
    bg: 'bg-slate-100',
    text: 'text-slate-800',
    border: 'border-slate-200',
    dot: 'bg-slate-500',
    hex: [100, 116, 139], // RGB for Slate
    hexStr: '#64748b'
  };
};
