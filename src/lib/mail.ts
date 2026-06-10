import nodemailer from 'nodemailer'

export interface EmailAttachment {
  filename?: string
  content?: string | Buffer
  path?: string
  contentType?: string
}

export interface EmailOptions {
  to: string | string[]
  subject: string
  text?: string
  html?: string
  cc?: string | string[]
  bcc?: string | string[]
  replyTo?: string
  attachments?: EmailAttachment[]
}

export async function sendEmail(options: EmailOptions) {
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM, SMTP_FROM_NAME } =
    process.env

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
    throw new Error(
      'Missing SMTP configuration. Ensure SMTP_HOST, SMTP_USER, SMTP_PASS, and SMTP_FROM are set.'
    )
  }

  if (!options.to || !options.subject || (!options.text && !options.html)) {
    throw new Error('Missing required email fields: to, subject, and either text or html.')
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: SMTP_SECURE === 'true',
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  })

  const join = (v: string | string[]) => (Array.isArray(v) ? v.join(', ') : v)

  const mailOptions: nodemailer.SendMailOptions = {
    from: `"${SMTP_FROM_NAME || 'VMS'}" <${SMTP_FROM}>`,
    to: join(options.to),
    subject: options.subject,
    text: options.text,
    html: options.html,
    cc: options.cc ? join(options.cc) : undefined,
    bcc: options.bcc ? join(options.bcc) : undefined,
    replyTo: options.replyTo,
    attachments: options.attachments,
  }

  return transporter.sendMail(mailOptions)
}
