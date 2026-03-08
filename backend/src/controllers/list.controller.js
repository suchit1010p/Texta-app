import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js"
import { ApiError } from "../utils/ApiError.js";
import { List } from "../models/list.model.js";
import { generatePutPresignedUrl, deleteFromS3 } from "../utils/s3.js";

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

    try {
        await List.findByIdAndDelete({ _id: id, user: req.user._id });
    } catch (error) {
        throw new ApiError(500, "Failed to delete list");
    }

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
    await List.deleteMany({ user: req.user._id });

    return res.status(200).json(new ApiResponse(200, null, "All lists deleted successfully"));
});

const generateUploadURLs = asyncHandler(async (req, res) => {
    
    const { listid, fileNames } = req.body;


    if (!fileNames || !Array.isArray(fileNames) || fileNames.length === 0) {
        throw new ApiError(400, "fileNames must be a non-empty array");
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




export { createList, getLists, getListById, deleteList, updateList, deleteAllLists, generateUploadURLs };