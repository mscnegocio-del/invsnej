import { useCallback } from 'react'
import { BarcodeScanner } from './BarcodeScanner'

type Props = {
  onDetected: (code: string) => void
  onClose: () => void
}

export function BarcodeScanModal({ onDetected, onClose }: Props) {
  const handleDetected = useCallback(
    (code: string) => {
      onDetected(code)
      onClose()
    },
    [onDetected, onClose],
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="font-semibold text-slate-900">Escanear código</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            ✕
          </button>
        </div>
        <div className="p-4 max-h-[80vh] overflow-y-auto">
          <BarcodeScanner onDetected={handleDetected} />
        </div>
      </div>
    </div>
  )
}
