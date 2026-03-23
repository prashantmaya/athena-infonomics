export type UserRole = 'coordinator' | 'agent' | 'supervisor'

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed'

export interface CaseRecord {
  id: number
  title: string
  programId: number
  caseType: string
  priority: 'low' | 'medium' | 'high'
  status: 'open' | 'in_progress' | 'closed'
  assignedAgentId: number | null
  version: number
  updatedAt: string
}

export interface NewCaseInput {
  title: string
  programId: number
  caseType: string
  priority: 'low' | 'medium' | 'high'
}

export interface ActivityDraft {
  caseId: number
  notes: string
  outcome: string
  clientReportedAt: string
}

export interface OutboxItem extends ActivityDraft {
  clientActivityId: string
  agentId: number
  programId: number
  status: SyncStatus
  retries: number
  lastError?: string
  createdAt: string
}

export interface TimelineEvent {
  id: string
  type: 'activity' | 'external_event'
  title: string
  description: string
  serverReceivedAt: string
  clientReportedAt?: string
}

export interface QualityIssue {
  id: string
  caseId: number
  severity: 'low' | 'medium' | 'high'
  message: string
  createdAt: string
}

export interface DashboardMetrics {
  totalCases: number
  activeCases: number
  pendingSyncItems: number
  qualityScore: number
}

export interface SyncPullResponse {
  assignedCases: CaseRecord[]
  nextCursor: string | null
}

export interface AgentSummary {
  id: number
  name: string
  externalId?: string
}

export interface NewAgentInput {
  programId: number
  name: string
  externalId?: string
}

export interface WebhookEventInput {
  programId: number
  caseId?: number
  source: string
  eventType: string
  payload: Record<string, unknown>
}

export interface ProgramSummary {
  id: number
  name: string
  code?: string
}

export interface CaseTypeSummary {
  id: number
  name: string
  slug: string
}
