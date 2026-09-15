import assert from "node:assert/strict";
import test from "node:test";

import { resolvePartyPairRoles } from "../../server/modules/party-coding/pair-roles.js";

test("单人进入派时保留管理成员，但结对尚未就绪", () => {
  const roles = resolvePartyPairRoles(["owner"]);

  assert.equal(roles.pairReady, false);
  assert.equal(roles.driverUserId, "owner");
  assert.equal(roles.navigatorUserId, "");
});

test("第二名学生加入后分配独立的 Driver 和 Navigator", () => {
  const roles = resolvePartyPairRoles(["owner", "member"]);

  assert.equal(roles.pairReady, true);
  assert.equal(roles.driverUserId, "owner");
  assert.equal(roles.navigatorUserId, "member");
});

test("角色轮换后不会因为派主身份恢复初始角色", () => {
  const roles = resolvePartyPairRoles(["owner", "member"], {
    driverUserId: "member",
    navigatorUserId: "owner",
  });

  assert.equal(roles.pairReady, true);
  assert.equal(roles.driverUserId, "member");
  assert.equal(roles.navigatorUserId, "owner");
  assert.equal(roles.changed, true); // Older room receives the navigator array without changing its Driver.
  assert.equal(resolvePartyPairRoles(["owner", "member"], roles).changed, false);
});

test("成员变化时清理离开者并重新生成有效角色", () => {
  const roles = resolvePartyPairRoles(["owner", "new-member"], {
    driverUserId: "old-member",
    navigatorUserId: "owner",
  });

  assert.equal(roles.pairReady, true);
  assert.equal(roles.driverUserId, "owner");
  assert.equal(roles.navigatorUserId, "new-member");
  assert.equal(roles.changed, true);
});


test("补入第三人保留 Driver，随后依次覆盖所有学生", async () => {
  const { rotatePartyRoles, canDriveParty } = await import("../../shared/party-roles.js");
  const ids = ["a", "b", "c"];
  let roles = resolvePartyPairRoles(ids, { driverUserId: "b", navigatorUserId: "a" });
  assert.equal(roles.driverUserId, "b");
  assert.deepEqual(roles.navigatorUserIds, ["c", "a"]);
  for (const next of ["c", "a", "b"]) {
    roles = rotatePartyRoles(ids, roles);
    assert.equal(roles.driverUserId, next);
    assert.equal(ids.filter((id) => canDriveParty(roles, id)).length, 1);
    assert.equal(roles.navigatorUserIds.includes(next), false);
  }
});

test("超员小组不能交棒，单人没有编辑权限", async () => {
  const { rotatePartyRoles, canDriveParty } = await import("../../shared/party-roles.js");
  assert.throws(() => rotatePartyRoles(["a", "b", "c", "d"], {}));
  assert.equal(canDriveParty(resolvePartyPairRoles(["a"]), "a"), false);
});
