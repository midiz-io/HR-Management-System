export async function sendWhatsAppDocument(to: string, pdfUrl: string, caption: string) {
  const BIRD_API_KEY = process.env.BIRD_API_KEY || 'bk_us1_O4MOaDaWQKNOBPTrUhQZ6DP09VKdd';
  const BIRD_CHANNEL_ID = process.env.BIRD_WHATSAPP_CHANNEL_ID;

  if (!BIRD_CHANNEL_ID) {
    console.warn('BIRD_WHATSAPP_CHANNEL_ID is not configured. Falling back to SMS or failing.');
    // Fall back to SMS if no channel ID is set
    return sendSMS(to, caption);
  }

  // Formatting phone number to ensure it has international format
  let formattedTo = to.replace(/[^0-9+]/g, '');
  if (formattedTo.startsWith('0')) {
    formattedTo = '+94' + formattedTo.substring(1); // Assuming Sri Lanka default, change if needed
  } else if (!formattedTo.startsWith('+')) {
    formattedTo = '+' + formattedTo;
  }

  const payload = {
    to: formattedTo,
    from: BIRD_CHANNEL_ID,
    type: "document",
    content: {
      document: {
        url: pdfUrl,
        caption: caption
      }
    }
  };

  try {
    const response = await fetch('https://api.messagebird.com/v1/conversations/send', {
      method: 'POST',
      headers: {
        'Authorization': `AccessKey ${BIRD_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Bird API Error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error sending WhatsApp Document:', error);
    return { success: false, error };
  }
}

export async function sendSMS(to: string, text: string) {
  const BIRD_API_KEY = process.env.BIRD_API_KEY || 'bk_us1_O4MOaDaWQKNOBPTrUhQZ6DP09VKdd';
  
  let formattedTo = to.replace(/[^0-9+]/g, '');
  if (formattedTo.startsWith('0')) {
    formattedTo = '+94' + formattedTo.substring(1); 
  } else if (!formattedTo.startsWith('+')) {
    formattedTo = '+' + formattedTo;
  }

  const payload = {
    originator: 'TSFPayroll',
    recipients: [formattedTo],
    body: text
  };

  try {
    const response = await fetch('https://rest.messagebird.com/messages', {
      method: 'POST',
      headers: {
        'Authorization': `AccessKey ${BIRD_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Bird API Error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error sending SMS:', error);
    return { success: false, error };
  }
}
