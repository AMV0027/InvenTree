import nodemailer from 'nodemailer';

const smtpHost = process.env.SMTP_HOST || 'localhost';
const smtpPort = parseInt(process.env.SMTP_PORT || '1025', 10);
const smtpUser = process.env.SMTP_USER || '';
const smtpPass = process.env.SMTP_PASS || '';
const smtpFrom = process.env.SMTP_FROM || 'noreply@inventree.local';

// Setup SMTP transport
export const mailer = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpPort === 465, // true for 465, false for other ports
  auth: smtpUser && smtpPass ? {
    user: smtpUser,
    pass: smtpPass,
  } : undefined,
});

export async function sendEmail(to: string, subject: string, text: string, html?: string) {
  const info = await mailer.sendMail({
    from: smtpFrom,
    to,
    subject,
    text,
    html,
  });
  
  console.log(`Email sent: ${info.messageId} to ${to}`);
  return info;
}
