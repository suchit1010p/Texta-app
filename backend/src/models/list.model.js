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
        }
    }, { timestamps: true }
);

export const List = mongoose.model("List", listSchema);