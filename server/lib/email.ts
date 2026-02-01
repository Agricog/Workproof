/**
 * Email Service using Resend
 * Sends audit pack links to clients and assessors
 */

interface SendEmailOptions {
  to: string
  subject: string
  html: string
  replyTo?: string
}

interface EmailResult {
  success: boolean
  messageId?: string
  error?: string
}

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@workproof.co.uk'

/**
 * Send email via Resend API
 */
export async function sendEmail(options: SendEmailOptions): Promise<EmailResult> {
  if (!RESEND_API_KEY) {
    console.error('[Email] RESEND_API_KEY not configured')
    return { success: false, error: 'Email service not configured' }
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: options.to,
        subject: options.subject,
        html: options.html,
        reply_to: options.replyTo
      })
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('[Email] Resend API error:', response.status, error)
      return { success: false, error: 'Failed to send email' }
    }

    const data = await response.json()
    console.log('[Email] Sent successfully:', data.id)
    return { success: true, messageId: data.id }

  } catch (error) {
    console.error('[Email] Error sending email:', error)
    return { success: false, error: 'Email service error' }
  }
}

/**
 * Send audit pack to recipient
 */
export async function sendAuditPackEmail(options: {
  to: string
  clientName: string
  jobAddress: string
  electricianName: string
  electricianCompany?: string
  verifyUrl: string
  packId: string
  replyTo?: string
}): Promise<EmailResult> {
  const { to, clientName, jobAddress, electricianName, electricianCompany, verifyUrl, packId, replyTo } = options

  const companyLine = electricianCompany ? `<p style="margin: 0; color: #666;">${electricianCompany}</p>` : ''

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Electrical Work Evidence Pack</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background-color: #22c55e; padding: 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">WorkProof</h1>
              <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Tamper-Proof Evidence for Electrical Work</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px; color: #1f2937; font-size: 20px;">Your Electrical Work Evidence</h2>
              
              <p style="margin: 0 0 20px; color: #4b5563; line-height: 1.6;">
                Dear ${clientName},
              </p>
              
              <p style="margin: 0 0 20px; color: #4b5563; line-height: 1.6;">
                Please find attached the cryptographically verified evidence pack for the electrical work completed at:
              </p>
              
              <div style="background-color: #f9fafb; border-left: 4px solid #22c55e; padding: 15px 20px; margin: 0 0 25px;">
                <p style="margin: 0; color: #1f2937; font-weight: 600;">${jobAddress}</p>
              </div>
              
              <p style="margin: 0 0 25px; color: #4b5563; line-height: 1.6;">
                This pack includes timestamped, GPS-tagged photos that have been cryptographically sealed. You can verify the authenticity of this evidence at any time.
              </p>
              
              <!-- Verify Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 10px 0 30px;">
                    <a href="${verifyUrl}" style="display: inline-block; background-color: #22c55e; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 16px;">Verify Evidence Pack</a>
                  </td>
                </tr>
              </table>
              
              <!-- Verification Info -->
              <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 20px; margin-bottom: 25px;">
                <p style="margin: 0 0 10px; color: #166534; font-weight: 600; font-size: 14px;">🔒 Cryptographic Verification</p>
                <p style="margin: 0; color: #166534; font-size: 13px; line-height: 1.5;">
                  This evidence has been sealed with SHA-256 hashing. Any modification to the photos, timestamps, or GPS data will be detected when verified.
                </p>
              </div>
              
              <p style="margin: 0 0 5px; color: #4b5563; line-height: 1.6;">
                Kind regards,
              </p>
              <p style="margin: 0; color: #1f2937; font-weight: 600;">${electricianName}</p>
              ${companyLine}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 25px 30px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px; color: #6b7280; font-size: 12px; text-align: center;">
                Pack ID: ${packId}
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 11px; text-align: center;">
                Powered by <a href="https://workproof.co.uk" style="color: #22c55e; text-decoration: none;">WorkProof</a> - Tamper-proof evidence for UK electricians
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`

  return sendEmail({
    to,
    subject: `Electrical Work Evidence - ${jobAddress}`,
    html,
    replyTo
  })
}
