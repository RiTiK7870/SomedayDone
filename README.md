# SomedayDone

Turn your someday dreams into things you actually accomplish.

Android app built with Expo SDK 58 (React Native 0.88), React Native, TypeScript, and Supabase (Google sign-in, Postgres, Row Level Security).

Palette: Forest Green `#1F3D2B`, Sand Beige `#E8DCC4`, Electric Purple `#8B5CF6`.

---

## What's included

- Google sign-in only (Supabase Auth, PKCE, scopes: openid, email, profile)
- Goals: create, edit, archive, restore, delete (with confirmation)
- Categories, status, optional target date, search, and filters
- Steps: add, complete, reopen, reorder, remove
- Progress: completed ÷ total steps, with a prompt when a goal has no steps
- Prompt to mark a goal complete when every step is done (never automatic)
- Reminders: one-time or daily, pause/resume, explained permission request, friendly message if denied
- Totals on Home and Profile
- In-app account deletion (server-side) plus a web deletion link setting
- Row Level Security on every table (policies in the migration; manual cross-user check in Part 8)
- Light theme; loading, empty, and error states on every screen

Not included (per PRD v1.4): payments, premium, templates, achievements screen, iOS.

---

## Part 1: Prerequisites

1. **Node.js 22.13 or newer (or 24.3+).** SDK 58 requires this. Check with `node -v`.
2. **Android Studio** (for emulator or building locally), *or* a physical Android phone with USB debugging on.
3. **Supabase account** at https://supabase.com and the Supabase CLI (`npm i -g supabase`).
4. **Google Cloud account** at https://console.cloud.google.com.
5. **Expo account** (optional, only if you build with EAS).
6. **Expo Go app, SDK 58** (optional, for screen previews only; see Part 7, Option C).

---

## Part 2: Install the app

```bash
cd SomedayDone
npm install
npx expo install --fix      # aligns every package with Expo SDK 58
npm run typecheck           # should finish with no errors
npm test                    # unit tests for progress and validation
```

If `npm run typecheck` reports version mismatches, run `npx expo install --fix` again, then retry.

---

## Part 3: Supabase setup

1. Go to supabase.com, click **New project**. Save the database password somewhere safe.
2. Open **SQL Editor**, paste the entire contents of `supabase/migrations/001_init.sql`, and click **Run**. This creates the tables, indexes, RLS policies, and the profile trigger.
3. Open **Authentication → Providers → Google** and turn it on. You will paste the Google client ID and secret here in step 5 below.
4. Open **Authentication → URL Configuration**:
   - Under **Redirect URLs**, add: `somedaydone://auth-callback`
   - Save.
5. Copy your **Project URL** and **anon (publishable) key** from **Project Settings → API**. You will need them for `.env`.

---

## Part 4: Google Cloud setup

1. In Google Cloud Console, create a project (for example, "SomedayDone").
2. **APIs & Services → OAuth consent screen**:
   - User type: **External**
   - App name: SomedayDone
   - Support email: your email
   - App logo (optional)
   - Privacy policy URL and Terms URL (required before other users sign in)
   - Scopes: `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`. Do not add Gmail or Drive.
   - While testing, add your own Google account under **Test users**.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**
   - Authorized redirect URI: the **Supabase callback URL**, which looks like
     `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
   - Create it. Copy the **Client ID** and **Client secret**.
4. Go back to Supabase **Authentication → Providers → Google**, paste the Client ID and Client secret, and save.

Google client secrets stay in Supabase only. They never go in the app or the repository.

---

## Part 5: Configure the app

```bash
cp .env.example .env
```

Edit `.env`:

```
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-publishable-anon-key
EXPO_PUBLIC_PRIVACY_URL=https://yourdomain.com/privacy
EXPO_PUBLIC_TERMS_URL=https://yourdomain.com/terms
EXPO_PUBLIC_DELETE_URL=https://yourdomain.com/delete-account
EXPO_PUBLIC_SUPPORT_EMAIL=support@yourdomain.com
```

Only the anon key goes in the app. Never put the **service_role** key in `.env`.

Also set `android.package` in `app.json` to your own unique name (for example, `com.yourname.somedaydone`). Once you upload to Google Play, this cannot change.

---

## Part 6: Deploy the account deletion function

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy delete-account
```

Supabase provides the function's service-role key automatically. Nothing secret goes in the app.

---

## Part 7: Run the app on Android

**Option A: Local build (fastest for development)**

```bash
npx expo run:android
```

This generates the `android/` folder and installs a debug build on your connected phone or emulator. Google sign-in uses the `somedaydone://` scheme, which only works in a native build. Expo Go can show the screens, but sign-in and final reminder testing need Option A or B below.

**Option C: Expo Go (screens only)**

Install the SDK 58 build of Expo Go from the Play Store, then run:

```bash
npx expo start
```

Scan the QR code with Expo Go. Use it to check layout and navigation. Sign-in will not complete in Expo Go, and reminders must be tested on a native build.

**Option B: EAS cloud build**

```bash
npm install -g eas-cli
eas login
eas build --profile development --platform android
```

Install the APK it produces on your phone.

---

## Part 8: Test before you release

Work through this list on a **physical Android phone**.

- [ ] Tap "Continue with Google", pick an account, and land on Home.
- [ ] Sign out, sign back in. Your goals are still there and you did not get a second profile.
- [ ] Cancel the Google screen. You see a gentle message, not a broken screen.
- [ ] Turn airplane mode on and try to create a goal. You see "No connection," and nothing is lost.
- [ ] Create a goal, add three steps, complete one, reopen it. Progress shows 33%, then 0%.
- [ ] Complete all steps. The app asks "Mark this dream complete?" and does not complete it on its own.
- [ ] Set a daily reminder 2 minutes ahead. Close the app. The notification arrives.
- [ ] Set a one-time reminder, then deny notification permission in Android settings. The app shows the explanation with a button to open settings, and everything else still works.
- [ ] Sign in with a second Google account. It shows none of the first account's goals.
- [ ] Delete the account from Profile. Sign-in with the same Google account gives a fresh, empty profile.

RLS check (optional but recommended): in Supabase **SQL Editor**, run a query as a specific user using the "Run as" option, and confirm you only see that user's rows.

---

## Part 9: Release to Google Play

1. Create a Google Play Console account. The one-time registration fee is $25.
2. Build the release bundle:
   ```bash
   eas build --profile production --platform android
   ```
3. In Play Console, create the app. Complete **Store listing**, **Data safety** (declare account info and user content; no ads or tracking), **Content rating**, and **App access** (sign-in is required, so include a test Google account or explain how to sign in).
4. Under **App content → Data deletion**, add the web deletion link (`EXPO_PUBLIC_DELETE_URL`).
5. If your account was created after November 13, 2023 (personal account), run a **closed test** with at least 12 testers opted in for 14 continuous days before applying for production access.
6. Upload the `.aab` file to the closed testing track, then apply for production when the 14 days are complete.

---

## Troubleshooting

| Problem | Likely cause and fix |
|---|---|
| "Missing Supabase config" on launch | `.env` is missing or misnamed. It must sit at the project root. Restart with `npx expo start -c`. |
| Google sign-in opens then returns to the app with an error | The redirect URL in Supabase does not match `somedaydone://auth-callback`, or the Google redirect URI is not the Supabase callback URL. |
| "Sign-in link expired" | Codes are single use and short-lived. Start sign-in again. |
| Sign-in works, but goals never load | The SQL migration did not run fully. Re-run `001_init.sql` in the SQL Editor. |
| Reminder does not fire | Check the notification permission and battery optimization for the app. Test on a real device, not an emulator. |
| `npm run typecheck` fails after install | Run `npx expo install --fix`. |
| Expo Go says "project SDK does not match" | Your Expo Go is older than this project. Install the SDK 58 Expo Go, or run `npx expo start --go` only after confirming the versions match. |
| `Cannot find module 'react-native/Libraries/...'` | SDK 58 blocks deep imports from React Native internals. This project does not use them. Remove any you added, or see Expo's Strict TypeScript API migration guide. |
| Release build crashes after enabling R8 | SDK 58 turns on R8 minification for Android release builds by default. Test the production build on a phone before uploading. |

---

## Project layout

```
App.tsx                      App entry, providers
src/
  theme.ts                   Palette and type scale
  types.ts                   Shared data types and constants
  context/AuthContext.tsx    Session state and profile creation
  lib/
    supabase.ts              Client (PKCE, session storage)
    auth.ts                  Google sign-in and sign-out
    goals.ts                 All database reads and writes
    reminders.ts             Notifications and scheduling
    progress.ts              Progress math (pure, tested)
    validate.ts              Input checks (pure, tested)
    errors.ts                Safe, user-facing error messages
  components/ui.tsx          Buttons, chips, fields, progress bar, states
  components/GoalCard.tsx    Goal summary card
  navigation/RootNavigator.tsx
  screens/                   Login, Home, Goals, Goal detail, Goal form, Profile
supabase/
  migrations/001_init.sql    Tables, indexes, RLS, profile trigger
  functions/delete-account/  Server-side account deletion
```

---

## Security notes

- The app holds only the Supabase anon key. RLS protects every table, and each policy checks `auth.uid()`.
- Account deletion runs on the server. The app never has the service-role key.
- Error messages shown to users are generic. Database and provider details are not displayed or logged.
- The PKCE flow avoids implicit tokens. Session tokens are stored by the Supabase client in AsyncStorage.
