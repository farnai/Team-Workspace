'use client';

import React from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { AlertCircle, Ban, CheckCircle2, Play, SkipForward, XCircle } from 'lucide-react';
import { getErrorMessage } from '@/lib/api-client';
import { testRunFormSchema, zodFormResolver, type TestRunFormValues } from '../schema';
import {
  TestRunStatus,
  TestStepResultStatus,
  type CreateTestRunPayload,
  type TestCaseDetail,
} from '../types';
import {
  TestRunEvidencePicker,
  type TaskAttachmentOption,
} from './TestRunEvidencePicker';

interface TestRunExecutionPanelProps {
  taskId: string;
  testCase: TestCaseDetail;
  existingAttachments: TaskAttachmentOption[];
  isSubmitting: boolean;
  onSubmitRun: (payload: CreateTestRunPayload) => Promise<void>;
  onCancel: () => void;
  onAttachmentCreated?: () => Promise<void> | void;
}

const VERDICT_OPTIONS: Array<{
  value: TestRunStatus;
  label: string;
  icon: React.ElementType;
  activeClass: string;
  idleClass: string;
}> = [
  {
    value: TestRunStatus.PASSED,
    label: 'გაიარა',
    icon: CheckCircle2,
    activeClass: 'bg-emerald-600 text-white border-emerald-600 shadow-xs',
    idleClass: 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50',
  },
  {
    value: TestRunStatus.FAILED,
    label: 'ვერ გაიარა',
    icon: XCircle,
    activeClass: 'bg-rose-600 text-white border-rose-600 shadow-xs',
    idleClass: 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50',
  },
  {
    value: TestRunStatus.BLOCKED,
    label: 'დაბლოკილია',
    icon: Ban,
    activeClass: 'bg-amber-600 text-white border-amber-600 shadow-xs',
    idleClass: 'bg-white text-amber-800 border-amber-200 hover:bg-amber-50',
  },
];

const STEP_BUTTONS: Array<{
  value: TestStepResultStatus;
  label: string;
  icon: React.ElementType;
  active: string;
}> = [
  { value: 'PASSED', label: 'გაიარა', icon: CheckCircle2, active: 'bg-emerald-600 text-white border-emerald-600' },
  { value: 'FAILED', label: 'ვერ გაიარა', icon: XCircle, active: 'bg-rose-600 text-white border-rose-600' },
  { value: 'BLOCKED', label: 'დაბლოკილია', icon: Ban, active: 'bg-amber-600 text-white border-amber-600' },
  { value: 'SKIPPED', label: 'გამოტოვება', icon: SkipForward, active: 'bg-stone-600 text-white border-stone-600' },
];

export function TestRunExecutionPanel({
  taskId,
  testCase,
  existingAttachments,
  isSubmitting,
  onSubmitRun,
  onCancel,
  onAttachmentCreated,
}: TestRunExecutionPanelProps) {
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    register,
    control,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<TestRunFormValues>({
    resolver: zodFormResolver(testRunFormSchema),
    defaultValues: {
      status: TestRunStatus.PASSED,
      actualResult: '',
      reason: '',
      stepResults: testCase.steps.map((s) => ({
        stepId: s.id,
        position: s.position,
        status: null,
        actualNote: '',
      })),
      attachmentIds: [],
    },
  });

  const currentStatus = useWatch({ control, name: 'status' });
  const stepResults = useWatch({ control, name: 'stepResults' }) ?? [];
  const attachmentIds = useWatch({ control, name: 'attachmentIds' }) ?? [];
  const needsReason =
    currentStatus === TestRunStatus.FAILED || currentStatus === TestRunStatus.BLOCKED;

  const setStepStatus = (index: number, nextStatus: TestStepResultStatus) => {
    const current = stepResults[index]?.status ?? null;
    const toggled = current === nextStatus ? null : nextStatus;
    setValue(`stepResults.${index}.status`, toggled, { shouldDirty: true });
    if (toggled === 'FAILED' && currentStatus === TestRunStatus.PASSED) {
      setValue('status', TestRunStatus.FAILED);
    } else if (toggled === 'BLOCKED' && currentStatus === TestRunStatus.PASSED) {
      setValue('status', TestRunStatus.BLOCKED);
    }
  };

  const submitRun = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await onSubmitRun({
        status: values.status,
        actualResult: values.actualResult?.trim() || null,
        reason: values.reason?.trim() || null,
        stepResults: values.stepResults.map((sr) => ({
          stepId: sr.stepId,
          position: sr.position,
          status: sr.status ?? null,
          actualNote: sr.actualNote?.trim() || null,
        })),
        attachmentIds: values.attachmentIds,
      });
    } catch (err) {
      setServerError(getErrorMessage(err));
    }
  });

  return (
    <form
      onSubmit={submitRun}
      data-testid="test-run-execution-panel"
      className="bg-orange-50/40 border border-orange-200 rounded-2xl p-4 space-y-4 text-xs"
    >
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-orange-200/70">
        <div className="flex items-center gap-2 font-black text-stone-900">
          <Play size={14} className="text-orange-600" fill="currentColor" />
          <span>ტესტის გაშვება #{testCase.runsCount + 1}</span>
        </div>
        <span className="text-[11px] font-semibold text-stone-500">
          შეამოწმეთ ნაბიჯები და დააფიქსირეთ შედეგი
        </span>
      </div>

      {serverError && (
        <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-rose-800">
          <AlertCircle size={14} className="shrink-0 mt-0.5 text-rose-600" />
          <span className="font-semibold">{serverError}</span>
        </div>
      )}

      {/* Steps Runner */}
      <div className="space-y-2">
        {testCase.steps.map((step, index) => {
          const activeStatus = stepResults[index]?.status ?? null;
          return (
            <div
              key={step.id}
              data-testid={`run-step-row-${index}`}
              className="bg-white border border-stone-200 rounded-xl p-3 space-y-2"
            >
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                <div className="sm:col-span-6 space-y-1">
                  <div className="text-[10px] font-extrabold text-stone-400 uppercase">
                    ნაბიჯი #{index + 1} • მოქმედება
                  </div>
                  <div className="font-semibold text-stone-900 whitespace-pre-wrap">
                    {step.action}
                  </div>
                  {step.testData && (
                    <div className="text-[11px] text-stone-600 bg-stone-50 px-2 py-1 rounded border border-stone-200/70 font-mono">
                      მონაცემი: {step.testData}
                    </div>
                  )}
                </div>

                <div className="sm:col-span-6 space-y-1">
                  <div className="text-[10px] font-extrabold text-stone-400 uppercase">
                    მოსალოდნელი შედეგი
                  </div>
                  <div className="font-medium text-stone-700 whitespace-pre-wrap">
                    {step.expectedResult}
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-stone-100">
                <div className="flex items-center gap-1 flex-wrap">
                  {STEP_BUTTONS.map((btn) => {
                    const Icon = btn.icon;
                    const isSelected = activeStatus === btn.value;
                    return (
                      <button
                        key={btn.value}
                        type="button"
                        onClick={() => setStepStatus(index, btn.value)}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                          isSelected
                            ? btn.active
                            : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                        }`}
                      >
                        <Icon size={10} />
                        <span>{btn.label}</span>
                      </button>
                    );
                  })}
                </div>

                <input
                  type="text"
                  {...register(`stepResults.${index}.actualNote`)}
                  placeholder="ნაბიჯის ფაქტობრივი შენიშვნა..."
                  className="sm:w-56 px-2 py-1 bg-stone-50 border border-stone-200 rounded-lg text-[11px] focus:outline-none focus:bg-white"
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Overall Result Selector */}
      <div className="space-y-1.5">
        <label className="block font-extrabold text-stone-800">
          საერთო შედეგი <span className="text-rose-500">*</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {VERDICT_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const selected = currentStatus === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                data-testid={`verdict-btn-${opt.value}`}
                onClick={() => setValue('status', opt.value, { shouldValidate: true })}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl font-bold border transition-all cursor-pointer ${
                  selected ? opt.activeClass : opt.idleClass
                }`}
              >
                <Icon size={14} />
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Reason (Required on FAILED or BLOCKED) */}
      {needsReason && (
        <div className="space-y-1">
          <label className="block font-bold text-rose-900">
            ჩავარდნის / დაბლოკვის მიზეზი <span className="text-rose-600">*</span>
          </label>
          <input
            type="text"
            {...register('reason')}
            placeholder="მაგ. შესვლის ღილაკზე დაჭერისას ბრუნდება 500 შეცდომა"
            data-testid="test-run-reason-input"
            className="w-full px-3 py-2 bg-white border border-rose-300 rounded-xl font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
          />
          {errors.reason?.message && (
            <p className="text-[11px] font-bold text-rose-600" data-testid="test-run-reason-error">
              {errors.reason.message}
            </p>
          )}
        </div>
      )}

      {/* Actual Result / Comment */}
      <div className="space-y-1">
        <label className="block font-bold text-stone-700">
          ფაქტობრივი შედეგი / კომენტარი{' '}
          <span className="text-stone-400 font-normal">(არასავალდებულო)</span>
        </label>
        <textarea
          rows={2}
          {...register('actualResult')}
          placeholder="აღწერეთ რეალური ქცევა, გარემო ან დამატებითი კომენტარი"
          data-testid="test-run-actual-input"
          className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 resize-none"
        />
      </div>

      <TestRunEvidencePicker
        taskId={taskId}
        existingAttachments={existingAttachments}
        selectedIds={attachmentIds}
        onChangeSelectedIds={(nextIds) => setValue('attachmentIds', nextIds)}
        onAttachmentCreated={onAttachmentCreated}
      />

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-orange-200/70">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-3.5 py-1.5 bg-white border border-stone-200 text-stone-700 rounded-xl font-bold hover:bg-stone-50 cursor-pointer"
        >
          გაუქმება
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          data-testid="submit-test-run-btn"
          className="px-4 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold shadow-xs disabled:opacity-50 cursor-pointer"
        >
          {isSubmitting ? 'ინახება...' : 'შედეგის შენახვა'}
        </button>
      </div>
    </form>
  );
}
