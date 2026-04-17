import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from 'next-themes'
import { Toaster } from 'sonner'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext'
import { CatalogProvider } from './context/CatalogContext'
import { CameraProvider } from './context/CameraContext'
import { SedeProvider } from './context/SedeContext'

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
