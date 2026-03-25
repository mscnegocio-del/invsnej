import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Home } from './pages/Home'
import { Scan } from './pages/Scan'
import { Search } from './pages/Search'
import { BienDetail } from './pages/BienDetail'
import { Registro } from './pages/Registro'
import { EditarBien } from './pages/EditarBien'
import { SedeSelector } from './pages/SedeSelector'
import { Admin } from './pages/Admin'
import { useSede } from './context/SedeContext'

function App() {
  const { sedeActiva, loading } = useSede()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-600">Cargando sede...</p>
      </div>
    )
  }

  if (!sedeActiva) {
    return <SedeSelector />
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/scan" element={<Scan />} />
          <Route path="/search" element={<Search />} />
          <Route path="/registro" element={<Registro />} />
          <Route path="/bienes/:id" element={<BienDetail />} />
          <Route path="/bienes/:id/editar" element={<EditarBien />} />
          <Route path="/admin" element={<Admin />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
