const classroomCollator = new Intl.Collator("zh-CN", {
  numeric: true,
  sensitivity: "base",
});

export function buildCollaborationClassroomItems(rooms, sortBy = "class") {
  const items = (Array.isArray(rooms) ? rooms : []).map((room) => {
    const classNames = [...new Set(
      (Array.isArray(room.members) ? room.members : [])
        .filter((member) => String(member.role || "").trim().toLowerCase() === "user")
        .map((member) => String(member.className || "").trim())
        .filter(Boolean),
    )].sort(classroomCollator.compare);
    const classLabel = classNames.length > 1
      ? `跨班：${classNames.join("、")}`
      : classNames[0] || "未分班";

    return {
      room,
      classLabel,
      classKey: classNames.join("、"),
      // 同班小组优先，跨班小组其次，未分班小组最后。
      classOrder: classNames.length === 0 ? 2 : classNames.length > 1 ? 1 : 0,
    };
  });

  items.sort((a, b) => {
    if (sortBy === "class") {
      const classOrder = a.classOrder - b.classOrder;
      if (classOrder !== 0) return classOrder;
      const classCompare = classroomCollator.compare(a.classKey, b.classKey);
      if (classCompare !== 0) return classCompare;
    }
    const nameCompare = classroomCollator.compare(
      String(a.room.name || "").trim(),
      String(b.room.name || "").trim(),
    );
    if (nameCompare !== 0) return nameCompare;
    // 同名小组保持稳定顺序，不随活跃时间或接口返回顺序变化。
    return String(a.room.id || "").localeCompare(String(b.room.id || ""));
  });

  return items.map(({ room, classLabel }) => ({ ...room, classLabel }));
}
