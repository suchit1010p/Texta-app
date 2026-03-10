import mongoose from "mongoose";

const connectDB = async () => {
    if (mongoose.connection.readyState === 1) {
        return mongoose.connection;
    }

    if (mongoose.connection.readyState === 2) {
        return mongoose.connection.asPromise();
    }

    try {
        const connectionInstance = await mongoose.connect(process.env.MONGODB_URL, {
            dbName: process.env.DB_NAME
        });
        console.log("MongoDB is connected");
        return connectionInstance;

    } catch (error) {
        console.log("mongoDB connection error:", error);
        throw error;
    }
};

export default connectDB;
