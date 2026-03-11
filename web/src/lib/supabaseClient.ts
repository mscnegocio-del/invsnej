import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  // En desarrollo, ayuda a detectar configuración faltante
  console.warn(
    '[supabaseClient] Falta configurar VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en el entorno.',
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

