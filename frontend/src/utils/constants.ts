// Category colour palette for service markers.
// Chosen to match the retro Cape Guide theme.
// Unknown categories get a stable fallback based on a hash of the name.

const categoryColors: Record<string, string> = {
  'Clinic':         '#b94b3c',  // red
  'Hospital':       '#3b77a2',  // blue
  'Pharmacy':       '#81528d',  // purple
  'Dentist':        '#77909c',  // slate
  'Library':        '#4f876f',  // green
  'School':         '#43858a',  // teal
  'Police station': '#375f93',  // navy
  'Fire station':   '#bd6240',  // orange
  'Shelter':        '#cb8c38',  // amber
  'Home Affairs':   '#75664b',  // brown
  'SPCA':           '#815c54',  // maroon
  'Mall':           '#a45b83',  // pink
  'Transport':      '#847337',  // olive
};

const fallbackPalette = [
  '#b94b3c', '#4f876f', '#cb8c38', '#3b77a2', '#375f93',
  '#81528d', '#77909c', '#815c54', '#bd6240', '#75664b',
  '#a45b83', '#847337', '#43858a',
];

export function categoryColor(category: string): string {
  const direct = categoryColors[category];
  if (direct) return direct;

  // Stable hash for unknown categories — same category always gets the same colour.
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = (hash * 31 + category.charCodeAt(i)) | 0;
  }
  return fallbackPalette[Math.abs(hash) % fallbackPalette.length];
}