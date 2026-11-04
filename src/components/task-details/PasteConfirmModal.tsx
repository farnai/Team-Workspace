"use client";

import React, { useEffect, useMemo } from "react";
import { UploadCloud, X, Loader2 } from "lucide-react";

interface PasteConfirmModalProps {
  file: File | null;
  isUploading: boolean;
  onConfirm: (file: File) => Promise<void>;
  onCancel: () => void;
}

export function PasteConfirmModal({
  file,
  isUploading,
  onConfirm,
  onCancel,
}: PasteConfirmModalProps) {
  const previewUrl = useMemo(() => {
    if (!file) return null;
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  if (!file || !previewUrl) return null;

  const fileSizeKB = (file.size / 1024).toFixed(1);

  return (
    <div
      className="fixed inset-0 z-50 bg-stone-900/80 backdrop-blur-2xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-stone-200 animate-in zoom-in-95 duration-150 text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center">
              <UploadCloud size={16} />
            </div>
            <div>
              <h3 className="font-extrabold text-stone-900 text-sm">
                სქრინშოტის ატვირთვა
              </h3>
              <p className="text-[11px] text-stone-400">
                ბუფერში (Clipboard) აღმოჩენილია სურათი
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Thumbnail preview */}
        <div className="bg-stone-50 border border-stone-200/80 rounded-xl p-2 flex items-center justify-center max-h-56 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Pasted screenshot"
            className="max-h-52 max-w-full object-contain rounded-lg"
          />
        </div>

        {/* File info */}
        <div className="flex items-center justify-between text-stone-500 text-[11px] px-1">
          <span className="font-semibold text-stone-700 truncate max-w-[200px]">
            {file.name}
          </span>
          <span>{fileSizeKB} KB</span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
          <button
            type="button"
            disabled={isUploading}
            onClick={onCancel}
            className="px-3.5 py-1.5 border border-stone-200 text-stone-600 rounded-xl font-bold hover:bg-stone-50 cursor-pointer transition-colors"
          >
            გაუქმება
          </button>
          <button
            type="button"
            disabled={isUploading}
            onClick={() => onConfirm(file)}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
          >
            {isUploading ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <UploadCloud size={13} />
            )}
            <span>ატვირთვა</span>
          </button>
        </div>
      </div>
    </div>
  );
}
