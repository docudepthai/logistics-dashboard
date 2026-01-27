'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

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

function SuccessContent() {
  const searchParams = useSearchParams();
  const _phone = searchParams.get('phone');

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glass-card rounded-2xl p-8 max-w-md w-full text-center animate-fade-in">
        {/* Success Icon */}
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center">
          <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold mb-2 text-white">Odeme Basarili!</h1>
        <p className="text-zinc-400 mb-6">
          Tebrikler! Premium uyeliginiz aktif edildi.
        </p>

        <div className="bg-zinc-800/50 rounded-lg p-4 mb-6">
          <p className="text-sm text-zinc-400 mb-2">Artik su ozelliklere sahipsiniz:</p>
          <ul className="text-left text-sm text-zinc-300 space-y-2">
            <li className="flex items-center gap-2">
              <span className="text-green-400">✓</span>
              Tum telefon numaralarini gorebilirsiniz
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-400">✓</span>
              Sinirsiz yuk arama
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-400">✓</span>
              Oncelikli destek
            </li>
          </ul>
        </div>

        {/* Invoice Note */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-300">
            📄 Fatura talebiniz varsa, faturaniz kisa sure icinde WhatsApp uzerinden gonderilecektir.
          </p>
        </div>

        <p className="text-zinc-500 text-sm mb-6">
          WhatsApp'a donup yuk aramaya devam edebilirsiniz.
        </p>

        <a
          href="https://wa.me/905321234567"
          className="btn-primary inline-flex"
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          WhatsApp'a Don
        </a>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <SuccessContent />
    </Suspense>
  );
}
