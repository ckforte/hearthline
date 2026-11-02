import React from 'react'
import { createRoot } from 'react-dom/client'
import CloudApp from './CloudApp'
import './styles.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <CloudApp />
  </React.StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', async () => {
    const registration = await navigator.serviceWorker.register('./sw.js')
    const announceUpdate = () => {
      if (!registration.waiting) return
      window.__hearthlineUpdateRegistration = registration
      window.dispatchEvent(new CustomEvent('hearthline-update-ready', { detail: registration }))
    }
    if (registration.waiting) announceUpdate()
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing
      worker?.addEventListener('statechange', () => { if (worker.state === 'installed' && navigator.serviceWorker.controller) announceUpdate() })
    })
    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    })
  })
}
