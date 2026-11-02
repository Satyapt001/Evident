export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0)
