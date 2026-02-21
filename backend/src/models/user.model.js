import mongoose from 'mongoose';
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
    },
    refreshToken: {
        type: String,
        default: null,
        select: false
    },
}, {
    timestamps: true,
});


userSchema.pre("save", async function () {

    if (!this.isModified("password")) return;

    this.password = await bcrypt.hash(this.password, 10)

})

userSchema.methods.isPasswordCorrect = async function (password) {
    return bcrypt.compare(password, this.password);
}

userSchema.methods.generateAccessToken = async function () {
    return jwt.sign(
        { 
            _id: this._id,
            email: this.email,
            username: this.username
        }, 
        process.env.ACCESS_TOKEN_SECRET, 
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY
        }
    );
}

userSchema.methods.generateRefreshToken = async function () {
    return jwt.sign(
        {
            _id: this._id,
            email: this.email,
            username: this.username
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY
        }
    )
}

export const User = mongoose.model("User", userSchema);