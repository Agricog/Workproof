/**
 * WorkProof Pack Preview
 * View evidence before export with client-side PDF generation including photos and QR verification
 * Uses single API call for all data (job, tasks, evidence) to prevent token expiration
 */
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '@clerk/clerk-react'
import {
  ArrowLeft,
  Download,
  MapPin,
  Shield,
  Camera,
  X,
  Loader2,
  AlertCircle,
  QrCode,
  Mail,
  CheckCircle,
  PenTool
} from 'lucide-react'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { trackPageView, trackError } from '../utils/analytics'
import { auditPackApi } from '../services/api'
import { captureError } from '../utils/errorTracking'
import { getTaskTypeConfig } from '../types/taskConfigs'
import SignaturePad from '../components/SignaturePad'
import type { Job, Task, TaskType } from '../types/models'

interface EvidenceItem {
  id: string
  taskId: string
  evidenceType: string
  photoStage?: string | null
  photoUrl: string | null
  photoHash?: string | null
  latitude?: number | null
  longitude?: number | null
  gpsAccuracy?: number | null
  capturedAt?: string | null
  notes?: string | null
}

interface PackDataResponse {
  job: Job & { taskCount: number; evidenceCount: number }
  tasks: Array<{
    id: string
    jobId: string
    taskType: string
    status: string
    notes: string
    order: number
  }>
  evidence: EvidenceItem[]
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
  const [generatingStatus, setGeneratingStatus] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState<EvidenceItem | null>(null)
  const [showShareModal, setShowShareModal] = useState(false)
  const [shareEmail, setShareEmail] = useState('')
  const [isSharing, setIsSharing] = useState(false)
  const [shareSuccess, setShareSuccess] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)
  const [lastGeneratedPackId, setLastGeneratedPackId] = useState<string | null>(null)
  
  // Signature state
  const [showSignatureModal, setShowSignatureModal] = useState(false)
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null)

  useEffect(() => {
    trackPageView('/packs/preview', 'Pack Preview')
    loadPackData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId])

  const loadPackData = async () => {
    if (!jobId) return
    
    setIsLoading(true)
    setError(null)
    
    try {
      const token = await getToken()
      const API_BASE = import.meta.env.VITE_API_URL || ''
      
      const response = await fetch(`${API_BASE}/api/jobs/${jobId}/pack-data`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      })
      
      if (!response.ok) {
        if (response.status === 401) throw new Error('Session expired. Please refresh the page.')
        if (response.status === 403) throw new Error('You do not have permission to view this job.')
        throw new Error('Failed to load pack data')
      }
      
      const data: PackDataResponse = await response.json()
      setJob(data.job)
      setTasks(data.tasks as unknown as Task[])
      setEvidence(data.evidence)
    } catch (err) {
      captureError(err, 'PackPreview.loadPackData')
      trackError('pack_load_error', err instanceof Error ? err.message : 'Unknown error')
      setError(err instanceof Error ? err.message : 'Failed to load pack data. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (dateField: string | { date: string } | null | undefined): string => {
    if (!dateField) return 'N/A'
    const dateStr = typeof dateField === 'object' ? dateField.date : dateField
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const formatShortDate = (dateField: string | { date: string } | null | undefined): string => {
    if (!dateField) return 'N/A'
    const dateStr = typeof dateField === 'object' ? dateField.date : dateField
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const fetchImageBytes = async (url: string): Promise<Uint8Array | null> => {
    try {
      const token = await getToken()
      const API_BASE = import.meta.env.VITE_API_URL || ''
      const proxyUrl = `${API_BASE}/api/images/proxy?url=${encodeURIComponent(url)}`
      const response = await fetch(proxyUrl, { headers: { 'Authorization': `Bearer ${token}` }, credentials: 'include' })
      if (!response.ok) return null
      return new Uint8Array(await response.arrayBuffer())
    } catch { return null }
  }

  const fetchQRCodeBytes = async (url: string): Promise<Uint8Array | null> => {
    try {
      const token = await getToken()
      const API_BASE = import.meta.env.VITE_API_URL || ''
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&format=png&data=${encodeURIComponent(url)}`
      const proxyUrl = `${API_BASE}/api/images/proxy?url=${encodeURIComponent(qrApiUrl)}`
      const response = await fetch(proxyUrl, { headers: { 'Authorization': `Bearer ${token}` }, credentials: 'include' })
      if (!response.ok) return null
      return new Uint8Array(await response.arrayBuffer())
    } catch { return null }
  }

  const handleSignatureSave = async (signatureBlob: Blob) => {
    if (!jobId || !lastGeneratedPackId) return
    try {
      const token = await getToken()
      const API_BASE = import.meta.env.VITE_API_URL || ''
      const filename = `signature-${Date.now()}.png`
      
      // 1. Get signed upload URL
      const urlRes = await fetch(`${API_BASE}/api/evidence/upload-url`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ filename, content_type: 'image/png', job_id: jobId })
      })
      if (!urlRes.ok) throw new Error('Failed to get upload URL')
      const { upload_url, photo_url } = await urlRes.json()
      
      // 2. Upload to R2
      const uploadRes = await fetch(upload_url, { method: 'PUT', headers: { 'Content-Type': 'image/png' }, body: signatureBlob })
      if (!uploadRes.ok) throw new Error('Failed to upload signature')
      
      // 3. Save signature URL to audit pack record
      const saveRes = await fetch(`${API_BASE}/api/audit-packs/${lastGeneratedPackId}/signature`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ signature_url: photo_url })
      })
      if (!saveRes.ok) throw new Error('Failed to save signature to audit pack')
      
      setSignatureUrl(photo_url)
      setShowSignatureModal(false)
    } catch (err) {
      captureError(err, 'PackPreview.handleSignatureSave')
      setError('Failed to save signature. Please try again.')
    }
  }

  const generatePDF = async () => {
    if (!job || !jobId) return
    
    setIsGenerating(true)
    setGeneratingStatus('Creating audit pack record...')
    
    try {
      const token = await getToken()
      
      const auditPackResponse = await auditPackApi.generate(jobId, token)
      if (auditPackResponse.error || !auditPackResponse.data) {
        throw new Error(auditPackResponse.error || 'Failed to create audit pack record')
      }
      
      const auditPackId = auditPackResponse.data.id
      const packHash = auditPackResponse.data.hash
      setLastGeneratedPackId(auditPackId)
      
      const verifyUrl = `https://workproof.co.uk/verify/${auditPackId}`
      setGeneratingStatus('Generating verification QR code...')
      const qrCodeBytes = await fetchQRCodeBytes(verifyUrl)
      
      setGeneratingStatus('Creating document...')
      
      const pdfDoc = await PDFDocument.create()
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
      
      const width = 595
      const height = 842
      
      const clientName = job.clientName || 'Unknown Client'
      const address = job.address || ''
      const postcode = job.postcode || ''
      const jobData = job as Job & { jobType?: string; jobTypeDescription?: string }
      const jobType = jobData.jobType || 'Electrical Work'
      const jobTypeDescription = jobData.jobTypeDescription || ''
      
      // Page 1: Cover Page
      let page = pdfDoc.addPage([width, height])
      
      page.drawRectangle({ x: 0, y: height - 80, width, height: 80, color: rgb(0.133, 0.545, 0.133) })
      page.drawText('WorkProof', { x: 50, y: height - 50, size: 28, font: fontBold, color: rgb(1, 1, 1) })
      page.drawText('AUDIT PACK', { x: 50, y: height - 70, size: 12, font, color: rgb(0.9, 0.9, 0.9) })
      
      if (qrCodeBytes) {
        try {
          const qrImage = await pdfDoc.embedPng(qrCodeBytes)
          page.drawImage(qrImage, { x: width - 140, y: height - 75, width: 60, height: 60 })
          page.drawText('Scan to Verify', { x: width - 145, y: height - 78, size: 7, font, color: rgb(1, 1, 1) })
        } catch {}
      }
      
      let yPos = height - 130
      page.drawText('Client Details', { x: 50, y: yPos, size: 16, font: fontBold, color: rgb(0.2, 0.2, 0.2) })
      
      yPos -= 30
      page.drawText('Client:', { x: 50, y: yPos, size: 11, font, color: rgb(0.5, 0.5, 0.5) })
      page.drawText(clientName, { x: 120, y: yPos, size: 11, font: fontBold, color: rgb(0.1, 0.1, 0.1) })
      
      yPos -= 20
      page.drawText('Address:', { x: 50, y: yPos, size: 11, font, color: rgb(0.5, 0.5, 0.5) })
      page.drawText(address, { x: 120, y: yPos, size: 11, font, color: rgb(0.1, 0.1, 0.1) })
      
      yPos -= 20
      page.drawText('Postcode:', { x: 50, y: yPos, size: 11, font, color: rgb(0.5, 0.5, 0.5) })
      page.drawText(postcode, { x: 120, y: yPos, size: 11, font, color: rgb(0.1, 0.1, 0.1) })
      
      yPos -= 20
      page.drawText('Job Type:', { x: 50, y: yPos, size: 11, font, color: rgb(0.5, 0.5, 0.5) })
      page.drawText(jobType === 'custom' && jobTypeDescription ? jobTypeDescription : jobType.replace(/_/g, ' '), { x: 120, y: yPos, size: 11, font, color: rgb(0.1, 0.1, 0.1) })
      
      yPos -= 20
      page.drawText('Generated:', { x: 50, y: yPos, size: 11, font, color: rgb(0.5, 0.5, 0.5) })
      page.drawText(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }), { x: 120, y: yPos, size: 11, font, color: rgb(0.1, 0.1, 0.1) })
      
      yPos -= 50
      page.drawLine({ start: { x: 50, y: yPos }, end: { x: width - 50, y: yPos }, thickness: 1, color: rgb(0.8, 0.8, 0.8) })
      
      yPos -= 30
      page.drawText('Pack Summary', { x: 50, y: yPos, size: 16, font: fontBold, color: rgb(0.2, 0.2, 0.2) })
      
      yPos -= 30
      const boxWidth = 150, boxHeight = 60, boxGap = 20
      
      page.drawRectangle({ x: 50, y: yPos - boxHeight, width: boxWidth, height: boxHeight, color: rgb(0.95, 0.95, 0.95), borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 1 })
      page.drawText('Tasks', { x: 60, y: yPos - 20, size: 10, font, color: rgb(0.5, 0.5, 0.5) })
      page.drawText(tasks.length.toString(), { x: 60, y: yPos - 45, size: 24, font: fontBold, color: rgb(0.133, 0.545, 0.133) })
      
      page.drawRectangle({ x: 50 + boxWidth + boxGap, y: yPos - boxHeight, width: boxWidth, height: boxHeight, color: rgb(0.95, 0.95, 0.95), borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 1 })
      page.drawText('Evidence Items', { x: 60 + boxWidth + boxGap, y: yPos - 20, size: 10, font, color: rgb(0.5, 0.5, 0.5) })
      page.drawText(evidence.length.toString(), { x: 60 + boxWidth + boxGap, y: yPos - 45, size: 24, font: fontBold, color: rgb(0.133, 0.545, 0.133) })
      
      const gpsVerified = evidence.filter(e => e.latitude && e.longitude).length
      page.drawRectangle({ x: 50 + (boxWidth + boxGap) * 2, y: yPos - boxHeight, width: boxWidth, height: boxHeight, color: rgb(0.95, 0.95, 0.95), borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 1 })
      page.drawText('GPS Verified', { x: 60 + (boxWidth + boxGap) * 2, y: yPos - 20, size: 10, font, color: rgb(0.5, 0.5, 0.5) })
      page.drawText(gpsVerified.toString(), { x: 60 + (boxWidth + boxGap) * 2, y: yPos - 45, size: 24, font: fontBold, color: rgb(0.133, 0.545, 0.133) })
      
      const verifyBoxY = yPos - boxHeight - 50
      page.drawRectangle({ x: 50, y: verifyBoxY - 80, width: 280, height: 80, color: rgb(0.95, 0.98, 0.95), borderColor: rgb(0.133, 0.545, 0.133), borderWidth: 1 })
      page.drawText('Tamper Verification', { x: 60, y: verifyBoxY - 20, size: 12, font: fontBold, color: rgb(0.133, 0.545, 0.133) })
      page.drawText('Verify this pack online:', { x: 60, y: verifyBoxY - 40, size: 9, font, color: rgb(0.4, 0.4, 0.4) })
      page.drawText(verifyUrl, { x: 60, y: verifyBoxY - 55, size: 8, font, color: rgb(0.2, 0.4, 0.8) })
      
      page.drawText('Pack Hash (SHA-256):', { x: 350, y: verifyBoxY - 45, size: 8, font, color: rgb(0.5, 0.5, 0.5) })
      page.drawText(packHash.substring(0, 32) + '...', { x: 350, y: verifyBoxY - 58, size: 6, font, color: rgb(0.4, 0.4, 0.4) })
      
      // Client Signature (if captured)
      if (signatureUrl) {
        setGeneratingStatus('Adding client signature...')
        const signatureBytes = await fetchImageBytes(signatureUrl)
        if (signatureBytes) {
          try {
            const sigImg = await pdfDoc.embedPng(signatureBytes)
            page.drawRectangle({ x: 350, y: verifyBoxY - 160, width: 195, height: 100, color: rgb(0.98, 0.98, 0.98), borderColor: rgb(0.7, 0.7, 0.7), borderWidth: 1 })
            page.drawText('Client Sign-Off', { x: 360, y: verifyBoxY - 70, size: 10, font: fontBold, color: rgb(0.3, 0.3, 0.3) })
            
            const sigDims = sigImg.scale(1)
            let sigW = sigDims.width, sigH = sigDims.height
            if (sigW > 175) { sigH = sigH * (175 / sigW); sigW = 175 }
            if (sigH > 55) { sigW = sigW * (55 / sigH); sigH = 55 }
            
            page.drawImage(sigImg, { x: 360 + (175 - sigW) / 2, y: verifyBoxY - 145, width: sigW, height: sigH })
            page.drawText('Work accepted and approved', { x: 360, y: verifyBoxY - 158, size: 7, font, color: rgb(0.5, 0.5, 0.5) })
          } catch {}
        }
      }
      
      // Page 2: Evidence Log
      page = pdfDoc.addPage([595, 842])
      yPos = height - 60
      
      page.drawText('Evidence Log', { x: 50, y: yPos, size: 20, font: fontBold, color: rgb(0.1, 0.1, 0.1) })
      yPos -= 10
      page.drawLine({ start: { x: 50, y: yPos }, end: { x: width - 50, y: yPos }, thickness: 2, color: rgb(0.133, 0.545, 0.133) })
      yPos -= 30
      
      page.drawRectangle({ x: 40, y: yPos - 20, width: width - 80, height: 25, color: rgb(0.95, 0.95, 0.95) })
      page.drawText('#', { x: 50, y: yPos - 14, size: 9, font: fontBold, color: rgb(0.3, 0.3, 0.3) })
      page.drawText('Evidence Type', { x: 70, y: yPos - 14, size: 9, font: fontBold, color: rgb(0.3, 0.3, 0.3) })
      page.drawText('Stage', { x: 180, y: yPos - 14, size: 9, font: fontBold, color: rgb(0.3, 0.3, 0.3) })
      page.drawText('Captured', { x: 230, y: yPos - 14, size: 9, font: fontBold, color: rgb(0.3, 0.3, 0.3) })
      page.drawText('GPS', { x: 330, y: yPos - 14, size: 9, font: fontBold, color: rgb(0.3, 0.3, 0.3) })
      page.drawText('Hash (SHA-256)', { x: 440, y: yPos - 14, size: 9, font: fontBold, color: rgb(0.3, 0.3, 0.3) })
      yPos -= 30
      
      for (let index = 0; index < evidence.length; index++) {
        const item = evidence[index]
        if (!item) continue
        if (yPos < 100) { page = pdfDoc.addPage([595, 842]); yPos = height - 60 }
        if (index % 2 === 0) page.drawRectangle({ x: 40, y: yPos - 15, width: width - 80, height: 22, color: rgb(0.98, 0.98, 0.98) })
        
        const evidenceType = (item.evidenceType || 'unknown').replace(/_/g, ' ')
        const stage = item.photoStage ? item.photoStage.charAt(0).toUpperCase() + item.photoStage.slice(1) : '-'
        const gps = item.latitude && item.longitude ? `${item.latitude.toFixed(4)}, ${item.longitude.toFixed(4)}` : 'N/A'
        const hash = item.photoHash ? item.photoHash.substring(0, 12) + '...' : 'N/A'
        
        page.drawText((index + 1).toString(), { x: 50, y: yPos - 10, size: 8, font, color: rgb(0.4, 0.4, 0.4) })
        page.drawText(evidenceType.substring(0, 18), { x: 70, y: yPos - 10, size: 8, font, color: rgb(0.2, 0.2, 0.2) })
        page.drawText(stage, { x: 180, y: yPos - 10, size: 8, font, color: rgb(0.2, 0.2, 0.2) })
        page.drawText(formatShortDate(item.capturedAt), { x: 230, y: yPos - 10, size: 8, font, color: rgb(0.2, 0.2, 0.2) })
        page.drawText(gps, { x: 330, y: yPos - 10, size: 8, font, color: rgb(0.2, 0.2, 0.2) })
        page.drawText(hash, { x: 440, y: yPos - 10, size: 7, font, color: rgb(0.5, 0.5, 0.5) })
        yPos -= 22
      }
      
      // Photo Pages
      setGeneratingStatus('Embedding photos...')
      for (let i = 0; i < evidence.length; i++) {
        const item = evidence[i]
        if (!item?.photoUrl) continue
        setGeneratingStatus(`Embedding photo ${i + 1} of ${evidence.length}...`)
        
        try {
          const imageBytes = await fetchImageBytes(item.photoUrl)
          if (!imageBytes) continue
          
          page = pdfDoc.addPage([595, 842])
          page.drawRectangle({ x: 0, y: height - 50, width, height: 50, color: rgb(0.133, 0.545, 0.133) })
          
          const evidenceType = (item.evidenceType || 'Evidence').replace(/_/g, ' ')
          const stage = item.photoStage ? ` - ${item.photoStage.charAt(0).toUpperCase() + item.photoStage.slice(1)}` : ''
          page.drawText(`${evidenceType}${stage}`, { x: 50, y: height - 32, size: 14, font: fontBold, color: rgb(1, 1, 1) })
          page.drawText(`Photo ${i + 1} of ${evidence.length}`, { x: width - 120, y: height - 32, size: 10, font, color: rgb(0.9, 0.9, 0.9) })
          
          let image
          try { image = await pdfDoc.embedJpg(imageBytes) } catch { image = await pdfDoc.embedPng(imageBytes) }
          
          const maxW = width - 100, maxH = 450
          let dW = image.scale(1).width, dH = image.scale(1).height
          if (dW > maxW) { dH = dH * (maxW / dW); dW = maxW }
          if (dH > maxH) { dW = dW * (maxH / dH); dH = maxH }
          
          const imgX = (width - dW) / 2, imgY = height - 100 - dH
          page.drawRectangle({ x: imgX - 5, y: imgY - 5, width: dW + 10, height: dH + 10, borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 1 })
          page.drawImage(image, { x: imgX, y: imgY, width: dW, height: dH })
          
          const metaY = imgY - 30
          page.drawText('Captured:', { x: 50, y: metaY, size: 9, font, color: rgb(0.5, 0.5, 0.5) })
          page.drawText(formatDate(item.capturedAt), { x: 110, y: metaY, size: 9, font: fontBold, color: rgb(0.2, 0.2, 0.2) })
          
          if (item.latitude && item.longitude) {
            page.drawText('GPS:', { x: 50, y: metaY - 18, size: 9, font, color: rgb(0.5, 0.5, 0.5) })
            page.drawText(`${item.latitude.toFixed(6)}, ${item.longitude.toFixed(6)}`, { x: 110, y: metaY - 18, size: 9, font, color: rgb(0.2, 0.2, 0.2) })
            if (item.gpsAccuracy) page.drawText(`(±${item.gpsAccuracy}m)`, { x: 280, y: metaY - 18, size: 8, font, color: rgb(0.5, 0.5, 0.5) })
          }
          
          if (item.notes) {
            page.drawText('Notes:', { x: 50, y: metaY - 36, size: 9, font, color: rgb(0.5, 0.5, 0.5) })
            page.drawText(item.notes.substring(0, 80), { x: 110, y: metaY - 36, size: 9, font, color: rgb(0.2, 0.2, 0.2) })
          }
          
          if (item.photoHash) {
            page.drawText('SHA-256:', { x: 50, y: metaY - 54, size: 9, font, color: rgb(0.5, 0.5, 0.5) })
            page.drawText(item.photoHash, { x: 110, y: metaY - 54, size: 7, font, color: rgb(0.4, 0.4, 0.4) })
          }
          
          page.drawRectangle({ x: width - 150, y: metaY - 10, width: 100, height: 25, color: rgb(0.9, 0.97, 0.9), borderColor: rgb(0.133, 0.545, 0.133), borderWidth: 1 })
          page.drawText('VERIFIED', { x: width - 130, y: metaY - 1, size: 10, font: fontBold, color: rgb(0.133, 0.545, 0.133) })
        } catch {}
      }
      
      setGeneratingStatus('Finalizing PDF...')
      const pdfBytes = await pdfDoc.save()
      const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `audit-pack-${clientName.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      captureError(err, 'PackPreview.generatePDF')
      trackError('pdf_generation_error', err instanceof Error ? err.message : 'Unknown error')
      setError('Failed to generate PDF. Please try again.')
    } finally {
      setIsGenerating(false)
      setGeneratingStatus('')
    }
  }

  const totalRequired = tasks.reduce((sum, task) => {
    const config = getTaskTypeConfig(task.taskType as TaskType)
    return sum + (config?.requiredEvidence.length || 0)
  }, 0)
  const completionPercent = totalRequired > 0 ? Math.round((evidence.length / totalRequired) * 100) : 0

  const handleShare = async () => {
    if (!lastGeneratedPackId || !shareEmail) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(shareEmail)) { setShareError('Please enter a valid email address'); return }
    
    setIsSharing(true)
    setShareError(null)
    
    try {
      const token = await getToken()
      const API_BASE = import.meta.env.VITE_API_URL || ''
      const response = await fetch(`${API_BASE}/api/audit-packs/${lastGeneratedPackId}/share`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: shareEmail })
      })
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || 'Failed to send email') }
      setShareSuccess(true)
      setTimeout(() => { setShowShareModal(false); setShareEmail(''); setShareSuccess(false) }, 2000)
    } catch (err) {
      captureError(err, 'PackPreview.handleShare')
      setShareError(err instanceof Error ? err.message : 'Failed to send email')
    } finally {
      setIsSharing(false)
    }
  }

  if (isLoading) return <div className="min-h-screen bg-gray-900 flex items-center justify-center"><Loader2 className="w-8 h-8 text-green-500 animate-spin" /></div>

  if (error) return (
    <div className="min-h-screen bg-gray-900 p-4">
      <div className="max-w-lg mx-auto mt-20 bg-red-900/20 border border-red-500 rounded-lg p-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-red-400 mb-4">{error}</p>
        <button onClick={() => navigate('/packs')} className="text-green-400 hover:text-green-300">← Back to Packs</button>
      </div>
    </div>
  )

  return (
    <>
      <Helmet><title>Audit Pack Preview - WorkProof</title></Helmet>
      
      <div className="min-h-screen bg-gray-900 pb-24">
        <div className="bg-gray-800 border-b border-gray-700 px-4 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <button onClick={() => navigate('/packs')} className="flex items-center gap-2 text-gray-400 hover:text-white">
              <ArrowLeft className="w-5 h-5" /><span>Back</span>
            </button>
            <h1 className="text-lg font-semibold text-white">Audit Pack Preview</h1>
            <div className="flex items-center gap-2">
              {lastGeneratedPackId && (
                <>
                  <button onClick={() => setShowSignatureModal(true)} className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${signatureUrl ? 'bg-green-700' : 'bg-purple-600 hover:bg-purple-700'} text-white`}>
                    {signatureUrl ? <CheckCircle className="w-4 h-4" /> : <PenTool className="w-4 h-4" />}
                    <span className="hidden sm:inline">{signatureUrl ? 'Signed' : 'Sign'}</span>
                  </button>
                  <button onClick={() => setShowShareModal(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
                    <Mail className="w-4 h-4" /><span className="hidden sm:inline">Share</span>
                  </button>
                </>
              )}
              <button onClick={generatePDF} disabled={isGenerating || evidence.length === 0} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg">
                {isGenerating ? <><Loader2 className="w-4 h-4 animate-spin" /><span className="hidden sm:inline">Generating...</span></> : <><Download className="w-4 h-4" /><span className="hidden sm:inline">Download PDF</span></>}
              </button>
            </div>
          </div>
        </div>
        
        {isGenerating && generatingStatus && (
          <div className="bg-green-900/30 border-b border-green-700 px-4 py-2">
            <div className="max-w-4xl mx-auto flex items-center gap-2 text-green-400 text-sm"><Loader2 className="w-4 h-4 animate-spin" />{generatingStatus}</div>
          </div>
        )}
        
        {signatureUrl && (
          <div className="bg-purple-900/30 border-b border-purple-700 px-4 py-2">
            <div className="max-w-4xl mx-auto flex items-center gap-2 text-purple-400 text-sm"><CheckCircle className="w-4 h-4" />Client signature captured - will be included in PDF</div>
          </div>
        )}
        
        <div className="max-w-4xl mx-auto p-4">
          <div className="bg-gray-800 rounded-lg p-4 mb-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-white">{job?.clientName || 'Unknown Client'}</h2>
                <div className="flex items-center gap-2 text-gray-400 mt-1"><MapPin className="w-4 h-4" /><span>{job?.address}, {job?.postcode}</span></div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-green-500">{completionPercent}%</div>
                <div className="text-sm text-gray-400">Complete</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-700/50 rounded-lg p-3 text-center"><div className="text-2xl font-bold text-white">{tasks.length}</div><div className="text-sm text-gray-400">Tasks</div></div>
              <div className="bg-gray-700/50 rounded-lg p-3 text-center"><div className="text-2xl font-bold text-white">{evidence.length}</div><div className="text-sm text-gray-400">Evidence</div></div>
              <div className="bg-gray-700/50 rounded-lg p-3 text-center"><div className="text-2xl font-bold text-white">{evidence.filter(e => e.latitude && e.longitude).length}</div><div className="text-sm text-gray-400">GPS Tagged</div></div>
            </div>
          </div>
          
          <div className="bg-green-900/20 border border-green-700 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-3"><QrCode className="w-8 h-8 text-green-500" /><div><h3 className="font-semibold text-green-400">Tamper Verification</h3><p className="text-sm text-gray-400">Your PDF will include a QR code for instant online verification</p></div></div>
          </div>
          
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><Camera className="w-5 h-5 text-green-500" />Evidence ({evidence.length})</h3>
          
          {evidence.length === 0 ? (
            <div className="bg-gray-800 rounded-lg p-8 text-center"><Camera className="w-12 h-12 text-gray-600 mx-auto mb-3" /><p className="text-gray-400">No evidence captured yet</p><p className="text-sm text-gray-500 mt-1">Add photos to your tasks first</p></div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {evidence.map((item) => (
                <div key={item.id} onClick={() => setSelectedImage(item)} className="relative aspect-square bg-gray-800 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-green-500 transition-all">
                  {item.photoUrl ? <img src={item.photoUrl} alt={item.evidenceType} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Camera className="w-8 h-8 text-gray-600" /></div>}
                  <div className="absolute top-2 left-2 flex flex-col gap-1">
                    {item.latitude && item.longitude && <span className="bg-green-500 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-1"><MapPin className="w-3 h-3" /></span>}
                    {item.photoHash && <span className="bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-1"><Shield className="w-3 h-3" /></span>}
                  </div>
                  {item.photoStage && <span className={`absolute bottom-2 right-2 text-xs px-2 py-0.5 rounded ${item.photoStage === 'before' ? 'bg-amber-100 text-amber-700' : item.photoStage === 'during' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>{item.photoStage}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {selectedImage && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setSelectedImage(null)}>
          <button onClick={() => setSelectedImage(null)} className="absolute top-4 right-4 text-white hover:text-gray-300"><X className="w-8 h-8" /></button>
          <div className="max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {selectedImage.photoUrl && <img src={selectedImage.photoUrl} alt={selectedImage.evidenceType} className="max-h-[60vh] object-contain rounded-lg" />}
            <div className="bg-gray-800 rounded-lg p-4 mt-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-white font-semibold">{selectedImage.evidenceType?.replace(/_/g, ' ')}</span>
                {selectedImage.photoStage && <span className={`text-xs px-2 py-0.5 rounded ${selectedImage.photoStage === 'before' ? 'bg-amber-100 text-amber-700' : selectedImage.photoStage === 'during' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>{selectedImage.photoStage}</span>}
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm text-gray-300">
                <div><p className="text-gray-500">Captured</p><p>{formatDate(selectedImage.capturedAt)}</p></div>
                {selectedImage.latitude && selectedImage.longitude && <div><p className="text-gray-500">GPS</p><p>{selectedImage.latitude.toFixed(6)}, {selectedImage.longitude.toFixed(6)}</p></div>}
                {selectedImage.gpsAccuracy && <div><p className="text-gray-500">Accuracy</p><p>±{selectedImage.gpsAccuracy}m</p></div>}
                {selectedImage.notes && <div className="col-span-2"><p className="text-gray-500">Notes</p><p>{selectedImage.notes}</p></div>}
                {selectedImage.photoHash && <div className="col-span-2"><p className="text-gray-500">SHA-256 Hash</p><p className="font-mono text-xs break-all">{selectedImage.photoHash}</p></div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {showShareModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => !isSharing && setShowShareModal(false)}>
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            {shareSuccess ? (
              <div className="text-center py-4"><CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" /><h3 className="text-xl font-semibold text-white mb-2">Email Sent!</h3><p className="text-gray-400">Audit pack sent to {shareEmail}</p></div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-6"><h3 className="text-xl font-semibold text-white">Share Audit Pack</h3><button onClick={() => setShowShareModal(false)} className="text-gray-400 hover:text-white" disabled={isSharing}><X className="w-6 h-6" /></button></div>
                <p className="text-gray-400 mb-4">Send this audit pack with verification link to your client or assessor.</p>
                <div className="mb-4"><label className="block text-sm font-medium text-gray-300 mb-2">Email Address</label><input type="email" value={shareEmail} onChange={(e) => { setShareEmail(e.target.value); setShareError(null) }} placeholder="client@example.com" className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500" disabled={isSharing} /></div>
                {shareError && <div className="mb-4 p-3 bg-red-900/30 border border-red-500 rounded-lg"><p className="text-red-400 text-sm">{shareError}</p></div>}
                <div className="bg-gray-700/50 rounded-lg p-4 mb-6"><p className="text-sm text-gray-400"><span className="text-green-400 font-medium">Includes:</span> Verification link, job details, and your contact info for replies.</p></div>
                <div className="flex gap-3">
                  <button onClick={() => setShowShareModal(false)} className="flex-1 px-4 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600" disabled={isSharing}>Cancel</button>
                  <button onClick={handleShare} disabled={isSharing || !shareEmail} className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                    {isSharing ? <><Loader2 className="w-4 h-4 animate-spin" />Sending...</> : <><Mail className="w-4 h-4" />Send Email</>}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showSignatureModal && <SignaturePad clientName={job?.clientName} onSave={handleSignatureSave} onCancel={() => setShowSignatureModal(false)} />}
    </>
  )
}
