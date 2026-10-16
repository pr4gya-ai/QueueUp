import mongoose from "mongoose";

const connectDB = async () => {
    try {
        mongoose.connection.on("connected", async () => {
            console.log("MongoDB connected successfully");
        });
        await mongoose.connect(process.env.MONGODB_URL!, {
            family: 4,
        });
    } catch (error) {
        console.error(`Error: ${(error as Error).message}`);
        process.exit(1);
    }
};

export default connectDB;