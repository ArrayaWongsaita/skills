// The colour of each vocabulary role, softened for the sketch style. Edit freely: an edit here is kept on upgrades.
import { vocabulary } from '../vocabulary';

export const palette: Record<string, string> = {
  primary: '#4a86c5',
  secondary: '#8a6fc9',
  accent: '#e08a2e',
  success: '#4f9a63',
  warning: '#c9971c',
  danger: '#d9607a',
  neutral: '#6b6b6b',
};

export function roleColour(role: string): string {
  return palette[role] ?? vocabulary.roles[role] ?? palette.neutral;
}
