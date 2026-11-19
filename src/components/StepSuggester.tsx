import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Goal } from '../types';
import { addSteps } from '../lib/goals';
import { suggestSteps } from '../lib/suggestSteps';
import { userMessage } from '../lib/errors';
import { Button, Card, ErrorBanner } from './ui';
import { colors, radius, space, type } from '../theme';

// Lets the user generate steps for a goal, review and edit them, then add the ones they keep.
export function StepSuggester({ goal, onAdded }: { goal: Goal; onAdded: () => void }) {
  // null = no suggestions on screen yet. An array = the review list.
  const [drafts, setDrafts] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const keptCount = (drafts ?? []).filter((s) => s.trim()).length;

  async function suggest() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const steps = await suggestSteps({
        title: goal.title,
        description: goal.description ?? '',
        category: goal.category,
        // Ask for ideas that differ from steps already listed or on screen.
        existing: [
          ...goal.goal_steps.map((s) => s.title),
          ...(drafts ?? []),
        ],
      });
      setDrafts(steps);
    } catch (e) {
      setError(userMessage(e));
    } finally {
      setLoading(false);
    }
  }

  function editDraft(index: number, text: string) {
    setDrafts((d) => (d ? d.map((s, i) => (i === index ? text : s)) : d));
  }

  function removeDraft(index: number) {
    setDrafts((d) => (d ? d.filter((_, i) => i !== index) : d));
  }

  async function addAll() {
    if (saving || !drafts) return;
    const cleaned = drafts.map((s) => s.trim()).filter(Boolean);
    if (cleaned.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      await addSteps(goal, cleaned);
      setDrafts(null);
      onAdded();
    } catch (e) {
      setError(userMessage(e));
    } finally {
      setSaving(false);
    }
  }

  if (!drafts) {
    return (
      <Card style={{ gap: space.sm }}>
        <View style={styles.head}>
          <Ionicons name="sparkles" size={20} color={colors.purple} />
          <Text style={[type.title, { flex: 1 }]}>
            {goal.goal_steps.length === 0 ? 'Not sure where to start?' : 'Need more steps?'}
          </Text>
        </View>
        <Text style={type.small}>
          SomedayDone can suggest a simple plan. You review every step before anything is added.
        </Text>
        {error ? <ErrorBanner message={error} /> : null}
        <Button
          label={loading ? 'Thinking…' : 'Suggest steps'}
          variant="secondary"
          onPress={suggest}
          loading={loading}
        />
      </Card>
    );
  }

  return (
    <Card style={{ gap: space.sm }}>
      <View style={styles.head}>
        <Ionicons name="sparkles" size={20} color={colors.purple} />
        <Text style={[type.title, { flex: 1 }]}>Suggested steps</Text>
      </View>
      <Text style={type.small}>
        Edit anything you want to change, or remove what you don't need.
      </Text>

      {drafts.map((step, i) => (
        <View key={i} style={styles.row}>
          <Text style={styles.index}>{i + 1}</Text>
          <TextInput
            value={step}
            onChangeText={(t) => editDraft(i, t)}
            maxLength={200}
            multiline
            accessibilityLabel={`Suggested step ${i + 1}`}
            style={styles.input}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove suggested step ${i + 1}`}
            onPress={() => removeDraft(i)}
            hitSlop={8}
            style={{ paddingTop: 12 }}
          >
            <Ionicons name="close" size={20} color={colors.muted} />
          </Pressable>
        </View>
      ))}

      {drafts.length === 0 ? (
        <Text style={type.small}>Everything was removed. Suggest again, or discard.</Text>
      ) : null}

      {error ? <ErrorBanner message={error} /> : null}

      <Button
        label={keptCount === 1 ? 'Add 1 step' : `Add ${keptCount} steps`}
        onPress={addAll}
        loading={saving}
        disabled={keptCount === 0}
      />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button
          label="Suggest again"
          variant="ghost"
          onPress={suggest}
          disabled={loading}
          style={{ flex: 1 }}
        />
        <Button
          label="Discard"
          variant="ghost"
          onPress={() => setDrafts(null)}
          style={{ flex: 1 }}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  index: {
    width: 22,
    paddingTop: 12,
    textAlign: 'center',
    fontWeight: '700',
    color: colors.muted,
  },
  input: {
    flex: 1,
    minHeight: 44,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.forest,
  },
});
