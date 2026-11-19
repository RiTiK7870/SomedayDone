import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, type } from '../theme';
import { Button, Chip } from './ui';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const pad = (n: number) => String(n).padStart(2, '0');

// ---------- Pure helpers (exported so screens can reuse them) ----------

export function parseIsoDate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d ? dt : null;
}

export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function toHHMM(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatIsoDate(s: string): string {
  const d = parseIsoDate(s);
  if (!d) return '';
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
}

export function splitTime(hhmm: string) {
  const valid = /^\d{2}:\d{2}$/.test(hhmm);
  const [h, m] = valid ? hhmm.split(':').map(Number) : [8, 0];
  const period: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return { hour12, minute: m, period };
}

export function joinTime(hour12: number, minute: number, period: 'AM' | 'PM'): string {
  const base = hour12 % 12;
  const h24 = period === 'PM' ? base + 12 : base;
  return `${pad(h24)}:${pad(minute)}`;
}

export function formatTime12(hhmm: string): string {
  const { hour12, minute, period } = splitTime(hhmm);
  return `${hour12}:${pad(minute)} ${period}`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// Six full weeks, starting on the Sunday on or before the 1st of the month.
function monthGrid(cursor: Date): Date[] {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const startDay = 1 - first.getDay();
  return Array.from(
    { length: 42 },
    (_, i) => new Date(first.getFullYear(), first.getMonth(), startDay + i),
  );
}

// ---------- Date field: tap to open a calendar ----------

interface DateFieldProps {
  label: string;
  value: string; // YYYY-MM-DD or ''
  onChange: (iso: string) => void;
  minDate?: Date;
  optional?: boolean;
  placeholder?: string;
}

export function DateField({
  label,
  value,
  onChange,
  minDate,
  optional,
  placeholder = 'Pick a date',
}: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const selected = parseIsoDate(value);
  const [cursor, setCursor] = useState(() => {
    const base = selected ?? minDate ?? new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const days = useMemo(() => monthGrid(cursor), [cursor]);
  const today = startOfDay(new Date());
  const min = minDate ? startOfDay(minDate) : null;

  function toggle() {
    if (!open) {
      const base = selected ?? minDate ?? new Date();
      setCursor(new Date(base.getFullYear(), base.getMonth(), 1));
    }
    setOpen(!open);
  }

  function shiftMonth(delta: number) {
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));
  }

  return (
    <View style={{ gap: space.xs }}>
      <Text style={type.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ? formatIsoDate(value) : 'not set'}. Tap to change`}
        onPress={toggle}
        style={({ pressed }) => [
          styles.field,
          open && styles.fieldOpen,
          { opacity: pressed ? 0.9 : 1 },
        ]}
      >
        <Ionicons name="calendar-outline" size={20} color={colors.purple} />
        <Text
          style={[
            type.body,
            { flex: 1, color: value ? colors.forest : '#7D8C80' },
          ]}
        >
          {value ? formatIsoDate(value) : placeholder}
        </Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.muted}
        />
      </Pressable>

      {open ? (
        <View style={styles.panel}>
          <View style={styles.monthRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous month"
              onPress={() => shiftMonth(-1)}
              hitSlop={10}
            >
              <Ionicons name="chevron-back" size={22} color={colors.forest} />
            </Pressable>
            <Text style={type.title}>
              {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next month"
              onPress={() => shiftMonth(1)}
              hitSlop={10}
            >
              <Ionicons name="chevron-forward" size={22} color={colors.forest} />
            </Pressable>
          </View>

          <View style={styles.row}>
            {WEEKDAYS.map((w) => (
              <View key={w} style={styles.dayHeader}>
                <Text style={[type.small, { textAlign: 'center' }]}>{w}</Text>
              </View>
            ))}
          </View>

          <View style={styles.row}>
            {days.map((d) => {
              const iso = toIsoDate(d);
              const inMonth = d.getMonth() === cursor.getMonth();
              const isSelected = iso === value;
              const isToday = sameDay(d, today);
              const disabled = min ? d < min : false;
              return (
                <Pressable
                  key={iso}
                  accessibilityRole="button"
                  accessibilityLabel={formatIsoDate(iso)}
                  accessibilityState={{ selected: isSelected, disabled }}
                  disabled={disabled}
                  onPress={() => {
                    onChange(iso);
                    setOpen(false);
                  }}
                  style={styles.dayCell}
                >
                  <View
                    style={[
                      styles.dayCircle,
                      isSelected && styles.dayCircleSelected,
                      isToday && !isSelected && styles.dayCircleToday,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        !inMonth && { opacity: 0.35 },
                        disabled && { opacity: 0.3 },
                        isSelected && { color: colors.white, fontWeight: '700' },
                      ]}
                    >
                      {d.getDate()}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {optional && value ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                onChange('');
                setOpen(false);
              }}
              style={{ alignSelf: 'center', paddingVertical: 4 }}
            >
              <Text style={styles.clear}>Clear date</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

// ---------- Time field: tap to open hour / minute / AM-PM spinner ----------

interface TimeFieldProps {
  label: string;
  value: string; // HH:MM (24-hour)
  onChange: (hhmm: string) => void;
}

export function TimeField({ label, value, onChange }: TimeFieldProps) {
  const [open, setOpen] = useState(false);
  const { hour12, minute, period } = splitTime(value);

  function setHour(h: number) {
    onChange(joinTime(h, minute, period));
  }
  function setMinute(m: number) {
    onChange(joinTime(hour12, m, period));
  }
  function setPeriod(p: 'AM' | 'PM') {
    onChange(joinTime(hour12, minute, p));
  }

  const nextHour = hour12 === 12 ? 1 : hour12 + 1;
  const prevHour = hour12 === 1 ? 12 : hour12 - 1;
  const nextMinute = (Math.floor(minute / 5) * 5 + 5) % 60;
  const prevMinute = minute % 5 === 0 ? (minute - 5 + 60) % 60 : Math.floor(minute / 5) * 5;

  return (
    <View style={{ gap: space.xs }}>
      <Text style={type.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${formatTime12(value)}. Tap to change`}
        onPress={() => setOpen(!open)}
        style={({ pressed }) => [
          styles.field,
          open && styles.fieldOpen,
          { opacity: pressed ? 0.9 : 1 },
        ]}
      >
        <Ionicons name="time-outline" size={20} color={colors.purple} />
        <Text style={[type.body, { flex: 1 }]}>{formatTime12(value)}</Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.muted}
        />
      </Pressable>

      {open ? (
        <View style={styles.panel}>
          <View style={styles.timeRow}>
            <Spinner
              label="Hour"
              value={String(hour12)}
              onUp={() => setHour(nextHour)}
              onDown={() => setHour(prevHour)}
            />
            <Text style={styles.colon}>:</Text>
            <Spinner
              label="Minute"
              value={pad(minute)}
              onUp={() => setMinute(nextMinute)}
              onDown={() => setMinute(prevMinute)}
            />
            <View style={styles.periodCol}>
              <Chip label="AM" selected={period === 'AM'} onPress={() => setPeriod('AM')} />
              <Chip label="PM" selected={period === 'PM'} onPress={() => setPeriod('PM')} />
            </View>
          </View>
          <Button label="Done" variant="secondary" onPress={() => setOpen(false)} />
        </View>
      ) : null}
    </View>
  );
}

function Spinner({
  label,
  value,
  onUp,
  onDown,
}: {
  label: string;
  value: string;
  onUp: () => void;
  onDown: () => void;
}) {
  return (
    <View style={styles.spinner}>
      <Text style={type.small}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Increase ${label.toLowerCase()}`}
        onPress={onUp}
        hitSlop={8}
        style={styles.spinBtn}
      >
        <Ionicons name="chevron-up" size={22} color={colors.forest} />
      </Pressable>
      <Text style={styles.spinValue}>{value}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Decrease ${label.toLowerCase()}`}
        onPress={onDown}
        hitSlop={8}
        style={styles.spinBtn}
      >
        <Ionicons name="chevron-down" size={22} color={colors.forest} />
      </Pressable>
    </View>
  );
}

const CELL = '14.2857%';

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 52,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  fieldOpen: { borderColor: colors.purple },
  panel: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: space.md,
    gap: space.sm,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.xs,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  dayHeader: { width: CELL, paddingVertical: 4 },
  dayCell: { width: CELL, alignItems: 'center', paddingVertical: 2 },
  dayCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleSelected: { backgroundColor: colors.purple },
  dayCircleToday: { borderWidth: 1.5, borderColor: colors.purple },
  dayText: { fontSize: 15, color: colors.forest },
  clear: { color: colors.purple, fontWeight: '600', fontSize: 15 },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: space.xs,
  },
  colon: { fontSize: 28, fontWeight: '700', color: colors.forest, marginTop: 14 },
  spinner: { alignItems: 'center', gap: 4, minWidth: 84 },
  spinBtn: {
    width: 56,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinValue: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.forest,
    minWidth: 60,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  periodCol: { gap: space.xs, marginLeft: space.xs, marginTop: 14 },
});
