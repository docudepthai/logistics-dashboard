'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  TURKISH_PROVINCES,
  PRICING,
  validateVKN,
  validateEmail,
  validatePhone,
  ERROR_MESSAGES,
} from '@/lib/constants';

interface CompanyData {
  companyName: string;
  vkn: string;
  taxOffice: string;
  address: string;
  city: string;
  district: string;
  email: string;
  phone: string;
}

interface FormErrors {
  companyName?: string;
  vkn?: string;
  taxOffice?: string;
  address?: string;
  city?: string;
  district?: string;
  email?: string;
  phone?: string;
}

interface TokenData {
  valid: boolean;
  phoneNumber?: string;
  error?: string;
}

function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="spinner mx-auto mb-4" />
        <p className="text-zinc-400">Yukleniyor...</p>
      </div>
    </div>
  );
}

function CheckoutContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  // Token validation state
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [isValidating, setIsValidating] = useState(true);

  // Form state
  const [wantsInvoice, setWantsInvoice] = useState(false);
  const [companyData, setCompanyData] = useState<CompanyData>({
    companyName: '',
    vkn: '',
    taxOffice: '',
    address: '',
    city: '',
    district: '',
    email: '',
    phone: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Validate token on mount
  useEffect(() => {
    async function validateToken() {
      if (!token) {
        setTokenData({ valid: false, error: ERROR_MESSAGES.TOKEN_INVALID });
        setIsValidating(false);
        return;
      }

      try {
        const res = await fetch('/api/validate-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const data = await res.json();
        setTokenData(data);
      } catch {
        setTokenData({ valid: false, error: ERROR_MESSAGES.NETWORK_ERROR });
      } finally {
        setIsValidating(false);
      }
    }

    validateToken();
  }, [token]);

  // Validate a single field
  const validateField = useCallback((field: keyof CompanyData, value: string): string | undefined => {
    if (!wantsInvoice) return undefined;

    switch (field) {
      case 'companyName':
        return value.trim() ? undefined : ERROR_MESSAGES.REQUIRED;
      case 'vkn':
        if (!value.trim()) return ERROR_MESSAGES.REQUIRED;
        if (!/^\d{10}$/.test(value)) return ERROR_MESSAGES.VKN_INVALID;
        if (!validateVKN(value)) return ERROR_MESSAGES.VKN_CHECKSUM;
        return undefined;
      case 'taxOffice':
        return value.trim() ? undefined : ERROR_MESSAGES.REQUIRED;
      case 'address':
        return value.trim() ? undefined : ERROR_MESSAGES.REQUIRED;
      case 'city':
        return value ? undefined : ERROR_MESSAGES.REQUIRED;
      case 'district':
        return value.trim() ? undefined : ERROR_MESSAGES.REQUIRED;
      case 'email':
        if (!value.trim()) return ERROR_MESSAGES.REQUIRED;
        if (!validateEmail(value)) return ERROR_MESSAGES.EMAIL_INVALID;
        return undefined;
      case 'phone':
        if (value && !validatePhone(value)) return ERROR_MESSAGES.PHONE_INVALID;
        return undefined;
      default:
        return undefined;
    }
  }, [wantsInvoice]);

  // Update field and validate
  const updateField = (field: keyof CompanyData, value: string) => {
    setCompanyData(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: validateField(field, value) }));
  };

  // Validate entire form
  const validateForm = (): boolean => {
    if (!wantsInvoice) return true;

    const newErrors: FormErrors = {};
    let isValid = true;

    (Object.keys(companyData) as (keyof CompanyData)[]).forEach(field => {
      const error = validateField(field, companyData[field]);
      if (error) {
        newErrors[field] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  // Check if form is valid
  const isFormValid = useCallback((): boolean => {
    if (!wantsInvoice) return true;

    return (
      companyData.companyName.trim() !== '' &&
      /^\d{10}$/.test(companyData.vkn) &&
      validateVKN(companyData.vkn) &&
      companyData.taxOffice.trim() !== '' &&
      companyData.address.trim() !== '' &&
      companyData.city !== '' &&
      companyData.district.trim() !== '' &&
      validateEmail(companyData.email) &&
      (companyData.phone === '' || validatePhone(companyData.phone))
    );
  }, [wantsInvoice, companyData]);

  // Handle form submission
  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch('/api/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          wantsInvoice,
          companyData: wantsInvoice ? companyData : undefined,
        }),
      });

      const data = await res.json();

      if (data.success && data.paymentUrl) {
        // Redirect to PayTR
        window.location.href = data.paymentUrl;
      } else {
        setSubmitError(data.error || ERROR_MESSAGES.PAYMENT_FAILED);
      }
    } catch {
      setSubmitError(ERROR_MESSAGES.NETWORK_ERROR);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (isValidating) {
    return <LoadingSpinner />;
  }

  // Invalid token state
  if (!tokenData?.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass-card rounded-2xl p-8 max-w-md w-full text-center animate-fade-in">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold mb-4">Gecersiz Baglanti</h1>
          <p className="text-zinc-400 mb-6">
            {tokenData?.error || ERROR_MESSAGES.TOKEN_INVALID}
          </p>
          <p className="text-sm text-zinc-500">
            Yeni bir odeme linki icin WhatsApp uzerinden bizimle iletisime gecin.
          </p>
          <a
            href="https://wa.me/905321234567?text=Yeni%20odeme%20linki%20istiyorum"
            className="btn-primary mt-6 inline-flex"
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            WhatsApp ile Iletisim
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8 animate-fade-in">
          <h1 className="text-3xl font-bold mb-2">Patron Premium</h1>
          <p className="text-zinc-400">Aylik Uyelik Odemesi</p>
        </div>

        {/* Price Card */}
        <div className="glass-card rounded-2xl p-6 mb-6 animate-slide-up">
          <h2 className="text-lg font-semibold mb-4 text-zinc-300">Odeme Detaylari</h2>
          <div className="space-y-3">
            <div className="flex justify-between text-zinc-400">
              <span>Aylik Uyelik</span>
              <span>{PRICING.BASE_AMOUNT.toLocaleString('tr-TR')} {PRICING.CURRENCY}</span>
            </div>
            <div className="flex justify-between text-zinc-400">
              <span>KDV (%{PRICING.VAT_RATE * 100})</span>
              <span>{PRICING.VAT_AMOUNT.toLocaleString('tr-TR')} {PRICING.CURRENCY}</span>
            </div>
            <div className="border-t border-zinc-700 pt-3 flex justify-between text-xl font-bold">
              <span>Toplam</span>
              <span className="text-green-400">{PRICING.TOTAL_AMOUNT.toLocaleString('tr-TR')} {PRICING.CURRENCY}</span>
            </div>
          </div>
        </div>

        {/* Invoice Checkbox */}
        <div className="glass-card rounded-2xl p-6 mb-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <label className="checkbox-container">
            <input
              type="checkbox"
              className="checkbox-input"
              checked={wantsInvoice}
              onChange={(e) => {
                setWantsInvoice(e.target.checked);
                if (!e.target.checked) {
                  setErrors({});
                }
              }}
            />
            <span className="text-white font-medium">Fatura istiyorum</span>
          </label>

          {wantsInvoice && (
            <p className="text-sm text-zinc-500 mt-2 ml-8">
              Kurumsal fatura icin asagidaki bilgileri doldurun
            </p>
          )}
        </div>

        {/* Invoice Form */}
        {wantsInvoice && (
          <div className="glass-card rounded-2xl p-6 mb-6 animate-slide-down">
            <h2 className="text-lg font-semibold mb-4 text-zinc-300">Fatura Bilgileri</h2>
            <div className="space-y-4">
              {/* Company Name */}
              <div>
                <label className="block text-sm text-zinc-400 mb-1">
                  Sirket Unvani <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  className={`input-field ${errors.companyName ? 'error' : ''}`}
                  placeholder="Ornek Lojistik A.S."
                  value={companyData.companyName}
                  onChange={(e) => updateField('companyName', e.target.value)}
                />
                {errors.companyName && <p className="error-message">{errors.companyName}</p>}
              </div>

              {/* VKN */}
              <div>
                <label className="block text-sm text-zinc-400 mb-1">
                  Vergi Kimlik Numarasi (VKN) <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  className={`input-field ${errors.vkn ? 'error' : ''}`}
                  placeholder="1234567890"
                  maxLength={10}
                  value={companyData.vkn}
                  onChange={(e) => updateField('vkn', e.target.value.replace(/\D/g, ''))}
                />
                {errors.vkn && <p className="error-message">{errors.vkn}</p>}
              </div>

              {/* Tax Office */}
              <div>
                <label className="block text-sm text-zinc-400 mb-1">
                  Vergi Dairesi <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  className={`input-field ${errors.taxOffice ? 'error' : ''}`}
                  placeholder="Cankaya Vergi Dairesi"
                  value={companyData.taxOffice}
                  onChange={(e) => updateField('taxOffice', e.target.value)}
                />
                {errors.taxOffice && <p className="error-message">{errors.taxOffice}</p>}
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm text-zinc-400 mb-1">
                  Adres <span className="text-red-400">*</span>
                </label>
                <textarea
                  className={`input-field min-h-[80px] resize-none ${errors.address ? 'error' : ''}`}
                  placeholder="Tam adres"
                  value={companyData.address}
                  onChange={(e) => updateField('address', e.target.value)}
                />
                {errors.address && <p className="error-message">{errors.address}</p>}
              </div>

              {/* City & District */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">
                    Il <span className="text-red-400">*</span>
                  </label>
                  <select
                    className={`select-field ${errors.city ? 'error' : ''}`}
                    value={companyData.city}
                    onChange={(e) => updateField('city', e.target.value)}
                  >
                    <option value="">Il Seciniz</option>
                    {TURKISH_PROVINCES.map(province => (
                      <option key={province} value={province}>{province}</option>
                    ))}
                  </select>
                  {errors.city && <p className="error-message">{errors.city}</p>}
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">
                    Ilce <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    className={`input-field ${errors.district ? 'error' : ''}`}
                    placeholder="Ilce"
                    value={companyData.district}
                    onChange={(e) => updateField('district', e.target.value)}
                  />
                  {errors.district && <p className="error-message">{errors.district}</p>}
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm text-zinc-400 mb-1">
                  E-posta <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  className={`input-field ${errors.email ? 'error' : ''}`}
                  placeholder="muhasebe@sirket.com"
                  value={companyData.email}
                  onChange={(e) => updateField('email', e.target.value)}
                />
                {errors.email && <p className="error-message">{errors.email}</p>}
              </div>

              {/* Phone (Optional) */}
              <div>
                <label className="block text-sm text-zinc-400 mb-1">
                  Telefon <span className="text-zinc-600">(Opsiyonel)</span>
                </label>
                <input
                  type="tel"
                  className={`input-field ${errors.phone ? 'error' : ''}`}
                  placeholder="0532 123 45 67"
                  value={companyData.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                />
                {errors.phone && <p className="error-message">{errors.phone}</p>}
              </div>
            </div>
          </div>
        )}

        {/* Submit Error */}
        {submitError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6 text-red-400 text-center">
            {submitError}
          </div>
        )}

        {/* Submit Button */}
        <button
          className="btn-primary"
          disabled={isSubmitting || (wantsInvoice && !isFormValid())}
          onClick={handleSubmit}
        >
          {isSubmitting ? (
            <>
              <div className="spinner" />
              <span>Isleniyor...</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>Guvenli Odeme Yap</span>
            </>
          )}
        </button>

        {/* Security Note */}
        <p className="text-center text-zinc-500 text-sm mt-4">
          🔒 Guvenli odeme PayTR altyapisi ile saglanmaktadir
        </p>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <CheckoutContent />
    </Suspense>
  );
}
