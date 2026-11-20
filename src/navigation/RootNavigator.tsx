import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer, DefaultTheme, NavigatorScreenParams } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme';
import { LoginScreen } from '../screens/LoginScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { GoalsScreen } from '../screens/GoalsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { GoalDetailScreen } from '../screens/GoalDetailScreen';
import { GoalFormScreen } from '../screens/GoalFormScreen';
import { TemplatesScreen } from '../screens/TemplatesScreen';
import { PartnersScreen } from '../screens/PartnersScreen';
import { FocusScreen } from '../screens/FocusScreen';

export type TabParamList = {
  Home: undefined;
  Goals: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  GoalDetail: { goalId: string };
  GoalForm: { goalId?: string } | undefined;
  Templates: undefined;
  Partners: undefined;
  Focus: { goalId: string; stepId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.purple,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.line },
        tabBarIcon: ({ color, size, focused }) => {
          const name = {
            Home: focused ? 'home' : 'home-outline',
            Goals: focused ? 'list' : 'list-outline',
            Profile: focused ? 'person' : 'person-outline',
          }[route.name as keyof TabParamList] as React.ComponentProps<typeof Ionicons>['name'];
          return <Ionicons name={name} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Goals" component={GoalsScreen} options={{ title: 'My Goals' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.sand,
    card: colors.card,
    primary: colors.purple,
    text: colors.forest,
    border: colors.line,
  },
};

export function RootNavigator() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.sand }}>
        <ActivityIndicator color={colors.purple} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          headerTintColor: colors.forest,
          headerStyle: { backgroundColor: colors.sand },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.sand },
        }}
      >
        {session ? (
          <>
            <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
            <Stack.Screen name="GoalDetail" component={GoalDetailScreen} options={{ title: 'Goal' }} />
            <Stack.Screen
              name="GoalForm"
              component={GoalFormScreen}
              options={{ presentation: 'modal', title: 'Goal' }}
            />
            <Stack.Screen name="Templates" component={TemplatesScreen} options={{ title: 'Start from a template' }} />
            <Stack.Screen name="Partners" component={PartnersScreen} options={{ title: 'Accountability partners' }} />
            <Stack.Screen name="Focus" component={FocusScreen} options={{ title: 'Focus' }} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
