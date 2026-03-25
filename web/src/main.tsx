import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { CatalogProvider } from './context/CatalogContext'
import { CameraProvider } from './context/CameraContext'
import { SedeProvider } from './context/SedeContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SedeProvider>
      <CatalogProvider>
        <CameraProvider>
          <App />
        </CameraProvider>
      </CatalogProvider>
    </SedeProvider>
  </StrictMode>,
)
