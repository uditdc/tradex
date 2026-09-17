import type { ChoiceQuestion, ScoreQuestion } from '@typesafe-ai/sdk'

export interface FactorMeta {
  key: string
  label: string
  kind: 'directional' | 'conviction'
}

/**
 * What a strategy module hands the route: the full Jev question set for one
 * `systemOne` call — always including `scenario` (choice), `action` (choice), and
 * `riskWidth` (score), plus one `score()` question per entry in `factorMeta`, keyed
 * the same way. Which question set gets built is only known at request time (the
 * caller picks a strategy), so this is intentionally looser than a literal object
 * type — the route reads named/dynamic answers back out with a couple of narrow,
 * deliberate casts rather than fighting for static precision that runtime strategy
 * selection can't actually provide.
 */
export interface StrategyQuestions {
  questions: Record<string, ChoiceQuestion | ScoreQuestion>
  factorMeta: FactorMeta[]
}
