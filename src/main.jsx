import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { bootstrapInfrastructure } from '@/lib/infra/app-bootstrap'

// Initialize all infrastructure primitives before React renders:
// logger → perf monitor → event queue → error capture → network monitoring
bootstrapInfrastructure()

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)