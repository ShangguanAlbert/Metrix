import assert from "node:assert/strict";
import test from "node:test";
import {
  TEACHER_CLASSROOM_FILE_MAX_FILE_SIZE_BYTES,
  repairAdminClassroomCoursePlansFileMetadata,
  sanitizeAdminClassroomCourseFilePayload,
  normalizeAdminClassroomLessonFileDoc,
} from "../../server/services/core-runtime.js";

test("normalizeAdminClassroomLessonFileDoc preserves teacher classroom file sizes up to 100MB", () => {
  const doc = normalizeAdminClassroomLessonFileDoc({
    fileId: "lesson-file-1",
    fileName: "任务附件.zip",
    mimeType: "application/zip",
    size: TEACHER_CLASSROOM_FILE_MAX_FILE_SIZE_BYTES,
    uploadedAt: "2026-05-05T08:00:00.000Z",
  });

  assert.equal(doc.size, TEACHER_CLASSROOM_FILE_MAX_FILE_SIZE_BYTES);
});

test("sanitizeAdminClassroomCourseFilePayload preserves classroom file sizes up to 100MB", () => {
  const file = sanitizeAdminClassroomCourseFilePayload({
    id: "lesson-file-1",
    name: "任务附件.zip",
    mimeType: "application/zip",
    size: 80 * 1024 * 1024,
    uploadedAt: "2026-05-05T08:00:00.000Z",
  });

  assert.equal(file.size, 80 * 1024 * 1024);
});

test("repairAdminClassroomCoursePlansFileMetadata backfills stored file sizes from lesson file docs", () => {
  const repaired = repairAdminClassroomCoursePlansFileMetadata(
    [
      {
        id: "lesson-1",
        courseName: "第七节课",
        files: [],
        tasks: [
          {
            id: "task-1",
            title: "任务 1",
            type: "text",
            content: "请下载附件",
            files: [
              {
                id: "lesson-file-1",
                name: "第七节课.zip",
                mimeType: "application/zip",
                size: 10 * 1024 * 1024 - 1,
                uploadedAt: "2026-05-05T14:14:52.000Z",
              },
            ],
          },
        ],
      },
    ],
    [
      {
        fileId: "lesson-file-1",
        fileName: "第七节课.zip",
        mimeType: "application/zip",
        size: 80 * 1024 * 1024,
        uploadedAt: "2026-05-05T14:14:52.000Z",
      },
    ],
  );

  assert.equal(repaired[0].tasks[0].files[0].size, 80 * 1024 * 1024);
});

test("classroom publication snapshots survive config normalization without including nested drafts", async () => {
  const { sanitizeAdminClassroomCoursePlansPayload } = await import("../../server/services/core-runtime.js");
  const input = [{ id: "lesson", courseName: "草稿新名称", tasks: [], publication: {
    publishedAt: "2026-09-21T01:00:00.000Z",
    snapshot: { id: "lesson", courseName: "已发布名称", tasks: [{ id: "task", title: "已发布任务", type: "text", content: "原内容", files: [{ id: "file", name: "推荐卡.txt" }] }] },
  } }];
  const first = sanitizeAdminClassroomCoursePlansPayload(input);
  const second = sanitizeAdminClassroomCoursePlansPayload(first);
  assert.equal(second[0].courseName, "草稿新名称");
  assert.equal(second[0].publication.snapshot.courseName, "已发布名称");
  assert.equal(second[0].publication.snapshot.tasks[0].files[0].id, "file");
  assert.equal(Object.hasOwn(second[0].publication.snapshot, "publication"), false);
});


test("MongoDB lesson schema keeps publication snapshots and distinguishes legacy data from unpublished drafts", async () => {
  const { AdminConfig } = await import("../../server/services/core-runtime.js");
  const doc = new AdminConfig({ teacherCoursePlans: [
    { id: "legacy", courseName: "旧课时" },
    { id: "draft", courseName: "新草稿", publication: { publishedAt: "", snapshot: null } },
    { id: "published", courseName: "修改中", publication: { publishedAt: "2026-09-21T01:00:00.000Z", snapshot: { id: "published", courseName: "已发布名称", tasks: [] } } },
  ] });
  const plans = doc.toObject().teacherCoursePlans;
  assert.equal(Object.hasOwn(plans[0], "publication"), false);
  assert.equal(plans[1].publication.snapshot, null);
  assert.equal(plans[2].publication.snapshot.courseName, "已发布名称");
});
