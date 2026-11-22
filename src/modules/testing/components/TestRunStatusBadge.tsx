'use client';

import React from 'react';
import { CheckCircle2, XCircle, Ban, Circle, SkipForward } from 'lucide-react';
import {
  TEST_NOT_RUN_LABEL,
  TEST_RUN_STATUS_LABELS,
  TEST_STEP_STATUS_LABELS,
} from '@/lib/labels';
import type { TestRunStatus, TestStepResultStatus } from '../types';

export function TestRunStatusBadge({
  status,
  compact = false,
}: {
  status: TestRunStatus | null;
  compact?: boolean;
}) {
  if (!status) {
    return (
      <span
        className={`inline-flex items-center gap-1 font-bold rounded-full border shrink-0 ${
          TEST_NOT_RUN_LABEL.bg
        } ${TEST_NOT_RUN_LABEL.color} ${TEST_NOT_RUN_LABEL.border} ${
          compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-[11px]'
        }`}
      >
        <Circle size={compact ? 10 : 11} />
        <span>{TEST_NOT_RUN_LABEL.label}</span>
      </span>
    );
  }

  const meta = TEST_RUN_STATUS_LABELS[status];
  const Icon =
    status === 'PASSED' ? CheckCircle2 : status === 'FAILED' ? XCircle : Ban;

  return (
    <span
      className={`inline-flex items-center gap-1 font-bold rounded-full border shrink-0 ${
        meta.bg
      } ${meta.color} ${meta.border} ${
        compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-[11px]'
      }`}
    >
      <Icon size={compact ? 11 : 12} />
      <span>{meta.label}</span>
    </span>
  );
}

export function TestStepStatusBadge({ status }: { status: TestStepResultStatus | null }) {
  if (!status) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-stone-100 text-stone-500 border border-stone-200">
        <Circle size={9} />
        <span>შეუფასებელი</span>
      </span>
    );
  }

  const meta = TEST_STEP_STATUS_LABELS[status];
  const Icon =
    status === 'PASSED'
      ? CheckCircle2
      : status === 'FAILED'
      ? XCircle
      : status === 'BLOCKED'
      ? Ban
      : SkipForward;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${meta.bg} ${meta.color} ${meta.border}`}
    >
      <Icon size={10} />
      <span>{meta.label}</span>
    </span>
  );
}
