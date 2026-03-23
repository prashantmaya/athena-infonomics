import type {
  AgentSummary,
  CaseTypeSummary,
  CaseRecord,
  DashboardMetrics,
  NewAgentInput,
  NewCaseInput,
  OutboxItem,
  ProgramSummary,
  QualityIssue,
  SyncPullResponse,
  TimelineEvent,
  WebhookEventInput,
} from '../types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

const defaultHeaders = {
  'Content-Type': 'application/json',
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...defaultHeaders,
      ...init?.headers,
    },
  })

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`
    try {
      const body = await response.json()
      if (body?.detail) {
        message = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
      }
    } catch {
      // ignore non-JSON body
    }
    throw new Error(message)
  }

  return response.json() as Promise<T>
}

const fallbackCases: CaseRecord[] = [
  {
    id: 101,
    title: 'Medication adherence follow-up',
    programId: 1,
    caseType: 'health_followup',
    priority: 'high',
    status: 'open',
    assignedAgentId: 11,
    version: 1,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 102,
    title: 'Food support eligibility review',
    programId: 1,
    caseType: 'social_support',
    priority: 'medium',
    status: 'in_progress',
    assignedAgentId: 12,
    version: 1,
    updatedAt: new Date().toISOString(),
  },
]

const fallbackAgentsByProgram: Record<number, AgentSummary[]> = {
  1: [
    { id: 1, name: 'Agent A', externalId: 'agt-a' },
    { id: 2, name: 'Agent B', externalId: 'agt-b' },
    { id: 11, name: 'Agent 11', externalId: 'agt-11' },
    { id: 12, name: 'Agent 12', externalId: 'agt-12' },
  ],
}

const fallbackPrograms: ProgramSummary[] = [
  { id: 1, name: 'Program 1', code: 'program-1' },
  { id: 2, name: 'Program 2', code: 'program-2' },
  { id: 3, name: 'Program 3', code: 'program-3' },
]

const fallbackCaseTypesByProgram: Record<number, CaseTypeSummary[]> = {
  1: [
    { id: 1, name: 'Home Visit', slug: 'home-visit' },
    { id: 2, name: 'Health Follow-up', slug: 'health_followup' },
    { id: 3, name: 'Social Support', slug: 'social_support' },
  ],
  2: [{ id: 4, name: 'Case Review', slug: 'case-review' }],
  3: [{ id: 5, name: 'Intake', slug: 'intake' }],
}

export async function listCases(programId?: number): Promise<CaseRecord[]> {
  const url = programId ? `/api/cases/?program_id=${programId}` : '/api/cases/'
  try {
    return await request<CaseRecord[]>(url)
  } catch {
    return fallbackCases
  }
}

export async function listPrograms(): Promise<ProgramSummary[]> {
  try {
    return await request<ProgramSummary[]>('/api/programs/')
  } catch {
    return fallbackPrograms
  }
}

export async function listCaseTypes(programId: number): Promise<CaseTypeSummary[]> {
  try {
    return await request<CaseTypeSummary[]>(`/api/case-types/?program_id=${programId}`)
  } catch {
    return fallbackCaseTypesByProgram[programId] ?? []
  }
}

export async function createCase(input: NewCaseInput): Promise<CaseRecord> {
  return request<CaseRecord>('/api/cases/', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function getCaseDetail(caseId: number): Promise<CaseRecord> {
  return request<CaseRecord>(`/api/cases/${caseId}/`)
}

export async function assignCase(caseId: number, agentId: number): Promise<CaseRecord> {
  return request<CaseRecord>(`/api/cases/${caseId}/assign/`, {
    method: 'POST',
    body: JSON.stringify({ agentId }),
  })
}

export async function listProgramAgents(programId: number): Promise<AgentSummary[]> {
  try {
    return await request<AgentSummary[]>(
      `/api/programs/agents/?program_id=${programId}`,
    )
  } catch {
    return fallbackAgentsByProgram[programId] ?? []
  }
}

export async function createProgramAgent(input: NewAgentInput): Promise<AgentSummary> {
  try {
    return await request<AgentSummary>('/api/programs/agents/', {
      method: 'POST',
      body: JSON.stringify({
        program_id: input.programId,
        name: input.name,
        external_id: input.externalId?.trim() || undefined,
      }),
    })
  } catch {
    const existing = fallbackAgentsByProgram[input.programId] ?? []
    const created: AgentSummary = {
      id: Date.now(),
      name: input.name,
      externalId: input.externalId?.trim() || `agt-${Math.random().toString(36).slice(2, 8)}`,
    }
    fallbackAgentsByProgram[input.programId] = [created, ...existing]
    return created
  }
}

export async function pullAgentSync(
  agentId: number,
  cursor: string | null,
  programId = 1,
): Promise<SyncPullResponse> {
  const query = new URLSearchParams({
    program_id: String(programId),
    agent_id: String(agentId),
  })
  if (cursor) {
    query.set('cursor', cursor)
  }

  try {
    const data = await request<{
      assignedCases?: CaseRecord[]
      assigned_cases?: CaseRecord[]
      nextCursor?: string | null
      cursor?: string | null
    }>(`/api/agent/sync/pull/?${query.toString()}`)
    return {
      assignedCases: data.assignedCases ?? data.assigned_cases ?? [],
      nextCursor: data.nextCursor ?? data.cursor ?? null,
    }
  } catch {
    return {
      assignedCases: fallbackCases.filter((caseRecord) => caseRecord.assignedAgentId === agentId),
      nextCursor: null,
    }
  }
}

export async function pushAgentSync(agentId: number, activities: OutboxItem[]): Promise<void> {
  const programId = activities[0]?.programId ?? 1
  await request('/api/agent/sync/push/', {
    method: 'POST',
    body: JSON.stringify({
      program_id: programId,
      agent_id: agentId,
      request_id: crypto.randomUUID(),
      activities: activities.map((item) => ({
        client_activity_id: item.clientActivityId,
        case_id: item.caseId,
        activity_type: 'visit_completed',
        payload: { notes: item.notes, outcome: item.outcome },
        client_reported_at: item.clientReportedAt,
      })),
    }),
  })
}

export async function getDashboardMetrics(programId = 1): Promise<DashboardMetrics> {
  try {
    return await request<DashboardMetrics>(
      `/api/dashboard/metrics/?program_id=${programId}`,
    )
  } catch {
    return {
      totalCases: 2,
      activeCases: 2,
      pendingSyncItems: 1,
      qualityScore: 89,
    }
  }
}

export async function getCaseTimeline(caseId: number): Promise<TimelineEvent[]> {
  try {
    return await request<TimelineEvent[]>(`/api/cases/${caseId}/timeline/`)
  } catch {
    return [
      {
        id: `${caseId}-evt-1`,
        type: 'external_event',
        title: 'External referral received',
        description: 'Referral imported from partner system.',
        serverReceivedAt: new Date().toISOString(),
      },
      {
        id: `${caseId}-evt-2`,
        type: 'activity',
        title: 'Home visit logged',
        description: 'Agent marked follow-up plan and next check-in.',
        serverReceivedAt: new Date().toISOString(),
        clientReportedAt: new Date().toISOString(),
      },
    ]
  }
}

export async function listQualityIssues(programId = 1): Promise<QualityIssue[]> {
  try {
    return await request<QualityIssue[]>(
      `/api/quality/issues/?program_id=${programId}`,
    )
  } catch {
    return [
      {
        id: 'qi-1',
        caseId: 101,
        severity: 'medium',
        message: 'Outcome missing for the latest field activity.',
        createdAt: new Date().toISOString(),
      },
    ]
  }
}

export async function emulateWebhookCall(input: WebhookEventInput): Promise<{ created: boolean; status: string }> {
  try {
    const response = await request<{ created: boolean; status: string }>('/api/external-events/ingest/', {
      method: 'POST',
      body: JSON.stringify({
        program_id: input.programId,
        case_id: input.caseId,
        source: input.source,
        external_event_id: crypto.randomUUID(),
        event_type: input.eventType,
        payload: input.payload,
        client_reported_at: new Date().toISOString(),
      }),
    })
    return response
  } catch {
    return { created: true, status: 'accepted' }
  }
}
