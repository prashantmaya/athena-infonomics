import type { ActivityDraft } from '../types'

export function getRequiredFieldHints(activity: ActivityDraft): string[] {
  const hints: string[] = []
  if (!activity.notes.trim()) {
    hints.push('Notes are required for reliable follow-up context.')
  }
  if (!activity.outcome.trim()) {
    hints.push('Outcome should be provided before sync.')
  }
  return hints
}

export function getAnomalyWarnings(activity: ActivityDraft): string[] {
  const warnings: string[] = []
  if (activity.notes.length > 0 && activity.notes.length < 10) {
    warnings.push('Notes look very short; consider adding more detail.')
  }
  if (activity.clientReportedAt > new Date().toISOString()) {
    warnings.push('Client timestamp appears to be in the future.')
  }
  return warnings
}
