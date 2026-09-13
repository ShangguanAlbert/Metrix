import assert from "node:assert/strict";
import test from "node:test";
import { once } from "node:events";
import express from "express";
import * as XLSX from "xlsx";
import * as core from "../../server/services/core-runtime.js";
import { registerAuthUserClassroomRoutes } from "../../server/routes/auth-user-classroom.js";
import { registerAdminRoutes } from "../../server/routes/admin.js";
import { registerGroupChatRoutes } from "../../server/routes/group-chat.js";
import { getTeacherScopeStudentEntryPath } from "../../shared/teacherScopes.js";

// Only the database boundary is replaced. Requests use the real Excel parser,
// routes, password hashing, token signing and authentication middleware.
function queryResult(value) {
  return {
    then: (...args) => Promise.resolve(value).then(...args),
    lean: async () => value,
    select() { return this; },
    sort() { return this; },
  };
}

function matches(doc, query) {
  return Object.entries(query).every(([key, expected]) => {
    if (key === "$or") return expected.some((part) => matches(doc, part));
    const actual = key.split(".").reduce((value, part) => value?.[part], doc);
    if (expected && typeof expected === "object") {
      if ("$in" in expected) return expected.$in.includes(actual);
      if ("$ne" in expected) return actual !== expected.$ne;
    }
    return Array.isArray(actual) ? actual.includes(expected) : actual === expected;
  });
}

async function createFixture(t) {
  const users = [];
  const rooms = [];
  const makeUser = (data) => {
    const user = {
      _id: (users.length + 1).toString(16).padStart(24, "0"),
      accountStatus: "active",
      ...data,
      async save() { return this; },
    };
    users.push(user);
    return user;
  };
  const teacher = makeUser({
    username: "test-teacher", usernameKey: "test-teacher", role: "teacher",
    passwordHash: await core.hashPassword("Teacher-Test-123"),
    lockedTeacherScopeKey: "shi-gaojun", authorizedClassNames: ["810班"],
    profile: { name: "测试教师" },
  });
  const admin = makeUser({
    role: "admin", accountTag: core.PLATFORM_ADMIN_ACCOUNT_TAG,
  });
  t.mock.method(core.AuthUser, "findById", (id) => queryResult(users.find((u) => u._id === id) || null));
  t.mock.method(core.AuthUser, "findOne", (query) => queryResult(users.find((u) => matches(u, query)) || null));
  t.mock.method(core.AuthUser, "find", (query) => queryResult(users.filter((u) => matches(u, query))));
  t.mock.method(core.AuthUser, "create", async (data) => makeUser(data));
  t.mock.method(core.GroupChatRoom, "find", (query) => queryResult(rooms.filter((room) => matches(room, query))));
  const deps = { ...core, env: {}, readGroupChatUsersByIds: async () => [] };
  const app = express();
  registerAuthUserClassroomRoutes(app, deps);
  registerAdminRoutes(app, deps);
  registerGroupChatRoutes(app, deps);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const teacherToken = core.signToken({ uid: teacher._id, role: "admin", scope: "admin" });
  const adminToken = core.signToken({ uid: admin._id, role: "admin", scope: "admin" });
  async function request(path, { body, token = "", method = body ? "POST" : "GET" } = {}) {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, data: await response.json() };
  }
  async function importStudents(rows) {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "学生账号导入");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    const form = new FormData();
    form.set("file", new Blob([buffer]), "students.xlsx");
    const response = await fetch(`${base}/api/auth/admin/user-directory/student-import`, {
      method: "POST", headers: { Authorization: `Bearer ${teacherToken}` }, body: form,
    });
    return { status: response.status, data: await response.json() };
  }
  const login = (username, password) => request("/api/auth/login", { body: { username, password } });
  return { users, rooms, teacher, makeUser, request, importStudents, login, teacherToken, adminToken };
}

test("imported passwords log students into their bound classroom without an invitation", async (t) => {
  const f = await createFixture(t);
  const imported = await f.importStudents([
    { 姓名: "张三", 学号: "81001", 班级: "810班", 初始密码: "Chosen-123" },
    { 姓名: "李四", 学号: "81002", 班级: "810班", 初始密码: "" },
  ]);
  assert.equal(imported.status, 201);
  assert.equal(imported.data.summary.createdCount, 2);
  const [chosen, generated] = imported.data.results;
  assert.equal(chosen.initialPassword, "Chosen-123");
  assert.match(generated.initialPassword, /^[A-Za-z2-9]{12}$/);
  for (const row of [chosen, generated]) {
    const user = f.users.find((u) => u.username === row.username);
    assert.equal(user.accountStatus, "active");
    assert.equal(user.lockedTeacherScopeKey, "shi-gaojun");
    assert.notEqual(user.passwordHash, row.initialPassword);
    assert.equal(user.passwordPlain, undefined);
    const result = await f.login(row.username, row.initialPassword);
    assert.equal(result.status, 200, JSON.stringify(result.data));
    assert.equal(result.data.teacherScopeKey, "shi-gaojun");
    assert.equal(getTeacherScopeStudentEntryPath(result.data.teacherScopeKey), "/party");
    const payload = core.verifyToken(result.data.token);
    assert.equal(payload.pairProgrammingAccess, true);
    const bootstrap = await f.request("/api/group-chat/bootstrap", { token: result.data.token });
    assert.equal(bootstrap.status, 200);
    assert.deepEqual(bootstrap.data.rooms, []);
    f.rooms.push({ _id: "123456789012345678901234", name: "测试结对课堂", teacherScopeKey: "shi-gaojun", memberUserIds: [user._id] });
    const assigned = await f.request("/api/group-chat/bootstrap", { token: result.data.token });
    assert.equal(assigned.status, 200);
    assert.equal(assigned.data.rooms.length, 1);
    f.rooms.length = 0;
  }
  const duplicate = await f.importStudents([{ 姓名: "张三", 学号: "81001", 班级: "810班", 初始密码: "Different-123" }]);
  assert.equal(duplicate.data.summary.createdCount, 0);
  assert.equal(duplicate.data.results[0].initialPassword, undefined);
  assert.equal((await f.login("81001", "Chosen-123")).status, 200);
  assert.equal((await f.login("81001", "Different-123")).status, 401);
});

test("password recovery enforces teacher scope and class permissions and keeps account data", async (t) => {
  const f = await createFixture(t);
  const imported = await f.importStudents([{ 姓名: "张三", 学号: "81001", 班级: "810班", 初始密码: "Old-123" }]);
  const id = imported.data.results[0].userId;
  const student = f.users.find((user) => user._id === id);
  const path = `/api/auth/admin/user-directory/users/${id}/reset-password`;
  const reset = (token, password) => f.request(path, { token, body: { password } });
  assert.equal((await reset("", "New-123")).status, 401);
  const studentSession = await f.login("81001", "Old-123");
  assert.equal((await reset(studentSession.data.token, "New-123")).status, 401);
  assert.equal((await reset(f.teacherToken, "short")).status, 400);
  f.teacher.authorizedClassNames = ["811班"];
  assert.equal((await reset(f.teacherToken, "New-123")).status, 403);
  f.teacher.authorizedClassNames = ["810班"];
  f.teacher.lockedTeacherScopeKey = "yang-junfeng";
  assert.equal((await reset(f.teacherToken, "New-123")).status, 403);
  f.teacher.lockedTeacherScopeKey = "shi-gaojun";
  const directory = await f.request("/api/auth/admin/user-directory", { token: f.teacherToken });
  assert.equal(directory.data.users.find((user) => user.id === id).canResetPassword, true);
  assert.equal(directory.data.users.find((user) => user.id === f.teacher._id).canResetPassword, false);
  const profile = { ...student.profile };
  const result = await reset(f.teacherToken, "New-123");
  assert.equal(result.status, 200);
  assert.deepEqual(result.data, { ok: true });
  assert.deepEqual(student.profile, profile);
  assert.equal(student.accountStatus, "active");
  assert.equal(student.lockedTeacherScopeKey, "shi-gaojun");
  assert.equal((await f.login("81001", "Old-123")).status, 401);
  assert.equal((await f.login("81001", "New-123")).status, 200);
  student.accountStatus = "disabled";
  assert.equal((await reset(f.adminToken, "Admin-123")).status, 200);
  assert.equal(student.accountStatus, "disabled");
  assert.equal((await f.login("81001", "Admin-123")).status, 403);
  const teacherReset = await f.request(`/api/auth/admin/user-directory/users/${f.teacher._id}/reset-password`, { token: f.adminToken, body: { password: "New-123" } });
  assert.equal(teacherReset.status, 404);
});

test("login rejects pending, disabled and unbound students and teacher accounts", async (t) => {
  const f = await createFixture(t);
  const passwordHash = await core.hashPassword("Student-123");
  for (const [index, accountStatus, lockedTeacherScopeKey] of [[1, "pending_binding", "shi-gaojun"], [2, "disabled", "shi-gaojun"], [3, "active", ""]]) {
    const username = `8200${index}`;
    f.makeUser({ username, usernameKey: username, role: "user", passwordHash, accountStatus, lockedTeacherScopeKey, profile: { className: "820班" } });
    assert.equal((await f.login(username, "Student-123")).status, 403);
  }
  assert.equal((await f.login("test-teacher", "Teacher-Test-123")).status, 403);
});

test("scope resolution preserves explicit default and special class routing", () => {
  assert.equal(core.resolveLoginLockedTeacherScopeKey({ profile: { className: "810班" }, lockedTeacherScopeKey: "shi-gaojun" }), "shi-gaojun");
  assert.equal(core.resolveLoginLockedTeacherScopeKey({ profile: { className: "810班" }, lockedTeacherScopeKey: "default" }), "default");
  assert.equal(core.resolveLoginLockedTeacherScopeKey({ profile: { className: "810班" } }), "");
  assert.equal(core.resolveLoginLockedTeacherScopeKey({ profile: { className: core.CLASS_NAME_JIAOJI_231 } }), "yang-junfeng");
});
