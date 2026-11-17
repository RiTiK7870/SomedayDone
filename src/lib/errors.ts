// Errors that are safe to show to the user. Anything else becomes a generic message,
// so database or provider details never reach the screen or logs.
export class AppError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = 'AppError';
    this.code = code;
  }
}

export class AuthCancelledError extends AppError {
  constructor() {
    super('Sign-in was cancelled. Tap the button to try again.', 'AUTH_CANCELLED');
  }
}

export function userMessage(e: unknown): string {
  if (e instanceof AppError) return e.message;
  const msg = e instanceof Error ? e.message : '';
  if (/network|fetch|timed? ?out|offline/i.test(msg)) {
    return 'No connection. Check your network and try again.';
  }
  if (/jwt|expired|not signed in/i.test(msg)) {
    return 'Your session expired. Please sign in again.';
  }
  return 'Something went wrong. Please try again.';
}
