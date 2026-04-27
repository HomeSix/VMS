import { emailService } from './email';

/**
 * Test functions to demonstrate email service usage
 * Run these functions to test your email configuration
 */

// Test 1: Basic email sending
export async function testBasicEmail() {
  console.log('Testing basic email sending...');
  
  const result = await emailService.sendEmail({
    to: 'test@example.com', // Replace with your test email
    subject: 'Test Email from VMS',
    html: '<h1>Hello from SK Seri Telok VMS!</h1><p>This is a test email.</p>',
    text: 'Hello from SK Seri Telok VMS! This is a test email.'
  });
  
  console.log('Basic email result:', result);
  return result;
}

// Test 2: Welcome email
export async function testWelcomeEmail() {
  console.log('Testing welcome email...');
  
  const result = await emailService.sendWelcomeEmail(
    'newuser@example.com', // Replace with test email
    'John Doe'
  );
  
  console.log('Welcome email result:', result);
  return result;
}

// Test 3: Password reset email
export async function testPasswordReset() {
  console.log('Testing password reset email...');
  
  const resetLink = 'http://localhost:3000/reset-password?token=abc123';
  const result = await emailService.sendPasswordResetEmail(
    'user@example.com', // Replace with test email
    resetLink
  );
  
  console.log('Password reset result:', result);
  return result;
}

// Test 4: Approval notification
export async function testApprovalNotification() {
  console.log('Testing approval notification...');
  
  const result = await emailService.sendApprovalEmail(
    'staff@example.com', // Replace with test email
    'Jane Smith',
    true // true for approved, false for rejected
  );
  
  console.log('Approval notification result:', result);
  return result;
}

// Test 5: Visitor notification
export async function testVisitorNotification() {
  console.log('Testing visitor notification...');
  
  const result = await emailService.sendVisitorNotificationEmail(
    'admin@example.com', // Replace with test email
    'John Visitor',
    'Meeting with Principal',
    '2024-04-28 10:00 AM'
  );
  
  console.log('Visitor notification result:', result);
  return result;
}

// Test 6: Email with attachment
export async function testEmailWithAttachment() {
  console.log('Testing email with attachment...');
  
  // Create a simple text file as attachment
  const attachmentContent = Buffer.from('This is a test attachment file.');
  
  const result = await emailService.sendEmail({
    to: 'test@example.com', // Replace with test email
    subject: 'Email with Attachment',
    html: '<p>Please find the attached file.</p>',
    text: 'Please find the attached file.',
    attachments: [{
      filename: 'test.txt',
      content: attachmentContent,
      contentType: 'text/plain'
    }]
  });
  
  console.log('Email with attachment result:', result);
  return result;
}

// Test 7: Test SMTP connection
export async function testConnection() {
  console.log('Testing SMTP connection...');
  
  const result = await emailService.testConnection();
  console.log('Connection test result:', result);
  return result;
}

// Test 8: Bulk email
export async function testBulkEmail() {
  console.log('Testing bulk email...');
  
  const result = await emailService.sendEmail({
    to: ['user1@example.com', 'user2@example.com'], // Replace with test emails
    subject: 'Bulk Test Email',
    html: '<p>This is a bulk email test.</p>',
    text: 'This is a bulk email test.'
  });
  
  console.log('Bulk email result:', result);
  return result;
}

// Run all tests (for development)
export async function runAllTests() {
  console.log('Running all email tests...\n');
  
  const tests = [
    { name: 'Connection Test', fn: testConnection },
    { name: 'Basic Email', fn: testBasicEmail },
    { name: 'Welcome Email', fn: testWelcomeEmail },
    { name: 'Password Reset', fn: testPasswordReset },
    { name: 'Approval Notification', fn: testApprovalNotification },
    { name: 'Visitor Notification', fn: testVisitorNotification },
    { name: 'Email with Attachment', fn: testEmailWithAttachment },
    { name: 'Bulk Email', fn: testBulkEmail }
  ];
  
  for (const test of tests) {
    try {
      console.log(`\n--- ${test.name} ---`);
      await test.fn();
    } catch (error) {
      console.error(`${test.name} failed:`, error);
    }
  }
  
  console.log('\nAll tests completed!');
}
