import { api } from '@/lib/api-client';
import type {
  CreateTestCasePayload,
  CreateTestRunPayload,
  TestCaseDetail,
  TestCaseListItem,
  TestRunItem,
  UpdateTestCasePayload,
  UploadedEvidenceAttachment,
} from './types';

export const testingApi = {
  async listByTask(taskId: string): Promise<TestCaseListItem[]> {
    const res = await api.get<{ testCases: TestCaseListItem[] }>(`/tasks/${taskId}/test-cases`);
    return res.testCases;
  },

  async getCase(testCaseId: string): Promise<TestCaseDetail> {
    const res = await api.get<{ testCase: TestCaseDetail }>(`/test-cases/${testCaseId}`);
    return res.testCase;
  },

  async createCase(taskId: string, payload: CreateTestCasePayload): Promise<TestCaseDetail> {
    const res = await api.post<{ testCase: TestCaseDetail }>(
      `/tasks/${taskId}/test-cases`,
      payload
    );
    return res.testCase;
  },

  async updateCase(testCaseId: string, payload: UpdateTestCasePayload): Promise<TestCaseDetail> {
    const res = await api.patch<{ testCase: TestCaseDetail }>(
      `/test-cases/${testCaseId}`,
      payload
    );
    return res.testCase;
  },

  async deleteCase(testCaseId: string): Promise<{ success: boolean }> {
    return api.delete<{ success: boolean }>(`/test-cases/${testCaseId}`);
  },

  async createRun(testCaseId: string, payload: CreateTestRunPayload): Promise<TestRunItem> {
    const res = await api.post<{ run: TestRunItem }>(`/test-cases/${testCaseId}/runs`, payload);
    return res.run;
  },

  async uploadEvidenceFile(taskId: string, file: File): Promise<UploadedEvidenceAttachment> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post<{ attachment: UploadedEvidenceAttachment }>(
      `/tasks/${taskId}/attachments`,
      formData
    );
    return res.attachment;
  },

  async createEvidenceLink(
    taskId: string,
    payload: { name?: string; url: string }
  ): Promise<UploadedEvidenceAttachment> {
    const res = await api.post<{ attachment: UploadedEvidenceAttachment }>(
      `/tasks/${taskId}/attachments`,
      payload
    );
    return res.attachment;
  },
};
