export const DEFAULT_FINAL_TEST_CONTENT = Object.freeze({
  introText: "本次期末测试分为两个部分。第一个部分是改进任务，第二个部分是创新任务。",
  tasks: [
    {
      id: "task-1",
      title: "任务 1：改进课桌",
      description:
        "请对你自己的课桌提出改进方案，让它更加适合你的在校学习。尽量写清楚你觉得课桌哪里有问题、你的改进思路和改进后未来的使用方式。要求：\n1. 分点阐述，改进好多个地方；\n2. 每个改进地方都要说明现在有哪些问题，改完之后有什么好处；\n3. 必要时请描述详细。",
      mode: "platform",
    },
    {
      id: "task-2",
      title: "任务 2：创新任务",
      description: "任务 2：创新任务在线下独立完成，不在本页面提交。",
      mode: "offline",
    },
  ],
});

function sanitizeLineText(value, fallback, maxLength) {
  const text = String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim()
    .slice(0, maxLength);
  return text || fallback;
}

function sanitizeBlockText(value, fallback, maxLength) {
  const text = String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .slice(0, maxLength);
  return text.trim() ? text : fallback;
}

function sanitizeTaskMode(value, fallback = "platform") {
  const mode = String(value || "").trim().toLowerCase();
  if (mode === "offline") return "offline";
  return fallback === "offline" ? "offline" : "platform";
}

function sanitizeFinalTestTask(input, index = 0) {
  const source = input && typeof input === "object" ? input : {};
  const title = sanitizeLineText(
    source.title,
    `任务 ${index + 1}`,
    80,
  );
  const description = sanitizeBlockText(source.description, "", 600);
  const mode = sanitizeTaskMode(source.mode, "platform");
  return {
    id: sanitizeLineText(source.id, `task-${index + 1}`, 60).replace(/\s+/g, "-"),
    title,
    description,
    mode,
  };
}

export function normalizeFinalTestContentConfig(input) {
  const source = input && typeof input === "object" ? input : {};
  const rawTasks = Array.isArray(source.tasks) && source.tasks.length > 0
    ? source.tasks
    : DEFAULT_FINAL_TEST_CONTENT.tasks;
  const tasks = rawTasks
    .map((item, index) => sanitizeFinalTestTask(item, index))
    .filter((item, index, array) => {
      if (!item.title && !item.description) return false;
      const seenIndex = array.findIndex((candidate) => candidate.id === item.id);
      return seenIndex === index;
    })
    .slice(0, 8);
  const normalizedTasks =
    tasks.length > 0
      ? tasks
      : DEFAULT_FINAL_TEST_CONTENT.tasks.map((item, index) =>
          sanitizeFinalTestTask(item, index),
        );
  const firstTask = normalizedTasks[0] || sanitizeFinalTestTask(null, 0);
  const offlineTask = normalizedTasks.find((item) => item.mode === "offline") || normalizedTasks[1] || firstTask;
  return {
    introText: sanitizeBlockText(
      source.introText,
      DEFAULT_FINAL_TEST_CONTENT.introText,
      240,
    ),
    tasks: normalizedTasks,
    taskTitle: firstTask.title,
    taskDescription: firstTask.description,
    task2OfflineText: offlineTask.description || DEFAULT_FINAL_TEST_CONTENT.tasks[1].description,
  };
}
