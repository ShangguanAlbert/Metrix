function normalizeTaskText(value) {
  return String(value || "").replace(/\r\n/g, "\n").trim();
}

function splitTaskItems(value) {
  return String(value || "")
    .split(/\n+/)
    .map((item) => item.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean);
}

function buildFallbackTaskStructure({ room, settings }) {
  const modePreset = String(settings?.modePreset || "").trim().toLowerCase();
  const description = normalizeTaskText(room?.description);
  const name = String(room?.name || "Agent Lab").trim() || "Agent Lab";

  let target = description;
  if (!target) {
    if (modePreset === "learning_companion") {
      target = `围绕「${name}」中的核心问题互相解释思路，并找出仍未理解的点。`;
    } else if (modePreset === "community_manager") {
      target = `围绕「${name}」收集观点、梳理分歧，并推动讨论形成可执行结论。`;
    } else {
      target = `围绕「${name}」开展聚焦讨论，逐步澄清问题、比较观点并推进共识。`;
    }
  }

  const requirements =
    modePreset === "learning_companion"
      ? ["先说出你的理解或困惑。", "尽量结合一个具体例子说明。", "回应时优先帮助别人把思路说清楚。"]
      : modePreset === "community_manager"
        ? ["发言尽量聚焦一个明确观点。", "回应时补充理由或证据，而不是只表态。", "必要时帮助整理已有结论与未决问题。"]
        : ["先明确你要讨论的具体问题。", "尽量给出理由、案例或对比对象。", "讨论中适时总结一致点与分歧点。"];

  const outputs =
    modePreset === "learning_companion"
      ? ["形成一版更清晰的问题表述。", "沉淀 1-2 条可继续追问的线索。"]
      : modePreset === "community_manager"
        ? ["沉淀当前主要观点。", "整理后续可执行的下一步。"]
        : ["形成阶段性共识或候选方案。", "明确目前仍待补充的信息。"];

  return {
    target,
    requirements,
    outputs,
  };
}

function parseStructuredDescription(description) {
  const source = normalizeTaskText(description);
  if (!source) return null;

  const result = {
    target: "",
    requirements: [],
    outputs: [],
  };

  const labelMap = {
    "任务目标": "target",
    "讨论目标": "target",
    "目标": "target",
    "讨论要求": "requirements",
    "要求": "requirements",
    "预期产出": "outputs",
    "产出": "outputs",
  };

  let currentKey = "target";
  const lines = source.split("\n");

  for (const rawLine of lines) {
    const line = String(rawLine || "").trim();
    if (!line) continue;

    const matched = line.match(
      /^(?:任务目标|讨论目标|目标|讨论要求|要求|预期产出|产出)\s*[:：]\s*(.*)$/u,
    );
    if (matched) {
      const label = line.split(/[:：]/u)[0].trim();
      currentKey = labelMap[label] || "target";
      const rest = normalizeTaskText(matched[1]);
      if (!rest) continue;
      if (currentKey === "target") {
        result.target = result.target ? `${result.target}\n${rest}` : rest;
      } else {
        result[currentKey].push(rest.replace(/^[-*•]\s*/, ""));
      }
      continue;
    }

    if (currentKey === "target") {
      result.target = result.target ? `${result.target}\n${line}` : line;
      continue;
    }

    result[currentKey].push(line.replace(/^[-*•]\s*/, ""));
  }

  result.requirements = result.requirements.flatMap((item) => splitTaskItems(item));
  result.outputs = result.outputs.flatMap((item) => splitTaskItems(item));

  return result;
}

function resolveTaskStructure({ room, settings }) {
  const taskConfig = room?.taskConfig && typeof room.taskConfig === "object" ? room.taskConfig : null;
  if (taskConfig) {
    const title = normalizeTaskText(taskConfig.title) || "课程任务";
    const objective = normalizeTaskText(taskConfig.objective);
    const requirements = Array.isArray(taskConfig.requirements)
      ? taskConfig.requirements.map((item) => normalizeTaskText(item)).filter(Boolean)
      : [];
    const outputs = Array.isArray(taskConfig.expectedOutputs)
      ? taskConfig.expectedOutputs.map((item) => normalizeTaskText(item)).filter(Boolean)
      : [];
    if (objective || requirements.length > 0 || outputs.length > 0) {
      return {
        title,
        target: objective,
        requirements,
        outputs,
      };
    }
  }

  const parsed = parseStructuredDescription(room?.description);
  const fallback = buildFallbackTaskStructure({ room, settings });
  return {
    title: "课程任务",
    target: normalizeTaskText(parsed?.target) || fallback.target,
    requirements: Array.isArray(parsed?.requirements) && parsed.requirements.length > 0
      ? parsed.requirements
      : fallback.requirements,
    outputs: Array.isArray(parsed?.outputs) && parsed.outputs.length > 0 ? parsed.outputs : fallback.outputs,
  };
}

export default function AgentLabTaskPanel({ room = null, settings = null } = {}) {
  const task = resolveTaskStructure({ room, settings });

  return (
    <div className="agent-lab-task-card">
      <div className="agent-lab-task-card-head">
        <strong>{task.title || "课程任务"}</strong>
      </div>
      <div className="agent-lab-task-block">
        <span className="agent-lab-task-label">任务目标</span>
        <p className="agent-lab-task-text">{task.target}</p>
      </div>

      <div className="agent-lab-task-block">
        <span className="agent-lab-task-label">讨论要求</span>
        <ul className="agent-lab-task-list">
          {task.requirements.map((item, index) => (
            <li key={`task-req-${index}`}>{item}</li>
          ))}
        </ul>
      </div>

      <div className="agent-lab-task-block">
        <span className="agent-lab-task-label">预期产出</span>
        <ul className="agent-lab-task-list">
          {task.outputs.map((item, index) => (
            <li key={`task-output-${index}`}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
