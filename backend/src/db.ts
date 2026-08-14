import mongoose from "mongoose";

let cached: typeof mongoose | null = null;

export async function connectDb(): Promise<typeof mongoose> {
  if (cached && mongoose.connection.readyState === 1) {
    return cached;
  }
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set.");
  }
  mongoose.set("strictQuery", true);
  cached = await mongoose.connect(uri);
  return cached;
}

export function isObjectId(value: string): boolean {
  return mongoose.Types.ObjectId.isValid(value);
}
