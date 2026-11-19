import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { WeekBucket } from '../lib/history';
import { colors, type } from '../theme';

const BAR_MAX_HEIGHT = 90;

// Simple bar chart built from Views, so it needs no chart library.
export function WeeklyChart({ buckets }: { buckets: WeekBucket[] }) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const total = buckets.reduce((n, b) => n + b.count, 0);

  return (
    <View
      accessible
      accessibilityLabel={`Steps done per week, ${total} in the last ${buckets.length} weeks`}
      style={styles.chart}
    >
      {buckets.map((b) => {
        const height =
          b.count === 0 ? 4 : Math.max(10, Math.round((b.count / max) * BAR_MAX_HEIGHT));
        return (
          <View key={b.label} style={styles.column}>
            <Text style={styles.count}>{b.count > 0 ? b.count : ''}</Text>
            <View
              style={[
                styles.bar,
                {
                  height,
                  backgroundColor: b.isCurrent ? colors.purple : colors.line,
                },
              ]}
            />
            <Text style={styles.label} numberOfLines={1}>
              {b.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    paddingTop: 4,
  },
  column: { flex: 1, alignItems: 'center', gap: 4 },
  count: { ...type.small, fontSize: 12, height: 16, color: colors.forest, fontWeight: '700' },
  bar: { width: '100%', borderRadius: 6 },
  label: { fontSize: 10, color: colors.muted },
});
