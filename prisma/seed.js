const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Private Team Workspace database...");

  // 1. Create Users
  const passwordHash = await bcrypt.hash("admin123", 10);
  const userPasswordHash = await bcrypt.hash("user123", 10);

  const farna = await prisma.user.upsert({
    where: { email: "admin@team.local" },
    update: {},
    create: {
      email: "admin@team.local",
      name: "ფარნა",
      role: "ADMIN",
      passwordHash: passwordHash,
      avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=face",
      isActive: true,
    },
  });

  const vaska = await prisma.user.upsert({
    where: { email: "vaska@team.local" },
    update: {},
    create: {
      email: "vaska@team.local",
      name: "ვასკა",
      role: "USER",
      passwordHash: userPasswordHash,
      avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
      isActive: true,
    },
  });

  const tornike = await prisma.user.upsert({
    where: { email: "tornike@team.local" },
    update: {},
    create: {
      email: "tornike@team.local",
      name: "თორნიკე",
      role: "USER",
      passwordHash: userPasswordHash,
      avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face",
      isActive: true,
    },
  });

  const nika = await prisma.user.upsert({
    where: { email: "nika@team.local" },
    update: {},
    create: {
      email: "nika@team.local",
      name: "ნიკა",
      role: "USER",
      passwordHash: userPasswordHash,
      avatarUrl: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=100&h=100&fit=crop&crop=face",
      isActive: true,
    },
  });

  console.log("Users created:", { farna: farna.name, vaska: vaska.name, tornike: tornike.name, nika: nika.name });

  // 2. Working Calendar (Mon-Fri working, Sat-Sun non-working)
  for (let d = 0; d < 7; d++) {
    const isWorking = d >= 1 && d <= 5; // Monday to Friday
    await prisma.workingCalendar.upsert({
      where: { dayOfWeek: d },
      update: { isWorking },
      create: { dayOfWeek: d, isWorking },
    });
  }

  // 3. Holidays
  const currentYear = new Date().getFullYear();
  const holidays = [
    { date: new Date(currentYear, 0, 1), name: "ახალი წელი" },
    { date: new Date(currentYear, 0, 2), name: "ბედობა" },
    { date: new Date(currentYear, 0, 7), name: "შობა" },
    { date: new Date(currentYear, 0, 19), name: "ნათლისღება" },
    { date: new Date(currentYear, 2, 3), name: "დედის დღე" },
    { date: new Date(currentYear, 2, 8), name: "ქალთა საერთაშორისო დღე" },
    { date: new Date(currentYear, 3, 9), name: "ეროვნული ერთიანობის დღე" },
    { date: new Date(currentYear, 4, 9), name: "ფაშიზმზე გამარჯვების დღე" },
    { date: new Date(currentYear, 4, 12), name: "ანდრია პირველწოდებულის დღე" },
    { date: new Date(currentYear, 4, 26), name: "დამოუკიდებლობის დღე" },
    { date: new Date(currentYear, 7, 28), name: "მარიამობა" },
    { date: new Date(currentYear, 9, 14), name: "სვეტიცხოვლობა" },
    { date: new Date(currentYear, 10, 23), name: "გიორგობა" },
  ];

  for (const h of holidays) {
    await prisma.holiday.upsert({
      where: { date: h.date },
      update: { name: h.name },
      create: { date: h.date, name: h.name },
    });
  }

  // 4. Default Project
  const project = await prisma.project.create({
    data: {
      name: "მთავარი პლატფორმა",
      description: "გუნდის ძირითადი ვებ-პლატფორმა და ადმინისტრირების სისტემა",
      color: "#EA580C",
    },
  });

  // Dynamic reference dates based on today
  const today = new Date();
  today.setHours(10, 0, 0, 0);

  const dayAdd = (days) => {
    const d = new Date(today);
    d.setDate(d.getDate() + days);
    return d;
  };

  // 5. Featured Task: TASK-104 (მთავარი გვერდის დიზაინი)
  const task104 = await prisma.task.create({
    data: {
      taskNumber: 104,
      projectId: project.id,
      title: "მთავარი გვერდის დიზაინი",
      description: "საიტის მთავარი გვერდის ახალი ვიზუალური კონცეფციის მომზადება და ფრონტენდში ინტეგრაცია.",
      type: "FEATURE",
      priority: "HIGH",
      status: "IN_PROGRESS",
      startDate: today,
      deadline: dayAdd(4),
      deadlineLocked: true,
      progress: 60,
      createdById: farna.id,
    },
  });

  // Assignees for Task 104
  await prisma.taskAssignment.createMany({
    data: [
      { taskId: task104.id, userId: vaska.id },
      { taskId: task104.id, userId: tornike.id },
      { taskId: task104.id, userId: farna.id },
    ],
  });

  // Workflow Stages for Task 104
  const stageDesign = await prisma.workflowStage.create({
    data: {
      taskId: task104.id,
      position: 0,
      title: "დიზაინი",
      isActive: false,
      isCompleted: true,
      completedAt: today,
    },
  });
  await prisma.stageAssignment.create({
    data: { stageId: stageDesign.id, userId: vaska.id },
  });

  const stageDev = await prisma.workflowStage.create({
    data: {
      taskId: task104.id,
      position: 1,
      title: "Development",
      isActive: true,
      isCompleted: false,
    },
  });
  await prisma.stageAssignment.create({
    data: { stageId: stageDev.id, userId: tornike.id },
  });

  const stageQA = await prisma.workflowStage.create({
    data: {
      taskId: task104.id,
      position: 2,
      title: "QA / შემოწმება",
      isActive: false,
      isCompleted: false,
    },
  });
  await prisma.stageAssignment.create({
    data: { stageId: stageQA.id, userId: farna.id },
  });

  // Subtasks for Stage 1 (Design) - 3 done
  const dSub1 = await prisma.subtask.create({
    data: {
      taskId: task104.id,
      stageId: stageDesign.id,
      position: 0,
      title: "Wireframe-ის მომზადება",
      status: "DONE",
      deadline: today,
      completedById: vaska.id,
      completedAt: today,
    },
  });
  await prisma.subtaskAssignment.create({ data: { subtaskId: dSub1.id, userId: vaska.id } });

  const dSub2 = await prisma.subtask.create({
    data: {
      taskId: task104.id,
      stageId: stageDesign.id,
      position: 1,
      title: "Desktop-დიზაინი",
      status: "DONE",
      deadline: today,
      completedById: vaska.id,
      completedAt: today,
    },
  });
  await prisma.subtaskAssignment.create({ data: { subtaskId: dSub2.id, userId: vaska.id } });

  const dSub3 = await prisma.subtask.create({
    data: {
      taskId: task104.id,
      stageId: stageDesign.id,
      position: 2,
      title: "Mobile დიზაინი",
      status: "DONE",
      deadline: today,
      completedById: vaska.id,
      completedAt: today,
    },
  });
  await prisma.subtaskAssignment.create({ data: { subtaskId: dSub3.id, userId: vaska.id } });

  // Subtasks for Stage 2 (Dev) - 3 done, 2 todo
  const devSub1 = await prisma.subtask.create({
    data: {
      taskId: task104.id,
      stageId: stageDev.id,
      position: 0,
      title: "Header კომპონენტი",
      status: "DONE",
      deadline: dayAdd(1),
      completedById: tornike.id,
      completedAt: today,
    },
  });
  await prisma.subtaskAssignment.create({ data: { subtaskId: devSub1.id, userId: tornike.id } });

  const devSub2 = await prisma.subtask.create({
    data: {
      taskId: task104.id,
      stageId: stageDev.id,
      position: 1,
      title: "Hero-სექციის დამუშავება",
      status: "DONE",
      deadline: dayAdd(2),
      completedById: tornike.id,
      completedAt: today,
    },
  });
  await prisma.subtaskAssignment.create({ data: { subtaskId: devSub2.id, userId: tornike.id } });

  const devSub3 = await prisma.subtask.create({
    data: {
      taskId: task104.id,
      stageId: stageDev.id,
      position: 2,
      title: "API ინტეგრაციის საწყისი ნაწილი",
      status: "DONE",
      deadline: dayAdd(2),
      completedById: tornike.id,
      completedAt: today,
    },
  });
  await prisma.subtaskAssignment.create({ data: { subtaskId: devSub3.id, userId: tornike.id } });

  const devSub4 = await prisma.subtask.create({
    data: {
      taskId: task104.id,
      stageId: stageDev.id,
      position: 3,
      title: "ანიმაციები და ინტერაქციები",
      status: "TODO",
      deadline: dayAdd(3),
    },
  });
  await prisma.subtaskAssignment.create({ data: { subtaskId: devSub4.id, userId: tornike.id } });

  const devSub5 = await prisma.subtask.create({
    data: {
      taskId: task104.id,
      stageId: stageDev.id,
      position: 4,
      title: "Performance და ოპტიმიზაცია",
      status: "TODO",
      deadline: dayAdd(4),
    },
  });
  await prisma.subtaskAssignment.create({ data: { subtaskId: devSub5.id, userId: tornike.id } });

  // Subtasks for Stage 3 (QA) - 2 todo
  const qaSub1 = await prisma.subtask.create({
    data: {
      taskId: task104.id,
      stageId: stageQA.id,
      position: 0,
      title: "ტესტირება (Desktop / Mobile)",
      status: "TODO",
      deadline: dayAdd(4),
    },
  });
  await prisma.subtaskAssignment.create({ data: { subtaskId: qaSub1.id, userId: farna.id } });

  const qaSub2 = await prisma.subtask.create({
    data: {
      taskId: task104.id,
      stageId: stageQA.id,
      position: 1,
      title: "ფინალური შემოწმება",
      status: "TODO",
      deadline: dayAdd(4),
    },
  });
  await prisma.subtaskAssignment.create({ data: { subtaskId: qaSub2.id, userId: farna.id } });

  // Attachments / External links
  await prisma.attachment.create({
    data: {
      taskId: task104.id,
      userId: tornike.id,
      originalName: "GitLab - MR #342",
      storedName: "gitlab-mr-342",
      mimeType: "text/html",
      sizeBytes: 0,
      url: "https://gitlab.com",
      isExternal: true,
    },
  });

  await prisma.attachment.create({
    data: {
      taskId: task104.id,
      userId: vaska.id,
      originalName: "Figma - Main Page v3",
      storedName: "figma-main-page-v3",
      mimeType: "text/html",
      sizeBytes: 0,
      url: "https://figma.com",
      isExternal: true,
    },
  });

  // Daily update
  await prisma.dailyUpdate.create({
    data: {
      taskId: task104.id,
      userId: tornike.id,
      content: "დავასრულე API ინტეგრაციის საწყისი ნაწილი. ხვალ გავაგრძელებ ანიმაციებს.",
    },
  });

  // Audit Events
  await prisma.auditEvent.create({
    data: {
      taskId: task104.id,
      actorId: farna.id,
      action: "TASK_CREATED",
      entityType: "TASK",
      entityId: task104.id,
      newValues: { title: task104.title, type: task104.type, priority: task104.priority },
      reason: "საწყისი შექმნა",
    },
  });

  // Additional tasks for timeline and backlog
  // Task 2: Bug (overdue)
  const taskBug = await prisma.task.create({
    data: {
      projectId: project.id,
      title: "ბექენდ დეველოპმენტის ბაგი",
      type: "BUG",
      priority: "HIGH",
      status: "IN_PROGRESS",
      startDate: dayAdd(-2),
      deadline: today,
      deadlineLocked: true,
      progress: 0,
      createdById: farna.id,
    },
  });
  await prisma.taskAssignment.create({ data: { taskId: taskBug.id, userId: tornike.id } });

  // Task 3: Feature (done)
  const taskDone = await prisma.task.create({
    data: {
      projectId: project.id,
      title: "Card-ის ფონტის დაპატარავება",
      type: "FEATURE",
      priority: "LOW",
      status: "DONE",
      startDate: dayAdd(-3),
      deadline: dayAdd(-1),
      deadlineLocked: true,
      progress: 100,
      completedAt: dayAdd(-1),
      createdById: farna.id,
    },
  });
  await prisma.taskAssignment.create({ data: { taskId: taskDone.id, userId: farna.id } });

  // Task 4: Hotfix
  const taskHotfix = await prisma.task.create({
    data: {
      projectId: project.id,
      title: "Login redirect პრობლემა",
      type: "HOTFIX",
      priority: "CRITICAL",
      status: "IN_PROGRESS",
      startDate: dayAdd(1),
      deadline: dayAdd(1),
      deadlineLocked: true,
      progress: 0,
      createdById: tornike.id,
    },
  });
  await prisma.taskAssignment.create({ data: { taskId: taskHotfix.id, userId: tornike.id } });

  // Task 5: Feature with multiple assignees
  const taskAPI = await prisma.task.create({
    data: {
      projectId: project.id,
      title: "API ინტეგრაცია",
      type: "FEATURE",
      priority: "HIGH",
      status: "IN_PROGRESS",
      startDate: dayAdd(2),
      deadline: dayAdd(6),
      deadlineLocked: true,
      progress: 25,
      createdById: vaska.id,
    },
  });
  await prisma.taskAssignment.createMany({
    data: [
      { taskId: taskAPI.id, userId: vaska.id },
      { taskId: taskAPI.id, userId: tornike.id },
    ],
  });

  // Task 6: Bug
  const taskMobileHeader = await prisma.task.create({
    data: {
      projectId: project.id,
      title: "Mobile Header სურათის ზომა",
      type: "BUG",
      priority: "MEDIUM",
      status: "PLANNED",
      startDate: dayAdd(2),
      deadline: dayAdd(3),
      deadlineLocked: true,
      progress: 0,
      createdById: vaska.id,
    },
  });
  await prisma.taskAssignment.create({ data: { taskId: taskMobileHeader.id, userId: vaska.id } });

  // Task 7: Backlog tasks (unscheduled)
  await prisma.task.createMany({
    data: [
      {
        projectId: project.id,
        title: "ახალი პროფილის გვერდი",
        type: "FEATURE",
        priority: "MEDIUM",
        status: "BACKLOG",
        createdById: farna.id,
      },
      {
        projectId: project.id,
        title: "Mobile - ფილტრაციის შეცდომა",
        type: "BUG",
        priority: "HIGH",
        status: "BACKLOG",
        createdById: tornike.id,
      },
      {
        projectId: project.id,
        title: "მომხმარებლის პარამეტრები",
        type: "FEATURE",
        priority: "LOW",
        status: "BACKLOG",
        createdById: vaska.id,
      },
      {
        projectId: project.id,
        title: "კონტენტის ბლოკების განახლება",
        type: "FEATURE",
        priority: "MEDIUM",
        status: "PLANNED",
        startDate: dayAdd(5),
        deadline: dayAdd(8),
        deadlineLocked: true,
        createdById: vaska.id,
      },
    ],
  });

  console.log("Database seeded successfully with initial users, project, holidays, tasks and workflow!");
}

main()
  .catch((e) => {
    console.error("Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
