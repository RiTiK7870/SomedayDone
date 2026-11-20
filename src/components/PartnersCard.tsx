import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import type { Goal } from '../types';
import {
  invitePartner,
  listPartnersForGoal,
  removePartner,
  sendNudge,
  type GoalPartner,
  partnerErrorMessage,
} from '../lib/partners';

import { Button, Card, ErrorBanner, Field } from './ui';
import { colors, radius, space, type } from '../theme';

const COLLAPSED_COUNT = 2;

// Lets the goal's owner invite partners, see their status, and send nudges.
// Shows a short list with "Show all" so many partners stay tidy.
export function PartnersCard({ goal }: { goal: Goal }) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [rows, setRows] = useState<GoalPartner[]>([]);
  const [email, setEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await listPartnersForGoal(goal.id));
    } catch (e) {
      setError(partnerErrorMessage(e));
    }
  }, [goal.id]);

  useEffect(() => {
    load();
  }, [load]);

  // Confirmations show for 5 seconds, then go away.
  useEffect(() => {
    if (!note) return;
    const timer = setTimeout(() => setNote(null), 5000);
    return () => clearTimeout(timer);
  }, [note]);

  async function invite() {
    if (!userId || busy) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      await invitePartner(goal.id, userId, email);
      setEmail('');
      setAdding(false);
      setNote('Invite saved. They will see it when they sign in with that email.');
      await load();
    } catch (e) {
      setError(partnerErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function nudge(row: GoalPartner) {
    if (!userId || !row.partner_id) return;
    setError(null);
    setNote(null);
    try {
      await sendNudge(goal.id, userId, row.partner_id);
      setNote('Nudge sent.');
    } catch (e) {
      setError(partnerErrorMessage(e));
    }
  }

  async function remove(row: GoalPartner) {
    setError(null);
    try {
      await removePartner(row.id);
      await load();
    } catch (e) {
      setError(partnerErrorMessage(e));
    }
  }

  const visible = showAll ? rows : rows.slice(0, COLLAPSED_COUNT);

  return (
    <Card style={{ gap: space.sm }}>
      <View style={styles.head}>
        <Text style={[type.title, { flex: 1 }]}>Accountability partners</Text>
        <Text style={type.small}>
          {rows.length} {rows.length === 1 ? 'partner' : 'partners'}
        </Text>
      </View>

      {rows.length === 0 ? (
        <Text style={type.small}>No partners yet. Invite a friend to follow this goal.</Text>
      ) : null}

      {visible.map((row) => (
        <View key={row.id} style={styles.row}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={type.label} numberOfLines={1} ellipsizeMode="middle">
              {row.invite_email}
            </Text>
            <Text style={type.small}>
              {row.status === 'accepted' ? 'Following' : 'Invite pending'}
            </Text>
          </View>
          {row.status === 'accepted' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Nudge ${row.invite_email}`}
              onPress={() => nudge(row)}
              style={styles.nudge}
            >
              <Text style={styles.nudgeText}>Nudge</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${row.invite_email}`}
            onPress={() => remove(row)}
            hitSlop={8}
          >
            <Ionicons name="close" size={20} color={colors.muted} />
          </Pressable>
        </View>
      ))}

      {rows.length > COLLAPSED_COUNT ? (
        <Pressable accessibilityRole="button" onPress={() => setShowAll((v) => !v)} hitSlop={6}>
          <Text style={styles.more}>{showAll ? 'Show less' : `Show all ${rows.length}`}</Text>
        </Pressable>
      ) : null}

      {error ? <ErrorBanner message={error} /> : null}
      {note ? <Text style={type.small}>{note}</Text> : null}

      {adding ? (
        <View style={{ gap: space.sm }}>
          <Field
            label="Friend's email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="friend@example.com"
            maxLength={254}
          />
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button
              label="Send invite"
              onPress={invite}
              loading={busy}
              disabled={!email.trim()}
              style={{ flex: 1 }}
            />
            <Button
              label="Cancel"
              variant="ghost"
              onPress={() => {
                setAdding(false);
                setEmail('');
              }}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      ) : (
        <Button label="Invite a friend" variant="secondary" onPress={() => setAdding(true)} />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: space.sm,
  },
  nudge: {
    backgroundColor: colors.forest,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  nudgeText: { color: colors.sand, fontWeight: '700', fontSize: 13 },
  more: { color: colors.purple, fontWeight: '600', fontSize: 14 },
});
