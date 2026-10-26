import { Text as RNText, type TextProps } from 'react-native';

import { usePalette } from './theme';

const variants = {
  display: { fontSize: 30, fontWeight: '800', letterSpacing: -0.6 },
  title: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  heading: { fontSize: 17, fontWeight: '700' },
  body: { fontSize: 15, fontWeight: '400' },
  label: { fontSize: 14, fontWeight: '600' },
  caption: { fontSize: 12, fontWeight: '500' },
  tiny: { fontSize: 11, fontWeight: '600' },
} as const;

type Props = TextProps & {
  variant?: keyof typeof variants;
  tone?: 'default' | 'muted' | 'faint' | 'primary' | 'danger' | 'success' | 'onPrimary';
};

export function Text({ variant = 'body', tone = 'default', style, ...rest }: Props) {
  const t = usePalette();
  const color = {
    default: t.text,
    muted: t.textMuted,
    faint: t.textFaint,
    primary: t.primary,
    danger: t.danger,
    success: t.success,
    onPrimary: t.onPrimary,
  }[tone];
  return <RNText {...rest} style={[variants[variant], { color }, style]} />;
}
