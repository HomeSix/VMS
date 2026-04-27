import { emailService } from './email';

/**
 * Example usage of the email service
 * These examples show how to use the email functionality in your application
 */

// Example 1: Send a custom email
export async function sendCustomEmail(to: string, subject: string, content: string) {
  const result = await emailService.sendEmail({
    to,
    subject,
    html: `<p>${content}</p>`,
    text: content,
  });
  
  return result;
}

// Example 2: Send welcome email to new user
export async function sendWelcomeToNewUser(userEmail: string, userName: string) {
  const result = await emailService.sendWelcomeEmail(userEmail, userName);
  return result;
}

// Example 3: Send password reset email
export async function sendPasswordReset(userEmail: string, resetToken: string) {
  const resetLink = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${resetToken}`;
  const result = await emailService.sendPasswordResetEmail(userEmail, resetLink);
  return result;
}

// Example 4: Send approval notification
export async function sendApprovalNotification(userEmail: string, userName: string, isApproved: boolean) {
  const result = await emailService.sendApprovalEmail(userEmail, userName, isApproved);
  return result;
}

// Example 5: Send visitor notification to admin
export async function notifyAdminAboutVisitor(adminEmail: string, visitorName: string, purpose: string, visitDate: string) {
  const result = await emailService.sendVisitorNotificationEmail(adminEmail, visitorName, purpose, visitDate);
  return result;
}

// Example 6: Send email with attachment
export async function sendEmailWithAttachment(to: string, subject: string, content: string, attachmentData: Buffer, filename: string) {
  const result = await emailService.sendEmail({
    to,
    subject,
    html: `<p>${content}</p>`,
    text: content,
    attachments: [{
      filename,
      content: attachmentData,
      contentType: 'application/pdf' // or appropriate MIME type
    }]
  });
  
  return result;
}

// Example 7: Test email configuration
export async function testEmailConfiguration() {
  const result = await emailService.testConnection();
  return result;
}

// Example 8: Send bulk email (to multiple recipients)
export async function sendBulkEmail(recipients: string[], subject: string, content: string) {
  const result = await emailService.sendEmail({
    to: recipients,
    subject,
    html: `<p>${content}</p>`,
    text: content,
  });
  
  return result;
}

// Example usage in an API route:
/*
export async function POST(request: Request) {
  try {
    const { to, subject, message } = await request.json();
    
    const result = await emailService.sendEmail({
      to,
      subject,
      html: `<p>${message}</p>`,
      text: message,
    });
    
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { success: false, error: 'Failed to send email' },
      { status: 500 }
    );
  }
}
*/

// Example usage in a server action:
/*
'use server';

export async function sendWelcomeEmailAction(formData: FormData) {
  const email = formData.get('email') as string;
  const name = formData.get('name') as string;
  
  const result = await emailService.sendWelcomeEmail(email, name);
  
  if (!result.success) {
    throw new Error(result.error);
  }
  
  return { success: true };
}
*/
