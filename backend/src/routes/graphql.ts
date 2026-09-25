import { Router } from "express";
import { graphql } from "graphql";
import { requireAuth } from "../auth.js";
import { graphqlRoot, graphqlSchema } from "../graphql/schema.js";
import type { AuthedRequest } from "../types.js";

const router = Router();

router.post("/", requireAuth, async (req: AuthedRequest, res) => {
  const body = (req.body ?? {}) as {
    query?: unknown;
    variables?: Record<string, unknown> | null;
    operationName?: string | null;
  };
  if (typeof body.query !== "string" || !body.query.trim()) {
    return res.status(400).json({ message: "GraphQL query is required." });
  }

  const result = await graphql({
    schema: graphqlSchema,
    source: body.query,
    rootValue: graphqlRoot,
    variableValues: body.variables ?? undefined,
    operationName: body.operationName ?? undefined,
    contextValue: { userId: req.user!.id }
  });

  return res.json(result);
});

export default router;
