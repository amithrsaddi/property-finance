import serverless from "serverless-http";
import { createApp } from "../../backend/dist/app.js";
import { connectDb } from "../../backend/dist/db.js";

const app = createApp();
const handle = serverless(app);

function rewritePath(path: string): string {
  return path.replace(/^\/\.netlify\/functions\/api/, "").replace(/^\/api/, "") || "/";
}

export const handler = async (event: { path?: string }, context: { callbackWaitsForEmptyEventLoop: boolean }) => {
  context.callbackWaitsForEmptyEventLoop = false;
  await connectDb();
  const path = rewritePath(event.path || "/");
  return handle({ ...event, path }, context);
};
