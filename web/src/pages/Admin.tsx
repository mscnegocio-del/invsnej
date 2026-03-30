import { useState } from 'react'
import { AdminSigaPanel } from '../components/AdminSigaPanel'
import { AdminUsuarios } from '../components/AdminUsuarios'

type Tab = 'siga' | 'usuarios'

export function Admin() {
  const [tab, setTab] = useState<Tab>('siga')

  return (
    <div>
      <h1 className="page-title">Administración</h1>

      <div className="mt-4 flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setTab('siga')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'siga' ? 'bg-teal-50 text-teal-800 ring-1 ring-teal-200' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Base SIGA PJ
        </button>
        <button
          type="button"
          onClick={() => setTab('usuarios')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'usuarios' ? 'bg-teal-50 text-teal-800 ring-1 ring-teal-200' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Usuarios
        </button>
      </div>

      <div className="mt-6">{tab === 'siga' ? <AdminSigaPanel /> : <AdminUsuarios />}</div>
    </div>
  )
}
