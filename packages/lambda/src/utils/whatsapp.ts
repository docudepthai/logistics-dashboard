/**
 * WhatsApp Business API utilities
 * For sending messages and documents to users
 */

const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

interface WhatsAppMessageResponse {
  messaging_product: string;
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string }>;
}

interface WhatsAppErrorResponse {
  error: {
    message: string;
    type: string;
    code: number;
  };
}

/**
 * Send a text message via WhatsApp
 */
export async function sendWhatsAppMessage(to: string, message: string): Promise<boolean> {
  if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) {
    console.warn('WhatsApp: Missing credentials, cannot send message');
    return false;
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: message },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json() as WhatsAppErrorResponse;
      console.error('WhatsApp send message error:', error);
      return false;
    }

    const data = await response.json() as WhatsAppMessageResponse;
    console.log(`WhatsApp: Message sent to ${to}, id: ${data.messages?.[0]?.id}`);
    return true;
  } catch (error) {
    console.error('WhatsApp send message failed:', error);
    return false;
  }
}

/**
 * Send a document via WhatsApp
 * @param to - Recipient phone number
 * @param documentUrl - Public URL to the document (PDF, etc.)
 * @param caption - Optional caption for the document
 * @param filename - Filename to display
 */
export async function sendWhatsAppDocument(
  to: string,
  documentUrl: string,
  caption: string,
  filename: string
): Promise<boolean> {
  if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) {
    console.warn('WhatsApp: Missing credentials, cannot send document');
    return false;
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'document',
          document: {
            link: documentUrl,
            caption,
            filename,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json() as WhatsAppErrorResponse;
      console.error('WhatsApp send document error:', error);
      return false;
    }

    const data = await response.json() as WhatsAppMessageResponse;
    console.log(`WhatsApp: Document sent to ${to}, id: ${data.messages?.[0]?.id}`);
    return true;
  } catch (error) {
    console.error('WhatsApp send document failed:', error);
    return false;
  }
}

/**
 * Send an image via WhatsApp
 * @param to - Recipient phone number
 * @param imageUrl - Public URL to the image
 * @param caption - Optional caption for the image
 */
export async function sendWhatsAppImage(
  to: string,
  imageUrl: string,
  caption?: string
): Promise<boolean> {
  if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) {
    console.warn('WhatsApp: Missing credentials, cannot send image');
    return false;
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'image',
          image: {
            link: imageUrl,
            caption,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json() as WhatsAppErrorResponse;
      console.error('WhatsApp send image error:', error);
      return false;
    }

    const data = await response.json() as WhatsAppMessageResponse;
    console.log(`WhatsApp: Image sent to ${to}, id: ${data.messages?.[0]?.id}`);
    return true;
  } catch (error) {
    console.error('WhatsApp send image failed:', error);
    return false;
  }
}

/**
 * Send invoice notification with PDF
 */
export async function sendInvoiceNotification(
  to: string,
  pdfUrl: string,
  merchantOid: string
): Promise<boolean> {
  const caption = `Faturanız hazır!\n\nSipariş No: ${merchantOid}\n\nPatron Premium üyeliğiniz için teşekkür ederiz. 🙏`;
  const filename = `fatura-${merchantOid}.pdf`;

  return sendWhatsAppDocument(to, pdfUrl, caption, filename);
}

/**
 * Send payment success notification (without PDF)
 */
export async function sendPaymentSuccessNotification(to: string): Promise<boolean> {
  const message = `✅ Ödemeniz başarıyla alındı!\n\nPremium üyeliğiniz aktif edildi. Artık tüm telefon numaralarını görebilirsiniz.\n\nSorularınız için WhatsApp'tan bize ulaşabilirsiniz: +90 533 208 9867`;

  return sendWhatsAppMessage(to, message);
}

/**
 * Send invoice generation failure notification
 */
export async function sendInvoiceFailureNotification(to: string): Promise<boolean> {
  const message = `⚠️ Faturanız şu anda oluşturulamadı.\n\nEndişelenmeyin, ödemeniz başarılı ve premium üyeliğiniz aktif. Faturanız en kısa sürede manuel olarak oluşturulup gönderilecektir.\n\nSorularınız için WhatsApp'tan bize ulaşabilirsiniz: +90 533 208 9867`;

  return sendWhatsAppMessage(to, message);
}

/**
 * Send an interactive message with a CTA URL button
 * @param to - Recipient phone number
 * @param headerText - Header text (optional)
 * @param bodyText - Main message body
 * @param footerText - Footer text (optional)
 * @param buttonText - Text on the button
 * @param buttonUrl - URL to open when button is clicked
 */
export async function sendWhatsAppButtonMessage(
  to: string,
  bodyText: string,
  buttonText: string,
  buttonUrl: string,
  headerText?: string,
  footerText?: string
): Promise<boolean> {
  if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) {
    console.warn('WhatsApp: Missing credentials, cannot send button message');
    return false;
  }

  try {
    const interactive: {
      type: string;
      header?: { type: string; text: string };
      body: { text: string };
      footer?: { text: string };
      action: {
        name: string;
        parameters: {
          display_text: string;
          url: string;
        };
      };
    } = {
      type: 'cta_url',
      body: { text: bodyText },
      action: {
        name: 'cta_url',
        parameters: {
          display_text: buttonText,
          url: buttonUrl,
        },
      },
    };

    if (headerText) {
      interactive.header = { type: 'text', text: headerText };
    }
    if (footerText) {
      interactive.footer = { text: footerText };
    }

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'interactive',
          interactive,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json() as WhatsAppErrorResponse;
      console.error('WhatsApp send button message error:', error);
      return false;
    }

    const data = await response.json() as WhatsAppMessageResponse;
    console.log(`WhatsApp: Button message sent to ${to}, id: ${data.messages?.[0]?.id}`);
    return true;
  } catch (error) {
    console.error('WhatsApp send button message failed:', error);
    return false;
  }
}
