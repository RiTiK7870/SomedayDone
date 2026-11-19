import React, { useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  currentUndo,
  flushDeletions,
  subscribeUndo,
  undoDeletion,
  type UndoItem,
} from '../lib/undo';
import { colors, radius, space } from '../theme';

// Shows "Deleted … Undo" at the top of the screen while a deletion is still pending.
export function UndoBar() {
  const insets = useSafeAreaInsets();
  const [item, setItem] = useState<UndoItem | null>(currentUndo());

  useEffect(() => subscribeUndo(() => setItem(currentUndo())), []);

  // Commit pending deletions when the app leaves the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') flushDeletions();
    });
    return () => sub.remove();
  }, []);

  if (!item) return null;

  return (
    <View
      accessibilityRole="alert"
      style={[styles.bar, { top: insets.top + space.sm }]}
    >
      <Text style={styles.text} numberOfLines={1}>
        Deleted “{item.label}”
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Undo delete"
        onPress={() => undoDeletion(item.id)}
        hitSlop={8}
      >
        <Text style={styles.undo}>Undo</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: space.md,
    right: space.md,
    zIndex: 10,
    elevation: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.forest,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: 12,
  },
  text: { flex: 1, marginRight: space.sm, color: colors.sand, fontSize: 15 },
  undo: { color: '#C4B5FD', fontSize: 15, fontWeight: '700' },
});
