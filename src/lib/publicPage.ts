import { supabase } from './supabase';
import { AppError } from './errors';

export interface PublicPageSettings {
  slug: string | null;
  isPublic: boolean;
}

export async function getPublicPage(userId: string): Promise<PublicPageSettings> {
  const { data, error } = await supabase
    .from('profiles')
    .select('public_slug, is_public')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return { slug: data?.public_slug ?? null, isPublic: !!data?.is_public };
}

export function validateSlug(input: string): string | null {
  const v = input.trim().toLowerCase();
  if (!/^[a-z0-9-]{3,30}$/.test(v)) return 'Use 3 to 30 letters, numbers, or dashes.';
  if (v.startsWith('-') || v.endsWith('-')) return 'Start and end with a letter or number.';
  return null;
}

export async function savePublicPage(
  userId: string,
  slug: string | null,
  isPublic: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ public_slug: slug, is_public: isPublic })
    .eq('id', userId);
  if (error) {
    if (error.code === '23505') throw new AppError('That page name is taken. Try another.');
    throw error;
  }
}

// True when a hosted viewer page has been configured in .env.
export function viewerConfigured(): boolean {
  return (process.env.EXPO_PUBLIC_PUBLIC_PAGE_URL ?? '').trim() !== '';
}

// Link to the hosted viewer page. The Supabase address travels in the link,
// so the viewer needs no manual setup. Returns null when either value is missing.
export function publicPageUrl(slug: string): string | null {
  const viewer = (process.env.EXPO_PUBLIC_PUBLIC_PAGE_URL ?? '').trim();
  const base = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim().replace(/\/$/, '');
  if (!viewer || !base) return null;
  const api = `${base}/functions/v1/public-profile/`;
  return `${viewer.replace(/\/?$/, '/')}?u=${encodeURIComponent(slug)}&api=${encodeURIComponent(api)}`;
}

// Names the .env setting that stops the share link from being built, or null when all are set.
export function missingPublicPageSetting(): string | null {
  if (!(process.env.EXPO_PUBLIC_PUBLIC_PAGE_URL ?? '').trim()) return 'EXPO_PUBLIC_PUBLIC_PAGE_URL';
  if (!(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim()) return 'EXPO_PUBLIC_SUPABASE_URL';
  return null;
}
