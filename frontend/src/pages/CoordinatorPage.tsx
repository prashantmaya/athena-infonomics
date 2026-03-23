import { FormEvent, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  assignCase,
  createCase,
  listCases,
  listCaseTypes,
  listProgramAgents,
  listPrograms,
} from '../lib/api'
import type {
  AgentSummary,
  CaseRecord,
  CaseTypeSummary,
  NewCaseInput,
  ProgramSummary,
} from '../types'

const CASES_PAGE_SIZE = 8

const defaultCase: NewCaseInput = {
  title: '',
  programId: 1,
  caseType: '',
  priority: 'medium',
}

export function CoordinatorPage() {
  const [cases, setCases] = useState<CaseRecord[]>([])
  const [casesPage, setCasesPage] = useState(1)
  const [agentNameById, setAgentNameById] = useState<Record<number, string>>({})
  const [selectedProgramFilter, setSelectedProgramFilter] = useState<number | 'all'>('all')
  const [newCase, setNewCase] = useState<NewCaseInput>(defaultCase)
  const [programOptions, setProgramOptions] = useState<ProgramSummary[]>([])
  const [caseTypeOptions, setCaseTypeOptions] = useState<CaseTypeSummary[]>([])
  const [isLoadingCaseTypes, setIsLoadingCaseTypes] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)
  const [selectedCase, setSelectedCase] = useState<CaseRecord | null>(null)
  const [availableAgents, setAvailableAgents] = useState<AgentSummary[]>([])
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null)
  const [isLoadingAgents, setIsLoadingAgents] = useState(false)
  const [isAssigning, setIsAssigning] = useState(false)

  useEffect(() => {
    const loadCases = async () => {
      const records = await listCases(
        selectedProgramFilter === 'all' ? undefined : selectedProgramFilter,
      )
      setCases(records)
      setCasesPage(1)
    }
    void loadCases()
  }, [selectedProgramFilter])

  useEffect(() => {
    const loadPrograms = async () => {
      const programs = await listPrograms()
      setProgramOptions(programs)
      if (programs.length > 0) {
        setNewCase((current) => ({ ...current, programId: programs[0].id }))
      }
    }
    void loadPrograms()
  }, [])

  useEffect(() => {
    const loadCaseTypes = async () => {
      setIsLoadingCaseTypes(true)
      try {
        const caseTypes = await listCaseTypes(newCase.programId)
        setCaseTypeOptions(caseTypes)
        setNewCase((current) => ({
          ...current,
          caseType: caseTypes[0]?.slug ?? '',
        }))
      } finally {
        setIsLoadingCaseTypes(false)
      }
    }
    void loadCaseTypes()
  }, [newCase.programId])

  useEffect(() => {
    const assignedProgramIds = Array.from(
      new Set(cases.filter((record) => record.assignedAgentId !== null).map((record) => record.programId)),
    )

    if (assignedProgramIds.length === 0) {
      return
    }

    let isCancelled = false
    const loadAgentNames = async () => {
      try {
        const agentGroups = await Promise.all(
          assignedProgramIds.map((programId) => listProgramAgents(programId)),
        )
        if (isCancelled) {
          return
        }
        const nextMap: Record<number, string> = {}
        agentGroups.flat().forEach((agent) => {
          nextMap[agent.id] = agent.name
        })
        setAgentNameById(nextMap)
      } catch {
        // Keep existing map if lookup fails.
      }
    }

    void loadAgentNames()
    return () => {
      isCancelled = true
    }
  }, [cases])

  const handleCreateCase = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!newCase.caseType) {
      const message = 'Select a valid case type before creating the case.'
      setError(message)
      toast.error(message)
      return
    }
    try {
      const createdCase = await createCase(newCase)
      setCases((current) => [createdCase, ...current])
      setCasesPage(1)
      setNewCase(defaultCase)
      closeCreateModal()
      toast.success(`New case created: #${createdCase.id}`)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Case create endpoint is currently unavailable.'
      setError(message)
      toast.error(message)
    }
  }

  const openCreateModal = () => {
    setError(null)
    setIsCreateModalOpen(true)
  }

  const closeCreateModal = () => {
    setIsCreateModalOpen(false)
    setNewCase(defaultCase)
  }

  const openAssignModal = async (caseRecord: CaseRecord) => {
    setError(null)
    setSelectedCase(caseRecord)
    setIsAssignModalOpen(true)
    setIsLoadingAgents(true)
    setSelectedAgentId(caseRecord.assignedAgentId ?? null)
    try {
      const agents = await listProgramAgents(caseRecord.programId)
      setAvailableAgents(agents)
      if (!caseRecord.assignedAgentId && agents[0]) {
        setSelectedAgentId(agents[0].id)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not fetch available agents.'
      setError(message)
      setAvailableAgents([])
    } finally {
      setIsLoadingAgents(false)
    }
  }

  const closeAssignModal = () => {
    setIsAssignModalOpen(false)
    setSelectedCase(null)
    setAvailableAgents([])
    setSelectedAgentId(null)
    setIsLoadingAgents(false)
    setIsAssigning(false)
  }

  const handleAssignCase = async () => {
    if (!selectedCase || !selectedAgentId) {
      return
    }
    setError(null)
    setIsAssigning(true)
    try {
      const updated = await assignCase(selectedCase.id, selectedAgentId)
      setCases((current) =>
        current.map((record) => (record.id === selectedCase.id ? updated : record)),
      )
      closeAssignModal()
      toast.success(`User assigned to case #${selectedCase.id}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not assign this case.'
      setError(message)
      setIsAssigning(false)
      toast.error(message)
    }
  }

  const totalCasePages = Math.max(1, Math.ceil(cases.length / CASES_PAGE_SIZE))
  const safeCasesPage = Math.min(casesPage, totalCasePages)
  const paginatedCases = cases.slice(
    (safeCasesPage - 1) * CASES_PAGE_SIZE,
    safeCasesPage * CASES_PAGE_SIZE,
  )

  return (
    <section className="page">
      <h2>Coordinator</h2>
      <p>Review available cases and assign them to field agents.</p>

      {error && <p className="banner banner-error">{error}</p>}

      <div className="panel">
        <div className="panel-header">
          <h3>Available cases</h3>
          <div className="inline-form">
            <label>
              Program filter
              <select
                value={selectedProgramFilter}
                onChange={(event) => {
                  const value = event.target.value
                  setSelectedProgramFilter(value === 'all' ? 'all' : Number(value))
                }}
              >
                <option value="all">All programs</option>
                {programOptions.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={openCreateModal}>
              Create Case
            </button>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Title</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Assigned</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {paginatedCases.map((record) => (
              <tr key={record.id}>
                <td>{record.id}</td>
                <td>{record.title}</td>
                <td>{record.status}</td>
                <td>{record.priority}</td>
                <td>
                  {record.assignedAgentId
                    ? `${agentNameById[record.assignedAgentId] ?? `Agent #${record.assignedAgentId}`}`
                    : 'Unassigned'}
                </td>
                <td>
                  <button type="button" onClick={() => void openAssignModal(record)}>
                    Assign
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="pagination-row">
          <span className="muted-text">
            Page {safeCasesPage} of {totalCasePages}
          </span>
          <div className="pagination-actions">
            <button
              type="button"
              onClick={() => setCasesPage((current) => Math.max(1, current - 1))}
              disabled={safeCasesPage === 1}
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setCasesPage((current) => Math.min(totalCasePages, current + 1))}
              disabled={safeCasesPage === totalCasePages}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {isCreateModalOpen && (
        <div className="modal-overlay" onClick={closeCreateModal}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h3>Create case</h3>
            <form className="form-grid" onSubmit={handleCreateCase}>
              <label>
                Title
                <input
                  value={newCase.title}
                  onChange={(event) => setNewCase((current) => ({ ...current, title: event.target.value }))}
                  required
                />
              </label>
              <label>
                Program ID
                <select
                  value={newCase.programId}
                  onChange={(event) =>
                    setNewCase((current) => ({ ...current, programId: Number(event.target.value) }))
                  }
                >
                  {programOptions.map((program) => (
                    <option key={program.id} value={program.id}>
                      {program.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Case Type
                <select
                  value={newCase.caseType}
                  onChange={(event) =>
                    setNewCase((current) => ({ ...current, caseType: event.target.value }))
                  }
                  disabled={isLoadingCaseTypes || caseTypeOptions.length === 0}
                >
                  {caseTypeOptions.length === 0 ? (
                    <option value="">No case types available</option>
                  ) : (
                    caseTypeOptions.map((caseType) => (
                      <option key={caseType.id} value={caseType.slug}>
                        {caseType.name}
                      </option>
                    ))
                  )}
                </select>
              </label>
              <label>
                Priority
                <select
                  value={newCase.priority}
                  onChange={(event) =>
                    setNewCase((current) => ({
                      ...current,
                      priority: event.target.value as NewCaseInput['priority'],
                    }))
                  }
                >
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                </select>
              </label>
              <div className="modal-actions">
                <button type="button" onClick={closeCreateModal}>
                  Cancel
                </button>
                <button type="submit">Create case</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAssignModalOpen && selectedCase && (
        <div className="modal-overlay" onClick={closeAssignModal}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h3>Assign case #{selectedCase.id}</h3>
            <p>{selectedCase.title}</p>
            <p className="muted-text">Program: {selectedCase.programId}</p>

            {isLoadingAgents ? (
              <p>Loading available agents...</p>
            ) : (
              <>
                {availableAgents.length === 0 ? (
                  <p className="banner banner-warning">No agents found for this program.</p>
                ) : (
                  <div className="agent-list">
                    {availableAgents.map((agent) => (
                      <label key={agent.id} className="agent-option">
                        <input
                          type="radio"
                          name="assign-agent"
                          checked={selectedAgentId === agent.id}
                          onChange={() => setSelectedAgentId(agent.id)}
                        />
                        <span>
                          {agent.name} (ID: {agent.id}
                          {agent.externalId ? `, ${agent.externalId}` : ''})
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </>
            )}

            <div className="modal-actions">
              <button type="button" onClick={closeAssignModal}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleAssignCase()}
                disabled={!selectedAgentId || isLoadingAgents || isAssigning}
              >
                {isAssigning ? 'Assigning...' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
