'use client';

import React from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { ArrowDown, ArrowUp, Plus, Trash2, AlertCircle } from 'lucide-react';
import { getErrorMessage } from '@/lib/api-client';
import {
  testCaseFormSchema,
  zodFormResolver,
  type TestCaseFormValues,
} from '../schema';
import type { CreateTestCasePayload } from '../types';

interface TestCaseFormProps {
  mode: 'create' | 'edit';
  initialValues?: TestCaseFormValues;
  isSubmitting: boolean;
  onSubmit: (payload: CreateTestCasePayload) => Promise<void>;
  onCancel: () => void;
}

const DEFAULT_STEP = { action: '', testData: '', expectedResult: '' };

export function TestCaseForm({
  mode,
  initialValues,
  isSubmitting,
  onSubmit,
  onCancel,
}: TestCaseFormProps) {
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<TestCaseFormValues>({
    resolver: zodFormResolver(testCaseFormSchema),
    defaultValues: initialValues ?? {
      title: '',
      precondition: '',
      steps: [{ ...DEFAULT_STEP }],
    },
  });

  const { fields, append, remove, move } = useFieldArray({
    control,
    name: 'steps',
  });

  const submitForm = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await onSubmit({
        title: values.title.trim(),
        precondition: values.precondition?.trim() || null,
        steps: values.steps.map((s) => ({
          action: s.action.trim(),
          testData: s.testData?.trim() || null,
          expectedResult: s.expectedResult.trim(),
        })),
      });
    } catch (err) {
      setServerError(getErrorMessage(err));
    }
  });

  return (
    <form
      onSubmit={submitForm}
      className="bg-stone-50/70 border border-stone-200 rounded-2xl p-4 space-y-4 text-xs"
      data-testid="test-case-form"
    >
      <div className="flex items-center justify-between border-b border-stone-200/80 pb-2.5">
        <h4 className="font-black text-stone-900 text-sm">
          {mode === 'create' ? 'ახალი ტესტ-ქეისის დამატება' : 'ტესტ-ქეისის რედაქტირება'}
        </h4>
      </div>

      {serverError && (
        <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-rose-800">
          <AlertCircle size={14} className="shrink-0 mt-0.5 text-rose-600" />
          <span className="font-semibold">{serverError}</span>
        </div>
      )}

      {/* Title */}
      <div className="space-y-1">
        <label className="block font-bold text-stone-700">
          სათაური <span className="text-rose-500">*</span>
        </label>
        <input
          type="text"
          {...register('title')}
          placeholder="მაგ. ავტორიზაცია სწორი მონაცემებით"
          data-testid="test-case-title-input"
          className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
        />
        {errors.title?.message && (
          <p className="text-[11px] font-semibold text-rose-600">{errors.title.message}</p>
        )}
      </div>

      {/* Optional Precondition */}
      <div className="space-y-1">
        <label className="block font-bold text-stone-700">
          წინაპირობა <span className="text-stone-400 font-normal">(არასავალდებულო)</span>
        </label>
        <textarea
          rows={2}
          {...register('precondition')}
          placeholder="მაგ. მომხმარებელი არ არის ავტორიზებული სისტემაში"
          data-testid="test-case-precondition-input"
          className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 resize-none"
        />
        {errors.precondition?.message && (
          <p className="text-[11px] font-semibold text-rose-600">{errors.precondition.message}</p>
        )}
      </div>

      {/* Ordered Steps */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="font-extrabold text-stone-800 uppercase tracking-wider text-[11px]">
            სატესტო ნაბიჯები ({fields.length})
          </span>
          <button
            type="button"
            onClick={() => append({ ...DEFAULT_STEP })}
            data-testid="add-test-step-btn"
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-orange-50 text-orange-700 border border-orange-200 rounded-lg font-bold text-[11px] transition-colors cursor-pointer"
          >
            <Plus size={12} strokeWidth={2.5} />
            <span>ნაბიჯის დამატება</span>
          </button>
        </div>

        {errors.steps?.root?.message && (
          <p className="text-[11px] font-semibold text-rose-600">{errors.steps.root.message}</p>
        )}

        <div className="space-y-2.5">
          {fields.map((field, index) => {
            const stepErr = errors.steps?.[index];
            return (
              <div
                key={field.id}
                data-testid={`test-step-editor-${index}`}
                className="bg-white border border-stone-200 rounded-xl p-3 space-y-2.5 shadow-2xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 font-extrabold text-stone-800 text-[11px]">
                    <span className="w-5 h-5 rounded-md bg-stone-100 border border-stone-200 flex items-center justify-center font-mono text-[10px]">
                      {index + 1}
                    </span>
                    <span>ნაბიჯი #{index + 1}</span>
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => move(index, index - 1)}
                      className="p-1 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded disabled:opacity-30 cursor-pointer"
                      title="ზემოთ აწევა"
                    >
                      <ArrowUp size={13} />
                    </button>
                    <button
                      type="button"
                      disabled={index === fields.length - 1}
                      onClick={() => move(index, index + 1)}
                      className="p-1 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded disabled:opacity-30 cursor-pointer"
                      title="ქვემოთ ჩამოწევა"
                    >
                      <ArrowDown size={13} />
                    </button>
                    {fields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="p-1 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                        title="ნაბიჯის წაშლა"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-stone-600">
                      მოქმედება <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      rows={2}
                      {...register(`steps.${index}.action`)}
                      placeholder="მაგ. შეიყვანეთ მონაცემები და დააჭირეთ შესვლას"
                      data-testid={`test-step-action-${index}`}
                      className="w-full px-2.5 py-1.5 bg-stone-50/70 border border-stone-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:bg-white resize-none"
                    />
                    {stepErr?.action?.message && (
                      <p className="text-[10px] font-semibold text-rose-600">
                        {stepErr.action.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-stone-600">
                      მოსალოდნელი შედეგი <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      rows={2}
                      {...register(`steps.${index}.expectedResult`)}
                      placeholder="მაგ. მომხმარებელი გადამისამართდება მთავარ გვერდზე"
                      data-testid={`test-step-expected-${index}`}
                      className="w-full px-2.5 py-1.5 bg-stone-50/70 border border-stone-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:bg-white resize-none"
                    />
                    {stepErr?.expectedResult?.message && (
                      <p className="text-[10px] font-semibold text-rose-600">
                        {stepErr.expectedResult.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-stone-600">
                    სატესტო მონაცემი{' '}
                    <span className="text-stone-400 font-normal">(არასავალდებულო)</span>
                  </label>
                  <input
                    type="text"
                    {...register(`steps.${index}.testData`)}
                    placeholder="მაგ. admin@team.local / სატესტო ID (არასავალდებულო)"
                    data-testid={`test-step-data-${index}`}
                    className="w-full px-2.5 py-1.5 bg-stone-50/70 border border-stone-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:bg-white"
                  />
                  {stepErr?.testData?.message && (
                    <p className="text-[10px] font-semibold text-rose-600">
                      {stepErr.testData.message}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-200/80">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-3.5 py-1.5 border border-stone-200 bg-white text-stone-700 rounded-xl font-bold hover:bg-stone-100 cursor-pointer"
        >
          გაუქმება
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          data-testid="save-test-case-btn"
          className="px-4 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold shadow-xs disabled:opacity-50 cursor-pointer"
        >
          {isSubmitting ? 'ინახება...' : mode === 'create' ? 'ქეისის შექმნა' : 'ცვლილებების შენახვა'}
        </button>
      </div>
    </form>
  );
}
