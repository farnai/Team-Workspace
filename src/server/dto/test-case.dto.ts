import 'server-only';
import { z } from 'zod';
import { TestRunStatus } from '@prisma/client';

export const testStepInputDto = z.object({
  action: z
    .string()
    .trim()
    .min(1, 'ნაბიჯის მოქმედება სავალდებულოა')
    .max(2000, 'მოქმედება მაქსიმუმ 2000 სიმბოლოა'),
  testData: z
    .string()
    .trim()
    .max(1000, 'სატესტო მონაცემი მაქსიმუმ 1000 სიმბოლოა')
    .nullable()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  expectedResult: z
    .string()
    .trim()
    .min(1, 'მოსალოდნელი შედეგი სავალდებულოა')
    .max(2000, 'მოსალოდნელი შედეგი მაქსიმუმ 2000 სიმბოლოა'),
});

export type TestStepInputDto = z.infer<typeof testStepInputDto>;

export const createTestCaseDto = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'ტესტ-ქეისის სათაური სავალდებულოა')
    .max(200, 'სათაური მაქსიმუმ 200 სიმბოლოა'),
  precondition: z
    .string()
    .trim()
    .max(2000, 'წინაპირობა მაქსიმუმ 2000 სიმბოლოა')
    .nullable()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  steps: z
    .array(testStepInputDto)
    .min(1, 'დაამატეთ მინიმუმ ერთი სატესტო ნაბიჯი')
    .max(100, 'მაქსიმუმ 100 ნაბიჯის დამატებაა შესაძლებელი'),
});

export type CreateTestCaseDto = z.infer<typeof createTestCaseDto>;

export const updateTestCaseDto = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'ტესტ-ქეისის სათაური სავალდებულოა')
    .max(200, 'სათაური მაქსიმუმ 200 სიმბოლოა')
    .optional(),
  precondition: z
    .string()
    .trim()
    .max(2000, 'წინაპირობა მაქსიმუმ 2000 სიმბოლოა')
    .transform((v) => (v.length > 0 ? v : null))
    .nullable()
    .optional(),
  position: z.number().int().min(0).optional(),
  steps: z
    .array(testStepInputDto)
    .min(1, 'დაამატეთ მინიმუმ ერთი სატესტო ნაბიჯი')
    .max(100, 'მაქსიმუმ 100 ნაბიჯის დამატებაა შესაძლებელი')
    .optional(),
});

export type UpdateTestCaseDto = z.infer<typeof updateTestCaseDto>;

export const testStepResultStatusSchema = z.enum(['PASSED', 'FAILED', 'BLOCKED', 'SKIPPED']);

export const createTestRunDto = z
  .object({
    status: z.nativeEnum(TestRunStatus),
    actualResult: z
      .string()
      .trim()
      .max(4000, 'ფაქტობრივი შედეგი მაქსიმუმ 4000 სიმბოლოა')
      .nullable()
      .optional()
      .transform((v) => (v && v.length > 0 ? v : null)),
    reason: z
      .string()
      .trim()
      .max(2000, 'მიზეზი მაქსიმუმ 2000 სიმბოლოა')
      .nullable()
      .optional()
      .transform((v) => (v && v.length > 0 ? v : null)),
    stepResults: z
      .array(
        z.object({
          stepId: z.string().uuid('არასწორი ნაბიჯის იდენტიფიკატორი').optional(),
          position: z.number().int().min(0),
          status: testStepResultStatusSchema.nullable().optional(),
          actualNote: z
            .string()
            .trim()
            .max(1000, 'შენიშვნა მაქსიმუმ 1000 სიმბოლოა')
            .nullable()
            .optional()
            .transform((v) => (v && v.length > 0 ? v : null)),
        })
      )
      .default([]),
    attachmentIds: z
      .array(z.string().uuid('არასწორი ფაილის იდენტიფიკატორი'))
      .max(20, 'მაქსიმუმ 20 მტკიცებულების მიმაგრებაა შესაძლებელი')
      .default([]),
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

export type CreateTestRunDto = z.infer<typeof createTestRunDto>;
