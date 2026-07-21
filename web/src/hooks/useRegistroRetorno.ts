import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import type { AgentCard } from './useAIChat'

// Al volver de /registro con ?registrado=<id>, inserta en el chat la
// confirmación del registro con la ficha del bien recién creado.
export function useRegistroRetorno(
  appendAssistantMessage: (content: string, cards?: AgentCard[]) => void,
) {
  const [searchParams, setSearchParams] = useSearchParams()
  const procesadoRef = useRef(false)

  useEffect(() => {
    const registradoId = searchParams.get('registrado')
    if (!registradoId || procesadoRef.current) return
    procesadoRef.current = true

    // Limpiar el parámetro para que un refresh no repita el mensaje
    const next = new URLSearchParams(searchParams)
    next.delete('registrado')
    setSearchParams(next, { replace: true })

    void (async () => {
      const { data } = await supabase
        .from('bienes')
        .select('*, trabajadores(nombre)')
        .eq('id', Number(registradoId))
        .is('eliminado_at', null)
        .maybeSingle()

      if (data) {
        appendAssistantMessage(
          `✅ Has registrado exitosamente "${data.nombre_mueble_equipo}" (código ${data.codigo_patrimonial}). ¿Registramos otro bien o necesitas algo más?`,
          [{ tipo: 'bien', payload: data }],
        )
      } else {
        appendAssistantMessage(
          'Volviste del formulario de registro, pero no pude encontrar el bien recién creado. Verifica en Buscar bienes si se guardó correctamente.',
        )
      }
    })()
  }, [searchParams, setSearchParams, appendAssistantMessage])
}
