import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js"
import { ApiError } from "../utils/ApiError.js";
import { List } from "../models/list.model.js";
import { generatePutPresignedUrl, deleteFromS3 } from "../utils/s3.js";

const deleteListFilesFromS3 = async (urls = []) => {
    const fileUrls = Array.isArray(urls) ? urls.filter(Boolean) : [];
    if (fileUrls.length === 0) return;

    const deleteResults = await Promise.allSettled(
        fileUrls.map((fileUrl) => deleteFromS3(fileUrl))
    );

    const failedDeletions = deleteResults.filter(
        (result) => result.status === "rejected" || result.value === false
    );

    if (failedDeletions.length > 0) {
        throw new ApiError(500, "Failed to delete one or more files from S3");
    }
};

const createList = asyncHandler(async (req, res) => {
    const { text, description } = req.body;


    if (!text || !text.trim()) {
        throw new ApiError(400, "Text is required");
    }


    const newList = await List.create({
        user: req.user._id,
        text: text.trim(),
        description
    });

    return res.status(201).json(new ApiResponse(201, newList, "List created successfully"));
});

const getListById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const list = await List.findOne({ _id: id, user: req.user._id });

    if (!list) {
        throw new ApiError(404, "List not found");
    }

    return res.status(200).json(new ApiResponse(200, list, "List fetched successfully"));
});

const getLists = asyncHandler(async (req, res) => {
    const lists = await List.find({ user: req.user._id }).sort({ createdAt: -1 });

    return res.status(200).json(new ApiResponse(200, lists, "Lists fetched successfully"));
});

const deleteList = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const list = await List.findOne({ _id: id, user: req.user._id });
    if (!list) {
        throw new ApiError(404, "List not found");
    }

    await deleteListFilesFromS3(list.url);

    await List.deleteOne({ _id: list._id, user: req.user._id });

    return res.status(200).json(new ApiResponse(200, null, "List deleted successfully"));
});

const updateList = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { text, description, url } = req.body;

    if (text !== undefined && !text?.trim()) {
        throw new ApiError(400, "Text cannot be empty");
    }

    const list = await List.findOne({ _id: id, user: req.user._id });

    if (!list) {
        throw new ApiError(404, "List not found");
    }
    if (text !== undefined) list.text = text.trim();
    if (description !== undefined) list.description = description;
    if (url !== undefined) list.url = url;
    await list.save();

    return res.status(200).json(new ApiResponse(200, list, "List updated successfully"));
});

const deleteAllLists = asyncHandler(async (req, res) => {
    const lists = await List.find({ user: req.user._id }).select("url");
    const allUrls = lists.flatMap((list) => (Array.isArray(list.url) ? list.url : []));

    await deleteListFilesFromS3(allUrls);

    await List.deleteMany({ user: req.user._id });

    return res.status(200).json(new ApiResponse(200, null, "All lists deleted successfully"));
});

const deleteMultipleLists = asyncHandler(async (req, res) => {
    const { listIds } = req.body;

    if (!Array.isArray(listIds) || listIds.length === 0) {
        throw new ApiError(400, "listIds must be a non-empty array");
    }

    const normalizedIds = [...new Set(
        listIds
            .filter((id) => typeof id === "string")
            .map((id) => id.trim())
            .filter((id) => id)
    )];

    if (normalizedIds.length === 0) {
        throw new ApiError(400, "listIds must contain valid string IDs");
    }

    const invalidIds = normalizedIds.filter((id) => !/^[a-fA-F0-9]{24}$/.test(id));
    if (invalidIds.length > 0) {
        throw new ApiError(400, "listIds contains one or more invalid IDs");
    }

    const listsToDelete = await List.find({
        _id: { $in: normalizedIds },
        user: req.user._id
    }).select("url");

    const allUrls = listsToDelete.flatMap((list) => (Array.isArray(list.url) ? list.url : []));
    await deleteListFilesFromS3(allUrls);

    const result = await List.deleteMany({
        _id: { $in: normalizedIds },
        user: req.user._id
    });

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                requestedCount: normalizedIds.length,
                deletedCount: result.deletedCount ?? 0
            },
            "Selected lists deleted successfully"
        )
    );
});

const generateUploadURLs = asyncHandler(async (req, res) => {

    const listid = req.body?.listid ?? req.query?.listid;
    const rawFileNames = req.body?.fileNames ?? req.query?.fileNames;
    const fileNames = Array.isArray(rawFileNames)
        ? rawFileNames
        : typeof rawFileNames === "string"
            ? rawFileNames.split(",").map((name) => name.trim()).filter(Boolean)
            : [];


    if (!fileNames || !Array.isArray(fileNames) || fileNames.length === 0) {
        throw new ApiError(400, "fileNames must be a non-empty array");
    }

    if (!listid || typeof listid !== "string") {
        throw new ApiError(400, "listid is required");
    }

    const list = await List.findOne({ _id: listid, user: req.user._id });

    if (!list) {
        throw new ApiError(404, "List not found");
    }

    const presignedUrls = [];
    const urlsKeys = [];
    for (const fileName of fileNames) {
        const key = `files/${req.user._id}_${req.user.username}/${listid}/${Date.now()}_${fileName}`;
        const presignedUrl = await generatePutPresignedUrl(key).catch((error) => {
            console.error("Error generating presigned URL for file:", fileName, error);
            throw new ApiError(500, `Failed to generate presigned URL for file: ${fileName}`);
        });
        presignedUrls.push(presignedUrl);
        urlsKeys.push(key);
    }

    urlsKeys.forEach((key) => {
        list.url.push(key);
    });

    await list.save();

    return res.status(200).json(new ApiResponse(200, { presignedUrls, urlsKeys }, "Presigned URLs generated successfully"));
});

const updateListStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (status !== undefined && !status?.trim()) {
        throw new ApiError(400, "Status cannot be empty");
    }

    const list = await List.findOne({ _id: id, user: req.user._id });

    if (!list) {
        throw new ApiError(404, "List not found");
    }
    if (status !== undefined) list.status = status.trim();
    await list.save();

    return res.status(200).json(new ApiResponse(200, list, "List status updated successfully"));
});

// Helper: parse duration strings like "20s", "25m", "3h", "5d" into milliseconds
const parseDuration = (durationStr) => {
    if (!durationStr || typeof durationStr !== "string") {
        throw new ApiError(400, "Duration is required and must be a string (e.g. '20s', '25m', '3h', '5d')");
    }

    const match = durationStr.trim().match(/^(\d+)(s|m|h|d)$/i);
    if (!match) {
        throw new ApiError(400, "Invalid duration format. Use a number followed by s (seconds), m (minutes), h (hours), or d (days). Example: '20s', '25m', '3h', '5d'");
    }

    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    if (value <= 0) {
        throw new ApiError(400, "Duration must be a positive number");
    }

    const multipliers = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
    return value * multipliers[unit];
};

const scheduleDeleteList = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { duration } = req.body;

    const ms = parseDuration(duration);

    const list = await List.findOne({ _id: id, user: req.user._id });

    if (!list) {
        throw new ApiError(404, "List not found");
    }

    list.scheduledDeleteAt = new Date(Date.now() + ms);
    await list.save();

    return res.status(200).json(new ApiResponse(200, list, `List scheduled for deletion in ${duration}`));
});

const cancelScheduledDelete = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const list = await List.findOne({ _id: id, user: req.user._id });

    if (!list) {
        throw new ApiError(404, "List not found");
    }

    list.scheduledDeleteAt = null;
    await list.save();

    return res.status(200).json(new ApiResponse(200, list, "Scheduled deletion cancelled"));
});

export { createList, getLists, getListById, deleteList, updateList, deleteAllLists, deleteMultipleLists, generateUploadURLs, updateListStatus, scheduleDeleteList, cancelScheduledDelete };
