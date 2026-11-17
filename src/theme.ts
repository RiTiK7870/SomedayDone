import { Platform, TextStyle } from 'react-native';

// Palette: Forest Green, Sand Beige, Electric Purple (from the brand reference).
// Surfaces and muted tones are tints of these three, so the screens stay on-palette.
export const colors = {
  forest: '#1F3D2B',
  sand: '#E8DCC4',
  purple: '#8B5CF6',
  surface: '#F3ECDC',
  card: '#FBF7EE',
  line: '#D4C8AE',
  track: '#D9CDB2',
  muted: '#55695B',
  purpleSoft: '#ECE4FE',
  danger: '#9B2C2C',
  white: '#FFFFFF',
};

// A serif for titles gives the app a warm, personal voice. Body text stays system sans.
export const displayFont = Platform.OS === 'ios' ? 'Georgia' : 'serif';

export const type = {
  hero: { fontFamily: displayFont, fontSize: 32, lineHeight: 38, color: colors.forest, fontWeight: '700' } as TextStyle,
  title: { fontFamily: displayFont, fontSize: 22, lineHeight: 28, color: colors.forest, fontWeight: '700' } as TextStyle,
  body: { fontSize: 16, lineHeight: 23, color: colors.forest } as TextStyle,
  label: { fontSize: 14, lineHeight: 18, color: colors.forest, fontWeight: '600' } as TextStyle,
  small: { fontSize: 13, lineHeight: 18, color: colors.muted } as TextStyle,
};

export const radius = { sm: 12, md: 16, lg: 22, pill: 999 };
export const space = { xs: 6, sm: 10, md: 16, lg: 24, xl: 32 };
