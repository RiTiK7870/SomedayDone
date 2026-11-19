import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { useAuth } from '../context/AuthContext';
import { createGoal, getGoal, updateGoal } from '../lib/goals';
import { userMessage } from '../lib/errors';
import { validateGoal } from '../lib/validate';
import { CATEGORIES } from '../types';
import type { Category } from '../types';
import { Button, Chip, ErrorBanner, Field } from '../components/ui';
import { DateField } from '../components/DateTimePicker';
import { colors, space, type } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function GoalFormScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, 'GoalForm'>>();
  const goalId = route.params?.goalId;
  const { session } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category>('Personal Growth');
  const [targetDate, setTargetDate] = useState('');
  const [loading, setLoading] = useState(!!goalId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!goalId) return;
    getGoal(goalId)
      .then((g) => {
        setTitle(g.title);
        setDescription(g.description ?? '');
        setCategory(g.category);
        setTargetDate(g.target_date ?? '');
      })
      .catch((e) => setError(userMessage(e)))
      .finally(() => setLoading(false));
  }, [goalId]);

  async function save() {
    if (saving) return;
    const problem = validateGoal({ title, description, targetDate });
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const input = { title, description, category, targetDate: targetDate.trim() };
      if (goalId) {
        await updateGoal(goalId, input);
      } else {
        const userId = session?.user.id;
        if (!userId) throw new Error('Not signed in');
        const created = await createGoal(userId, input);
        // Open the new goal so the user can add their first step right away.
        navigation.replace('GoalDetail', { goalId: created.id });
        return;
      }
      navigation.goBack();
    } catch (e) {
      setError(userMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={type.title}>{goalId ? 'Edit goal' : 'What would you like to do someday?'}</Text>

        {error ? <ErrorBanner message={error} /> : null}

        {!goalId ? (
          <Button
            label="Start from a template"
            variant="ghost"
            onPress={() => navigation.navigate('Templates')}
          />
        ) : null}

        <Field
          label="Title"
          value={title}
          onChangeText={setTitle}
          placeholder="Learn to cook five dishes"
          maxLength={120}
          editable={!loading}
        />
        <Field
          label="Description (optional)"
          value={description}
          onChangeText={setDescription}
          placeholder="Why it matters to you"
          multiline
          maxLength={1000}
          editable={!loading}
        />

        <View style={{ gap: space.xs }}>
          <Text style={type.label}>Category</Text>
          <View style={styles.chips}>
            {CATEGORIES.map((c) => (
              <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} />
            ))}
          </View>
        </View>

        <DateField
          label="Target date (optional)"
          value={targetDate}
          onChange={setTargetDate}
          optional
          placeholder="Pick a target date"
        />

        <Button label={goalId ? 'Save changes' : 'Create goal'} onPress={save} loading={saving} disabled={loading} />
        <Button label="Cancel" variant="ghost" onPress={() => navigation.goBack()} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.sand },
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xl },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
});
