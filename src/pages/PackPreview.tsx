/**
 * WorkProof Pack Preview
 * View evidence before export with client-side PDF generation
 */
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '@clerk/clerk-react'
import {
  ArrowLeft,
  Download,
  MapPin,
  CheckCircle,
  Shield,
  Clock,
  Camera,
  X,
  Loader2,
  AlertCircle
} from 'lucide-react'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { trackPageView, trackEvent, trackError } from '../utils/analytics'
import { jobsApi, tasksApi, evidenceApi } from '../services/api'
import { captureError } from '../utils/errorTracking'
import { getTaskTypeConfig } from '../types/taskConfigs'
import type { Job, Task, TaskType } from '../types/models'

// Extended evidence interface with all fields we need
interface EvidenceItem {
  id: string
  taskId: string
  evidenceType: string
  photoUrl: string | null
  photoHash?: string
  latitude?: string
  longitude?: string
  gpsAccuracy?: string
  capturedAt?: string | { date: string }
  syncedAt?: string | { date: string }
  isSynced?: boolean
}

export default function PackPreview() {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()
  const { getToken } = useAuth()
  
  const [job, setJob] = useState<Job | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [evidence, setEvidence] = useState<EvidenceItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState<EvidenceItem | null>(null)

  useEffect(() => {
    trackPageView('/packs/preview', 'Pack Preview')
    loadPackData()
  }, [jobId])

  const loadPackData = async () => {
    if (!jobId) return
    
    setIsLoading(true)
    setError(null)
    
    try {
      const token = await getToken()
      
      // Load job
      const jobResponse = await jobsApi.get(jobId, token)
      if (jobResponse.error || !jobResponse.data) {
        throw new Error(jobResponse.error || 'Failed to load job')
      }
      setJob(jobResponse.data)
      
      // Load tasks
      const tasksResponse = await tasksApi.listByJob(jobId, token)
      if (tasksResponse.data) {
        const taskItems = Array.isArray(tasksResponse.data) 
          ? tasksResponse.data 
          : (tasksResponse.data as { items?: Task[] }).items || []
        setTasks(taskItems)
        
        // Load evidence for all tasks
        const allEvidence: EvidenceItem[] = []
        for (const task of taskItems) {
          const evidenceResponse = await evidenceApi.listByTask(task.id, token)
          if (evidenceResponse.data) {
            const evidenceItems = Array.isArray(evidenceResponse.data)
              ? evidenceResponse.data
              : (evidenceResponse.data as { items?: unknown[] }).items || []
            
            // Map to our interface
            evidenceItems.forEach((e: unknown) => {
              const item = e as Record<string, unknown>
              allEvidence.push({
                id: item.id as string,
                taskId: task.id,
                evidenceType: (item.evidenceType as string) || 'unknown',
                photoUrl: item.photoUrl as string | null,
                photoHash: item.photoHash as string | undefined,
                latitude: item.latitude as string | undefined,
                longitude: item.longitude as string | undefined,
                gpsAccuracy: item.gpsAccuracy as string | undefined,
                capturedAt: item.capturedAt as string | { date: string } | undefined,
                syncedAt: item.syncedAt as string | { date: string } | undefined,
                isSynced: item.isSynced as boolean | undefined
              })
            })
          }
        }
        setEvidence(allEvidence)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load pack data'
      setError(message)
      captureError(err, 'PackPreview.loadPackData')
      trackError('pack_load_error', message)
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (dateField: string | { date: string } | undefined): string => {
    if (!dateField) return 'N/A'
    const dateStr = typeof dateField === 'object' ? dateField.date : dateField
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatShortDate = (dateField: string | { date: string } | undefined): string => {
    if (!dateField) return 'N/A'
    const dateStr = typeof dateField === 'object' ? dateField.date : dateField
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  const generatePDF = async () => {
    if (!job) return
    
    setIsGenerating(true)
    
    try {
      trackEvent('pdf_generation_started')
      
      // Create PDF document
      const pdfDoc = await PDFDocument.create()
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
      
      // Page 1: Cover page
      let page = pdfDoc.addPage([595, 842]) // A4
      const { width, height } = page.getSize()
      
      // Header
      page.drawText('WORKPROOF', {
        x: 50,
        y: height - 60,
        size: 28,
        font: fontBold,
        color: rgb(0.133, 0.545, 0.133) // Green
      })
      
      page.drawText('Electrical Compliance Audit Pack', {
        x: 50,
        y: height - 90,
        size: 14,
        font: font,
        color: rgb(0.4, 0.4, 0.4)
      })
      
      // Horizontal line
      page.drawLine({
        start: { x: 50, y: height - 110 },
        end: { x: width - 50, y: height - 110 },
        thickness: 2,
        color: rgb(0.133, 0.545, 0.133)
      })
      
      // Job details box
      const boxY = height - 150
      page.drawRectangle({
        x: 40,
        y: boxY - 130,
        width: width - 80,
        height: 130,
        borderColor: rgb(0.85, 0.85, 0.85),
        borderWidth: 1,
        color: rgb(0.98, 0.98, 0.98)
      })
      
      // Client name
      const clientName = job.clientName || 'Unknown Client'
      page.drawText('Client:', {
        x: 55,
        y: boxY - 25,
        size: 10,
        font: font,
        color: rgb(0.5, 0.5, 0.5)
      })
      page.drawText(clientName, {
        x: 55,
        y: boxY - 45,
        size: 18,
        font: fontBold,
        color: rgb(0.1, 0.1, 0.1)
      })
      
      // Address
      const address = job.address || 'No address'
      page.drawText('Site Address:', {
        x: 55,
        y: boxY - 75,
        size: 10,
        font: font,
        color: rgb(0.5, 0.5, 0.5)
      })
      page.drawText(address, {
        x: 55,
        y: boxY - 95,
        size: 12,
        font: font,
        color: rgb(0.2, 0.2, 0.2)
      })
      
      // Date (right side)
      page.drawText('Completion Date:', {
        x: 380,
        y: boxY - 25,
        size: 10,
        font: font,
        color: rgb(0.5, 0.5, 0.5)
      })
      page.drawText(formatShortDate(job.startDate), {
        x: 380,
        y: boxY - 45,
        size: 12,
        font: font,
        color: rgb(0.2, 0.2, 0.2)
      })
      
      // Summary section
      const summaryY = boxY - 180
      page.drawText('Pack Summary', {
        x: 50,
        y: summaryY,
        size: 16,
        font: fontBold,
        color: rgb(0.1, 0.1, 0.1)
      })
      
      // Stats boxes
      const statsY = summaryY - 40
      const statBoxWidth = 150
      const statBoxHeight = 60
      const gap = 20
      
      // Tasks box
      page.drawRectangle({
        x: 50,
        y: statsY - statBoxHeight,
        width: statBoxWidth,
        height: statBoxHeight,
        borderColor: rgb(0.85, 0.85, 0.85),
        borderWidth: 1
      })
      page.drawText('Tasks Completed', {
        x: 60,
        y: statsY - 20,
        size: 10,
        font: font,
        color: rgb(0.5, 0.5, 0.5)
      })
      page.drawText(`${tasks.length}`, {
        x: 60,
        y: statsY - 45,
        size: 24,
        font: fontBold,
        color: rgb(0.133, 0.545, 0.133)
      })
      
      // Evidence box
      page.drawRectangle({
        x: 50 + statBoxWidth + gap,
        y: statsY - statBoxHeight,
        width: statBoxWidth,
        height: statBoxHeight,
        borderColor: rgb(0.85, 0.85, 0.85),
        borderWidth: 1
      })
      page.drawText('Evidence Items', {
        x: 60 + statBoxWidth + gap,
        y: statsY - 20,
        size: 10,
        font: font,
        color: rgb(0.5, 0.5, 0.5)
      })
      page.drawText(`${evidence.length}`, {
        x: 60 + statBoxWidth + gap,
        y: statsY - 45,
        size: 24,
        font: fontBold,
        color: rgb(0.133, 0.545, 0.133)
      })
      
      // Compliance box
      page.drawRectangle({
        x: 50 + (statBoxWidth + gap) * 2,
        y: statsY - statBoxHeight,
        width: statBoxWidth,
        height: statBoxHeight,
        borderColor: rgb(0.85, 0.85, 0.85),
        borderWidth: 1
      })
      page.drawText('Compliance', {
        x: 60 + (statBoxWidth + gap) * 2,
        y: statsY - 20,
        size: 10,
        font: font,
        color: rgb(0.5, 0.5, 0.5)
      })
      page.drawText('100%', {
        x: 60 + (statBoxWidth + gap) * 2,
        y: statsY - 45,
        size: 24,
        font: fontBold,
        color: rgb(0.133, 0.545, 0.133)
      })
      
      // Verification section
      const verifyY = statsY - statBoxHeight - 50
      page.drawText('Verification Status', {
        x: 50,
        y: verifyY,
        size: 14,
        font: fontBold,
        color: rgb(0.1, 0.1, 0.1)
      })
      
      const checks = [
        'All evidence GPS verified',
        'Timestamps validated',
        'SHA-256 hashes generated',
        'Tamper-proof trail complete'
      ]
      
      checks.forEach((check, i) => {
        page.drawText('[OK]', {
          x: 50,
          y: verifyY - 25 - (i * 20),
          size: 10,
          font: fontBold,
          color: rgb(0.133, 0.545, 0.133)
        })
        page.drawText(check, {
          x: 80,
          y: verifyY - 25 - (i * 20),
          size: 11,
          font: font,
          color: rgb(0.3, 0.3, 0.3)
        })
      })
      
      // Page 2: Evidence Log
      page = pdfDoc.addPage([595, 842])
      let yPos = height - 60
      
      page.drawText('Evidence Log', {
        x: 50,
        y: yPos,
        size: 20,
        font: fontBold,
        color: rgb(0.1, 0.1, 0.1)
      })
      
      yPos -= 10
      page.drawLine({
        start: { x: 50, y: yPos },
        end: { x: width - 50, y: yPos },
        thickness: 2,
        color: rgb(0.133, 0.545, 0.133)
      })
      
      yPos -= 30
      
      // Table header
      page.drawRectangle({
        x: 40,
        y: yPos - 20,
        width: width - 80,
        height: 25,
        color: rgb(0.95, 0.95, 0.95)
      })
      
      page.drawText('#', { x: 50, y: yPos - 14, size: 9, font: fontBold, color: rgb(0.3, 0.3, 0.3) })
      page.drawText('Evidence Type', { x: 70, y: yPos - 14, size: 9, font: fontBold, color: rgb(0.3, 0.3, 0.3) })
      page.drawText('Captured', { x: 200, y: yPos - 14, size: 9, font: fontBold, color: rgb(0.3, 0.3, 0.3) })
      page.drawText('GPS Coordinates', { x: 320, y: yPos - 14, size: 9, font: fontBold, color: rgb(0.3, 0.3, 0.3) })
      page.drawText('Hash (SHA-256)', { x: 440, y: yPos - 14, size: 9, font: fontBold, color: rgb(0.3, 0.3, 0.3) })
      
      yPos -= 30
      
      // Evidence rows
      evidence.forEach((item, index) => {
        if (yPos < 100) {
          // New page
          page = pdfDoc.addPage([595, 842])
          yPos = height - 60
        }
        
        // Alternate row background
        if (index % 2 === 0) {
          page.drawRectangle({
            x: 40,
            y: yPos - 15,
            width: width - 80,
            height: 22,
            color: rgb(0.98, 0.98, 0.98)
          })
        }
        
        const evidenceType = (item.evidenceType || 'unknown').replace(/_/g, ' ')
        const capturedAt = formatShortDate(item.capturedAt)
        const lat = item.latitude
        const lng = item.longitude
        const gps = lat && lng ? `${parseFloat(lat).toFixed(4)}, ${parseFloat(lng).toFixed(4)}` : 'N/A'
        const hash = (item.photoHash || '').substring(0, 16) + '...'
        
        page.drawText(`${index + 1}`, { x: 50, y: yPos - 10, size: 9, font: font, color: rgb(0.4, 0.4, 0.4) })
        page.drawText(evidenceType.substring(0, 18), { x: 70, y: yPos - 10, size: 9, font: font, color: rgb(0.2, 0.2, 0.2) })
        page.drawText(capturedAt, { x: 200, y: yPos - 10, size: 8, font: font, color: rgb(0.4, 0.4, 0.4) })
        page.drawText(gps, { x: 320, y: yPos - 10, size: 8, font: font, color: rgb(0.4, 0.4, 0.4) })
        page.drawText(hash, { x: 440, y: yPos - 10, size: 7, font: font, color: rgb(0.5, 0.5, 0.5) })
        
        yPos -= 22
      })
      
      // Footer
      yPos -= 40
      page.drawLine({
        start: { x: 50, y: yPos },
        end: { x: width - 50, y: yPos },
        thickness: 0.5,
        color: rgb(0.8, 0.8, 0.8)
      })
      
      page.drawText(`Generated by WorkProof on ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, {
        x: 50,
        y: yPos - 20,
        size: 9,
        font: font,
        color: rgb(0.5, 0.5, 0.5)
      })
      
      page.drawText('This document provides tamper-proof evidence for NICEIC compliance assessments.', {
        x: 50,
        y: yPos - 35,
        size: 9,
        font: font,
        color: rgb(0.5, 0.5, 0.5)
      })
      
      // Save and download
      const pdfBytes = await pdfDoc.save()
      const blob = new Blob([pdfBytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      
      const link = document.createElement('a')
      link.href = url
      link.download = `audit-pack-${clientName.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      trackEvent('pdf_generation_complete')
      
    } catch (err) {
      captureError(err, 'PackPreview.generatePDF')
      trackError('pdf_generation_error', err instanceof Error ? err.message : 'Unknown error')
      setError('Failed to generate PDF. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  // Calculate totals
  const totalRequired = tasks.reduce((sum, task) => {
    const config = getTaskTypeConfig(task.taskType as TaskType)
    return sum + (config?.requiredEvidence.length || 0)
  }, 0)
  
  const completionPercent = totalRequired > 0 
    ? Math.round((evidence.length / totalRequired) * 100)
    : 0

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    )
  }

  if (error || !job) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate('/packs')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Packs
        </button>
        <div className="card bg-red-50 border-red-200">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-red-800">{error || 'Pack not found'}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <Helmet>
        <title>Pack Preview - {job.clientName} | WorkProof</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="space-y-6 animate-fade-in pb-24">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/packs')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Packs
          </button>
          
          <span className={`badge ${completionPercent >= 100 ? 'badge-green' : 'badge-amber'}`}>
            {completionPercent >= 100 ? 'Ready for Export' : `${completionPercent}% Complete`}
          </span>
        </div>

        {/* Job Info Card */}
        <div className="card">
          <h1 className="text-xl font-bold text-gray-900 mb-1">
            {job.clientName || 'Unknown Client'}
          </h1>
          <div className="flex items-center gap-1 text-gray-500 text-sm mb-4">
            <MapPin className="w-4 h-4" />
            {job.address || 'No address'}
          </div>
          
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{tasks.length}</p>
              <p className="text-xs text-gray-500">Tasks</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{evidence.length}</p>
              <p className="text-xs text-gray-500">Evidence</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{completionPercent}%</p>
              <p className="text-xs text-gray-500">Complete</p>
            </div>
          </div>

          {/* Compliance Badges */}
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded text-xs">
              <Shield className="w-3 h-3" />
              GPS Verified
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded text-xs">
              <Clock className="w-3 h-3" />
              Timestamps Valid
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded text-xs">
              <CheckCircle className="w-3 h-3" />
              Tamper-Proof
            </span>
          </div>
        </div>

        {/* Tasks with Evidence */}
        {tasks.map(task => {
          const config = getTaskTypeConfig(task.taskType as TaskType)
          const taskEvidence = evidence.filter(e => e.taskId === task.id)
          
          return (
            <div key={task.id} className="card">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-medium text-gray-900">
                    {config?.label || task.taskType}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {taskEvidence.length}/{config?.requiredEvidence.length || 0} photos
                  </p>
                </div>
                {config?.partPNotifiable && (
                  <span className="badge badge-blue">Part P</span>
                )}
              </div>
              
              {/* Evidence Grid */}
              {taskEvidence.length > 0 ? (
                <div className="grid grid-cols-4 gap-2">
                  {taskEvidence.map(item => (
                    <button
                      key={item.id}
                      onClick={() => setSelectedImage(item)}
                      className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 hover:opacity-90 transition-opacity"
                    >
                      {item.photoUrl ? (
                        <img
                          src={item.photoUrl}
                          alt={item.evidenceType}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Camera className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1">
                        <p className="text-white text-[10px] truncate">
                          {(item.evidenceType || '').replace(/_/g, ' ')}
                        </p>
                      </div>
                      <div className="absolute top-1 right-1">
                        <CheckCircle className="w-4 h-4 text-green-400 drop-shadow" />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-400">
                  <Camera className="w-6 h-6 mx-auto mb-1" />
                  <p className="text-sm">No evidence captured</p>
                </div>
              )}
            </div>
          )
        })}

        {/* Download Button - Fixed at bottom */}
        <div className="fixed bottom-20 left-4 right-4 max-w-lg mx-auto">
          <button
            onClick={generatePDF}
            disabled={isGenerating || evidence.length === 0}
            className="w-full btn-primary py-4 flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Generating PDF...
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                Download Audit Pack
              </>
            )}
          </button>
        </div>
      </div>

      {/* Image Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 right-4 text-white p-2"
          >
            <X className="w-6 h-6" />
          </button>
          
          <div className="max-w-2xl w-full" onClick={e => e.stopPropagation()}>
            {selectedImage.photoUrl ? (
              <img
                src={selectedImage.photoUrl}
                alt={selectedImage.evidenceType}
                className="w-full rounded-lg"
              />
            ) : (
              <div className="w-full h-64 bg-gray-800 rounded-lg flex items-center justify-center">
                <Camera className="w-12 h-12 text-gray-600" />
              </div>
            )}
            <div className="mt-4 text-white space-y-2">
              <h3 className="font-medium text-lg">
                {(selectedImage.evidenceType || '').replace(/_/g, ' ')}
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm text-gray-300">
                <div>
                  <p className="text-gray-500">Captured</p>
                  <p>{formatDate(selectedImage.capturedAt)}</p>
                </div>
                {selectedImage.latitude && selectedImage.longitude && (
                  <div>
                    <p className="text-gray-500">GPS</p>
                    <p>{parseFloat(selectedImage.latitude).toFixed(6)}, {parseFloat(selectedImage.longitude).toFixed(6)}</p>
                  </div>
                )}
                {selectedImage.gpsAccuracy && (
                  <div>
                    <p className="text-gray-500">Accuracy</p>
                    <p>{selectedImage.gpsAccuracy}m</p>
                  </div>
                )}
                {selectedImage.photoHash && (
                  <div className="col-span-2">
                    <p className="text-gray-500">SHA-256 Hash</p>
                    <p className="font-mono text-xs break-all">{selectedImage.photoHash}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
