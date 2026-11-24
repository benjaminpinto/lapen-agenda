import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { registerSW } from 'virtual:pwa-register'
import App from './App.jsx'
import './index.css'

// With registerType 'autoUpdate' this reloads the page as soon as a new service worker takes over,
// so nobody keeps running the old bundle. An installed app (home screen) is usually resumed rather
// than reloaded, so also look for a new version every time it comes back to the foreground.
registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && navigator.onLine) registration.update()
    })
  },
})

console.log('Lapen Agenda Updated: ' + new Date().toISOString());
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <Analytics />
    <SpeedInsights />
  </StrictMode>,
)