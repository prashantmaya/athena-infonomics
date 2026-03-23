import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { MetricCard } from '../components/MetricCard'
import {
  emulateWebhookCall,
  getCaseTimeline,
  getDashboardMetrics,
  listCases,
  listQualityIssues,
} from '../lib/api'
import type { CaseRecord, DashboardMetrics, QualityIssue, TimelineEvent } from '../types'

const programOptions = [1, 2, 3]
const TIMELINE_PAGE_SIZE = 6

export function SupervisorPage() {
  const [programId, setProgramId] = useState<number>(1)
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [issues, setIssues] = useState<QualityIssue[]>([])
  const [cases, setCases] = useState<CaseRecord[]>([])
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null)
  const [timeline, setTimeline] = useState<TimelineEvent[]>([])
  const [timelinePage, setTimelinePage] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [webhookSource, setWebhookSource] = useState('partner_system')
  const [webhookEventType, setWebhookEventType] = useState('status_update')
  const [webhookCaseId, setWebhookCaseId] = useState<number | null>(null)
  const [webhookPayloadText, setWebhookPayloadText] = useState('{\n  "status": "referred"\n}')
  const [isWebhookSubmitting, setIsWebhookSubmitting] = useState(false)
  const [isWebhookModalOpen, setIsWebhookModalOpen] = useState(false)

  useEffect(() => {
    setSelectedCaseId(null)
    setTimeline([])
    setTimelinePage(1)
    setError(null)
    void Promise.all([
      getDashboardMetrics(programId),
      listQualityIssues(programId),
      listCases(programId),
    ])
      .then(([metricsPayload, qualityIssues, caseRecords]) => {
        setMetrics(metricsPayload)
        setIssues(qualityIssues)
        setCases(caseRecords)
        if (caseRecords[0]) {
          setSelectedCaseId(caseRecords[0].id)
          setWebhookCaseId(caseRecords[0].id)
        }
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : 'Dashboard data unavailable.'
        setError(message)
      })
  }, [programId])

  useEffect(() => {
    if (!selectedCaseId) {
      return
    }
    void getCaseTimeline(selectedCaseId)
      .then((events) => {
        setTimeline(events)
        setTimelinePage(1)
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : 'Timeline unavailable.'
        setError(message)
      })
  }, [selectedCaseId])

  const prioritizedIssues = [...issues]
    .sort((a, b) => {
      const severityRank = { high: 3, medium: 2, low: 1 }
      const severityDelta = severityRank[b.severity] - severityRank[a.severity]
      if (severityDelta !== 0) {
        return severityDelta
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
    .slice(0, 5)

  const totalTimelinePages = Math.max(1, Math.ceil(timeline.length / TIMELINE_PAGE_SIZE))
  const safeTimelinePage = Math.min(timelinePage, totalTimelinePages)
  const paginatedTimeline = timeline.slice(
    (safeTimelinePage - 1) * TIMELINE_PAGE_SIZE,
    safeTimelinePage * TIMELINE_PAGE_SIZE,
  )

  const timelineByDay = paginatedTimeline.reduce<Record<string, TimelineEvent[]>>((acc, item) => {
    const label = new Date(item.serverReceivedAt).toLocaleDateString()
    if (!acc[label]) {
      acc[label] = []
    }
    acc[label].push(item)
    return acc
  }, {})

  const submitWebhook = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    let parsedPayload: Record<string, unknown>
    try {
      parsedPayload = JSON.parse(webhookPayloadText) as Record<string, unknown>
      if (Array.isArray(parsedPayload) || parsedPayload === null) {
        throw new Error('Payload must be a JSON object.')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid JSON payload.'
      setError(`Webhook payload error: ${message}`)
      toast.error(`Webhook payload error: ${message}`)
      return
    }

    setIsWebhookSubmitting(true)
    try {
      const result = await emulateWebhookCall({
        programId,
        caseId: webhookCaseId ?? undefined,
        source: webhookSource,
        eventType: webhookEventType,
        payload: parsedPayload,
      })
      toast.success(
        result.status === 'duplicate'
          ? 'Webhook accepted as duplicate event.'
          : 'Webhook event accepted.',
      )

      const [qualityIssues, caseRecords] = await Promise.all([
        listQualityIssues(programId),
        listCases(programId),
      ])
      setIssues(qualityIssues)
      setCases(caseRecords)
      if (selectedCaseId) {
        const events = await getCaseTimeline(selectedCaseId)
        setTimeline(events)
      }
      setIsWebhookModalOpen(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Webhook simulation failed.'
      setError(message)
      toast.error(message)
    } finally {
      setIsWebhookSubmitting(false)
    }
  }

  return (
    <section className="page">
      <h2>Supervisor</h2>
      <p>Monitor quality, sync health, and review priorities for active programs.</p>

      {error && <p className="banner banner-error">{error}</p>}

      <section className="panel inline-form dashboard-toolbar">
        <label>
          Program
          <select value={programId} onChange={(event) => setProgramId(Number(event.target.value))}>
            {programOptions.map((id) => (
              <option key={id} value={id}>
                Program {id}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => setIsWebhookModalOpen(true)}>
          Simulate webhook
        </button>
      </section>

      {metrics && (
        <section className="metrics-grid">
          <MetricCard label="Total cases" value={metrics.totalCases} />
          <MetricCard label="Active cases" value={metrics.activeCases} />
          <MetricCard label="Pending sync items" value={metrics.pendingSyncItems} />
          <MetricCard label="Quality score" value={`${metrics.qualityScore}%`} />
        </section>
      )}

      <div className="grid-two">
        <section className="panel">
          <h3>Quality issues</h3>
          <ul className="card-list">
            {prioritizedIssues.map((issue) => (
              <li key={issue.id} className={`quality quality-${issue.severity}`}>
                <strong>Case #{issue.caseId}</strong> - {issue.message}
              </li>
            ))}
            {prioritizedIssues.length === 0 && <li className="muted-text">No open quality issues.</li>}
          </ul>
        </section>

        <section className="panel">
          <h3>Case timeline</h3>
          <label>
            Case
            <select
              value={selectedCaseId ?? ''}
              onChange={(event) => setSelectedCaseId(Number(event.target.value))}
            >
              {cases.map((record) => (
                <option key={record.id} value={record.id}>
                  #{record.id} - {record.title}
                </option>
              ))}
            </select>
          </label>
          <div className="timeline-feed">
            {Object.entries(timelineByDay).map(([day, events]) => (
              <div key={day} className="timeline-day">
                <h4>{day}</h4>
                <ul className="card-list">
                  {events.map((event) => (
                    <li key={event.id}>
                      <p>
                        <strong>{event.type}</strong>: {event.title}
                      </p>
                      <p>{event.description}</p>
                      <small>
                        server_received_at: {new Date(event.serverReceivedAt).toLocaleString()}
                      </small>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {timeline.length === 0 && <p className="muted-text">No timeline events for this case.</p>}
          </div>
          <div className="pagination-row">
            <span className="muted-text">
              Page {safeTimelinePage} of {totalTimelinePages}
            </span>
            <div className="pagination-actions">
              <button
                type="button"
                onClick={() => setTimelinePage((current) => Math.max(1, current - 1))}
                disabled={safeTimelinePage === 1}
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() =>
                  setTimelinePage((current) => Math.min(totalTimelinePages, current + 1))
                }
                disabled={safeTimelinePage === totalTimelinePages}
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </div>

      {isWebhookModalOpen && (
        <div className="modal-overlay" onClick={() => setIsWebhookModalOpen(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h3>Webhook simulator</h3>
            <p className="muted-text">Emulate external event ingestion for Program {programId}.</p>
            <form className="form-grid" onSubmit={submitWebhook}>
              <div className="grid-two">
                <label>
                  Source
                  <input
                    value={webhookSource}
                    onChange={(event) => setWebhookSource(event.target.value)}
                    placeholder="partner_system"
                    required
                  />
                </label>
                <label>
                  Event type
                  <input
                    value={webhookEventType}
                    onChange={(event) => setWebhookEventType(event.target.value)}
                    placeholder="status_update"
                    required
                  />
                </label>
              </div>
              <label>
                Case (optional)
                <select
                  value={webhookCaseId ?? ''}
                  onChange={(event) =>
                    setWebhookCaseId(event.target.value ? Number(event.target.value) : null)
                  }
                >
                  <option value="">No case link</option>
                  {cases.map((record) => (
                    <option key={record.id} value={record.id}>
                      #{record.id} - {record.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Payload (JSON object)
                <textarea
                  value={webhookPayloadText}
                  onChange={(event) => setWebhookPayloadText(event.target.value)}
                  rows={6}
                />
              </label>
              <div className="modal-actions">
                <button type="button" onClick={() => setIsWebhookModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" disabled={isWebhookSubmitting}>
                  {isWebhookSubmitting ? 'Sending...' : 'Send webhook event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
