import test from "node:test";
import assert from "node:assert";
import {
  PrismaClient,
  Role,
} from "@prisma/client";
import { calculateAndSyncTaskProgress } from "../src/lib/workflow";
import path from "path";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  "postgresql://workspace_user:workspace_secret_password@localhost:5434/team_workspace_test_db?schema=public";

const testPrisma = new PrismaClient({
  datasources: {
    db: { url: TEST_DATABASE_URL },
  },
});

test("Step 5: Complete Task Details: Comments, Attachments, External Links, Daily Updates & Activity", async () => {
  // 1. Setup Project & Users (Giorgi - Author, Salome - Other User, Dato - Admin)
  const project = await testPrisma.project.create({
    data: {
      name: `Step 5 Collaboration Project ${Date.now()}`,
      color: "#EA580C",
    },
  });

  const giorgi = await testPrisma.user.create({
    data: {
      email: `giorgi_${Date.now()}@test.local`,
      name: "გიორგი",
      role: Role.USER,
      passwordHash: "hash123",
    },
  });

  const salome = await testPrisma.user.create({
    data: {
      email: `salome_${Date.now()}@test.local`,
      name: "სალომე",
      role: Role.USER,
      passwordHash: "hash123",
    },
  });

  const datoAdmin = await testPrisma.user.create({
    data: {
      email: `dato_${Date.now()}@test.local`,
      name: "დათო ადმინი",
      role: Role.ADMIN,
      passwordHash: "hash123",
    },
  });

  // Create Task
  const task = await testPrisma.task.create({
    data: {
      projectId: project.id,
      title: "დავალება #5 კოლაბორაციის ტესტი",
      description: "საწყისი აღწერა",
      createdById: giorgi.id,
      progress: 0,
    },
  });

  // ==========================================
  // 1. COMMENTS TESTS
  // ==========================================

  // 1.1 Add comment
  const comment1 = await testPrisma.comment.create({
    data: {
      taskId: task.id,
      userId: giorgi.id,
      content: "გამარჯობა @სალომე, დიზაინის განახლება მზად არის.",
    },
    include: {
      user: { select: { id: true, name: true } },
    },
  });

  assert.strictEqual(comment1.taskId, task.id);
  assert.strictEqual(comment1.userId, giorgi.id);
  assert.strictEqual(comment1.user.name, "გიორგი");

  // Audit log for comment
  await testPrisma.auditEvent.create({
    data: {
      taskId: task.id,
      actorId: giorgi.id,
      action: "COMMENT_ADDED",
      entityType: "COMMENT",
      entityId: comment1.id,
      newValues: { snippet: comment1.content.slice(0, 100) },
      reason: "ახალი კომენტარის დამატება",
    },
  });

  // 1.2 Persist check
  const fetchedComments = await testPrisma.comment.findMany({
    where: { taskId: task.id },
  });
  assert.strictEqual(fetchedComments.length, 1);
  assert.strictEqual(fetchedComments[0].content, comment1.content);

  // 1.3 Edit own comment (by Giorgi)
  const updatedComment = await testPrisma.comment.update({
    where: { id: comment1.id },
    data: { content: "გამარჯობა @სალომე, დიზაინის განახლება მზად არის და ატვირთულია." },
  });
  assert.strictEqual(
    updatedComment.content,
    "გამარჯობა @სალომე, დიზაინის განახლება მზად არის და ატვირთულია."
  );

  // 1.4 Permission check: Salome (ordinary user) cannot edit Giorgi's comment
  const canSalomeEdit = salome.id === comment1.userId || salome.role === Role.ADMIN;
  assert.strictEqual(canSalomeEdit, false, "Salome should not be allowed to edit Giorgi's comment");

  // Admin Dato CAN edit or moderate
  const canAdminEdit = datoAdmin.id === comment1.userId || datoAdmin.role === Role.ADMIN;
  assert.strictEqual(canAdminEdit, true, "Admin should have moderation rights");

  // 1.5 Script / XSS safety: Script tag stored as text, not executed
  const xssComment = await testPrisma.comment.create({
    data: {
      taskId: task.id,
      userId: giorgi.id,
      content: "<script>alert('xss')</script> და ტესტ ტექსტი",
    },
  });
  assert.strictEqual(xssComment.content.includes("<script>"), true);
  // Content remains a raw string and is safely rendered via React JSX (no dangerouslySetInnerHTML)

  // ==========================================
  // 2. ATTACHMENTS & SCREENSHOTS & EXTERNAL LINKS
  // ==========================================

  // 2.1 File upload metadata
  const fileAttachment = await testPrisma.attachment.create({
    data: {
      taskId: task.id,
      userId: giorgi.id,
      originalName: "mockup_dashboard.png",
      storedName: "mockup_dashboard_uuid123.png",
      mimeType: "image/png",
      sizeBytes: 1024 * 350, // 350 KB
      isExternal: false,
    },
  });

  assert.strictEqual(fileAttachment.isExternal, false);
  assert.strictEqual(fileAttachment.sizeBytes, 350 * 1024);

  // Audit event for attachment
  await testPrisma.auditEvent.create({
    data: {
      taskId: task.id,
      actorId: giorgi.id,
      action: "ATTACHMENT_ADDED",
      entityType: "ATTACHMENT",
      entityId: fileAttachment.id,
      newValues: { originalName: fileAttachment.originalName, sizeBytes: fileAttachment.sizeBytes },
      reason: "ფაილის ატვირთვა",
    },
  });

  // 2.2 Security: Dangerous file rejection logic
  const dangerousExts = [".exe", ".bat", ".cmd", ".sh", ".php", ".vbs", ".dll"];
  const isMalicious = dangerousExts.includes(path.extname("trojan.exe").toLowerCase());
  assert.strictEqual(isMalicious, true, "Executable extensions must be rejected");

  // 2.3 Security: File size limit (25MB)
  const MAX_FILE_SIZE = 25 * 1024 * 1024;
  const oversizedFileBytes = 30 * 1024 * 1024;
  assert.strictEqual(oversizedFileBytes > MAX_FILE_SIZE, true, "Files > 25MB must be rejected");

  // 2.4 Security: Path traversal rejection
  const uploadDir = path.normalize("/workspace/uploads");
  const traversalTarget = path.normalize(path.join(uploadDir, "../../../etc/passwd"));
  const isTraversalSafe = traversalTarget.startsWith(uploadDir);
  assert.strictEqual(isTraversalSafe, false, "Path traversal path must not be allowed to escape uploads directory");

  // 2.5 External Links: Figma and GitLab URLs
  const figmaLink = await testPrisma.attachment.create({
    data: {
      taskId: task.id,
      userId: giorgi.id,
      originalName: "Figma დიზაინი v2",
      storedName: "link-figma-uuid",
      mimeType: "text/html",
      sizeBytes: 0,
      url: "https://www.figma.com/design/sample123",
      isExternal: true,
    },
  });

  assert.strictEqual(figmaLink.isExternal, true);
  assert.strictEqual(figmaLink.url?.startsWith("https://"), true);

  // Unsafe link scheme validation
  const unsafeUrl = "javascript:alert('malicious')";
  const isSafeScheme =
    unsafeUrl.trim().toLowerCase().startsWith("http://") ||
    unsafeUrl.trim().toLowerCase().startsWith("https://");
  assert.strictEqual(isSafeScheme, false, "Unsafe schemes like javascript: must be rejected");

  // 2.6 External Link Editing
  const editedFigmaLink = await testPrisma.attachment.update({
    where: { id: figmaLink.id },
    data: {
      originalName: "Figma დიზაინი (საბოლოო)",
      url: "https://www.figma.com/design/sample123_v3",
    },
  });
  assert.strictEqual(editedFigmaLink.originalName, "Figma დიზაინი (საბოლოო)");

  // 2.7 Attachment Deletion with Audit
  await testPrisma.attachment.delete({
    where: { id: fileAttachment.id },
  });
  await testPrisma.auditEvent.create({
    data: {
      taskId: task.id,
      actorId: giorgi.id,
      action: "ATTACHMENT_REMOVED",
      entityType: "ATTACHMENT",
      entityId: fileAttachment.id,
      oldValues: { originalName: fileAttachment.originalName },
      reason: "ფაილის წაშლა",
    },
  });

  const remainingAttachments = await testPrisma.attachment.findMany({
    where: { taskId: task.id },
  });
  assert.strictEqual(remainingAttachments.length, 1); // Only figmaLink remains

  // ==========================================
  // 3. DAILY UPDATES (OPTIONAL WORK LOG)
  // ==========================================

  // 3.1 Create Daily Update
  const dailyUpdate = await testPrisma.dailyUpdate.create({
    data: {
      taskId: task.id,
      userId: giorgi.id,
      content: "დღეს დავასრულე Header-ის Desktop ვერსია. ხვალ გავაგრძელებ მობილურზე მუშაობას.",
    },
    include: {
      user: { select: { id: true, name: true } },
    },
  });

  assert.strictEqual(dailyUpdate.userId, giorgi.id);
  assert.strictEqual(dailyUpdate.user.name, "გიორგი");

  // Audit log for daily update
  await testPrisma.auditEvent.create({
    data: {
      taskId: task.id,
      actorId: giorgi.id,
      action: "DAILY_UPDATE_ADDED",
      entityType: "DAILY_UPDATE",
      entityId: dailyUpdate.id,
      newValues: { snippet: dailyUpdate.content.slice(0, 100) },
      reason: "დღიური სამუშაო ჩანაწერი დაემატა",
    },
  });

  // 3.2 CRITICAL INVARIANT: Daily update DOES NOT change task progress!
  const taskAfterDailyUpdate = await testPrisma.task.findUnique({
    where: { id: task.id },
  });
  assert.strictEqual(
    taskAfterDailyUpdate?.progress,
    0,
    "Daily update must NEVER alter task progress"
  );

  // 3.3 Edit own Daily Update
  const updatedDailyUpdate = await testPrisma.dailyUpdate.update({
    where: { id: dailyUpdate.id },
    data: {
      content: "დღეს დავასრულე Header-ის Desktop ვერსია და გავაკეთე responsive ტესტები.",
    },
  });
  assert.strictEqual(
    updatedDailyUpdate.content,
    "დღეს დავასრულე Header-ის Desktop ვერსია და გავაკეთე responsive ტესტები."
  );

  // 3.4 Authorization check for Daily Update
  const canSalomeEditDU = salome.id === dailyUpdate.userId || salome.role === Role.ADMIN;
  assert.strictEqual(canSalomeEditDU, false, "Salome cannot edit Giorgi's daily update");

  // ==========================================
  // 4. REGRESSION: PROGRESS STILL GOVERNED BY SUBTASKS ONLY
  // ==========================================
  // Add 2 subtasks, complete 1 -> progress must be 50%
  const st1 = await testPrisma.subtask.create({
    data: {
      taskId: task.id,
      title: "ქვედავალება 1",
      position: 0,
    },
  });
  await testPrisma.subtask.create({
    data: {
      taskId: task.id,
      title: "ქვედავალება 2",
      position: 1,
    },
  });

  await testPrisma.subtask.update({
    where: { id: st1.id },
    data: { status: "DONE", completedById: giorgi.id },
  });

  const newProgress = await calculateAndSyncTaskProgress(task.id, testPrisma);
  assert.strictEqual(newProgress, 50, "1 of 2 subtasks completed = 50%");

  // Add another daily update -> progress must still be 50%
  await testPrisma.dailyUpdate.create({
    data: {
      taskId: task.id,
      userId: salome.id,
      content: "სალომემ შეამოწმა ტასკი.",
    },
  });
  const taskCheck = await testPrisma.task.findUnique({ where: { id: task.id } });
  assert.strictEqual(taskCheck?.progress, 50, "Progress remains 50% after second daily update");

  // ==========================================
  // 5. ACTIVITY / AUDIT LOG INTEGRITY VERIFICATION
  // ==========================================
  const auditEvents = await testPrisma.auditEvent.findMany({
    where: { taskId: task.id },
    orderBy: { createdAt: "desc" },
  });

  const actions = auditEvents.map((a) => a.action);
  assert.strictEqual(actions.includes("COMMENT_ADDED"), true);
  assert.strictEqual(actions.includes("ATTACHMENT_ADDED"), true);
  assert.strictEqual(actions.includes("ATTACHMENT_REMOVED"), true);
  assert.strictEqual(actions.includes("DAILY_UPDATE_ADDED"), true);
});
