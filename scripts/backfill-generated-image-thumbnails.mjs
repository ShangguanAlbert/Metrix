import { createAppContext } from "../server/app/createAppContext.js";

function parseArgs(argv = []) {
  let limit = 0;
  let dryRun = false;

  argv.forEach((arg) => {
    const text = String(arg || "").trim();
    if (!text) return;
    if (text === "--dry-run") {
      dryRun = true;
      return;
    }
    if (text.startsWith("--limit=")) {
      const value = Number.parseInt(text.slice("--limit=".length), 10);
      if (Number.isFinite(value) && value > 0) {
        limit = value;
      }
    }
  });

  return { limit, dryRun };
}

async function main() {
  const { limit, dryRun } = parseArgs(process.argv.slice(2));
  const deps = createAppContext();
  const now = new Date();

  const thumbnailMissingQuery = {
    $and: [
      {
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: null },
          { expiresAt: { $gt: now } },
          { imageStorageType: "oss" },
        ],
      },
      {
        $or: [
          { thumbnailSize: { $exists: false } },
          { thumbnailSize: { $lte: 0 } },
          { thumbnailData: { $exists: false } },
          { thumbnailMimeType: { $exists: false } },
          { thumbnailMimeType: "" },
        ],
      },
    ],
  };

  const projection = {
    imageUrl: 1,
    ossKey: 1,
    imageData: 1,
    imageMimeType: 1,
    imageStorageType: 1,
    expiresAt: 1,
    thumbnailMimeType: 1,
    thumbnailSize: 1,
    thumbnailData: 1,
    createdAt: 1,
  };

  await deps.mongoose.connect(deps.mongoUri, {
    serverSelectionTimeoutMS: 6000,
  });
  console.log(`[thumbnail-backfill] Mongo connected: ${deps.mongoUri}`);

  try {
    const totalCandidates = await deps.GeneratedImageHistory.countDocuments(
      thumbnailMissingQuery,
    );
    console.log(
      `[thumbnail-backfill] candidates=${totalCandidates}${limit > 0 ? ` limit=${limit}` : ""}${dryRun ? " dry-run=1" : ""}`,
    );

    let query = deps.GeneratedImageHistory.find(
      thumbnailMissingQuery,
      projection,
    ).sort({ createdAt: -1, _id: -1 });
    if (limit > 0) {
      query = query.limit(limit);
    }

    const docs = await query.lean();
    const selectedCount = Array.isArray(docs) ? docs.length : 0;
    if (!selectedCount) {
      console.log("[thumbnail-backfill] no documents need backfill");
      return;
    }

    if (dryRun) {
      docs.slice(0, 10).forEach((doc, index) => {
        console.log(
          `[thumbnail-backfill] sample#${index + 1} imageId=${String(doc?._id || "")} createdAt=${String(doc?.createdAt || "")}`,
        );
      });
      console.log(
        `[thumbnail-backfill] dry run complete, selected=${selectedCount}`,
      );
      return;
    }

    let successCount = 0;
    let failedCount = 0;

    for (const doc of docs) {
      const imageId = String(doc?._id || "").trim();
      try {
        const payload = await deps.ensureGeneratedImageHistoryThumbnail(doc);
        if (payload?.data?.length) {
          successCount += 1;
          console.log(
            `[thumbnail-backfill] ok imageId=${imageId} bytes=${Number(payload.data.length || 0)}`,
          );
        } else {
          failedCount += 1;
          console.warn(
            `[thumbnail-backfill] skipped imageId=${imageId} reason=no-thumbnail`,
          );
        }
      } catch (error) {
        failedCount += 1;
        console.warn(
          `[thumbnail-backfill] failed imageId=${imageId} error=${error?.message || error}`,
        );
      }
    }

    console.log(
      `[thumbnail-backfill] complete selected=${selectedCount} success=${successCount} failed=${failedCount}`,
    );
  } finally {
    await deps.mongoose.disconnect().catch(() => {});
  }
}

main().catch((error) => {
  console.error("[thumbnail-backfill] fatal:", error);
  process.exit(1);
});
