import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Share, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { useAuth } from '../context/AuthContext';
import { userMessage } from '../lib/errors';
import { missingPublicPageSetting, getPublicPage, publicPageUrl, savePublicPage, validateSlug } from '../lib/publicPage';
import { isRecapOn, setRecapOn } from '../lib/recap';
import { computeBadges, syncBadges } from '../lib/badges';
import { longestStreak } from '../lib/streaks';
import type { Goal } from '../types';
import { Button, Card, ErrorBanner, Field } from './ui';
import { colors, radius, space, type } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Everything below the progress chart on the Profile screen.
export function ProfileExtras({ goals }: { goals: Goal[] }) {
  return (
    <View style={{ gap: space.md }}>
      <BadgesCard goals={goals} />
      <PublicPageCard />
      <RecapCard />
      <PartnersLink />
    </View>
  );
}

function BadgesCard({ goals }: { goals: Goal[] }) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [earned, setEarned] = useState<Set<string>>(new Set());

  const badges = useMemo(() => computeBadges(goals, longestStreak(goals)), [goals]);

  // The server awards badges from the real data and returns everything earned so far.
  useEffect(() => {
    if (!userId) return;
    syncBadges()
      .then((ids) => setEarned(new Set(ids)))
      .catch(() => undefined);
  }, [userId, goals]);

  const shown = badges.map((b) => ({ ...b, unlocked: b.unlocked || earned.has(b.id) }));
  const unlocked = shown.filter((b) => b.unlocked).length;

  return (
    <Card style={{ gap: space.sm }}>
      <Text style={type.title}>Badges</Text>
      <Text style={type.small}>
        {unlocked} of {shown.length} unlocked
      </Text>
      <View style={styles.grid}>
        {shown.map((b) => (
          <View
            key={b.id}
            accessible
            accessibilityLabel={`${b.title}, ${b.unlocked ? 'unlocked' : 'locked'}. ${b.description}`}
            style={[styles.badge, !b.unlocked && styles.badgeLocked]}
          >
            <Ionicons
              name={b.icon}
              size={22}
              color={b.unlocked ? colors.purple : colors.muted}
            />
            <Text style={[type.label, { color: b.unlocked ? colors.forest : colors.muted }]}>
              {b.title}
            </Text>
            <Text style={type.small}>{b.description}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

function PublicPageCard() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [slug, setSlug] = useState('');
  const [mode, setMode] = useState<'private' | 'public'>('private');
  const [saved, setSaved] = useState<{ slug: string | null; isPublic: boolean }>({
    slug: null,
    isPublic: false,
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    getPublicPage(userId)
      .then((p) => {
        setSlug(p.slug ?? '');
        setMode(p.isPublic ? 'public' : 'private');
        setSaved({ slug: p.slug, isPublic: p.isPublic });
      })
      .catch((e) => setError(userMessage(e)))
      .finally(() => setLoading(false));
  }, [userId]);

  const url = saved.isPublic && saved.slug ? publicPageUrl(saved.slug) : null;
  const choosingPublic = mode === 'public';

  // The confirmation shows for 5 seconds after saving, then goes away.
  useEffect(() => {
    if (!note) return;
    const timer = setTimeout(() => setNote(null), 5000);
    return () => clearTimeout(timer);
  }, [note]);

  async function save() {
    if (!userId || busy) return;
    const clean = slug.trim().toLowerCase();
    if (choosingPublic) {
      const problem = validateSlug(clean);
      if (problem) {
        setError(problem);
        return;
      }
    }
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const keepSlug = clean || null;
      await savePublicPage(userId, keepSlug, choosingPublic);
      setSaved({ slug: keepSlug, isPublic: choosingPublic });
      setNote(
        choosingPublic
          ? 'Saved. Your page is public. Share the link below.'
          : 'Saved. Your page is private. Nobody can see it.',
      );
    } catch (e) {
      setError(userMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function shareLink() {
    if (!url) return;
    await Share.share({ message: `See my someday dreams: ${url}` }).catch(() => undefined);
  }

  return (
    <Card style={{ gap: space.sm }}>
      <Text style={type.title}>Public dream page</Text>
      <Text style={type.small}>
        A shareable page with your dreams and progress. Descriptions and steps stay private.
      </Text>

      <View style={styles.pdChoice}>
        {(['private', 'public'] as const).map((opt) => {
          const selected = mode === opt;
          return (
            <Pressable
              key={opt}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled: loading }}
              onPress={() => setMode(opt)}
              disabled={loading}
              style={[styles.pdChoiceBtn, selected && styles.pdChoiceOn]}
            >
              <Ionicons
                name={opt === 'private' ? 'lock-closed-outline' : 'globe-outline'}
                size={18}
                color={selected ? colors.white : colors.forest}
              />
              <Text style={[type.label, { color: selected ? colors.white : colors.forest }]}>
                {opt === 'private' ? 'Private' : 'Public'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {choosingPublic ? (
        <Field
          label="Page name"
          value={slug}
          onChangeText={setSlug}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="your-name"
          maxLength={30}
        />
      ) : null}

      {error ? <ErrorBanner message={error} /> : null}
      {note ? <Text style={type.small}>{note}</Text> : null}
      <Button label="Save" onPress={save} loading={busy} disabled={loading} />

      {saved.isPublic && saved.slug && !url ? (
        <Text style={type.small}>
          {`Your link isn't ready yet. Add ${missingPublicPageSetting() ?? 'the setting'} to .env, then run npx expo start -c and reload the app.`}
        </Text>
      ) : null}

      {url ? (
        <View style={{ gap: space.xs }}>
          <Text style={type.label}>Your public link</Text>
          <Text selectable style={styles.pdLink}>{url}</Text>
          <Button label="Share link" variant="secondary" onPress={shareLink} />
        </View>
      ) : null}
    </Card>
  );
}

function RecapCard() {
  const [on, setOn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    isRecapOn()
      .then(setOn)
      .catch(() => setOn(false))
      .finally(() => setLoading(false));
  }, []);

  async function toggle(value: boolean) {
    setError(null);
    try {
      const result = await setRecapOn(value);
      setOn(result);
      if (value && !result) {
        setError('Turn on notifications in your phone settings to get the weekly recap.');
      }
    } catch (e) {
      setError(userMessage(e));
    }
  }

  return (
    <Card style={{ gap: space.sm }}>
      <Text style={type.title}>Weekly recap</Text>
      <View style={styles.row}>
        <Text style={[type.label, { flex: 1 }]}>Remind me on Sunday evenings</Text>
        <Switch
          value={on}
          onValueChange={toggle}
          disabled={loading}
          trackColor={{ false: colors.line, true: colors.purple }}
          thumbColor={colors.white}
        />
      </View>
      <Text style={type.small}>A reminder at 6 pm each Sunday to look back at your week.</Text>
      {error ? <ErrorBanner message={error} /> : null}
    </Card>
  );
}

function PartnersLink() {
  const navigation = useNavigation<Nav>();
  return (
    <Card style={{ gap: space.sm }}>
      <Text style={type.title}>Accountability partners</Text>
      <Text style={type.small}>
        Invite a friend to follow a goal, send nudges, and see who is backing you.
      </Text>
      <Button
        label="Open partners"
        variant="secondary"
        onPress={() => navigation.navigate('Partners')}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  pdChoice: { flexDirection: 'row', gap: space.sm },
  pdChoiceBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 12,
  },
  pdChoiceOn: { backgroundColor: colors.forest, borderColor: colors.forest },
  pdLink: {
    fontSize: 14,
    color: colors.purple,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: space.sm,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  badge: {
    width: '47%',
    gap: 4,
    padding: space.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  badgeLocked: { opacity: 0.6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
