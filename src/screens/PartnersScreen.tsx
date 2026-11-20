import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { hasNotificationPermission, requestNotificationPermission } from '../lib/reminders';
import { registerPushIfAllowed } from '../lib/push';
import { useAuth } from '../context/AuthContext';
import {
  acceptInvite,
  declineInvite,
  listIncomingInvites,
  listNudgesForMe,
  listSupportedGoals,
  markNudgesSeen,
  sendNudge,
  type IncomingInvite,
  type NudgeItem,
  type SupportedGoal,
  listOwnedPartners,
  partnerErrorMessage,
  type OwnedPartnerRow,
} from '../lib/partners';

import { Button, Card, ErrorBanner, ProgressBar } from '../components/ui';
import { colors, space, type } from '../theme';

export function PartnersScreen() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const email = session?.user.email ?? '';
  const [invites, setInvites] = useState<IncomingInvite[]>([]);
  const [supported, setSupported] = useState<SupportedGoal[]>([]);
  const [nudges, setNudges] = useState<NudgeItem[]>([]);
  const [owned, setOwned] = useState<OwnedPartnerRow[]>([]);
  const [pushOn, setPushOn] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const [i, s, n, o] = await Promise.all([
        listIncomingInvites(email),
        listSupportedGoals(userId),
        listNudgesForMe(userId),
        listOwnedPartners(userId),
      ]);
      setInvites(i);
      setSupported(s);
      setNudges(n);
      setOwned(o);
      hasNotificationPermission().then(setPushOn).catch(() => undefined);
      setError(null);
      // Show new nudges once, then mark them read.
      if (n.length > 0) await markNudgesSeen(userId);
    } catch (e) {
      setError(partnerErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [userId, email]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function run(id: string, action: () => Promise<void>, done: string) {
    if (busyId) return;
    setBusyId(id);
    setError(null);
    setNote(null);
    try {
      await action();
      setNote(done);
      await load();
    } catch (e) {
      setError(partnerErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  async function enablePush() {
    const granted = await requestNotificationPermission();
    if (granted) {
      await registerPushIfAllowed().catch(() => undefined);
      setPushOn(true);
    }
  }

  const nothingYet =
    !loading && invites.length === 0 && supported.length === 0 && nudges.length === 0 && owned.length === 0;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={type.small}>
          Partners can follow a goal and send nudges. They see progress, never your private notes.
        </Text>

        {error ? <ErrorBanner message={error} onRetry={load} /> : null}
        {note ? <Text style={type.small}>{note}</Text> : null}

        {!pushOn ? (
          <Card style={{ gap: space.sm }}>
            <Text style={type.title}>Get nudges on your phone</Text>
            <Text style={type.small}>
              Turn on notifications so you hear right away when a partner nudges you.
            </Text>
            <Button label="Turn on notifications" variant="secondary" onPress={enablePush} />
          </Card>
        ) : null}

        {invites.length > 0 ? (
          <Section title="Invites for you">
            {invites.map((inv) => (
              <Card key={inv.id} style={{ gap: space.sm }}>
                <Text style={type.title}>{inv.goals?.title ?? 'A goal'}</Text>
                <Text style={type.small}>Would like you to follow this goal.</Text>
                <View style={styles.row}>
                  <Button
                    label="Accept"
                    loading={busyId === inv.id}
                    onPress={() =>
                      run(inv.id, () => acceptInvite(inv.id), 'You are now following this goal.')
                    }
                    style={{ flex: 1 }}
                  />
                  <Button
                    label="Decline"
                    variant="ghost"
                    onPress={() => run(inv.id, () => declineInvite(inv.id), 'Invite declined.')}
                    style={{ flex: 1 }}
                  />
                </View>
              </Card>
            ))}
          </Section>
        ) : null}

        {supported.length > 0 ? (
          <Section title="Goals you're supporting">
            {supported.map((s) => {
              const steps = s.goals?.goal_steps ?? [];
              const done = steps.filter((x) => x.is_completed).length;
              const percent = steps.length ? Math.round((done / steps.length) * 100) : 0;
              return (
                <Card key={s.id} style={{ gap: space.sm }}>
                  <Text style={type.title}>{s.goals?.title ?? 'A goal'}</Text>
                  <Text style={type.small}>
                    {s.goals?.category} · {done} of {steps.length} steps
                  </Text>
                  <ProgressBar percent={percent} />
                  <Button
                    label="Send a nudge"
                    variant="secondary"
                    loading={busyId === s.id}
                    onPress={() => {
                      if (!userId) return;
                      run(s.id, () => sendNudge(s.goal_id, userId, s.owner_id), 'Nudge sent.');
                    }}
                  />
                </Card>
              );
            })}
          </Section>
        ) : null}

        {owned.length > 0 ? (
          <Section title="Partners on your goals">
            {owned.map((o) => (
              <Card key={o.id} style={{ gap: 2 }}>
                <Text style={type.title}>{o.goal_title}</Text>
                <Text style={type.small}>
                  {o.invite_email} · {o.status === 'accepted' ? 'Following this goal' : 'Invite pending'}
                </Text>
              </Card>
            ))}
          </Section>
        ) : null}

        {nudges.length > 0 ? (
          <Section title="New nudges">
            {nudges.map((n) => (
              <Card key={n.id}>
                <Text style={type.body}>
                  Someone nudged you about {n.goals?.title ?? 'a goal'}.
                </Text>
              </Card>
            ))}
          </Section>
        ) : null}

        {nothingYet ? (
          <Card>
            <Text style={type.title}>No partner activity yet</Text>
            <Text style={type.small}>
              Open any goal and use Accountability partners to invite a friend.
            </Text>
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <Text style={type.title}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  content: { padding: space.md, gap: space.lg, paddingBottom: space.xl },
  row: { flexDirection: 'row', gap: space.sm },
});
