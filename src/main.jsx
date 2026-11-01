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
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'))
}
