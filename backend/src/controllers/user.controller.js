import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import jwt from "jsonwebtoken";
import { ApiResponse } from "../utils/ApiResponse.js"
import { ApiError } from "../utils/ApiError.js";
import { generateAccessAndRefereshTokens } from "../utils/GenerateToken.js";

const getCookieMaxAges = () => {
    const accessTokenCookieDays = Number(process.env.ACCESS_TOKEN_COOKIE_DAYS || 1);
    const refreshTokenCookieDays = Number(process.env.REFRESH_TOKEN_COOKIE_DAYS || 90);

    return {
        accessTokenMaxAge: accessTokenCookieDays * 24 * 60 * 60 * 1000,
        refreshTokenMaxAge: refreshTokenCookieDays * 24 * 60 * 60 * 1000
    };
};

const getCookieOptions = () => {
    const isProduction = process.env.NODE_ENV === "production";
    const { accessTokenMaxAge, refreshTokenMaxAge } = getCookieMaxAges();

    return {
        access: {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? "none" : "lax",
            maxAge: accessTokenMaxAge
        },
        refresh: {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? "none" : "lax",
            maxAge: refreshTokenMaxAge
        }
    };
};

const getClearCookieOptions = () => {
    const isProduction = process.env.NODE_ENV === "production";

    return {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax"
    };
};

// register user
const registerUser = asyncHandler(async (req, res) => {
    let { username, email, password } = req.body;

    username = username?.trim();
    email = email?.trim();

    if (
        [username, email, password].some((field) => !field?.trim())
    ) {
        throw new ApiError(400, "All fields are required")
    }


    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
        throw new ApiError(400, "User with the same email or username already exists");
    }

    const user = await User.create({ username, email, password });

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    const { accessToken, refreshToken } = await generateAccessAndRefereshTokens(user._id)

    const options = getCookieOptions();

    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    // await sendRegistrationEmail(createdUser.email, createdUser.username);



    return res
        .status(201)
        .cookie("accessToken", accessToken, options.access)
        .cookie("refreshToken", refreshToken, options.refresh)
        .json(
            new ApiResponse(
                201,
                { user: createdUser, accessToken, refreshToken },
                "User registered successfully"
            )
        );
});

// login user
const loginUser = asyncHandler(async (req, res) => {
    let { username, email, password } = req.body;

    username = username?.trim();
    email = email?.trim();

    if (
        [username || email, password].some((field) => !field?.trim())
    ) {
        throw new ApiError(400, "All fields are required")
    }


    const user = await User.findOne({ $or: [{ email }, { username }] });

    if (!user) {
        throw new ApiError(400, "Invalid username/email or password");
    }

    const isPasswordValid = await user.isPasswordCorrect(password);

    if (!isPasswordValid) {
        throw new ApiError(400, "Invalid username/email or password");
    }

    const safeUser = await User.findById(user._id).select("-password -refreshToken");

    const { accessToken, refreshToken } = await generateAccessAndRefereshTokens(safeUser._id);

    const options = getCookieOptions();

    return res
        .status(200)
        .cookie("accessToken", accessToken, options.access)
        .cookie("refreshToken", refreshToken, options.refresh)
        .json(
            new ApiResponse(
                200,
                {
                    user: safeUser, accessToken, refreshToken
                },
                "User logged in successfully"
            )
        );

});

// logout user
const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: null
            }
        }
    )

    const options = getClearCookieOptions();

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(
            new ApiResponse(200, {}, "User logged out Successfully")
        )
})

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized request");
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        );

        const user = await User.findById(decodedToken?._id).select("+refreshToken");

        if (!user) {
            throw new ApiError(401, "Invalid refresh token");
        }

        if (incomingRefreshToken !== user.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used");
        }

        const { accessToken, refreshToken: newRefreshToken } = await generateAccessAndRefereshTokens(user._id);
        const safeUser = await User.findById(user._id).select("-password -refreshToken");

        const options = getCookieOptions();

        return res
            .status(200)
            .cookie("accessToken", accessToken, options.access)
            .cookie("refreshToken", newRefreshToken, options.refresh)
            .json(
                new ApiResponse(
                    200,
                    { accessToken, refreshToken: newRefreshToken, user: safeUser },
                    "Access token refreshed successfully"
                )
            );
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token");
    }
});

const getCurrentUser = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user?._id).select("-password");

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, user, "User profile fetched successfully"));
})


export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    getCurrentUser
}