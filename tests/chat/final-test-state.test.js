import assert from "node:assert/strict";
import test from "node:test";

import {
  buildInternalTransferEvent,
  canPasteInStage,
  lockExpiredSession,
  resolveFinalTestVariant,
} from "../../shared/finalTestState.js";

test("resolveFinalTestVariant maps 810 and 811 to different experiment modes", () => {
  assert.equal(resolveFinalTestVariant("810班"), "three-stage-guided");
  assert.equal(resolveFinalTestVariant("811班"), "two-stage-free");
  assert.equal(resolveFinalTestVariant("709班"), "disabled");
});

test("canPasteInStage blocks stage1 but allows stage3", () => {
  assert.equal(canPasteInStage("stage1_draft"), false);
  assert.equal(canPasteInStage("stage2_active"), true);
  assert.equal(canPasteInStage("stage3_active"), true);
});

test("lockExpiredSession switches an overdue active session into time_expired_locked", () => {
  const next = lockExpiredSession(
    {
      status: "stage3_active",
      deadlineAt: "2026-05-31T10:20:00.000Z",
    },
    "2026-05-31T10:20:01.000Z",
  );

  assert.equal(next.status, "time_expired_locked");
  assert.equal(next.timeExpired, true);
  assert.equal(next.lockedAt, "2026-05-31T10:20:01.000Z");
});

test("buildInternalTransferEvent records the source text and target field", () => {
  const event = buildInternalTransferEvent({
    sourceMessageId: "msg-1",
    sourceRole: "assistant",
    selectedText: "把两个想法组合起来",
    targetField: "coreFeatures",
    insertedAt: "2026-05-31T10:12:00.000Z",
  });

  assert.equal(event.insertMethod, "internal_stage2_transfer");
  assert.equal(event.sourceMessageId, "msg-1");
  assert.equal(event.targetField, "coreFeatures");
  assert.equal(event.selectedText, "把两个想法组合起来");
});
