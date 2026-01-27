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

function FailedContent() {
  const searchParams = useSearchParams();
  const phone = searchParams.get('phone');
  const reason = searchParams.get('reason');

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glass-card rounded-2xl p-8 max-w-md w-full text-center animate-fade-in">
        {/* Error Icon */}
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
          <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold mb-2 text-white">Odeme Basarisiz</h1>
        <p className="text-zinc-400 mb-6">
          Odeme islemi tamamlanamadi.
        </p>

        {reason && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-300">{reason}</p>
          </div>
        )}

        <div className="space-y-3 mb-6">
          <p className="text-zinc-400 text-sm">Olasi nedenler:</p>
          <ul className="text-left text-sm text-zinc-500 space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-zinc-600 mt-0.5">•</span>
              Kart bilgileri hatali girilebilir
            </li>
            <li className="flex items-start gap-2">
              <span className="text-zinc-600 mt-0.5">•</span>
              Yetersiz bakiye
            </li>
            <li className="flex items-start gap-2">
              <span className="text-zinc-600 mt-0.5">•</span>
              Banka tarafindan reddedilmis olabilir
            </li>
            <li className="flex items-start gap-2">
              <span className="text-zinc-600 mt-0.5">•</span>
              3D Secure dogrulama basarisiz
            </li>
          </ul>
        </div>

        <div className="space-y-3">
          {phone && (
            <a
              href={`/checkout?phone=${phone}`}
              className="btn-primary inline-flex w-full justify-center"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Tekrar Dene
            </a>
          )}

          <a
            href="https://wa.me/905321234567?text=Odeme%20sorunu%20yasiyorum"
            className="block w-full py-3 px-6 rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800 transition-colors text-center"
            target="_blank"
            rel="noopener noreferrer"
          >
            Destek Al
          </a>
        </div>
      </div>
    </div>
  );
}

export default function FailedPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <FailedContent />
    </Suspense>
  );
}
