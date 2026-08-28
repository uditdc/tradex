import type { AiRead, KeyLevel } from './types'

function isKeyLevel(v: unknown): v is KeyLevel {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as KeyLevel).price === 'number' &&
    typeof (v as KeyLevel).kind === 'string' &&
    typeof (v as KeyLevel).note === 'string'
  )
}

/**
 * Strict-parses the model's accumulated /api/read text into an AiRead. Only tolerates
 * a wrapping ```json fence (models add this despite being told not to); anything else
 * malformed returns null so the caller can fall back to showing the raw text.
 */
export function parseAiRead(text: string): AiRead | null {
  const stripped = text
    .trim()
    .replace(/^```(?:json)?\n?/, '')
    .replace(/```$/, '')
    .trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(stripped)
  } catch {
    return null
  }

  if (
    typeof parsed === 'object' &&
    parsed !== null &&
    typeof (parsed as AiRead).bias === 'string' &&
    Array.isArray((parsed as AiRead).key_levels) &&
    (parsed as AiRead).key_levels.every(isKeyLevel) &&
    typeof (parsed as AiRead).invalidation === 'string' &&
    typeof (parsed as AiRead).confidence === 'number' &&
    typeof (parsed as AiRead).rationale === 'string'
  ) {
    return parsed as AiRead
  }

  return null
}
