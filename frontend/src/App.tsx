import { Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import './App.css'
import { AppLayout } from './components/AppLayout'
import { CoordinatorPage } from './pages/CoordinatorPage'
import { AgentPage } from './pages/AgentPage'
import { SupervisorPage } from './pages/SupervisorPage'
import { CaseDetailPage } from './pages/CaseDetailPage'

function App() {
  return (
    <AppLayout>
      <Toaster position="top-right" richColors closeButton />
      <Routes>
        <Route path="/" element={<Navigate to="/cases" replace />} />
        <Route path="/cases" element={<CoordinatorPage />} />
        <Route path="/cases/:caseId" element={<CaseDetailPage />} />
        <Route path="/coordinator" element={<Navigate to="/cases" replace />} />
        <Route path="/agent" element={<AgentPage />} />
        <Route path="/supervisor" element={<SupervisorPage />} />
        <Route path="*" element={<Navigate to="/cases" replace />} />
      </Routes>
    </AppLayout>
  )
}

export default App
