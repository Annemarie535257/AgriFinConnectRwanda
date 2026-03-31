import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { LanguageProvider } from './context/LanguageContext'
import App from './App'
import { flushOfflineQueue } from './api/client'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </BrowserRouter>
  </React.StrictMode>
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((registration) => registration.unregister()))
    } catch {
      // Ignore service worker cleanup failures.
    }

    try {
      if ('caches' in window) {
        const cacheKeys = await caches.keys()
        await Promise.all(
          cacheKeys
            .filter((key) => key.startsWith('agrifinconnect-'))
            .map((key) => caches.delete(key))
        )
      }
    } catch {
      // Ignore cache cleanup failures.
    }
  })
}

flushOfflineQueue().catch(() => {
  // Offline queue sync is best effort.
})
