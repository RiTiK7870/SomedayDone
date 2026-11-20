import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { getGoal, setStepDone } from '../lib/goals';
import { userMessage } from '../lib/errors';
import type { Goal } from '../types';
import { Button, Chip, ErrorBanner } from '../components/ui';
import { colors, space, type } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const PRESETS = [15, 25, 50];

function format(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// A focus timer for one step. The end time is stored, so the countdown stays accurate in the background.
export function FocusScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, 'Focus'>>();
  const { goalId, stepId } = route.params;

  const [goal, setGoal] = useState<Goal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [minutes, setMinutes] = useState(25);
  const [remaining, setRemaining] = useState(25 * 60_000);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [busy, setBusy] = useState(false);
  const endAt = useRef<number | null>(null);

  useEffect(() => {
    getGoal(goalId)
      .then(setGoal)
      .catch((e) => setError(userMessage(e)));
  }, [goalId]);

  const step = goal?.goal_steps.find((s) => s.id === stepId) ?? null;
  const fullLength = minutes * 60_000;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      if (endAt.current === null) return;
      const left = endAt.current - Date.now();
      if (left <= 0) {
        endAt.current = null;
        setRemaining(0);
        setRunning(false);
        setFinished(true);
      } else {
        setRemaining(left);
      }
    }, 250);
    return () => clearInterval(id);
  }, [running]);

  function choose(m: number) {
    if (running) return;
    setMinutes(m);
    setRemaining(m * 60_000);
    setFinished(false);
  }

  function start() {
    if (remaining <= 0) return;
    endAt.current = Date.now() + remaining;
    setFinished(false);
    setRunning(true);
  }

  function restart() {
    endAt.current = Date.now() + fullLength;
    setRemaining(fullLength);
    setFinished(false);
    setRunning(true);
  }

  function pause() {
    if (endAt.current !== null) setRemaining(Math.max(0, endAt.current - Date.now()));
    endAt.current = null;
    setRunning(false);
  }

  function reset() {
    endAt.current = null;
    setRunning(false);
    setFinished(false);
    setRemaining(fullLength);
  }

  async function markDone() {
    if (!goal || !step || busy) return;
    setBusy(true);
    try {
      await setStepDone(goal, step, true);
      navigation.goBack();
    } catch (e) {
      setError(userMessage(e));
      setBusy(false);
    }
  }

  if (error && !goal) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={{ padding: space.md }}>
          <ErrorBanner message={error} />
        </View>
      </SafeAreaView>
    );
  }

  const atFullLength = remaining >= fullLength;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.wrap}>
        <Text style={styles.kicker}>Focus on</Text>
        <Text style={[type.title, styles.center]}>
          {step ? step.title : 'This step is no longer available'}
        </Text>
        {goal ? <Text style={[type.small, styles.center]}>{goal.title}</Text> : null}

        <Text
          style={[styles.clock, finished && { color: colors.purple }]}
          accessibilityLiveRegion="polite"
        >
          {finished ? 'Time’s up' : format(remaining)}
        </Text>

        {!running && !finished ? (
          <View style={styles.row}>
            {PRESETS.map((m) => (
              <Chip
                key={m}
                label={`${m} min`}
                selected={minutes === m}
                onPress={() => choose(m)}
              />
            ))}
          </View>
        ) : null}

        <View style={styles.controls}>
          {finished ? (
            <>
              {step && !step.is_completed ? (
                <Button label="Mark step done" onPress={markDone} loading={busy} />
              ) : null}
              <Button label="Another round" variant="secondary" onPress={restart} />
            </>
          ) : running ? (
            <Button label="Pause" variant="secondary" onPress={pause} />
          ) : (
            <Button
              label={atFullLength ? 'Start' : 'Resume'}
              onPress={start}
              disabled={!step}
            />
          )}
          {!running && !finished && !atFullLength ? (
            <Button label="Reset" variant="ghost" onPress={reset} />
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.lg, gap: space.md },
  kicker: { fontSize: 13, color: colors.muted, textTransform: 'uppercase', letterSpacing: 1 },
  center: { textAlign: 'center' },
  clock: {
    fontSize: 72,
    fontWeight: '700',
    color: colors.forest,
    fontVariant: ['tabular-nums'],
    marginVertical: space.md,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.sm },
  controls: { width: '100%', gap: space.sm, marginTop: space.md },
});
