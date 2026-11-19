import { supabase } from './supabase';
import { AppError } from './errors';

export interface SuggestInput {
  title: string;
  description: string;
  category: string;
  existing: string[];
}

// Asks the server for step ideas. The server holds the AI key and checks the sign-in.
export async function suggestSteps(input: SuggestInput): Promise<string[]> {
  const { data, error } = await supabase.functions.invoke('suggest-steps', {
    body: input,
  });

  if (error) {
    // Show the server's friendly message when it sent one.
    const context = (error as { context?: Response }).context;
    const body = context ? await context.json().catch(() => null) : null;
    const message =
      (body as { error?: string } | null)?.error ??
      'Could not suggest steps right now. You can still add them yourself.';
    throw new AppError(message);
  }

  const steps = (data as { steps?: unknown } | null)?.steps;
  if (!Array.isArray(steps) || steps.length === 0) {
    throw new AppError('No suggestions came back. Try again, or add steps yourself.');
  }
  return steps.filter((s): s is string => typeof s === 'string');
}
