import serverless from "serverless-http";
import { app } from "./src/app.js";
import connectDB from "./src/db/db.js";

let dbInitPromise = null;
const appHandler = serverless(app);

const ensureDbConnection = async () => {
    if (!dbInitPromise) {
        dbInitPromise = connectDB().catch((error) => {
            dbInitPromise = null;
            throw error;
        });
    }
    return dbInitPromise;
};

export const handler = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;
    await ensureDbConnection();
    return appHandler(event, context);
};
