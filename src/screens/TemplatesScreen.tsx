import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { useAuth } from '../context/AuthContext';
import { addSteps, createGoal } from '../lib/goals';
import { userMessage } from '../lib/errors';
import { TEMPLATES, type GoalTemplate } from '../lib/templates';
import { Button, Card, ErrorBanner } from '../components/ui';
import { colors, radius, space, type } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function TemplatesScreen() {
  const navigation = useNavigation<Nav>();
  const { session } = useAuth();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function use(template: GoalTemplate) {
    if (busyId) return;
    const userId = session?.user.id;
    if (!userId) {
      setError('Please sign in again.');
      return;
    }
    setBusyId(template.id);
    setError(null);
    try {
      const goal = await createGoal(userId, {
        title: template.title,
        description: template.description,
        category: template.category,
        targetDate: '',
      });
      await addSteps(goal, template.steps);
      // Replace the stack so Back goes to Home, not to the blank form.
      navigation.reset({
        index: 1,
        routes: [{ name: 'Tabs' }, { name: 'GoalDetail', params: { goalId: goal.id } }],
      });
    } catch (e) {
      setError(userMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={type.small}>
          Pick a plan and we add the goal and its steps. You can change anything afterwards.
        </Text>

        {error ? <ErrorBanner message={error} /> : null}

        {TEMPLATES.map((t) => {
          const isBusy = busyId === t.id;
          const preview = t.steps.slice(0, 3).map((s, i) => `${i + 1}. ${s}`).join('\n');
          const more = t.steps.length - 3;
          return (
            <Card key={t.id} style={{ gap: space.sm }}>
              <View style={styles.pill}>
                <Text style={styles.pillText}>{t.category}</Text>
              </View>
              <Text style={type.title}>{t.title}</Text>
              <Text style={type.small}>{t.description}</Text>
              <Text style={styles.preview}>
                {preview}
                {more > 0 ? `\n…and ${more} more` : ''}
              </Text>
              <Button
                label={isBusy ? 'Creating…' : 'Use this plan'}
                onPress={() => use(t)}
                loading={isBusy}
                disabled={!!busyId && !isBusy}
              />
            </Card>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  content: { padding: space.md, gap: space.md, paddingBottom: space.xl },
  pill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.purpleSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillText: { fontSize: 12, fontWeight: '700', color: colors.forest },
  preview: { fontSize: 14, lineHeight: 20, color: colors.forest },
});
