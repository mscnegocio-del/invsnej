import { AdminSigaPanel } from '../components/AdminSigaPanel'
import { AdminUsuarios } from '../components/AdminUsuarios'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'

export function Admin() {
  return (
    <div>
      <h1 className="page-title">Administración</h1>

      <Tabs defaultValue="siga" className="mt-6">
        <TabsList>
          <TabsTrigger value="siga">Base SIGA PJ</TabsTrigger>
          <TabsTrigger value="usuarios">Usuarios</TabsTrigger>
        </TabsList>
        <TabsContent value="siga" className="mt-6">
          <AdminSigaPanel />
        </TabsContent>
        <TabsContent value="usuarios" className="mt-6">
          <AdminUsuarios />
        </TabsContent>
      </Tabs>
    </div>
  )
}
