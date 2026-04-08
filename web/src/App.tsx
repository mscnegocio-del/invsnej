import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { AuthGuard } from './components/AuthGuard'
import { AuthenticatedShell } from './components/AuthenticatedShell'
import { RoleGuard } from './components/RoleGuard'
import { Home } from './pages/Home'
import { Scan } from './pages/Scan'
import { Search } from './pages/Search'
import { BienDetail } from './pages/BienDetail'
import { Registro } from './pages/Registro'
import { EditarBien } from './pages/EditarBien'
import { Admin } from './pages/Admin'
import { Login } from './pages/Login'
import { AuthCallback } from './pages/AuthCallback'
import { Security } from './pages/Security'
import { Trabajadores } from './pages/Trabajadores'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route element={<AuthGuard />}>
        <Route element={<AuthenticatedShell />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/security" element={<Security />} />
            <Route path="/search" element={<Search />} />
            <Route path="/bienes/:id" element={<BienDetail />} />
            <Route
              path="/scan"
              element={
                <RoleGuard roles={['admin', 'operador']}>
                  <Scan />
                </RoleGuard>
              }
            />
            <Route
              path="/registro"
              element={
                <RoleGuard roles={['admin', 'operador']}>
                  <Registro />
                </RoleGuard>
              }
            />
            <Route
              path="/bienes/:id/editar"
              element={
                <RoleGuard roles={['admin', 'operador']}>
                  <EditarBien />
                </RoleGuard>
              }
            />
            <Route
              path="/admin"
              element={
                <RoleGuard roles={['admin']}>
                  <Admin />
                </RoleGuard>
              }
            />
            <Route
              path="/trabajadores"
              element={
                <RoleGuard roles={['admin']}>
                  <Trabajadores />
                </RoleGuard>
              }
            />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
