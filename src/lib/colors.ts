// Person colours (rose, blue, sage, sand + two spare). The DB stores the dot colour; the panel maps it here.
export interface PersonColor {
  key: string;
  dot: string;
  bg: string;
  ink: string;
  /** Avatar letter colour in the team list (Zespol.dc.html). */
  avatarInk: string;
}

export const PALETTE: PersonColor[] = [
  { key: 'rose', dot: '#C2577F', bg: '#F6DDE6', ink: '#5E1F3A', avatarInk: '#6B2442' },
  { key: 'blue', dot: '#4F7CB8', bg: '#DCE7F5', ink: '#1C3558', avatarInk: '#1F3B63' },
  { key: 'sage', dot: '#5E8C57', bg: '#E1EDDD', ink: '#284224', avatarInk: '#2D4A29' },
  { key: 'sand', dot: '#C08A3E', bg: '#F5E5CB', ink: '#4F3610', avatarInk: '#4F3610' },
  { key: 'lilac', dot: '#8A6BB8', bg: '#E8E0F3', ink: '#3A2A55', avatarInk: '#3A2A55' },
  { key: 'teal', dot: '#3E8C8C', bg: '#D7ECEB', ink: '#1E4646', avatarInk: '#1E4646' }
];

/** The palette entry for a stored colour; an unknown colour falls back by position. */
export function personColor(stored: string | null | undefined, index = 0): PersonColor {
  const hit = PALETTE.find((p) => p.dot.toLowerCase() === (stored ?? '').toLowerCase());
  return hit ?? PALETTE[((index % PALETTE.length) + PALETTE.length) % PALETTE.length];
}
