/**
 * WhatsApp API Utility
 * Sends messages via a server-side proxy (/api/whatsapp) to avoid CORS issues
 * and reliably deliver to both individual numbers and WhatsApp groups.
 */

export interface WhatsAppMessage {
    number: string;
    type: 'text' | 'image' | 'video' | 'audio' | 'pdf';
    message?: string;
    mediaUrl?: string;
}

/**
 * Formats a phone number to the international format (94 for Sri Lanka).
 * Group IDs (containing @g.us) are returned as-is.
 */
export const formatPhoneNumber = (phone: string): string => {
    if (phone.includes('@g.us')) {
        return phone;
    }

    let cleaned = phone.replace(/\D/g, '');

    if (cleaned.startsWith('0')) {
        cleaned = '94' + cleaned.substring(1);
    }

    if (!cleaned.startsWith('94')) {
        cleaned = '94' + cleaned;
    }

    return cleaned;
};

/**
 * Sends a WhatsApp message via the /api/whatsapp proxy endpoint.
 */
export const sendWhatsAppMessage = async (params: WhatsAppMessage): Promise<boolean> => {
    try {
        const formattedNumber = formatPhoneNumber(params.number);

        console.log(`[WhatsApp] Sending to: ${formattedNumber} (original: ${params.number})`);

        // Determine the base URL for the API
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
            || process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : 'http://localhost:3000';

        const response = await fetch(`${baseUrl}/api/whatsapp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                number: formattedNumber,
                type: params.type,
                message: params.message,
                mediaUrl: params.mediaUrl,
            }),
        });

        const responseText = await response.text();
        console.log(`[WhatsApp] Proxy response status: ${response.status}`);
        console.log(`[WhatsApp] Proxy response: ${responseText.substring(0, 300)}`);

        if (!response.ok) {
            console.error(`[WhatsApp] Proxy error ${response.status}: ${responseText}`);
            return false;
        }

        return true;
    } catch (error) {
        console.error('[WhatsApp] API Error:', error);
        return false;
    }
};

/**
 * Sends a message to all administrators and WhatsApp groups configured in environment.
 */
export const sendAdminSummary = async (message: string): Promise<void> => {
    const adminNumbersString = process.env.ADMIN_WHATSAPP_NUMBER || '';
    const groupIdsString = process.env.WHATSAPP_GROUP_ID || '';

    const numbers = adminNumbersString.split(',').map(n => n.trim()).filter(Boolean);
    const groups = groupIdsString.split(',').map(g => g.trim()).filter(Boolean);

    const recipients = [...numbers, ...groups];

    if (recipients.length === 0) {
        console.warn('[WhatsApp] No ADMIN_WHATSAPP_NUMBER or WHATSAPP_GROUP_ID configured');
        return;
    }

    console.log(`[WhatsApp] Broadcasting to ${recipients.length} recipients: ${recipients.join(', ')}`);

    for (const recipient of recipients) {
        const success = await sendWhatsAppMessage({
            number: recipient,
            type: 'text',
            message
        });
        console.log(`[WhatsApp] ${recipient}: ${success ? 'SENT ✅' : 'FAILED ❌'}`);

        await new Promise(resolve => setTimeout(resolve, 500));
    }
};
