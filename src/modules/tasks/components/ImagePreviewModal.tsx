"use client";

import React from "react";
import { Download, X } from "lucide-react";

interface ImagePreviewModalProps {
  imageUrl: string | null;
  imageTitle: string | null;
  onClose: () => void;
}

export function ImagePreviewModal({
  imageUrl,
  imageTitle,
  onClose,
}: ImagePreviewModalProps) {
  if (!imageUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-stone-900/85 backdrop-blur-xs flex flex-col items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="bg-white rounded-2xl max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-stone-200 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-3 border-b border-stone-200 flex items-center justify-between gap-4 bg-stone-50">
          <span className="font-bold text-stone-900 text-xs truncate max-w-md">
            {imageTitle || "სურათის გადახედვა"}
          </span>
          <div className="flex items-center gap-2">
            <a
              href={imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              download={imageTitle || "image"}
              className="flex items-center gap-1 px-3 py-1 rounded-lg bg-orange-600 text-white font-bold text-xs hover:bg-orange-700 transition-colors"
            >
              <Download size={13} />
              <span>გადმოწერა</span>
            </a>
            <button
              onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
              className="p-1 text-stone-400 hover:text-stone-800 hover:bg-stone-200 rounded-lg cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="p-2 bg-stone-950/5 flex items-center justify-center overflow-auto max-h-[calc(90vh-60px)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={imageTitle || "Preview"}
            className="max-h-[80vh] max-w-full object-contain rounded-lg"
          />
        </div>
      </div>
    </div>
  );
}
