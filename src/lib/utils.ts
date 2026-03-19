// Lightweight cn() utility — joins class names, filtering out falsy values
export function cn(...inputs: (string | boolean | undefined | null)[]): string {
  return inputs.filter(Boolean).join(' ');
}
