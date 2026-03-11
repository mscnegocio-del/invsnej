import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Home } from './pages/Home'
import { Scan } from './pages/Scan'
import { Search } from './pages/Search'
import { BienDetail } from './pages/BienDetail'
import { Registro } from './pages/Registro'
import { EditarBien } from './pages/EditarBien'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/scan" element={<Scan />} />
        <Route path="/search" element={<Search />} />
        <Route path="/registro" element={<Registro />} />
        <Route path="/bienes/:id" element={<BienDetail />} />
        <Route path="/bienes/:id/editar" element={<EditarBien />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
