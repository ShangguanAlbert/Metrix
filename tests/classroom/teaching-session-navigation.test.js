import test from "node:test";
import assert from "node:assert/strict";

import { buildTeachingSessionHref } from "../../src/features/classroom/teachingSessionNavigation.js";

test("buildTeachingSessionHref keeps the configured app base path for teaching session routes", () => {
  assert.equal(
    buildTeachingSessionHref("lesson-123", "teacher", "/hznu/metaxfang/"),
    "/hznu/metaxfang/admin/classroom/teaching/lesson-123?slot=teacher",
  );
});
