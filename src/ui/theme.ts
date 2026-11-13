import { useColorScheme } from 'react-native';

// Brand blue is fixed by website/nextjs/ondc-zillybuy-ui/DESIGN.md (#0066CC,
// hover/pressed #0055AA). Surfaces are flat and solid (the glass look was
// dropped); the glass* token names are kept so existing screens need no edits.
type Gradient = readonly [string, string, ...string[]];

export type Palette = {
  dark: boolean;
  primaryGradient: Gradient;
  background: Gradient;
  blobs: readonly [string, string, string];
} & Record<
  | 'primary' | 'primaryPressed' | 'accent' | 'text' | 'textMuted' | 'textFaint' | 'onPrimary'
  | 'success' | 'warning' | 'danger' | 'glassFill' | 'glassFillBlur' | 'glassStrong' | 'glassBorder'
  | 'sheen' | 'hairline' | 'inputFill' | 'skeleton' | 'shadow' | 'tileFill',
  string
>;

const light: Palette = {
  dark: false,
  primary: '#0066CC',
  primaryPressed: '#0055AA',
  primaryGradient: ['#0066CC', '#0066CC'], // flat: kept as a pair for old callers
  accent: '#7C5CFF',
  text: '#0B1B33',
  textMuted: '#5B6B82',
  textFaint: '#8A97AB',
  onPrimary: '#FFFFFF',
  success: '#0E9F6E',
  warning: '#D97706',
  danger: '#E5484D',
  background: ['#FFFFFF', '#FFFFFF'],
  blobs: ['#5AA2FF', '#A78BFA', '#FF9BC8'],
  glassFill: '#FFFFFF',
  glassFillBlur: '#FFFFFF',
  glassStrong: '#FFFFFF',
  glassBorder: '#E8ECF2',
  sheen: 'transparent',
  hairline: 'rgba(11,27,51,0.08)',
  inputFill: '#F3F5F8',
  skeleton: 'rgba(11,27,51,0.07)',
  shadow: '#3A5A99',
  tileFill: '#F3F5F8', // grey well behind product images
};

const dark: Palette = {
  dark: true,
  primary: '#2F8CFF',
  primaryPressed: '#0066CC',
  primaryGradient: ['#2F8CFF', '#2F8CFF'],
  accent: '#9B87FF',
  text: '#F2F6FF',
  textMuted: '#A3B1C9',
  textFaint: '#6F7D96',
  onPrimary: '#FFFFFF',
  success: '#34D399',
  warning: '#FBBF24',
  danger: '#FF6B70',
  background: ['#0B0F1A', '#0B0F1A'],
  blobs: ['#1D5FD6', '#5B3FC4', '#B83A7F'],
  glassFill: '#151B2B',
  glassFillBlur: '#151B2B',
  glassStrong: '#151B2B',
  glassBorder: 'rgba(255,255,255,0.08)',
  sheen: 'transparent',
  hairline: 'rgba(255,255,255,0.08)',
  inputFill: 'rgba(255,255,255,0.06)',
  skeleton: 'rgba(255,255,255,0.08)',
  shadow: '#000000',
  tileFill: '#1C2336',
};

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;
export const radius = { sm: 10, md: 16, lg: 22, xl: 28, pill: 999 } as const;

// Bottom tab bar height (excluding the bottom safe-area inset);
// scroll views pad their bottom by this so content isn't hidden behind it.
export const TAB_BAR_HEIGHT = 66;
