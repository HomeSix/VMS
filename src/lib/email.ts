import nodemailer from 'nodemailer';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    try {
      this.transporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false, // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    } catch (error) {
      console.error('Failed to initialize email transporter:', error);
    }
  }

  /**
   * Send an email using Gmail SMTP
   */
  async sendEmail(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
    if (!this.transporter) {
      return { success: false, error: 'Email transporter not initialized' };
    }

    try {
      const mailOptions = {
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        attachments: options.attachments,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', info.messageId);
      return { success: true };
    } catch (error) {
      console.error('Failed to send email:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  /**
   * Send a welcome email
   */
  async sendWelcomeEmail(to: string, userName: string): Promise<{ success: boolean; error?: string }> {
    const template = this.getWelcomeTemplate(userName);
    return this.sendEmail({
      to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  /**
   * Send a password reset email
   */
  async sendPasswordResetEmail(to: string, resetLink: string): Promise<{ success: boolean; error?: string }> {
    const template = this.getPasswordResetTemplate(resetLink);
    return this.sendEmail({
      to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  /**
   * Send an approval notification email
   */
  async sendApprovalEmail(to: string, userName: string, approved: boolean): Promise<{ success: boolean; error?: string }> {
    const template = this.getApprovalTemplate(userName, approved);
    return this.sendEmail({
      to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  /**
   * Send a visitor notification email
   */
  async sendVisitorNotificationEmail(to: string, visitorName: string, purpose: string, visitDate: string): Promise<{ success: boolean; error?: string }> {
    const template = this.getVisitorNotificationTemplate(visitorName, purpose, visitDate);
    return this.sendEmail({
      to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  /**
   * Test email configuration
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.transporter) {
      return { success: false, error: 'Email transporter not initialized' };
    }

    try {
      await this.transporter.verify();
      return { success: true };
    } catch (error) {
      console.error('Email connection test failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Connection test failed' 
      };
    }
  }

  // Email Templates
  private getWelcomeTemplate(userName: string): EmailTemplate {
    return {
      subject: 'Welcome to SK Seri Telok Visitor Management System',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Welcome Email</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; padding: 20px 0; }
            .logo { max-width: 150px; height: auto; }
            .content { padding: 20px 0; }
            .footer { text-align: center; padding: 20px 0; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to SK Seri Telok Visitor Management System</h1>
            </div>
            <div class="content">
              <p>Dear ${userName},</p>
              <p>Welcome to the SK Seri Telok Visitor Management System! Your account has been successfully created.</p>
              <p>You can now log in to the system using your credentials and start managing visitor appointments efficiently.</p>
              <p>If you have any questions or need assistance, please don't hesitate to contact us.</p>
              <p>Best regards,<br>SK Seri Telok Administration Team</p>
            </div>
            <div class="footer">
              <p>&copy; 2024 SK Seri Telok Parit Yaani. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Welcome to SK Seri Telok Visitor Management System\n\nDear ${userName},\n\nWelcome to the SK Seri Telok Visitor Management System! Your account has been successfully created.\n\nYou can now log in to the system using your credentials and start managing visitor appointments efficiently.\n\nIf you have any questions or need assistance, please don't hesitate to contact us.\n\nBest regards,\nSK Seri Telok Administration Team`,
    };
  }

  private getPasswordResetTemplate(resetLink: string): EmailTemplate {
    return {
      subject: 'Password Reset Request - SK Seri Telok VMS',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Password Reset</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; padding: 20px 0; }
            .content { padding: 20px 0; }
            .button { display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px 0; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Reset Request</h1>
            </div>
            <div class="content">
              <p>You requested a password reset for your SK Seri Telok Visitor Management System account.</p>
              <p>Click the button below to reset your password:</p>
              <div style="text-align: center;">
                <a href="${resetLink}" class="button">Reset Password</a>
              </div>
              <p>If you didn't request this password reset, please ignore this email. The link will expire in 24 hours.</p>
              <p>For security reasons, please don't share this link with anyone.</p>
              <p>Best regards,<br>SK Seri Telok Administration Team</p>
            </div>
            <div class="footer">
              <p>&copy; 2024 SK Seri Telok Parit Yaani. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Password Reset Request - SK Seri Telok VMS\n\nYou requested a password reset for your SK Seri Telok Visitor Management System account.\n\nClick the link below to reset your password:\n${resetLink}\n\nIf you didn't request this password reset, please ignore this email. The link will expire in 24 hours.\n\nFor security reasons, please don't share this link with anyone.\n\nBest regards,\nSK Seri Telok Administration Team`,
    };
  }

  private getApprovalTemplate(userName: string, approved: boolean): EmailTemplate {
    const status = approved ? 'Approved' : 'Rejected';
    const message = approved 
      ? 'Your account has been approved and you now have full access to the system.'
      : 'Your account access has been rejected. Please contact the administration for more information.';

    return {
      subject: `Account ${status} - SK Seri Telok VMS`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Account ${status}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; padding: 20px 0; }
            .content { padding: 20px 0; }
            .approved { color: #28a745; }
            .rejected { color: #dc3545; }
            .footer { text-align: center; padding: 20px 0; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Account ${status}</h1>
            </div>
            <div class="content">
              <p>Dear ${userName},</p>
              <p class="${approved ? 'approved' : 'rejected'}"><strong>Your account has been ${status.toLowerCase()}.</strong></p>
              <p>${message}</p>
              ${approved ? '<p>You can now log in to the system with your credentials.</p>' : ''}
              <p>Best regards,<br>SK Seri Telok Administration Team</p>
            </div>
            <div class="footer">
              <p>&copy; 2024 SK Seri Telok Parit Yaani. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Account ${status} - SK Seri Telok VMS\n\nDear ${userName},\n\nYour account has been ${status.toLowerCase()}.\n\n${message}\n${approved ? 'You can now log in to the system with your credentials.' : ''}\n\nBest regards,\nSK Seri Telok Administration Team`,
    };
  }

  private getVisitorNotificationTemplate(visitorName: string, purpose: string, visitDate: string): EmailTemplate {
    return {
      subject: `New Visitor Appointment: ${visitorName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>New Visitor Appointment</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; padding: 20px 0; }
            .content { padding: 20px 0; }
            .appointment-details { background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px 0; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>New Visitor Appointment</h1>
            </div>
            <div class="content">
              <p>A new visitor appointment has been scheduled:</p>
              <div class="appointment-details">
                <p><strong>Visitor Name:</strong> ${visitorName}</p>
                <p><strong>Purpose of Visit:</strong> ${purpose}</p>
                <p><strong>Visit Date:</strong> ${visitDate}</p>
              </div>
              <p>Please review the appointment details and take necessary action.</p>
              <p>Best regards,<br>SK Seri Telok Visitor Management System</p>
            </div>
            <div class="footer">
              <p>&copy; 2024 SK Seri Telok Parit Yaani. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `New Visitor Appointment\n\nA new visitor appointment has been scheduled:\n\nVisitor Name: ${visitorName}\nPurpose of Visit: ${purpose}\nVisit Date: ${visitDate}\n\nPlease review the appointment details and take necessary action.\n\nBest regards,\nSK Seri Telok Visitor Management System`,
    };
  }
}

// Create and export a singleton instance
export const emailService = new EmailService();

// Export the class for testing or multiple instances
export { EmailService };
