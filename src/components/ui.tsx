import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { colors, radius, space, type } from '../theme';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

export function Button({ label, onPress, variant = 'primary', disabled, loading, style }: ButtonProps) {
  const isDisabled = disabled || loading;
  const variantStyle = {
    primary: { backgroundColor: colors.purple },
    secondary: { backgroundColor: colors.forest },
    ghost: { backgroundColor: 'transparent' },
    danger: { backgroundColor: 'transparent' },
  }[variant];
  const textColor = {
    primary: colors.white,
    secondary: colors.sand,
    ghost: colors.forest,
    danger: colors.danger,
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        variantStyle,
        variant === 'ghost' && styles.ghostBorder,
        { opacity: isDisabled ? 0.55 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.buttonText, { color: textColor }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.chip, selected ? styles.chipOn : styles.chipOff]}
    >
      <Text style={[styles.chipText, { color: selected ? colors.white : colors.forest }]}>{label}</Text>
    </Pressable>
  );
}

export function ProgressBar({ percent }: { percent: number }) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: percent }}
      style={styles.track}
    >
      <View style={[styles.fill, { width: `${Math.max(0, Math.min(100, percent))}%` }]} />
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Field(props: TextInputProps & { label: string }) {
  const { label, style, ...rest } = props;
  return (
    <View style={{ gap: space.xs }}>
      <Text style={type.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#7D8C80"
        style={[styles.input, props.multiline && styles.inputMulti, style]}
        {...rest}
      />
    </View>
  );
}

export function EmptyState({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.empty}>
      <Text style={type.title}>{title}</Text>
      <Text style={[type.body, styles.emptyBody]}>{body}</Text>
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} /> : null}
    </View>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View accessibilityRole="alert" style={styles.error}>
      <Text style={[type.body, { color: colors.danger, flex: 1 }]}>{message}</Text>
      {onRetry ? <Button label="Retry" variant="ghost" onPress={onRetry} style={{ paddingHorizontal: space.sm }} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostBorder: { borderWidth: 1, borderColor: colors.line },
  buttonText: { fontSize: 16, fontWeight: '700' },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    marginRight: space.xs,
    borderWidth: 1,
  },
  chipOn: { backgroundColor: colors.forest, borderColor: colors.forest },
  chipOff: { backgroundColor: colors.card, borderColor: colors.line },
  chipText: { fontSize: 14, fontWeight: '600' },
  track: {
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.track,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: colors.purple, borderRadius: 5 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.forest,
  },
  inputMulti: { minHeight: 96, textAlignVertical: 'top' },
  empty: { alignItems: 'center', gap: space.sm, paddingVertical: space.xl, paddingHorizontal: space.lg },
  emptyBody: { textAlign: 'center', color: colors.muted },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F6E3E0',
    borderRadius: radius.md,
    padding: space.md,
    gap: space.sm,
  },
});
