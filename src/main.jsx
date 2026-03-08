import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './insurance-agent-prototype.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
