import mongoose from "mongoose";

const listSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        text: {
            type: String,
            required: true,
        },
        description: {
            type: String,
        },
        url: {
            type: [String],
            default: []
        },
        status: {
            type: String,
            enum: ["pending", "in-progress", "done"],
            default: "pending"
        },
        scheduledDeleteAt: {
            type: Date,
            default: null
        }
    }, { timestamps: true }
);

// Note: No TTL index here — deletion is handled by the cleanup job
// so that S3 files can be cleaned up before the document is removed.

export const List = mongoose.model("List", listSchema);