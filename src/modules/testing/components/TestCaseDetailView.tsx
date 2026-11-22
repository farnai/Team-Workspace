'use client';

import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ClipboardList,
  Edit3,
  History,
  Loader2,
  Play,
  Trash2,
} from 'lucide-react';
import { formatTbilisiDateTime } from '@/lib/date';
import type { CreateTestRunPayload, TestCaseDetail } from '../types';
import { TestRunStatusBadge } from './TestRunStatusBadge';
import { TestRunExecutionPanel } from './TestRunExecutionPanel';
import { TestRunHistoryCard } from './TestRunHistoryCard';
import type { TaskAttachmentOption } from './TestRunEvidencePicker';

interface TestCaseDetailViewProps {
  taskId: string;
  caseNumber: number;
  testCase: TestCaseDetail;
  currentUser: { id: string; role: 'ADMIN' | 'USER' };
  existingAttachments: TaskAttachmentOption[];
  isRunningSubmit: boolean;
  isDeleting: boolean;
  onBack: () => void;
  onStartEdit: () => void;
  onDelete: () => Promise<void>;
  onSubmitRun: (payload: CreateTestRunPayload) => Promise<void>;
  onPreviewImage: (url: string, title?: string) => void;
  onAttachmentCreated?: () => Promise<void> | void;
}

export function TestCaseDetailView({
  taskId,
  caseNumber,
  testCase,
  currentUser,
  existingAttachments,
  isRunningSubmit,
  isDeleting,
  onBack,
  onStartEdit,
  onDelete,
  onSubmitRun,
  onPreviewImage,
  onAttachmentCreated,
}: TestCaseDetailViewProps) {
  const [isRunPanelOpen, setIsRunPanelOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const canDelete =
    currentUser.role === 'ADMIN' || testCase.createdById === currentUser.id;

  const handleRunSubmit = async (payload: CreateTestRunPayload) => {
    await onSubmitRun(payload);
    setIsRunPanelOpen(false);
  };

  return (
    <div className="space-y-4 text-xs" data-testid="test-case-detail-view">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <button
          type="button"
          onClick={onBack}
          data-testid="back-to-test-cases-btn"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200/80 text-stone-700 rounded-xl font-bold transition-colors cursor-pointer"
        >
          <ArrowLeft size={13} />
          <span>ქეისების სია</span>
        </button>

        <div className="flex items-center gap-1.5 flex-wrap">
          {!isRunPanelOpen && (
            <button
              type="button"
              onClick={() => setIsRunPanelOpen(true)}
              data-testid="run-test-btn"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Play size={12} fill="currentColor" />
              <span>ტესტის გაშვება</span>
            </button>
          )}

          <button
            type="button"
            onClick={onStartEdit}
            data-testid="edit-test-case-btn"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 rounded-xl font-bold transition-colors cursor-pointer"
          >
            <Edit3 size={12} />
            <span>რედაქტირება</span>
          </button>

          {canDelete && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              data-testid="delete-test-case-btn"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-rose-50 border border-stone-200 hover:border-rose-200 text-stone-500 hover:text-rose-700 rounded-xl font-bold transition-colors cursor-pointer"
              title="ტესტ-ქეისის წაშლა"
            >
              <Trash2 size={12} />
              <span>წაშლა</span>
            </button>
          )}
        </div>
      </div>

      {/* Inline Delete Confirmation Panel */}
      {showDeleteConfirm && (
        <div
          data-testid="delete-test-case-confirm"
          className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-start gap-2 text-rose-900">
            <AlertTriangle size={16} className="text-rose-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-extrabold">წავშალოთ ტესტ-ქეისი TC-{caseNumber}?</div>
              <div className="text-[11px] text-rose-700">
                წაიშლება ქეისი, მისი ნაბიჯები და გაშვების ისტორია (მიმაგრებული ფაილები დარჩება დავალებაში).
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => setShowDeleteConfirm(false)}
              className="px-3 py-1 bg-white border border-stone-200 text-stone-700 rounded-lg font-bold hover:bg-stone-50 cursor-pointer"
            >
              გაუქმება
            </button>
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => void onDelete()}
              data-testid="confirm-delete-test-case-btn"
              className="inline-flex items-center gap-1 px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold cursor-pointer disabled:opacity-50"
            >
              {isDeleting && <Loader2 size={12} className="animate-spin" />}
              <span>დადასტურება</span>
            </button>
          </div>
        </div>
      )}

      {/* Case Summary Card */}
      <div className="p-4 bg-stone-50/70 border border-stone-200 rounded-2xl space-y-2.5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[11px] font-black text-stone-600 bg-stone-200/80 px-2 py-0.5 rounded-md">
                TC-{caseNumber}
              </span>
              <TestRunStatusBadge status={testCase.latestRun?.status ?? null} />
            </div>
            <h4 className="text-sm font-black text-stone-900 leading-snug">{testCase.title}</h4>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-stone-500 flex-wrap">
          <span>შემქმნელი: <strong className="text-stone-700">{testCase.createdBy.name}</strong></span>
          <span>•</span>
          <span>{formatTbilisiDateTime(testCase.createdAt)}</span>
          {testCase.updatedBy && (
            <>
              <span>•</span>
              <span>ბოლო რედაქტორი: {testCase.updatedBy.name}</span>
            </>
          )}
        </div>

        {testCase.precondition && (
          <div className="p-2.5 bg-white border border-stone-200/80 rounded-xl space-y-0.5">
            <div className="text-[10px] font-extrabold text-stone-400 uppercase tracking-wider">
              წინაპირობა
            </div>
            <div className="text-stone-800 font-medium whitespace-pre-wrap">
              {testCase.precondition}
            </div>
          </div>
        )}
      </div>

      {/* Inline Test Runner */}
      {isRunPanelOpen && (
        <TestRunExecutionPanel
          taskId={taskId}
          testCase={testCase}
          existingAttachments={existingAttachments}
          isSubmitting={isRunningSubmit}
          onSubmitRun={handleRunSubmit}
          onCancel={() => setIsRunPanelOpen(false)}
          onAttachmentCreated={onAttachmentCreated}
        />
      )}

      {/* Ordered Steps Definition */}
      <div className="space-y-2">
        <h5 className="text-[11px] font-black text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
          <ClipboardList size={13} className="text-orange-600" />
          <span>შესამოწმებელი ნაბიჯები ({testCase.steps.length})</span>
        </h5>

        {/* Desktop Table Headers */}
        <div className="hidden sm:grid sm:grid-cols-12 gap-2 px-3 py-1.5 bg-stone-100 rounded-xl text-[10px] font-extrabold text-stone-500 uppercase tracking-wider">
          <div className="col-span-1">#</div>
          <div className="col-span-6">მოქმედება & მონაცემი</div>
          <div className="col-span-5">მოსალოდნელი შედეგი</div>
        </div>

        <div className="space-y-1.5">
          {testCase.steps.map((step, index) => (
            <div
              key={step.id}
              data-testid={`test-case-step-${index}`}
              className="p-3 bg-white border border-stone-200/90 rounded-xl grid grid-cols-1 sm:grid-cols-12 gap-2 items-start"
            >
              <div className="sm:col-span-1 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-md bg-stone-100 border border-stone-200 flex items-center justify-center font-mono text-[10px] font-bold text-stone-700">
                  {index + 1}
                </span>
                <span className="sm:hidden text-[10px] font-extrabold text-stone-400 uppercase">
                  ნაბიჯი #{index + 1}
                </span>
              </div>

              <div className="sm:col-span-6 space-y-1">
                <div className="sm:hidden text-[10px] font-extrabold text-stone-400 uppercase">
                  მოქმედება
                </div>
                <div className="font-semibold text-stone-900 whitespace-pre-wrap">
                  {step.action}
                </div>
                {step.testData && (
                  <div className="text-[11px] font-mono text-stone-600 bg-stone-50 px-2 py-0.5 rounded border border-stone-200/80 inline-block">
                    მონაცემი: {step.testData}
                  </div>
                )}
              </div>

              <div className="sm:col-span-5 space-y-0.5">
                <div className="sm:hidden text-[10px] font-extrabold text-stone-400 uppercase">
                  მოსალოდნელი შედეგი
                </div>
                <div className="text-stone-700 whitespace-pre-wrap">{step.expectedResult}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Execution History */}
      <div className="pt-2 border-t border-stone-200 space-y-2.5">
        <h5 className="text-[11px] font-black text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
          <History size={13} className="text-orange-600" />
          <span>გაშვებების ისტორია ({testCase.runs.length})</span>
        </h5>

        {testCase.runs.length > 0 ? (
          <div className="space-y-2">
            {testCase.runs.map((run, idx) => (
              <TestRunHistoryCard
                key={run.id}
                run={run}
                currentCaseTitle={testCase.title}
                defaultExpanded={idx === 0}
                onPreviewImage={onPreviewImage}
              />
            ))}
          </div>
        ) : (
          <div className="p-5 bg-stone-50 border border-dashed border-stone-200 rounded-xl text-center text-stone-500">
            ეს ტესტ-ქეისი ჯერ არ გაშვებულა. დააჭირეთ „ტესტის გაშვება“ ღილაკს.
          </div>
        )}
      </div>
    </div>
  );
}
