import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { StatusBadge } from '../components/StatusBadge'
import { createProgramAgent, listProgramAgents } from '../lib/api'
import { addOutboxItem, listOutboxItems } from '../lib/db'
import {
  createOutboxItem,
  getAssignedCasesFromCache,
  performPullSync,
  performPushSyncForProgram,
} from '../lib/sync'
import { getAnomalyWarnings, getRequiredFieldHints } from '../lib/validators'
import type { ActivityDraft, AgentSummary, CaseRecord, NewAgentInput, OutboxItem } from '../types'

const defaultProgramId = 1
const programOptions = [1, 2, 3]
const OUTBOX_PAGE_SIZE = 8

export function AgentPage() {
  const [agentId, setAgentId] = useState<number | null>(null)
  const [programId, setProgramId] = useState<number>(defaultProgramId)
  const [availableAgents, setAvailableAgents] = useState<AgentSummary[]>([])
  const [isLoadingAgents, setIsLoadingAgents] = useState(false)
  const [isCreateAgentModalOpen, setIsCreateAgentModalOpen] = useState(false)
  const [isCreatingAgent, setIsCreatingAgent] = useState(false)
  const [newAgent, setNewAgent] = useState<NewAgentInput>({
    programId: defaultProgramId,
    name: '',
    externalId: '',
  })
  const [assignedCases, setAssignedCases] = useState<CaseRecord[]>([])
  const [isFormModalOpen, setIsFormModalOpen] = useState(false)
  const [activeCase, setActiveCase] = useState<CaseRecord | null>(null)
  const [activity, setActivity] = useState<ActivityDraft>({
    caseId: 0,
    notes: '',
    outcome: '',
    clientReportedAt: new Date().toISOString(),
  })
  const [outbox, setOutbox] = useState<OutboxItem[]>([])
  const [outboxPage, setOutboxPage] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const requiredHints = useMemo(() => getRequiredFieldHints(activity), [activity])
  const anomalyWarnings = useMemo(() => getAnomalyWarnings(activity), [activity])
  const syncSummary = useMemo(() => {
    const pending = outbox.filter((item) => item.status === 'pending').length
    const syncing = outbox.filter((item) => item.status === 'syncing').length
    const failed = outbox.filter((item) => item.status === 'failed').length
    return { pending, syncing, failed, total: outbox.length }
  }, [outbox])
  const canRunAgentActions = agentId !== null
  const caseQueueSummary = useMemo(() => {
    return outbox.reduce<Record<number, { total: number; pending: number; syncing: number; failed: number }>>(
      (acc, item) => {
        const current = acc[item.caseId] ?? { total: 0, pending: 0, syncing: 0, failed: 0 }
        current.total += 1
        if (item.status === 'pending') {
          current.pending += 1
        } else if (item.status === 'syncing') {
          current.syncing += 1
        } else if (item.status === 'failed') {
          current.failed += 1
        }
        acc[item.caseId] = current
        return acc
      },
      {},
    )
  }, [outbox])

  const loadAgentsForProgram = useCallback(async (nextProgramId: number) => {
    setIsLoadingAgents(true)
    try {
      const agents = await listProgramAgents(nextProgramId)
      setAvailableAgents(agents)
      if (agents.length === 0) {
        setAgentId(null)
        setAssignedCases([])
        toast.warning('No agents found for selected program.')
        return
      }
      setAgentId((current) => {
        if (current && agents.some((agent) => agent.id === current)) {
          return current
        }
        return agents[0].id
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load agents.'
      setError(message)
      setAvailableAgents([])
      setAgentId(null)
      setAssignedCases([])
      toast.error(message)
    } finally {
      setIsLoadingAgents(false)
    }
  }, [])

  const refreshOutbox = useCallback(async () => {
    if (agentId === null) {
      setOutbox([])
      setOutboxPage(1)
      return
    }
    const items = await listOutboxItems()
    setOutbox(items.filter((item) => item.agentId === agentId && item.programId === programId))
    setOutboxPage(1)
  }, [agentId, programId])

  const pullAssignedCases = useCallback(async () => {
    if (agentId === null) {
      setAssignedCases([])
      return
    }
    try {
      const pulled = await performPullSync(agentId, programId)
      const merged = pulled.length > 0 ? pulled : await getAssignedCasesFromCache(agentId, programId)
      setAssignedCases(merged)
      setError(null)
      toast.success('Assigned cases refreshed.')
    } catch (err) {
      const cached = await getAssignedCasesFromCache(agentId, programId)
      setAssignedCases(cached)
      const message = err instanceof Error ? err.message : 'Could not pull latest cases.'
      const detail = `${message} Using cached assignment data.`
      setError(detail)
      toast.error(detail)
    }
  }, [agentId, programId])

  useEffect(() => {
    setNewAgent((current) => ({ ...current, programId }))
    void loadAgentsForProgram(programId)
  }, [loadAgentsForProgram, programId])

  useEffect(() => {
    if (agentId !== null) {
      void pullAssignedCases()
    } else {
      setAssignedCases([])
    }
    void refreshOutbox()
  }, [agentId, pullAssignedCases, refreshOutbox])

  const openFormModal = (caseRecord: CaseRecord) => {
    setActiveCase(caseRecord)
    setActivity({
      caseId: caseRecord.id,
      notes: '',
      outcome: '',
      clientReportedAt: new Date().toISOString(),
    })
    setError(null)
    setIsFormModalOpen(true)
  }

  const openCreateAgentModal = () => {
    setNewAgent({
      programId,
      name: '',
      externalId: '',
    })
    setIsCreateAgentModalOpen(true)
  }

  const closeCreateAgentModal = () => {
    setIsCreateAgentModalOpen(false)
    setIsCreatingAgent(false)
  }

  const handleCreateAgent = async (event: FormEvent) => {
    event.preventDefault()
    if (!newAgent.name.trim()) {
      const message = 'Agent name is required.'
      setError(message)
      toast.error(message)
      return
    }
    setIsCreatingAgent(true)
    setError(null)
    try {
      const created = await createProgramAgent({
        programId,
        name: newAgent.name.trim(),
        externalId: newAgent.externalId?.trim() || undefined,
      })
      toast.success(`Agent created: ${created.name}`)
      await loadAgentsForProgram(programId)
      setAgentId(created.id)
      closeCreateAgentModal()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not create agent.'
      setError(message)
      toast.error(message)
      setIsCreatingAgent(false)
    }
  }

  const closeFormModal = () => {
    setIsFormModalOpen(false)
    setActiveCase(null)
    setActivity({
      caseId: 0,
      notes: '',
      outcome: '',
      clientReportedAt: new Date().toISOString(),
    })
  }

  const addActivityToOutbox = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (agentId === null) {
      const detail = 'Select an agent before creating a form.'
      setError(detail)
      toast.error(detail)
      return
    }

    if (!activeCase) {
      const detail = 'Select a case before adding activity.'
      setError(detail)
      toast.error(detail)
      return
    }

    const queueItem = createOutboxItem({
      clientActivityId: crypto.randomUUID(),
      caseId: activeCase.id,
      notes: activity.notes,
      outcome: activity.outcome,
      clientReportedAt: activity.clientReportedAt,
      agentId,
      programId,
    })

    await addOutboxItem(queueItem)
    await refreshOutbox()

    toast.success('Form saved.')
    toast.info('Form synced to outbox.')
    closeFormModal()
  }

  const runSync = async () => {
    if (agentId === null) {
      const message = 'Please select an agent before syncing.'
      setError(message)
      toast.error(message)
      return
    }
    setError(null)
    try {
      const result = await performPushSyncForProgram(agentId, programId)
      await pullAssignedCases()
      await refreshOutbox()
      toast.success(`Outbox sync complete: ${result.success} succeeded, ${result.failed} failed.`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sync failed.'
      setError(message)
      toast.error(message)
      await refreshOutbox()
    }
  }

  const totalOutboxPages = Math.max(1, Math.ceil(outbox.length / OUTBOX_PAGE_SIZE))
  const safeOutboxPage = Math.min(outboxPage, totalOutboxPages)
  const paginatedOutbox = outbox.slice(
    (safeOutboxPage - 1) * OUTBOX_PAGE_SIZE,
    safeOutboxPage * OUTBOX_PAGE_SIZE,
  )

  return (
    <section className="page">
      <h2>Agent (PWA offline workflow)</h2>
      <p>Record activities locally first, then push via idempotent sync.</p>

      {error && <p className="banner banner-error">{error}</p>}

      <div className="panel inline-form">
        <label>
          Program
          <select
            value={programId}
            onChange={(event) => setProgramId(Number(event.target.value))}
          >
            {programOptions.map((id) => (
              <option key={id} value={id}>
                Program {id}
              </option>
            ))}
          </select>
        </label>
        <label>
          Agent
          <select
            value={agentId ?? ''}
            onChange={(event) => setAgentId(Number(event.target.value))}
            disabled={isLoadingAgents || availableAgents.length === 0}
          >
            {availableAgents.length === 0 ? (
              <option value="">No agents available</option>
            ) : (
              availableAgents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} (ID: {agent.id})
                </option>
              ))
            )}
          </select>
        </label>
        <button type="button" onClick={openCreateAgentModal}>
          Create Agent
        </button>
        <button
          type="button"
          onClick={() => void runSync()}
          disabled={!isOnline || !canRunAgentActions}
          title={!isOnline ? 'Connect to network to sync' : ''}
        >
          Sync Forms
        </button>
        {isLoadingAgents && <span className="muted-text">Loading agents...</span>}
        {!isOnline && (
          <span className="banner banner-warning">Offline – activities saved locally. Sync when online.</span>
        )}
      </div>

      <section className="panel">
        <div className="panel-header">
          <h3>Assigned cases</h3>
          <button
            type="button"
            className="link-button"
            onClick={() => void pullAssignedCases()}
            disabled={!isOnline || !canRunAgentActions}
            title={!isOnline ? 'Connect to network to refresh cases' : ''}
          >
            Refresh cases
          </button>
        </div>
        <div className="case-card-grid">
          {assignedCases.map((record) => (
            <article key={record.id} className="case-card">
              <h4>
                #{record.id} {record.title}
              </h4>
              <p>
                <strong>Status:</strong> {record.status}
              </p>
              <p>
                <strong>Priority:</strong> {record.priority}
              </p>
              <p>
                <strong>Program:</strong> {record.programId}
              </p>
              <div className="case-mini-row">
                <span className="mini-pill">Forms: {caseQueueSummary[record.id]?.total ?? 0}</span>
                <span className="mini-pill mini-pill-pending">
                  Pending: {caseQueueSummary[record.id]?.pending ?? 0}
                </span>
                <span className="mini-pill mini-pill-syncing">
                  Syncing: {caseQueueSummary[record.id]?.syncing ?? 0}
                </span>
                <span className="mini-pill mini-pill-failed">
                  Failed: {caseQueueSummary[record.id]?.failed ?? 0}
                </span>
              </div>
              <button type="button" onClick={() => openFormModal(record)}>
                Register Form Entry
              </button>
            </article>
          ))}
          {assignedCases.length === 0 && (
            <p className="muted-text">No assigned cases available. Cases auto-refresh when selection changes.</p>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h3>Sync center</h3>
          <div className="sync-pill-group">
            <span className="sync-pill">Total: {syncSummary.total}</span>
            <span className="sync-pill">Pending: {syncSummary.pending}</span>
            <span className="sync-pill">Syncing: {syncSummary.syncing}</span>
            <span className="sync-pill">Failed: {syncSummary.failed}</span>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Client activity ID</th>
              <th>Case</th>
              <th>Status</th>
              <th>Retries</th>
              <th>Last error</th>
            </tr>
          </thead>
          <tbody>
            {paginatedOutbox.map((item) => (
              <tr key={item.clientActivityId}>
                <td>{item.clientActivityId}</td>
                <td>{item.caseId}</td>
                <td>
                  <StatusBadge status={item.status} />
                </td>
                <td>{item.retries}</td>
                <td>{item.lastError ?? '-'}</td>
              </tr>
            ))}
            {outbox.length === 0 && (
              <tr>
                <td colSpan={5} className="muted-text">
                  Outbox is empty.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="pagination-row">
          <span className="muted-text">
            Page {safeOutboxPage} of {totalOutboxPages}
          </span>
          <div className="pagination-actions">
            <button
              type="button"
              onClick={() => setOutboxPage((current) => Math.max(1, current - 1))}
              disabled={safeOutboxPage === 1}
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setOutboxPage((current) => Math.min(totalOutboxPages, current + 1))}
              disabled={safeOutboxPage === totalOutboxPages}
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {isFormModalOpen && activeCase && (
        <div className="modal-overlay" onClick={closeFormModal}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h3>Create form for case #{activeCase.id}</h3>
            <p className="muted-text">{activeCase.title}</p>
            <form className="form-grid" onSubmit={addActivityToOutbox}>
              <label>
                Outcome
                <input
                  value={activity.outcome}
                  onChange={(event) =>
                    setActivity((current) => ({ ...current, outcome: event.target.value }))
                  }
                />
              </label>
              <label>
                Notes
                <textarea
                  value={activity.notes}
                  onChange={(event) => setActivity((current) => ({ ...current, notes: event.target.value }))}
                />
              </label>
              <label>
                Client reported at
                <input
                  type="datetime-local"
                  value={toLocalInputValue(activity.clientReportedAt)}
                  onChange={(event) =>
                    setActivity((current) => ({
                      ...current,
                      clientReportedAt: new Date(event.target.value).toISOString(),
                    }))
                  }
                />
              </label>

              {requiredHints.length > 0 && (
                <div className="banner banner-warning">
                  {requiredHints.map((hint) => (
                    <p key={hint}>{hint}</p>
                  ))}
                </div>
              )}
              {anomalyWarnings.length > 0 && (
                <div className="banner banner-warning">
                  {anomalyWarnings.map((warning) => (
                    <p key={warning}>{warning}</p>
                  ))}
                </div>
              )}

              <div className="modal-actions">
                <button type="button" onClick={closeFormModal}>
                  Cancel
                </button>
                <button type="submit">Save form</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isCreateAgentModalOpen && (
        <div className="modal-overlay" onClick={closeCreateAgentModal}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h3>Create agent</h3>
            <p className="muted-text">Program {programId}</p>
            <form className="form-grid" onSubmit={handleCreateAgent}>
              <label>
                Agent name
                <input
                  value={newAgent.name}
                  onChange={(event) =>
                    setNewAgent((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="e.g. Field Agent North"
                  required
                />
              </label>
              <label>
                External ID (optional)
                <input
                  value={newAgent.externalId ?? ''}
                  onChange={(event) =>
                    setNewAgent((current) => ({ ...current, externalId: event.target.value }))
                  }
                  placeholder="e.g. agt-north-01"
                />
              </label>
              <div className="modal-actions">
                <button type="button" onClick={closeCreateAgentModal}>
                  Cancel
                </button>
                <button type="submit" disabled={isCreatingAgent}>
                  {isCreatingAgent ? 'Creating...' : 'Create agent'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}

function toLocalInputValue(isoDate: string): string {
  const date = new Date(isoDate)
  const timezoneOffset = date.getTimezoneOffset() * 60 * 1000
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16)
}
