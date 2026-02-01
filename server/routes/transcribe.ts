import { Hono } from 'hono'

const transcribe = new Hono()

// Transcribe audio using OpenAI Whisper API
// No auth required - user already authenticated to reach photo capture page
transcribe.post('/', async (c) => {
  console.log('[TRANSCRIBE] POST / called')

  try {
    const body = await c.req.json() as { audio: string }
    const audioBase64 = body.audio

    if (!audioBase64) {
      return c.json({ error: 'Missing audio data' }, 400)
    }

    const openaiKey = process.env.OPENAI_API_KEY
    if (!openaiKey) {
      console.error('[TRANSCRIBE] OPENAI_API_KEY not configured')
      return c.json({ transcript: '[Transcription unavailable - API key not configured]' })
    }

    // Convert base64 to buffer
    const audioBuffer = Buffer.from(audioBase64, 'base64')

    // Create form data for Whisper API
    const formData = new FormData()
    const audioBlob = new Blob([audioBuffer], { type: 'audio/webm' })
    formData.append('file', audioBlob, 'audio.webm')
    formData.append('model', 'whisper-1')
    formData.append('language', 'en')
    formData.append('response_format', 'text')

    console.log('[TRANSCRIBE] Sending to Whisper API, size:', audioBuffer.length)

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
      },
      body: formData
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[TRANSCRIBE] Whisper API error:', response.status, errorText)
      return c.json({ transcript: '[Transcription failed]' })
    }

    const transcript = await response.text()
    console.log('[TRANSCRIBE] Success:', transcript.slice(0, 100))

    return c.json({ transcript: transcript.trim() })
  } catch (error) {
    console.error('[TRANSCRIBE] Error:', error)
    return c.json({ transcript: '[Transcription error]' })
  }
})

export default transcribe
