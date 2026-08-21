import serverless from "serverless-http";
import { createApp } from "../../backend/dist/app.js";
import { connectDb } from "../../backend/dist/db.js";

const app = createApp();
const handle = serverless(app, {
  binary: [
    "application/octet-stream",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/*"
  ]
});

function rewritePath(path: string): string {
  return path.replace(/^\/\.netlify\/functions\/api/, "").replace(/^\/api/, "") || "/";
}

type LambdaEvent = {
  path?: string;
  rawPath?: string;
  requestPath?: string;
  body?: string | object | null;
  isBase64Encoded?: boolean;
  requestContext?: {
    http?: { path?: string };
  };
};

export const handler = async (
  event: LambdaEvent,
  context: { callbackWaitsForEmptyEventLoop: boolean }
) => {
  context.callbackWaitsForEmptyEventLoop = false;
  try {
    await connectDb();
    const path = rewritePath(event.rawPath || event.path || "/");
    if (event.body && typeof event.body === "object") {
      event.body = JSON.stringify(event.body);
      event.isBase64Encoded = false;
    }
    return await handle(
      {
        ...event,
        path,
        rawPath: path,
        requestPath: path
      },
      context
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    console.error(error);
    return {
      statusCode: message.includes("MONGODB_URI") ? 500 : 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message })
    };
  }
};
