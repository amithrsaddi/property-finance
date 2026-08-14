import dotenv from "dotenv";
import { connectDb } from "./db.js";
import { createApp } from "./app.js";

dotenv.config();

const port = process.env.PORT || 3000;

async function start(): Promise<void> {
  await connectDb();
  const app = createApp();
  app.listen(port, () => {
    console.log(`Backend running at http://localhost:${port}`);
  });
}

start().catch((error) => {
  console.error("Failed to start backend:", error);
  process.exit(1);
});
