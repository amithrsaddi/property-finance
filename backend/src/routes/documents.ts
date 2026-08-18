import { Router } from "express";
import { requireAuth } from "../auth.js";
import { decodeFileData, fileBuffer, safeFilename, validateFile } from "../files.js";
import { Property, PropertyDocument } from "../models.js";
import { mapDocument } from "../serialize.js";
import type { AuthedRequest } from "../types.js";

const router = Router();
router.use(requireAuth);

async function resolveScope(
  userId: string,
  propertyIdRaw: unknown
): Promise<{ scope: "property" | "general"; propertyId: string | null; propertyName: string | null; error?: string }> {
  const propertyId = propertyIdRaw ? String(propertyIdRaw) : "";
  if (!propertyId) {
    return { scope: "general", propertyId: null, propertyName: null };
  }
  const property = await Property.findOne({ _id: propertyId, userId }).lean();
  if (!property) {
    return { scope: "general", propertyId: null, propertyName: null, error: "Choose a valid property, or General." };
  }
  return { scope: "property", propertyId: String(property._id), propertyName: property.name };
}

router.get("/", async (req: AuthedRequest, res) => {
  const scope = String(req.query.scope || "all");
  const propertyId = req.query.propertyId ? String(req.query.propertyId) : undefined;
  const filter: Record<string, unknown> = { userId: req.user!.id };
  if (scope === "property" || scope === "general") {
    filter.scope = scope;
  }
  if (propertyId) {
    filter.propertyId = propertyId;
  }

  const rows = await PropertyDocument.find(filter).sort({ createdAt: -1 }).lean();
  const propertyIds = rows.filter((row) => row.propertyId).map((row) => String(row.propertyId));
  const properties = await Property.find({ _id: { $in: propertyIds } }).lean();
  const nameById = new Map(properties.map((property) => [String(property._id), property.name]));

  return res.json({
    documents: rows.map((row) =>
      mapDocument(row, row.propertyId ? nameById.get(String(row.propertyId)) ?? null : null)
    )
  });
});

router.post("/", async (req: AuthedRequest, res) => {
  const name = String(req.body?.name || "").trim();
  if (!name) {
    return res.status(400).json({ message: "Document name is required." });
  }

  const linked = await resolveScope(req.user!.id, req.body?.propertyId);
  if (linked.error) {
    return res.status(400).json({ message: linked.error });
  }

  const originalFilename = String(req.body?.originalFilename || req.body?.fileName || "document");
  const mimeType = String(req.body?.mimeType || "application/octet-stream");
  const fileData = decodeFileData(req.body?.fileData);
  if (!fileData) {
    return res.status(400).json({ message: "Upload a document file." });
  }
  const fileError = validateFile(originalFilename, mimeType, fileData.length);
  if (fileError) {
    return res.status(400).json({ message: fileError });
  }

  const created = await PropertyDocument.create({
    userId: req.user!.id,
    propertyId: linked.propertyId,
    scope: linked.scope,
    name,
    validUntil: String(req.body?.validUntil || "") || null,
    originalFilename: safeFilename(originalFilename),
    mimeType,
    fileSize: fileData.length,
    fileData
  });

  return res.status(201).json({
    document: mapDocument(created.toObject(), linked.propertyName),
    message: "Document saved."
  });
});

router.put("/:id", async (req: AuthedRequest, res) => {
  const existing = await PropertyDocument.findOne({ _id: req.params.id, userId: req.user!.id });
  if (!existing) {
    return res.status(404).json({ message: "Document not found." });
  }

  const name = String(req.body?.name ?? existing.name).trim();
  if (!name) {
    return res.status(400).json({ message: "Document name is required." });
  }

  const linked = await resolveScope(
    req.user!.id,
    req.body?.propertyId !== undefined ? req.body.propertyId : existing.propertyId
  );
  if (linked.error) {
    return res.status(400).json({ message: linked.error });
  }

  existing.name = name;
  existing.validUntil =
    req.body?.validUntil !== undefined ? String(req.body.validUntil || "") || null : existing.validUntil;
  existing.scope = linked.scope;
  existing.set("propertyId", linked.propertyId);

  const fileData = decodeFileData(req.body?.fileData);
  if (fileData) {
    const originalFilename = String(req.body?.originalFilename || req.body?.fileName || existing.originalFilename);
    const mimeType = String(req.body?.mimeType || existing.mimeType);
    const fileError = validateFile(originalFilename, mimeType, fileData.length);
    if (fileError) {
      return res.status(400).json({ message: fileError });
    }
    existing.originalFilename = safeFilename(originalFilename);
    existing.mimeType = mimeType;
    existing.fileSize = fileData.length;
    existing.fileData = fileData;
  }

  await existing.save();
  return res.json({
    document: mapDocument(existing.toObject(), linked.propertyName),
    message: "Document updated."
  });
});

router.get("/:id/file", async (req: AuthedRequest, res) => {
  const existing = await PropertyDocument.findOne({ _id: req.params.id, userId: req.user!.id }).select(
    "+fileData name originalFilename mimeType"
  );
  if (!existing?.fileData) {
    return res.status(404).json({ message: "Document file not found." });
  }

  const filename = safeFilename(String(existing.originalFilename || existing.name || "document"));
  const payload = fileBuffer(existing.fileData);
  res.setHeader("Content-Type", existing.mimeType || "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Cache-Control", "private, no-store");
  return res.send(payload);
});

router.delete("/:id", async (req: AuthedRequest, res) => {
  const result = await PropertyDocument.deleteOne({ _id: req.params.id, userId: req.user!.id });
  if (!result.deletedCount) {
    return res.status(404).json({ message: "Document not found." });
  }
  return res.json({ message: "Document deleted." });
});

export default router;
