import { useRef, useEffect, useState } from 'react'
import { X, RotateCcw, Check } from 'lucide-react'

interface SignaturePadProps {
  onSave: (signatureBlob: Blob) => void
  onCancel: () => void
  clientName?: string
}

export default function SignaturePad({ onSave, onCancel, clientName }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Set up canvas for high DPI displays
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    
    const context = canvas.getContext('2d')
    if (!context) return

    context.scale(dpr, dpr)
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.lineWidth = 2.5
    context.strokeStyle = '#1a1a2e'
    
    // Fill white background
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, rect.width, rect.height)
    
    // Draw signature line
    context.strokeStyle = '#e5e7eb'
    context.lineWidth = 1
    context.beginPath()
    context.moveTo(20, rect.height - 40)
    context.lineTo(rect.width - 20, rect.height - 40)
    context.stroke()
    
    // Reset for signature drawing
    context.strokeStyle = '#1a1a2e'
    context.lineWidth = 2.5
    
    setCtx(context)
  }, [])

  const getCoordinates = (e: React.TouchEvent | React.MouseEvent): { x: number; y: number } | null => {
    const canvas = canvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()
    
    if ('touches' in e) {
      const touch = e.touches[0]
      if (!touch) return null
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      }
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      }
    }
  }

  const startDrawing = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault()
    const coords = getCoordinates(e)
    if (!coords || !ctx) return

    setIsDrawing(true)
    ctx.beginPath()
    ctx.moveTo(coords.x, coords.y)
  }

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault()
    if (!isDrawing || !ctx) return

    const coords = getCoordinates(e)
    if (!coords) return

    ctx.lineTo(coords.x, coords.y)
    ctx.stroke()
    setHasSignature(true)
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const clearSignature = () => {
    const canvas = canvasRef.current
    if (!canvas || !ctx) return

    const rect = canvas.getBoundingClientRect()
    
    // Clear and redraw background
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, rect.width, rect.height)
    
    // Redraw signature line
    ctx.strokeStyle = '#e5e7eb'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(20, rect.height - 40)
    ctx.lineTo(rect.width - 20, rect.height - 40)
    ctx.stroke()
    
    // Reset for signature drawing
    ctx.strokeStyle = '#1a1a2e'
    ctx.lineWidth = 2.5
    
    setHasSignature(false)
  }

  const saveSignature = () => {
    const canvas = canvasRef.current
    if (!canvas || !hasSignature) return

    canvas.toBlob((blob) => {
      if (blob) {
        onSave(blob)
      }
    }, 'image/png', 1.0)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Client Sign-Off</h2>
            {clientName && (
              <p className="text-sm text-gray-500">Signature for: {clientName}</p>
            )}
          </div>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Signature Area */}
        <div className="p-4">
          <p className="text-sm text-gray-600 mb-3">
            Please sign below to confirm work completion and acceptance
          </p>
          
          <div className="border-2 border-gray-200 rounded-lg overflow-hidden touch-none">
            <canvas
              ref={canvasRef}
              className="w-full cursor-crosshair"
              style={{ height: '200px' }}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
          </div>

          <p className="text-xs text-gray-400 mt-2 text-center">
            Sign above the line using finger or mouse
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-4 border-t bg-gray-50 rounded-b-xl">
          <button
            onClick={clearSignature}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Clear
          </button>
          
          <div className="flex-1" />
          
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          
          <button
            onClick={saveSignature}
            disabled={!hasSignature}
            className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check className="w-4 h-4" />
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}
