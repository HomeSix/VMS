import { NextRequest, NextResponse } from 'next/server';
import { emailService } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const { type, to, ...params } = await request.json();

    // Validate required fields
    if (!to) {
      return NextResponse.json(
        { success: false, error: 'Recipient email is required' },
        { status: 400 }
      );
    }

    let result;

    switch (type) {
      case 'basic':
        result = await emailService.sendEmail({
          to,
          subject: params.subject || 'Test Email from VMS',
          html: params.html || '<h1>Test Email</h1><p>This is a test email from SK Seri Telok VMS.</p>',
          text: params.text || 'This is a test email from SK Seri Telok VMS.'
        });
        break;

      case 'welcome':
        result = await emailService.sendWelcomeEmail(to, params.userName || 'Test User');
        break;

      case 'password-reset':
        result = await emailService.sendPasswordResetEmail(
          to,
          params.resetLink || 'http://localhost:3000/reset-password?token=test123'
        );
        break;

      case 'approval':
        result = await emailService.sendApprovalEmail(
          to,
          params.userName || 'Test User',
          params.approved !== false // default to true
        );
        break;

      case 'visitor-notification':
        result = await emailService.sendVisitorNotificationEmail(
          to,
          params.visitorName || 'Test Visitor',
          params.purpose || 'Meeting',
          params.visitDate || '2024-04-28 10:00 AM'
        );
        break;

      case 'test-connection':
        result = await emailService.testConnection();
        break;

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid email type' },
          { status: 400 }
        );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Email API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Email test API endpoint',
    usage: 'POST /api/test-email with JSON body',
    examples: {
      basic: { type: 'basic', to: 'test@example.com', subject: 'Test' },
      welcome: { type: 'welcome', to: 'test@example.com', userName: 'John' },
      'password-reset': { type: 'password-reset', to: 'test@example.com' },
      approval: { type: 'approval', to: 'test@example.com', userName: 'Jane', approved: true },
      'visitor-notification': { type: 'visitor-notification', to: 'test@example.com' },
      'test-connection': { type: 'test-connection' }
    }
  });
}
