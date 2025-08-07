import { NextResponse } from 'next/server';

// Function to send notification via Slack webhook
async function sendSlackNotification(title: string, content: string) {
  try {
    // Use the webhook URL from environment variables
    const webhookUrl = process.env.SLACK_WEBHOOK_URL || 'https://hooks.slack.com/services/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';
    
    // Create a simple Slack message
    const message = {
      text: title,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: title,
            emoji: true
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: content
          }
        }
      ]
    };
    
    // Send to webhook
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(message)
    });
    
    if (!response.ok) {
      throw new Error(`Slack notification failed: ${response.status} ${response.statusText}`);
    }
    
    console.log(`Slack notification sent: ${title}`);
    return true;
  } catch (error) {
    console.error('Failed to send Slack notification:', error);
    return false;
  }
}

// Test API endpoint
export async function GET(request: Request) {
  try {
    // Create a test message
    const testTitle = '🧪 Calendar API Test Notification';
    const testContent = `
*This is a test notification from the Calendar API*

• System Time: ${new Date().toLocaleString()}
• Test ID: ${Math.floor(Math.random() * 10000)}

This confirms that Slack notifications are working properly for:
• ✅ Booking cancellations
• ✅ Booking modifications
    `;
    
    // Send the test notification
    const success = await sendSlackNotification(testTitle, testContent);
    
    if (!success) {
      throw new Error('Failed to send test notification');
    }
    
    return NextResponse.json({
      success: true,
      message: 'Test notification sent successfully'
    });
  } catch (error) {
    console.error('Error sending test notification:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    }, { status: 500 });
  }
}

// Allow POST for more detailed testing if needed
export async function POST(request: Request) {
  try {
    // Get custom test data from request
    const body = await request.json();
    const { title, content } = body;
    
    if (!title || !content) {
      return NextResponse.json({
        success: false,
        error: 'Missing required parameters: title and content'
      }, { status: 400 });
    }
    
    // Send the custom notification
    const success = await sendSlackNotification(title, content);
    
    if (!success) {
      throw new Error('Failed to send custom notification');
    }
    
    return NextResponse.json({
      success: true,
      message: 'Custom notification sent successfully'
    });
  } catch (error) {
    console.error('Error sending custom notification:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    }, { status: 500 });
  }
} 