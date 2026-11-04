import { NextApiRequest, NextApiResponse } from 'next';

/**
 * WhatsApp API Proxy Endpoint
 * Acts as a backend proxy to forward messages to the external WhatsApp gateway.
 * This avoids CORS issues and keeps the gateway URL server-side.
 */

const WHATSAPP_API_BASE = 'http://api.geekhirusha.com/designasia.php';

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { number, type, message, mediaUrl } = req.body;

        if (!number || !type) {
            return res.status(400).json({
                error: 'Missing mandatory parameters',
                required: ['number', 'type']
            });
        }

        // Build URL with query parameters
        const url = new URL(WHATSAPP_API_BASE);
        url.searchParams.append('number', number);
        url.searchParams.append('type', type);

        if (message) {
            url.searchParams.append('message', message);
        }

        if (mediaUrl) {
            url.searchParams.append('mediaUrl', mediaUrl);
        }

        console.log(`[WhatsApp Proxy] Forwarding to gateway for number: ${number}`);

        // Call WhatsApp API
        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
        });

        const responseText = await response.text();
        console.log(`[WhatsApp Proxy] Gateway status: ${response.status}, body: ${responseText.substring(0, 300)}`);

        if (!response.ok) {
            return res.status(response.status).json({
                error: 'WhatsApp API request failed',
                status: response.status,
                details: responseText
            });
        }

        // Try to parse as JSON
        try {
            const result = JSON.parse(responseText);
            return res.status(200).json({ success: true, data: result });
        } catch {
            return res.status(200).json({ success: true, data: responseText });
        }

    } catch (error: any) {
        console.error('[WhatsApp Proxy] Error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}
