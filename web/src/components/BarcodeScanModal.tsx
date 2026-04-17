import { useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
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
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-lg p-0 overflow-hidden">
        <DialogHeader className="px-4 py-3 border-b border-border">
          <DialogTitle>Escanear código de barras</DialogTitle>
        </DialogHeader>
        <div className="p-4 max-h-[80vh] overflow-y-auto">
          <BarcodeScanner onDetected={handleDetected} hideManualInput />
        </div>
      </DialogContent>
    </Dialog>
  )
}
