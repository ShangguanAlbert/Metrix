import assert from "node:assert/strict";
import test from "node:test";
import {
  clearImageHistoryHandler,
  deleteImageHistoryItemHandler,
  getImageHistoryContentHandler,
  listImageHistoryHandler,
} from "../../server/modules/images/services/history.js";

function createResponseDouble() {
  return {
    statusCode: 200,
    headers: {},
    payload: null,
    redirectUrl: "",
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
    redirect(url) {
      this.redirectUrl = url;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
    },
    send(payload) {
      this.payload = payload;
      return this;
    },
  };
}

test("listImageHistoryHandler returns normalized items", async () => {
  const req = { authUser: { _id: "u1" }, authStorageUserId: "u1", query: { limit: "2" } };
  const res = createResponseDouble();
  const deps = {
    sanitizeId: (value) => String(value || ""),
    GeneratedImageHistory: {
      find() {
        return {
          sort() {
            return this;
          },
          limit() {
            return this;
          },
          lean: async () => [{ _id: "img-1", prompt: "hello" }],
        };
      },
    },
    toGeneratedImageHistoryItem: (doc) => doc,
  };

  await listImageHistoryHandler(req, res, deps);
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.items[0]._id, "img-1");
});

test("getImageHistoryContentHandler redirects to oss url when present", async () => {
  const req = { params: { imageId: "img-1" } };
  const res = createResponseDouble();
  const deps = {
    resolveImageHistoryAuthUserId: () => "u1",
    sanitizeId: (value) => String(value || ""),
    GeneratedImageHistory: {
      findOne() {
        return {
          lean: async () => ({
            imageUrl: "https://cdn.example.com/a.png",
            ossKey: "oss/a.png",
            imageStorageType: "oss",
          }),
        };
      },
    },
    sanitizeIsoDate: () => "",
    normalizeGeneratedImageStorageType: (value) => value,
    sanitizeGroupChatOssObjectKey: (value) => value,
    sanitizeGroupChatHttpUrl: (value) => value,
    buildGroupChatOssObjectUrl: (value) => `https://oss.example.com/${value}`,
    extractGeneratedImageDataBuffer: () => Buffer.alloc(0),
    normalizeGeneratedImageMimeType: () => "image/png",
    normalizeGeneratedImageStoreUrl: (value) => value,
    parseGeneratedImageDataUrl: () => null,
  };

  await getImageHistoryContentHandler(req, res, deps);
  assert.equal(res.redirectUrl, "https://cdn.example.com/a.png");
});

test("clearImageHistoryHandler and deleteImageHistoryItemHandler report delete counts", async () => {
  const req = { authUser: { _id: "u1" }, authStorageUserId: "u1", params: { imageId: "img-1" } };
  const clearRes = createResponseDouble();
  const deleteRes = createResponseDouble();
  const deps = {
    sanitizeId: (value) => String(value || ""),
    GeneratedImageHistory: {
      find() {
        return { lean: async () => [{ _id: "img-1", ossKey: "a" }] };
      },
      deleteMany: async () => ({ deletedCount: 1 }),
      findOneAndDelete: async () => ({ _id: "img-1", ossKey: "a" }),
    },
    deleteGeneratedImageHistoryOssObjects: async () => ({ deletedCount: 1, failedKeys: [] }),
  };

  await clearImageHistoryHandler(req, clearRes, deps);
  await deleteImageHistoryItemHandler(req, deleteRes, deps);

  assert.equal(clearRes.payload.deletedCount, 1);
  assert.equal(deleteRes.payload.deleted, true);
});
