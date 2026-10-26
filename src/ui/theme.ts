import { useColorScheme } from 'react-native';

// Brand blue is fixed by website/nextjs/ondc-zillybuy-ui/DESIGN.md (#0066CC,
// hover/pressed #0055AA). Everything else here is the app's glass palette.
type Gradient = readonly [string, string, ...string[]];

export type Palette = {
  dark: boolean;
  primaryGradient: Gradient;
  background: Gradient;
  blobs: readonly [string, string, string];
} & Record<
  | 'primary' | 'primaryPressed' | 'accent' | 'text' | 'textMuted' | 'textFaint' | 'onPrimary'
  | 'success' | 'warning' | 'danger' | 'glassFill' | 'glassFillBlur' | 'glassStrong' | 'glassBorder'
  | 'sheen' | 'hairline' | 'inputFill' | 'skeleton' | 'shadow',
  string
>;

const light: Palette = {
  dark: false,
  primary: '#0066CC',
  primaryPressed: '#0055AA',
  primaryGradient: ['#0066CC', '#2F8CFF'],
  accent: '#7C5CFF',
  text: '#0B1B33',
  textMuted: '#5B6B82',
  textFaint: '#8A97AB',
  onPrimary: '#FFFFFF',
  success: '#0E9F6E',
  warning: '#D97706',
  danger: '#E5484D',
  background: ['#EAF2FF', '#F3EEFF', '#FFF1F7'],
  blobs: ['#5AA2FF', '#A78BFA', '#FF9BC8'],
  glassFill: 'rgba(255,255,255,0.58)', // Android: no live blur, so a denser fill
  glassFillBlur: 'rgba(255,255,255,0.32)', // iOS: sits on top of a real BlurView
  glassStrong: 'rgba(255,255,255,0.82)',
  glassBorder: 'rgba(255,255,255,0.85)',
  sheen: 'rgba(255,255,255,0.55)',
  hairline: 'rgba(11,27,51,0.08)',
  inputFill: 'rgba(255,255,255,0.7)',
  skeleton: 'rgba(11,27,51,0.07)',
  shadow: '#3A5A99',
};

const dark: Palette = {
  dark: true,
  primary: '#2F8CFF',
  primaryPressed: '#0066CC',
  primaryGradient: ['#0066CC', '#3D9BFF'],
  accent: '#9B87FF',
  text: '#F2F6FF',
  textMuted: '#A3B1C9',
  textFaint: '#6F7D96',
  onPrimary: '#FFFFFF',
  success: '#34D399',
  warning: '#FBBF24',
  danger: '#FF6B70',
  background: ['#050B1A', '#0B1230', '#170B2A'],
  blobs: ['#1D5FD6', '#5B3FC4', '#B83A7F'],
  glassFill: 'rgba(28,36,64,0.62)',
  glassFillBlur: 'rgba(20,28,52,0.35)',
  glassStrong: 'rgba(28,36,64,0.88)',
  glassBorder: 'rgba(255,255,255,0.14)',
  sheen: 'rgba(255,255,255,0.08)',
  hairline: 'rgba(255,255,255,0.08)',
  inputFill: 'rgba(255,255,255,0.06)',
  skeleton: 'rgba(255,255,255,0.08)',
  shadow: '#000000',
};

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;
export const radius = { sm: 10, md: 16, lg: 22, xl: 28, pill: 999 } as const;

// Floating glass tab bar height (excluding the bottom safe-area inset);
// scroll views pad their bottom by this so content isn't hidden behind it.
export const TAB_BAR_HEIGHT = 68;
