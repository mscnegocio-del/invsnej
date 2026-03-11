import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { CatalogProvider } from './context/CatalogContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CatalogProvider>
      <App />
    </CatalogProvider>
  </StrictMode>,
)
