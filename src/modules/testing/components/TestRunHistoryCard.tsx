'use client';

import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  Eye,
  History,
  Paperclip,
} from 'lucide-react';
import { formatTbilisiDateTime } from '@/lib/date';
import type { TestRunItem } from '../types';
import { TestRunStatusBadge, TestStepStatusBadge } from './TestRunStatusBadge';

interface TestRunHistoryCardProps {
  run: TestRunItem;
  currentCaseTitle: string;
  defaultExpanded?: boolean;
  onPreviewImage: (url: string, title?: string) => void;
}

export function TestRunHistoryCard({
  run,
  currentCaseTitle,
  defaultExpanded = false,
  onPreviewImage,
}: TestRunHistoryCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const titleChanged = run.caseTitleSnapshot !== currentCaseTitle;

  return (
    <div
      data-testid={`test-run-row-${run.runNumber}`}
      className="bg-white border border-stone-200/90 rounded-xl overflow-hidden shadow-2xs"
    >
      {/* Compact Run Header Row */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        data-testid={`toggle-test-run-${run.runNumber}`}
        className="w-full px-3.5 py-2.5 flex items-center justify-between gap-2 text-left hover:bg-stone-50/80 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          {expanded ? (
            <ChevronDown size={14} className="text-stone-400 shrink-0" />
          ) : (
            <ChevronRight size={14} className="text-stone-400 shrink-0" />
          )}
          <span className="font-mono text-[11px] font-black text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded">
            #{run.runNumber}
          </span>
          <TestRunStatusBadge status={run.status} compact />
          <span className="font-bold text-stone-800 truncate">{run.executedBy.name}</span>
          {run.evidences.length > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded-full">
              <Paperclip size={10} />
              <span>{run.evidences.length}</span>
            </span>
          )}
        </div>

        <span className="text-[11px] font-medium text-stone-400 shrink-0 whitespace-nowrap">
          {formatTbilisiDateTime(run.executedAt)}
        </span>
      </button>

      {/* Short inline summary visible before expanding */}
      {!expanded && (run.reason || run.actualResult) && (
        <div className="px-3.5 pb-2.5 pt-0 text-[11px] text-stone-600 truncate">
          {run.reason ? `მიზეზი: ${run.reason}` : run.actualResult}
        </div>
      )}

      {/* Expanded Immutable Run Snapshot */}
      {expanded && (
        <div
          data-testid={`test-run-details-${run.runNumber}`}
          className="px-3.5 pb-3.5 pt-2.5 border-t border-stone-100 bg-stone-50/40 space-y-3 text-xs"
        >
          {/* Case Snapshot Metadata */}
          <div className="p-2.5 bg-white border border-stone-200/80 rounded-xl space-y-1.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[10px] font-extrabold text-stone-400 uppercase tracking-wider flex items-center gap-1">
                <History size={11} />
                <span>გაშვების მომენტის ასლი (Snapshot)</span>
              </span>
              {titleChanged && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                  ქეისი მოგვიანებით შეიცვალა
                </span>
              )}
            </div>
            <div className="font-bold text-stone-900">{run.caseTitleSnapshot}</div>
            {run.preconditionSnapshot && (
              <div className="text-[11px] text-stone-600">
                <span className="font-bold text-stone-700">წინაპირობა: </span>
                {run.preconditionSnapshot}
              </div>
            )}
          </div>

          {run.reason && (
            <div className="p-2.5 bg-rose-50/70 border border-rose-200/80 rounded-xl text-[11px] text-rose-900">
              <span className="font-extrabold">მიზეზი: </span>
              <span>{run.reason}</span>
            </div>
          )}

          {run.actualResult && (
            <div className="p-2.5 bg-white border border-stone-200/80 rounded-xl text-[11px] text-stone-700 whitespace-pre-wrap">
              <span className="font-extrabold text-stone-800 block mb-0.5">
                ფაქტობრივი შედეგი / კომენტარი:
              </span>
              {run.actualResult}
            </div>
          )}

          {/* Evidences */}
          {run.evidences.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] font-extrabold text-stone-500 uppercase tracking-wider">
                მტკიცებულებები ({run.evidences.length})
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {run.evidences.map((ev) => {
                  const isImage = !ev.isExternal && ev.mimeType.startsWith('image/');
                  if (ev.isExternal && ev.url) {
                    return (
                      <a
                        key={ev.id}
                        href={ev.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-stone-200 hover:border-orange-300 hover:text-orange-700 rounded-lg text-[11px] font-bold text-stone-800"
                      >
                        <ExternalLink size={11} />
                        <span className="max-w-[200px] truncate">{ev.originalName}</span>
                      </a>
                    );
                  }

                  return (
                    <div
                      key={ev.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-stone-200 rounded-lg text-[11px] font-bold text-stone-800"
                    >
                      {isImage ? (
                        <button
                          type="button"
                          onClick={() =>
                            onPreviewImage(`/api/attachments/${ev.attachmentId}`, ev.originalName)
                          }
                          className="inline-flex items-center gap-1 hover:text-orange-700 cursor-pointer"
                        >
                          <Eye size={11} />
                          <span className="max-w-[180px] truncate">{ev.originalName}</span>
                        </button>
                      ) : (
                        <a
                          href={`/api/attachments/${ev.attachmentId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          download={ev.originalName}
                          className="inline-flex items-center gap-1 hover:text-orange-700"
                        >
                          <Download size={11} />
                          <span className="max-w-[180px] truncate">{ev.originalName}</span>
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Steps Snapshot (Responsive: vertical on mobile, table grid on desktop) */}
          {run.stepsSnapshot.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] font-extrabold text-stone-500 uppercase tracking-wider">
                შემოწმებული ნაბიჯები ({run.stepsSnapshot.length})
              </div>
              <div className="space-y-1.5">
                {run.stepsSnapshot.map((st, idx) => (
                  <div
                    key={`${run.id}_step_${idx}`}
                    className="p-2.5 bg-white border border-stone-200/80 rounded-xl grid grid-cols-1 sm:grid-cols-12 gap-2 items-start"
                  >
                    <div className="sm:col-span-5 space-y-0.5">
                      <div className="text-[10px] font-extrabold text-stone-400">
                        ნაბიჯი #{st.position + 1} • მოქმედება
                      </div>
                      <div className="font-semibold text-stone-900 whitespace-pre-wrap">
                        {st.action}
                      </div>
                      {st.testData && (
                        <div className="text-[10px] font-mono text-stone-500">
                          მონაცემი: {st.testData}
                        </div>
                      )}
                    </div>

                    <div className="sm:col-span-4 space-y-0.5">
                      <div className="text-[10px] font-extrabold text-stone-400">
                        მოსალოდნელი შედეგი
                      </div>
                      <div className="text-stone-700 whitespace-pre-wrap">{st.expectedResult}</div>
                    </div>

                    <div className="sm:col-span-3 flex sm:flex-col items-start sm:items-end gap-1">
                      <TestStepStatusBadge status={st.status} />
                      {st.actualNote && (
                        <span className="text-[10px] text-stone-500 sm:text-right">
                          {st.actualNote}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
