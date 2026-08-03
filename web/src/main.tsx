import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from 'next-themes'
import { Toaster } from 'sonner'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext'
import { CatalogProvider } from './context/CatalogContext'
import { CameraProvider } from './context/CameraContext'
import { SedeProvider } from './context/SedeContext'

// Sin esto, el service worker de la PWA se queda con el bundle del último deploy
// que el navegador vio: cerrar/reabrir la app no basta, hay que forzar la
// actualización (skipWaiting + recarga) en cuanto detecta una versión nueva.
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() { updateSW(true) },
  onRegisteredSW(_url, registration) {
    if (!registration) return
    setInterval(() => { registration.update() }, 60 * 60 * 1000)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <BrowserRouter>
        <AuthProvider>
          <SedeProvider>
            <CatalogProvider>
              <CameraProvider>
                <App />
              </CameraProvider>
            </CatalogProvider>
          </SedeProvider>
        </AuthProvider>
      </BrowserRouter>
      <Toaster richColors position="top-center" closeButton />
    </ThemeProvider>
  </StrictMode>,
)
