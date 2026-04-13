import assert from "node:assert/strict";
import test from "node:test";
import { createFilteredRouteApp } from "../../server/platform/route-filter-app.js";

function createAppDouble() {
  const calls = [];
  return {
    calls,
    get(path) {
      calls.push(["get", path]);
      return this;
    },
    post(path) {
      calls.push(["post", path]);
      return this;
    },
    use(pathOrHandler) {
      calls.push(["use", pathOrHandler]);
      return this;
    },
  };
}

test("createFilteredRouteApp only forwards matching route registrations", () => {
  const app = createAppDouble();
  const filteredApp = createFilteredRouteApp(
    app,
    (routePath) => typeof routePath !== "string" || routePath.startsWith("/api/chat/"),
  );

  filteredApp.get("/api/chat/bootstrap");
  filteredApp.post("/api/images/history");
  filteredApp.use(() => {});

  assert.equal(app.calls[0][0], "get");
  assert.equal(app.calls[0][1], "/api/chat/bootstrap");
  assert.equal(app.calls[1][0], "use");
  assert.equal(typeof app.calls[1][1], "function");
  assert.equal(app.calls.length, 2);
});
