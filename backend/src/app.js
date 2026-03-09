import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { scheduledDeleteMiddleware } from "./utils/scheduledDeleteCleanup.js";

const app = express();

const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
    : true;

app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(cookieParser());

// Scheduled delete cleanup — runs in background on incoming requests (throttled)
app.use(scheduledDeleteMiddleware);

import authRoutes from "./routes/user.route.js";
import listRoutes from "./routes/list.route.js";

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/lists", listRoutes);

export { app };