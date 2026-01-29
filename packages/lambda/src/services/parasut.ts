/**
 * Parasut Invoice Service
 * Handles automatic invoice generation from PayTR payments
 */

export interface ParasutConfig {
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
  companyId: string;
}

export interface CompanyData {
  companyName: string;
  vkn: string;           // 10-digit VKN (Vergi Kimlik Numarası)
  taxOffice: string;
  address: string;
  city: string;
  district: string;
  email?: string;
  phone?: string;
}

export interface InvoiceData {
  invoiceType: 'none' | 'company';
  companyData?: CompanyData;
}

export interface InvoiceResult {
  success: boolean;
  invoiceId?: string;
  eArchiveId?: string;
  pdfUrl?: string;
  error?: string;
}

export class ParasutInvoiceService {
  private accessToken: string | null = null;
  private tokenExpiry: number | null = null;
  private config: ParasutConfig;

  constructor(config: ParasutConfig) {
    this.config = config;
  }

  /**
   * Get or refresh access token
   */
  async getAccessToken(): Promise<string> {
    // Return cached token if still valid (with 5 minute buffer)
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > Date.now() + 300000) {
      return this.accessToken;
    }

    console.log('Parasut: Authenticating...');

    const response = await fetch('https://api.parasut.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        username: this.config.username,
        password: this.config.password,
        grant_type: 'password',
        redirect_uri: 'urn:ietf:wg:oauth:2.0:oob',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Parasut auth failed:', error);
      throw new Error('Failed to authenticate with Parasut');
    }

    const data = await response.json() as { access_token: string; expires_in: number };

    this.accessToken = data.access_token;
    // Token expires in 7200 seconds (2 hours), subtract 5 minutes for safety
    this.tokenExpiry = Date.now() + ((data.expires_in - 300) * 1000);

    console.log('Parasut: Authenticated successfully');
    return this.accessToken;
  }

  /**
   * Create or find "Muhtelif Müşteriler" contact (for invoices without company data)
   */
  async createMinimalContact(accessToken: string): Promise<string> {
    const { companyId } = this.config;

    // First try to find existing "Muhtelif Müşteriler" contact
    try {
      const searchResponse = await fetch(
        `https://api.parasut.com/v4/${companyId}/contacts?filter[name]=Muhtelif%20M%C3%BC%C5%9Fteriler`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (searchResponse.ok) {
        const searchData = await searchResponse.json() as { data?: Array<{ id: string }> };
        const firstContact = searchData.data?.[0];
        if (firstContact) {
          console.log('Parasut: Found existing Muhtelif Müşteriler contact');
          return firstContact.id;
        }
      }
    } catch {
      // Ignore search error, try to create
    }

    // Create new minimal contact
    const contactData = {
      data: {
        type: 'contacts',
        attributes: {
          name: 'Muhtelif Müşteriler', // Legal Turkish placeholder
          contact_type: 'person',
          account_type: 'customer',
          tax_number: '11111111111', // Legal placeholder TC number
          city: 'Istanbul', // Required for e-Archive
          district: 'Kadikoy', // Required for e-Archive
        },
      },
    };

    const response = await fetch(
      `https://api.parasut.com/v4/${companyId}/contacts`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(contactData),
      }
    );

    if (!response.ok) {
      // If 422, contact might already exist (duplicate)
      if (response.status === 422) {
        console.log('Parasut: Contact already exists, searching...');
        // Retry search
        const searchResponse = await fetch(
          `https://api.parasut.com/v4/${companyId}/contacts?filter[name]=Muhtelif`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (searchResponse.ok) {
          const searchData = await searchResponse.json() as { data?: Array<{ id: string }> };
          const foundContact = searchData.data?.[0];
          if (foundContact) {
            return foundContact.id;
          }
        }
      }
      const error = await response.text();
      console.error('Parasut create minimal contact error:', error);
      throw new Error('Failed to create minimal contact');
    }

    const data = await response.json() as { data: { id: string } };
    console.log('Parasut: Created Muhtelif Müşteriler contact:', data.data.id);
    return data.data.id;
  }

  /**
   * Create or find company contact
   */
  async createCompanyContact(accessToken: string, companyData: CompanyData): Promise<string> {
    const { companyId } = this.config;

    // First try to find by VKN
    try {
      const searchResponse = await fetch(
        `https://api.parasut.com/v4/${companyId}/contacts?filter[tax_number]=${companyData.vkn}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (searchResponse.ok) {
        const searchData = await searchResponse.json() as { data?: Array<{ id: string }> };
        const existingContact = searchData.data?.[0];
        if (existingContact) {
          console.log('Parasut: Found existing company contact by VKN');
          return existingContact.id;
        }
      }
    } catch {
      // Ignore search error, try to create
    }

    // Create new company contact
    const contactPayload = {
      data: {
        type: 'contacts',
        attributes: {
          name: companyData.companyName,
          contact_type: 'company',
          account_type: 'customer',
          tax_office: companyData.taxOffice,
          tax_number: companyData.vkn,
          address: companyData.address,
          city: companyData.city,
          district: companyData.district,
          email: companyData.email || undefined,
          phone: companyData.phone || undefined,
        },
      },
    };

    const response = await fetch(
      `https://api.parasut.com/v4/${companyId}/contacts`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(contactPayload),
      }
    );

    if (!response.ok) {
      // If 422, contact might already exist
      if (response.status === 422) {
        const searchResponse = await fetch(
          `https://api.parasut.com/v4/${companyId}/contacts?filter[tax_number]=${companyData.vkn}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (searchResponse.ok) {
          const searchData = await searchResponse.json() as { data?: Array<{ id: string }> };
          const foundCompany = searchData.data?.[0];
          if (foundCompany) {
            return foundCompany.id;
          }
        }
      }
      const error = await response.text();
      console.error('Parasut create company contact error:', error);
      throw new Error('Failed to create company contact');
    }

    const data = await response.json() as { data: { id: string } };
    console.log('Parasut: Created company contact:', data.data.id);
    return data.data.id;
  }

  /**
   * Create or find the Premium Membership product
   */
  async getOrCreateProduct(accessToken: string): Promise<string> {
    const { companyId } = this.config;
    const productName = 'Patron Premium Üyelik (1 Ay)';

    // First try to find existing product
    try {
      const searchResponse = await fetch(
        `https://api.parasut.com/v4/${companyId}/products?filter[name]=${encodeURIComponent(productName)}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (searchResponse.ok) {
        const searchData = await searchResponse.json() as { data?: Array<{ id: string }> };
        const foundProduct = searchData.data?.[0];
        if (foundProduct) {
          console.log('Parasut: Found existing product:', foundProduct.id);
          return foundProduct.id;
        }
      }
    } catch (e) {
      console.log('Parasut: Product search failed, will create new');
    }

    // Create new product
    const productPayload = {
      data: {
        type: 'products',
        attributes: {
          name: productName,
          vat_rate: 20,
          unit: 'Adet',
          sales_price: 1000, // Net price before VAT
          currency: 'TRL',
          product_type: 'service',
        },
      },
    };

    const response = await fetch(
      `https://api.parasut.com/v4/${companyId}/products`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(productPayload),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Parasut create product error:', error);
      throw new Error('Failed to create product');
    }

    const data = await response.json() as { data: { id: string } };
    console.log('Parasut: Created product:', data.data.id);
    return data.data.id;
  }

  /**
   * Create sales invoice
   */
  async createSalesInvoice(
    accessToken: string,
    contactId: string,
    amount: number,
    merchantOid: string
  ): Promise<string> {
    const { companyId } = this.config;

    // Get or create the product first
    const productId = await this.getOrCreateProduct(accessToken);

    // Calculate net amount (excluding VAT)
    // Amount is 1200 TL including 20% VAT, so net = 1200 / 1.20 = 1000
    const netAmount = amount / 1.20;

    const invoicePayload = {
      data: {
        type: 'sales_invoices',
        attributes: {
          item_type: 'invoice',
          description: `Patron Premium Üyelik - Sipariş #${merchantOid}`,
          issue_date: new Date().toISOString().split('T')[0],
          due_date: new Date().toISOString().split('T')[0],
          currency: 'TRL',
          city: 'Istanbul', // Required for e-Archive
          district: 'Kadikoy', // Required for e-Archive
        },
        relationships: {
          contact: {
            data: { type: 'contacts', id: contactId },
          },
          details: {
            data: [
              {
                type: 'sales_invoice_details',
                attributes: {
                  quantity: 1,
                  unit_price: netAmount,
                  vat_rate: 20,
                },
                relationships: {
                  product: {
                    data: { type: 'products', id: productId },
                  },
                },
              },
            ],
          },
        },
      },
    };

    const response = await fetch(
      `https://api.parasut.com/v4/${companyId}/sales_invoices`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invoicePayload),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Parasut create invoice error:', error);
      throw new Error('Failed to create invoice');
    }

    const data = await response.json() as { data: { id: string } };
    console.log('Parasut: Created invoice:', data.data.id);
    return data.data.id;
  }

  /**
   * Record payment on invoice
   */
  async recordPayment(
    accessToken: string,
    invoiceId: string,
    amount: number,
    merchantOid: string
  ): Promise<void> {
    const { companyId } = this.config;

    const paymentPayload = {
      data: {
        type: 'payments',
        attributes: {
          date: new Date().toISOString().split('T')[0],
          amount: amount,
          description: `PayTR Ödeme - ${merchantOid}`,
        },
        relationships: {
          payable: {
            data: { type: 'sales_invoices', id: invoiceId },
          },
        },
      },
    };

    const response = await fetch(
      `https://api.parasut.com/v4/${companyId}/payments`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentPayload),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Parasut record payment error:', error);
      // Don't throw - payment recording is not critical
    } else {
      console.log('Parasut: Payment recorded');
    }
  }

  /**
   * Generate e-Archive document
   */
  async generateEArchive(accessToken: string, invoiceId: string): Promise<string> {
    const { companyId } = this.config;

    const eArchivePayload = {
      data: {
        type: 'e_archives',
        relationships: {
          sales_invoice: {
            data: { type: 'sales_invoices', id: invoiceId },
          },
        },
      },
    };

    const response = await fetch(
      `https://api.parasut.com/v4/${companyId}/e_archives`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eArchivePayload),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Parasut generate e-archive error:', error);
      throw new Error('Failed to generate e-archive');
    }

    const data = await response.json() as { data: { id: string } };
    console.log('Parasut: E-Archive created:', data.data.id);
    return data.data.id;
  }

  /**
   * Get e-Archive PDF URL (with polling for generation completion)
   */
  async getEArchivePdfUrl(accessToken: string, eArchiveId: string): Promise<string | null> {
    const { companyId } = this.config;
    const maxAttempts = 20;
    const delayMs = 3000;

    // Poll for PDF URL (generation can take 30-60 seconds)
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const response = await fetch(
        `https://api.parasut.com/v4/${companyId}/e_archives/${eArchiveId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (response.ok) {
        const data = await response.json() as {
          data: { attributes: { pdf_url?: string; status?: string } };
        };

        const pdfUrl = data.data.attributes.pdf_url;
        if (pdfUrl) {
          console.log('Parasut: Got PDF URL');
          return pdfUrl;
        }

        const status = data.data.attributes.status;
        if (attempt % 5 === 0) {
          console.log(`Parasut: E-Archive status: ${status}, attempt ${attempt + 1}/${maxAttempts}`);
        }
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    console.warn(`Parasut: PDF URL not available after ${maxAttempts} attempts`);
    return null;
  }

  /**
   * Get invoice print URL
   */
  async getInvoicePrintUrl(accessToken: string, invoiceId: string): Promise<string | null> {
    const { companyId } = this.config;

    try {
      const response = await fetch(
        `https://api.parasut.com/v4/${companyId}/sales_invoices/${invoiceId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!response.ok) {
        console.error('Failed to get invoice:', response.status);
        return null;
      }

      const data = await response.json() as {
        data: { attributes: { print_url?: string } };
      };

      const printUrl = data.data.attributes.print_url;
      if (printUrl) {
        console.log('Parasut: Got print URL');
        return printUrl;
      }

      return null;
    } catch (error) {
      console.error('Error getting invoice print URL:', error);
      return null;
    }
  }

  /**
   * Main method: Create complete invoice from payment
   */
  async createInvoice(
    paymentData: { merchantOid: string; totalAmount: number },
    invoiceData: InvoiceData
  ): Promise<InvoiceResult> {
    try {
      const accessToken = await this.getAccessToken();
      const amount = paymentData.totalAmount;

      // Create or find contact
      let contactId: string;
      if (invoiceData.invoiceType === 'company' && invoiceData.companyData) {
        contactId = await this.createCompanyContact(accessToken, invoiceData.companyData);
      } else {
        contactId = await this.createMinimalContact(accessToken);
      }

      // Create sales invoice
      const invoiceId = await this.createSalesInvoice(
        accessToken,
        contactId,
        amount,
        paymentData.merchantOid
      );

      // Record payment (non-blocking)
      await this.recordPayment(accessToken, invoiceId, amount, paymentData.merchantOid);

      // Generate e-Archive and wait for PDF URL
      let eArchiveId: string | undefined;
      let pdfUrl: string | null = null;

      try {
        eArchiveId = await this.generateEArchive(accessToken, invoiceId);
        if (eArchiveId) {
          // Poll for PDF URL with shorter timeout (Lambda has limited time)
          // E-Archive PDF generation typically takes 30-60 seconds
          pdfUrl = await this.getEArchivePdfUrl(accessToken, eArchiveId);
        }
      } catch (e) {
        console.log('E-Archive generation failed:', e);
      }

      return {
        success: true,
        invoiceId,
        eArchiveId,
        pdfUrl: pdfUrl || undefined,
      };
    } catch (error) {
      console.error('Parasut invoice creation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * Register webhook with Parasut
 */
export async function registerParasutWebhook(
  webhookUrl: string,
  events: string[] = ['e_archive.created', 'e_archive.updated', 'e_invoice.created', 'e_invoice.updated']
): Promise<{ success: boolean; webhookId?: string; error?: string }> {
  const service = createParasutService();
  if (!service) {
    return { success: false, error: 'Parasut service not configured' };
  }

  try {
    const accessToken = await service.getAccessToken();
    const companyId = process.env.PARASUT_COMPANY_ID;

    const webhookPayload = {
      data: {
        type: 'webhooks',
        attributes: {
          url: webhookUrl,
          events: events,
        },
      },
    };

    const response = await fetch(
      `https://api.parasut.com/v4/${companyId}/webhooks`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(webhookPayload),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Parasut register webhook error:', error);
      return { success: false, error };
    }

    const data = await response.json() as { data: { id: string } };
    console.log('Parasut: Webhook registered:', data.data.id);
    return { success: true, webhookId: data.data.id };
  } catch (error) {
    console.error('Parasut webhook registration failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * List registered webhooks
 */
export async function listParasutWebhooks(): Promise<{ success: boolean; webhooks?: Array<{ id: string; url: string; events: string[] }>; error?: string }> {
  const service = createParasutService();
  if (!service) {
    return { success: false, error: 'Parasut service not configured' };
  }

  try {
    const accessToken = await service.getAccessToken();
    const companyId = process.env.PARASUT_COMPANY_ID;

    const response = await fetch(
      `https://api.parasut.com/v4/${companyId}/webhooks`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error };
    }

    const data = await response.json() as {
      data: Array<{
        id: string;
        attributes: { url: string; events: string[] }
      }>
    };

    const webhooks = data.data.map(w => ({
      id: w.id,
      url: w.attributes.url,
      events: w.attributes.events,
    }));

    return { success: true, webhooks };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Create a Parasut service instance from environment variables
 */
export function createParasutService(): ParasutInvoiceService | null {
  const clientId = process.env.PARASUT_CLIENT_ID;
  const clientSecret = process.env.PARASUT_CLIENT_SECRET;
  const username = process.env.PARASUT_USERNAME;
  const password = process.env.PARASUT_PASSWORD;
  const companyId = process.env.PARASUT_COMPANY_ID;

  if (!clientId || !clientSecret || !username || !password || !companyId) {
    console.warn('Parasut: Missing configuration, service not available');
    return null;
  }

  return new ParasutInvoiceService({
    clientId,
    clientSecret,
    username,
    password,
    companyId,
  });
}
