'use client';

import React, { useState } from 'react';
import {
  AlertCircle,
  Archive,
  ChevronRight,
  ClipboardCheck,
  Loader2,
  Plus,
} from 'lucide-react';
import { formatTbilisiDateTime } from '@/lib/date';
import { getErrorMessage } from '@/lib/api-client';
import { useTaskTestCases } from '../hooks/useTaskTestCases';
import { useTestCaseDetail } from '../hooks/useTestCaseDetail';
import {
  useCreateTestCase,
  useCreateTestRun,
  useDeleteTestCase,
  useUpdateTestCase,
} from '../hooks/useTestCaseMutations';
import type { CreateTestCasePayload, CreateTestRunPayload } from '../types';
import { TestCaseForm } from './TestCaseForm';
import { TestCaseDetailView } from './TestCaseDetailView';
import { TestRunStatusBadge } from './TestRunStatusBadge';
import type { TaskAttachmentOption } from './TestRunEvidencePicker';

interface TaskTestingSectionProps {
  taskId: string;
  taskStatus: string;
  attachments: TaskAttachmentOption[];
  currentUser: { id: string; role: 'ADMIN' | 'USER' };
  onPreviewImage: (url: string, title?: string) => void;
  onDataMutated?: () => Promise<void> | void;
}

type TestingViewMode = 'list' | 'create' | 'detail' | 'edit';

export function TaskTestingSection({
  taskId,
  taskStatus,
  attachments,
  currentUser,
  onPreviewImage,
  onDataMutated,
}: TaskTestingSectionProps) {
  const [mode, setMode] = useState<TestingViewMode>('list');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  const listQuery = useTaskTestCases(taskId);
  const detailQuery = useTestCaseDetail(
    mode === 'detail' || mode === 'edit' ? selectedCaseId : null
  );

  const createMutation = useCreateTestCase(taskId);
  const updateMutation = useUpdateTestCase(taskId, selectedCaseId ?? '');
  const deleteMutation = useDeleteTestCase(taskId);
  const runMutation = useCreateTestRun(taskId, selectedCaseId ?? '');

  const testCases = React.useMemo(() => listQuery.data ?? [], [listQuery.data]);
  const selectedIndex = testCases.findIndex((tc) => tc.id === selectedCaseId);
  const selectedCaseNumber = selectedIndex >= 0 ? selectedIndex + 1 : 1;

  const isArchived = taskStatus === 'DONE' || taskStatus === 'CANCELLED';

  const stats = React.useMemo(() => {
    let passed = 0;
    let failed = 0;
    let blocked = 0;
    let untested = 0;
    for (const tc of testCases) {
      if (!tc.latestRun) untested += 1;
      else if (tc.latestRun.status === 'PASSED') passed += 1;
      else if (tc.latestRun.status === 'FAILED') failed += 1;
      else if (tc.latestRun.status === 'BLOCKED') blocked += 1;
    }
    return { total: testCases.length, passed, failed, blocked, untested };
  }, [testCases]);

  const handleCreate = async (payload: CreateTestCasePayload) => {
    const created = await createMutation.mutateAsync(payload);
    setSelectedCaseId(created.id);
    setMode('detail');
    await onDataMutated?.();
  };

  const handleUpdate = async (payload: CreateTestCasePayload) => {
    if (!selectedCaseId) return;
    await updateMutation.mutateAsync(payload);
    setMode('detail');
    await onDataMutated?.();
  };

  const handleDelete = async () => {
    if (!selectedCaseId) return;
    await deleteMutation.mutateAsync(selectedCaseId);
    setSelectedCaseId(null);
    setMode('list');
    await onDataMutated?.();
  };

  const handleCreateRun = async (payload: CreateTestRunPayload) => {
    await runMutation.mutateAsync(payload);
    await onDataMutated?.();
  };

  if (mode === 'create') {
    return (
      <TestCaseForm
        mode="create"
        isSubmitting={createMutation.isPending}
        onSubmit={handleCreate}
        onCancel={() => setMode('list')}
      />
    );
  }

  if (mode === 'edit') {
    if (detailQuery.isPending || !detailQuery.data) {
      return (
        <div className="p-8 text-center flex flex-col items-center gap-2 text-xs text-stone-500">
          <Loader2 size={20} className="animate-spin text-orange-600" />
          <span>ტესტ-ქეისი იტვირთება...</span>
        </div>
      );
    }

    return (
      <TestCaseForm
        mode="edit"
        initialValues={{
          title: detailQuery.data.title,
          precondition: detailQuery.data.precondition ?? '',
          steps: detailQuery.data.steps.map((s) => ({
            action: s.action,
            testData: s.testData ?? '',
            expectedResult: s.expectedResult,
          })),
        }}
        isSubmitting={updateMutation.isPending}
        onSubmit={handleUpdate}
        onCancel={() => setMode('detail')}
      />
    );
  }

  if (mode === 'detail' && selectedCaseId) {
    if (detailQuery.isPending) {
      return (
        <div className="p-8 text-center flex flex-col items-center gap-2 text-xs text-stone-500">
          <Loader2 size={20} className="animate-spin text-orange-600" />
          <span>ტესტ-ქეისის დეტალები იტვირთება...</span>
        </div>
      );
    }

    if (detailQuery.error || !detailQuery.data) {
      return (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-2">
          <div className="font-bold">
            {detailQuery.error ? getErrorMessage(detailQuery.error) : 'ტესტ-ქეისი ვერ მოიძებნა'}
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedCaseId(null);
              setMode('list');
            }}
            className="px-3 py-1 bg-white border border-stone-200 rounded-lg font-bold text-stone-700 cursor-pointer"
          >
            სიაში დაბრუნება
          </button>
        </div>
      );
    }

    return (
      <TestCaseDetailView
        taskId={taskId}
        caseNumber={selectedCaseNumber}
        testCase={detailQuery.data}
        currentUser={currentUser}
        existingAttachments={attachments}
        isRunningSubmit={runMutation.isPending}
        isDeleting={deleteMutation.isPending}
        onBack={() => {
          setSelectedCaseId(null);
          setMode('list');
        }}
        onStartEdit={() => setMode('edit')}
        onDelete={handleDelete}
        onSubmitRun={handleCreateRun}
        onPreviewImage={onPreviewImage}
        onAttachmentCreated={onDataMutated}
      />
    );
  }

  return (
    <div className="space-y-4 text-xs" data-testid="task-testing-section">
      {/* Header Row */}
      <div className="flex items-start sm:items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="text-xs font-black text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
            <ClipboardCheck size={15} className="text-orange-600" />
            <span>ხელით ტესტირება</span>
            <span className="text-[11px] font-bold text-stone-500">({stats.total})</span>
          </h3>
          <p className="text-[11px] text-stone-500 mt-0.5">
            შემოწმების სცენარები, ნაბიჯები და გაშვებების ისტორია.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setMode('create')}
          data-testid="add-test-case-btn"
          className="inline-flex items-center gap-1 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-xs shadow-2xs transition-colors cursor-pointer"
        >
          <Plus size={13} strokeWidth={2.5} />
          <span>ტესტ-ქეისის დამატება</span>
        </button>
      </div>

      {isArchived && (
        <div className="px-3 py-2 bg-stone-100 border border-stone-200 rounded-xl text-[11px] text-stone-600 flex items-center gap-2">
          <Archive size={13} className="text-stone-500 shrink-0" />
          <span>დავალება არქივშია — ტესტირების ისტორია სრულად ხელმისაწვდომია.</span>
        </div>
      )}

      {/* Compact Summary Strip */}
      {stats.total > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
            გაიარა: {stats.passed}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-bold">
            ვერ გაიარა: {stats.failed}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-bold">
            დაბლოკილია: {stats.blocked}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 border border-stone-200 font-bold">
            გასაშვები: {stats.untested}
          </span>
        </div>
      )}

      {/* Loading / Error / Empty / List */}
      {listQuery.isPending ? (
        <div className="p-8 text-center flex flex-col items-center gap-2 text-stone-500">
          <Loader2 size={20} className="animate-spin text-orange-600" />
          <span>ტესტ-ქეისები იტვირთება...</span>
        </div>
      ) : listQuery.error ? (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between gap-2 text-rose-800">
          <div className="flex items-center gap-2">
            <AlertCircle size={14} className="text-rose-600 shrink-0" />
            <span className="font-semibold">{getErrorMessage(listQuery.error)}</span>
          </div>
          <button
            type="button"
            onClick={() => void listQuery.refetch()}
            className="px-2.5 py-1 bg-white border border-rose-200 rounded-lg font-bold text-[11px] cursor-pointer"
          >
            თავიდან
          </button>
        </div>
      ) : testCases.length === 0 ? (
        <div
          data-testid="empty-test-cases-state"
          className="p-6 bg-stone-50 border border-dashed border-stone-200 rounded-2xl text-center space-y-2.5"
        >
          <div className="text-stone-600 font-bold">ამ დავალებაზე ტესტ-ქეისები ჯერ არ არის</div>
          <p className="text-[11px] text-stone-400">
            დაამატეთ პირველი ტესტ-ქეისი ნაბიჯებითა და მოსალოდნელი შედეგით.
          </p>
          <button
            type="button"
            onClick={() => setMode('create')}
            className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-white hover:bg-orange-50 text-orange-700 border border-orange-200 rounded-xl font-bold cursor-pointer"
          >
            <Plus size={13} />
            <span>ტესტ-ქეისის დამატება</span>
          </button>
        </div>
      ) : (
        <div className="divide-y divide-stone-100 border border-stone-200/90 rounded-2xl bg-white overflow-hidden">
          {testCases.map((tc, index) => (
            <button
              key={tc.id}
              type="button"
              data-testid={`test-case-row-${tc.id}`}
              onClick={() => {
                setSelectedCaseId(tc.id);
                setMode('detail');
              }}
              className="w-full px-3.5 py-2.5 flex items-center justify-between gap-2.5 text-left hover:bg-stone-50/80 transition-colors cursor-pointer group"
            >
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-[10px] font-black text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded shrink-0">
                    TC-{index + 1}
                  </span>
                  <span className="font-bold text-stone-900 group-hover:text-orange-700 truncate">
                    {tc.title}
                  </span>
                </div>
                <div className="text-[10px] text-stone-400 flex items-center gap-1.5 flex-wrap">
                  <span>{tc.stepsCount} ნაბიჯი</span>
                  <span>•</span>
                  <span>{tc.runsCount} გაშვება</span>
                  {tc.latestRun && (
                    <>
                      <span>•</span>
                      <span>
                        {tc.latestRun.executedBy.name} ({formatTbilisiDateTime(tc.latestRun.executedAt)})
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <TestRunStatusBadge status={tc.latestRun?.status ?? null} compact />
                <ChevronRight
                  size={14}
                  className="text-stone-300 group-hover:text-stone-600 transition-colors"
                />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
