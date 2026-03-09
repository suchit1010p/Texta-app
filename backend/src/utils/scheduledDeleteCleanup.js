import { List } from "../models/list.model.js";
import { deleteFromS3 } from "./s3.js";

const THROTTLE_MS = 60 * 1000; // Only check once per 60 seconds
let lastRunTime = 0;

const runCleanup = async () => {
    try {
        const expiredLists = await List.find({
            scheduledDeleteAt: { $ne: null, $lte: new Date() }
        });

        if (expiredLists.length === 0) return;

        console.log(`[Scheduled Delete] Found ${expiredLists.length} expired list(s). Cleaning up...`);

        for (const list of expiredLists) {
            // Delete all S3 files associated with this list
            if (list.url && list.url.length > 0) {
                for (const fileKey of list.url) {
                    try {
                        await deleteFromS3(fileKey);
                        console.log(`[Scheduled Delete] Deleted S3 file: ${fileKey}`);
                    } catch (err) {
                        console.error(`[Scheduled Delete] Failed to delete S3 file: ${fileKey}`, err);
                    }
                }
            }

            // Delete the list document
            await List.findByIdAndDelete(list._id);
            console.log(`[Scheduled Delete] Deleted list: ${list._id} (text: "${list.text}")`);
        }
    } catch (error) {
        console.error("[Scheduled Delete] Cleanup job error:", error);
    }
};

// Express middleware — runs cleanup in the background on incoming requests
// Throttled to execute at most once every 60 seconds
export const scheduledDeleteMiddleware = (req, res, next) => {
    const now = Date.now();
    if (now - lastRunTime >= THROTTLE_MS) {
        lastRunTime = now;
        // Run cleanup in background, don't block the request
        runCleanup().catch(() => { });
    }
    next();
};
