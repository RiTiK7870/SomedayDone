import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('Missing Supabase config. Copy .env.example to .env and fill in your values.');
}

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: AsyncStorage,       // session survives app restarts
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,   // we handle the OAuth callback ourselves
    flowType: 'pkce',            // authorization-code flow with PKCE, never implicit
  },
});
