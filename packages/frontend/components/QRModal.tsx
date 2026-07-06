'use client';

import { useEffect, useState } from 'react';

import { getQrUrl } from '../lib/api';

interface QRModalProps {
  code: string;
  open: boolean;
  onClose: () => void;
}

export function QRModal({ code, open, onClose }: QRModalProps) {
  const [imgSrc, setImgSrc] = useState('');

  useEffect(() => {
    if (open) {
      setImgSrc(getQrUrl(code, 400));
    }
  }, [open, code]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass rounded-2xl p-6 max-w-sm w-full animate-slide-up">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-lg bg-surface-lighter text-gray-500 hover:text-gray-300 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h3 className="text-sm font-medium text-gray-400 mb-4">QR Code</h3>

        <div className="rounded-xl overflow-hidden bg-white p-3 mb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imgSrc}
            alt={`QR code for ${code}`}
            className="w-full aspect-square"
          />
        </div>

        <p className="text-xs text-center text-gray-500">
          Scan to visit <span className="text-accent font-mono">/{code}</span>
        </p>
      </div>
    </div>
  );
}
