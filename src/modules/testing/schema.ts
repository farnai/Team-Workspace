import { z } from 'zod';
import type { FieldError, FieldErrors, FieldValues, Resolver } from 'react-hook-form';
import { TestRunStatus, TestStepResultStatus } from './types';

export const testStepFormSchema = z.object({
  action: z
    .string()
    .trim()
    .min(1, 'შეიყვანეთ ნაბიჯის მოქმედება')
    .max(2000, 'მოქმედება მაქსიმუმ 2000 სიმბოლოა'),
  testData: z
    .string()
    .trim()
    .max(1000, 'სატესტო მონაცემი მაქსიმუმ 1000 სიმბოლოა')
    .optional(),
  expectedResult: z
    .string()
    .trim()
    .min(1, 'შეიყვანეთ მოსალოდნელი შედეგი')
    .max(2000, 'მოსალოდნელი შედეგი მაქსიმუმ 2000 სიმბოლოა'),
});

export const testCaseFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'ტესტ-ქეისის სათაური სავალდებულოა')
    .max(200, 'სათაური მაქსიმუმ 200 სიმბოლოა'),
  precondition: z
    .string()
    .trim()
    .max(2000, 'წინაპირობა მაქსიმუმ 2000 სიმბოლოა')
    .optional(),
  steps: z
    .array(testStepFormSchema)
    .min(1, 'დაამატეთ მინიმუმ ერთი სატესტო ნაბიჯი')
    .max(100, 'მაქსიმუმ 100 ნაბიჯის დამატებაა შესაძლებელი'),
});

export type TestCaseFormValues = z.infer<typeof testCaseFormSchema>;

export const testRunFormSchema = z
  .object({
    status: z.enum([TestRunStatus.PASSED, TestRunStatus.FAILED, TestRunStatus.BLOCKED]),
    actualResult: z
      .string()
      .trim()
      .max(4000, 'ფაქტობრივი შედეგი მაქსიმუმ 4000 სიმბოლოა')
      .optional(),
    reason: z
      .string()
      .trim()
      .max(2000, 'მიზეზი მაქსიმუმ 2000 სიმბოლოა')
      .optional(),
    stepResults: z
      .array(
        z.object({
          stepId: z.string().optional(),
          position: z.number().int().min(0),
          status: z
            .enum([
              TestStepResultStatus.PASSED,
              TestStepResultStatus.FAILED,
              TestStepResultStatus.BLOCKED,
              TestStepResultStatus.SKIPPED,
            ])
            .nullable()
            .optional(),
          actualNote: z
            .string()
            .trim()
            .max(1000, 'შენიშვნა მაქსიმუმ 1000 სიმბოლოა')
            .optional(),
        })
      )
      .default([]),
    attachmentIds: z.array(z.string()).max(20).default([]),
  })
  .superRefine((data, ctx) => {
    if (
      (data.status === TestRunStatus.FAILED || data.status === TestRunStatus.BLOCKED) &&
      (!data.reason || data.reason.trim().length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reason'],
        message: 'ჩავარდნის ან დაბლოკვის დროს მიზეზის მითითება სავალდებულოა',
      });
    }
  });

export type TestRunFormValues = z.infer<typeof testRunFormSchema>;

function setNestedError(
  target: Record<string, unknown>,
  path: readonly PropertyKey[],
  error: FieldError
) {
  if (path.length === 0) {
    target.root = error;
    return;
  }

  let current: Record<string, unknown> = target;
  for (let i = 0; i < path.length - 1; i++) {
    const key = String(path[i]);
    const nextKey = path[i + 1];
    const existing = current[key];
    if (!existing || typeof existing !== 'object') {
      current[key] = typeof nextKey === 'number' ? [] : {};
    }
    current = current[key] as Record<string, unknown>;
  }

  const leafKey = String(path[path.length - 1]);
  if (!current[leafKey]) {
    current[leafKey] = error;
  }
}

export function zodFormResolver<T extends FieldValues>(
  schema: z.ZodType<T>
): Resolver<T> {
  return async (values) => {
    const parsed = schema.safeParse(values);
    if (parsed.success) {
      return {
        values: parsed.data,
        errors: {},
      };
    }

    const errors: Record<string, unknown> = {};
    for (const issue of parsed.error.issues) {
      setNestedError(errors, issue.path, {
        type: 'validation',
        message: issue.message,
      });
    }

    return {
      values: {},
      errors: errors as FieldErrors<T>,
    };
  };
}
