import { User } from "../models/user.model.js";
import { ApiError } from "./ApiError.js";

const generateAccessAndRefereshTokens = async (userId) => {
    try {
        const user = await User.findById(userId)
        if (!user) {
            throw new ApiError(404, "User not found")
        }
        const accessToken = await user.generateAccessToken();
        const refreshToken = await user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        return { accessToken, refreshToken };


    }
    catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }
        throw new ApiError(500, "Token generation failed");
    }
}

export { generateAccessAndRefereshTokens }
