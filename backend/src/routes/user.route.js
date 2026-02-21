import { Router } from "express";
import { registerUser, loginUser, logoutUser, refreshAccessToken, getCurrentUser } from "../controllers/user.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router()

// User routes
router.route("/register").post(registerUser) 
router.route("/login").post(loginUser) 
router.route("/logout").post(verifyJWT, logoutUser)
router.route("/refreshToken").post(refreshAccessToken)
router.route("/profile").get(verifyJWT, getCurrentUser)

export default router;