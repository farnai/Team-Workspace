'use client';

import React, { useRef, useState } from 'react';
import { Globe, Loader2, Paperclip, Plus, Upload, X } from 'lucide-react';
import { getErrorMessage } from '@/lib/api-client';
import { testingApi } from '../api';

export interface TaskAttachmentOption {
  id: string;
  originalName: string;
  mimeType: string;
  url?: string | null;
  isExternal: boolean;
}

interface TestRunEvidencePickerProps {
  taskId: string;
  existingAttachments: TaskAttachmentOption[];
  selectedIds: string[];
  onChangeSelectedIds: (nextIds: string[]) => void;
  onAttachmentCreated?: () => Promise<void> | void;
}

export function TestRunEvidencePicker({
  taskId,
  existingAttachments,
  selectedIds,
  onChangeSelectedIds,
  onAttachmentCreated,
}: TestRunEvidencePickerProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [localAdded, setLocalAdded] = useState<TaskAttachmentOption[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkName, setLinkName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [isSavingLink, setIsSavingLink] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mergedOptions = React.useMemo(() => {
    const map = new Map<string, TaskAttachmentOption>();
    for (const att of existingAttachments) map.set(att.id, att);
    for (const att of localAdded) map.set(att.id, att);
    return Array.from(map.values());
  }, [existingAttachments, localAdded]);

  const selectedItems = mergedOptions.filter((a) => selectedIds.includes(a.id));
  const availableToAttach = mergedOptions.filter((a) => !selectedIds.includes(a.id));

  const handleUpload = async (file: File) => {
    setErrorMsg(null);
    try {
      setIsUploading(true);
      const created = await testingApi.uploadEvidenceFile(taskId, file);
      setLocalAdded((prev) => [created, ...prev]);
      onChangeSelectedIds([...selectedIds, created.id]);
      await onAttachmentCreated?.();
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddLink = async () => {
    if (!linkUrl.trim()) return;
    setErrorMsg(null);
    let url = linkUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }

    try {
      setIsSavingLink(true);
      const created = await testingApi.createEvidenceLink(taskId, {
        name: linkName.trim() || undefined,
        url,
      });
      setLocalAdded((prev) => [created, ...prev]);
      onChangeSelectedIds([...selectedIds, created.id]);
      setLinkName('');
      setLinkUrl('');
      setShowLinkForm(false);
      await onAttachmentCreated?.();
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    } finally {
      setIsSavingLink(false);
    }
  };

  return (
    <div className="space-y-2 pt-1">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-[11px] font-bold text-stone-700 flex items-center gap-1">
          <Paperclip size={12} className="text-orange-600" />
          <span>მტკიცებულება — ფაილი ან ბმული (არასავალდებულო)</span>
        </span>

        <div className="flex items-center gap-1.5 flex-wrap">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleUpload(file);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1 px-2 py-1 bg-white hover:bg-stone-100 border border-stone-200 rounded-lg text-[11px] font-bold text-stone-700 cursor-pointer disabled:opacity-50"
          >
            {isUploading ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
            <span>ფაილის ატვირთვა</span>
          </button>

          <button
            type="button"
            onClick={() => setShowLinkForm((v) => !v)}
            data-testid="toggle-evidence-link-btn"
            className="inline-flex items-center gap-1 px-2 py-1 bg-white hover:bg-stone-100 border border-stone-200 rounded-lg text-[11px] font-bold text-stone-700 cursor-pointer"
          >
            <Globe size={11} />
            <span>ბმულის დამატება</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <p className="text-[11px] font-semibold text-rose-600">{errorMsg}</p>
      )}

      {showLinkForm && (
        <div className="p-2.5 bg-white border border-stone-200 rounded-xl space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              value={linkName}
              onChange={(e) => setLinkName(e.target.value)}
              placeholder="ბმულის სახელი (არასავალდებულო)"
              data-testid="evidence-link-name-input"
              className="px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs"
            />
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://..."
              data-testid="evidence-link-url-input"
              className="px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs"
            />
          </div>
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setShowLinkForm(false)}
              className="px-2.5 py-1 text-[11px] font-semibold text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-50 cursor-pointer"
            >
              გაუქმება
            </button>
            <button
              type="button"
              disabled={isSavingLink || !linkUrl.trim()}
              onClick={() => void handleAddLink()}
              data-testid="save-evidence-link-btn"
              className="px-3 py-1 text-[11px] font-bold bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 cursor-pointer"
            >
              {isSavingLink ? 'ინახება...' : 'ბმულის მიბმა'}
            </button>
          </div>
        </div>
      )}

      {availableToAttach.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-semibold text-stone-400">დავალების ფაილებიდან:</span>
          {availableToAttach.slice(0, 6).map((att) => (
            <button
              key={att.id}
              type="button"
              onClick={() => onChangeSelectedIds([...selectedIds, att.id])}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-stone-100 hover:bg-orange-50 hover:text-orange-700 border border-stone-200 rounded-full text-[10px] font-semibold text-stone-700 cursor-pointer max-w-[180px]"
            >
              <Plus size={10} className="shrink-0" />
              <span className="truncate">{att.originalName}</span>
            </button>
          ))}
        </div>
      )}

      {selectedItems.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          {selectedItems.map((att) => (
            <span
              key={att.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-orange-50 border border-orange-200 text-orange-900 rounded-full text-[11px] font-bold max-w-[240px]"
            >
              {att.isExternal ? <Globe size={11} className="shrink-0" /> : <Paperclip size={11} className="shrink-0" />}
              <span className="truncate">{att.originalName}</span>
              <button
                type="button"
                onClick={() => onChangeSelectedIds(selectedIds.filter((id) => id !== att.id))}
                className="text-orange-700 hover:text-rose-700 cursor-pointer shrink-0"
                title="მოხსნა"
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
