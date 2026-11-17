import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Goal } from '../types';
import { STATUS_LABEL } from '../types';
import { progressFor } from '../lib/goals';
import { colors, radius, space, type } from '../theme';
import { ProgressBar } from './ui';

export function GoalCard({ goal, onPress }: { goal: Goal; onPress: () => void }) {
  const p = progressFor(goal);
  const progressText =
    p.percent === null ? 'Add steps to track progress' : `${p.done} of ${p.total} steps · ${p.percent}%`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${goal.title}, ${STATUS_LABEL[goal.status]}, ${progressText}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, { opacity: pressed ? 0.9 : 1 }]}
    >
      <View style={styles.header}>
        <Text style={[type.title, { flex: 1 }]} numberOfLines={2}>{goal.title}</Text>
        <View style={styles.statusPill}>
          <Text style={styles.statusText}>{STATUS_LABEL[goal.status]}</Text>
        </View>
      </View>
      <Text style={type.small}>{goal.category}</Text>
      {p.percent !== null ? <ProgressBar percent={p.percent} /> : null}
      <Text style={[type.small, { color: colors.forest }]}>{progressText}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: space.md,
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.line,
    shadowColor: colors.forest,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  statusPill: {
    backgroundColor: colors.purpleSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: { fontSize: 12, fontWeight: '700', color: colors.forest },
});
