import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import 'sonner/dist/styles.css'
import { BrowserRouter } from 'react-router-dom'
import { registerServiceWorker } from './lib/registerServiceWorker'

if (import.meta.env.PROD) {
  registerServiceWorker()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
