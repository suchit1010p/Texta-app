import { Router } from "express";
import { createList, deleteList, deleteAllLists, getLists, updateList, getListById, generateUploadURLs } from "../controllers/list.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(verifyJWT);

// List routes
router.route("/").post(createList).get(getLists).delete(deleteAllLists);
router.delete("/all", deleteAllLists);

// Upload routes 
router.get("/upload", generateUploadURLs);

router.route("/:id").get(getListById).delete(deleteList).put(updateList);

export default router;