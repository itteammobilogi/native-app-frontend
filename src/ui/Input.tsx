import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Text } from './Text';
import { radius, usePalette } from './theme';

type Props = TextInputProps & {
  label?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  error?: string;
  prefix?: string;
  secure?: boolean;
};

export function Input({ label, icon, error, prefix, secure, style, ...rest }: Props) {
  const t = usePalette();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(!!secure);

  return (
    <View style={{ gap: 6 }}>
      {label && (
        <Text variant="caption" tone="muted">
          {label}
        </Text>
      )}
      <View
        style={[
          styles.field,
          rest.multiline && styles.multiField,
          {
            backgroundColor: t.inputFill,
            borderColor: error ? t.danger : focused ? t.primary : t.glassBorder,
          },
        ]}>
        {icon && <Ionicons name={icon} size={18} color={focused ? t.primary : t.textFaint} />}
        {prefix && (
          <Text variant="label" tone="muted">
            {prefix}
          </Text>
        )}
        <TextInput
          placeholderTextColor={t.textFaint}
          selectionColor={t.primary}
          secureTextEntry={hidden}
          onFocus={(e) => (setFocused(true), rest.onFocus?.(e))}
          onBlur={(e) => (setFocused(false), rest.onBlur?.(e))}
          {...rest}
          style={[styles.input, rest.multiline && styles.multiInput, { color: t.text }, style]}
        />
        {secure && (
          <Pressable
            hitSlop={8}
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            onPress={() => setHidden((h) => !h)}>
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={18} color={t.textFaint} />
          </Pressable>
        )}
      </View>
      {!!error && (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    height: 52,
  },
  input: { flex: 1, fontSize: 16, height: '100%' },
  multiField: { height: undefined, minHeight: 110, alignItems: 'flex-start', paddingVertical: 12 },
  multiInput: { height: undefined, minHeight: 86, textAlignVertical: 'top', paddingTop: 0 },
});
