import { Router } from "express";
import { requireAuth } from "../auth.js";
import { decodeFileData, fileBuffer, guessMime, safeFilename, validateFile } from "../files.js";
import { DocumentFolder, Property, PropertyDocument } from "../models.js";
import { mapDocument } from "../serialize.js";
import type { AuthedRequest } from "../types.js";

const router = Router();
router.use(requireAuth);

function optionalDate(value: unknown): string | null {
  const raw = String(value || "").trim();
  return raw || null;
}

function parseValidity(
  body: Record<string, unknown>,
  existing?: { validFrom?: string | null; validUntil?: string | null }
): { validFrom: string | null; validUntil: string | null; error?: string } {
  const validFrom =
    body.validFrom !== undefined ? optionalDate(body.validFrom) : (existing?.validFrom ?? null);
  const validUntil =
    body.validUntil !== undefined ? optionalDate(body.validUntil) : (existing?.validUntil ?? null);
  if (validFrom && validUntil && validFrom > validUntil) {
    return { validFrom, validUntil, error: "Valid from must be on or before valid to." };
  }
  return { validFrom, validUntil };
}

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

async function resolveFolder(
  userId: string,
  folderIdRaw: unknown
): Promise<{ folderId: string | null; folderName: string | null; error?: string }> {
  const folderId = folderIdRaw ? String(folderIdRaw) : "";
  if (!folderId) {
    return { folderId: null, folderName: null };
  }
  const folder = await DocumentFolder.findOne({ _id: folderId, userId }).lean();
  if (!folder) {
    return { folderId: null, folderName: null, error: "Choose a valid folder." };
  }
  return { folderId: String(folder._id), folderName: folder.name };
}

async function extrasFor(
  rows: Array<{ propertyId?: unknown; folderId?: unknown }>
): Promise<{
  propertyName: (id: unknown) => string | null;
  folderName: (id: unknown) => string | null;
}> {
  const propertyIds = rows.filter((row) => row.propertyId).map((row) => String(row.propertyId));
  const folderIds = rows.filter((row) => row.folderId).map((row) => String(row.folderId));
  const [properties, folders] = await Promise.all([
    propertyIds.length ? Property.find({ _id: { $in: propertyIds } }).lean() : [],
    folderIds.length ? DocumentFolder.find({ _id: { $in: folderIds } }).lean() : []
  ]);
  const propertiesById = new Map(properties.map((property) => [String(property._id), property.name]));
  const foldersById = new Map(folders.map((folder) => [String(folder._id), folder.name]));
  return {
    propertyName: (id) => (id ? propertiesById.get(String(id)) ?? null : null),
    folderName: (id) => (id ? foldersById.get(String(id)) ?? null : null)
  };
}

router.get("/", async (req: AuthedRequest, res) => {
  const scope = String(req.query.scope || "all");
  const propertyId = req.query.propertyId ? String(req.query.propertyId) : undefined;
  const folderId = req.query.folderId ? String(req.query.folderId) : undefined;
  const filter: Record<string, unknown> = { userId: req.user!.id };
  if (scope === "property" || scope === "general") {
    filter.scope = scope;
  }
  if (propertyId) {
    filter.propertyId = propertyId;
  }
  if (folderId === "unfiled") {
    filter.folderId = null;
  } else if (folderId) {
    filter.folderId = folderId;
  }

  const rows = await PropertyDocument.find(filter).sort({ updatedAt: -1 }).lean();
  const names = await extrasFor(rows);

  return res.json({
    documents: rows.map((row) =>
      mapDocument(row, {
        propertyName: names.propertyName(row.propertyId),
        folderName: names.folderName(row.folderId)
      })
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
  const folder = await resolveFolder(req.user!.id, req.body?.folderId);
  if (folder.error) {
    return res.status(400).json({ message: folder.error });
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

  const validity = parseValidity(req.body || {});
  if (validity.error) {
    return res.status(400).json({ message: validity.error });
  }

  const created = await PropertyDocument.create({
    userId: req.user!.id,
    propertyId: linked.propertyId,
    folderId: folder.folderId,
    scope: linked.scope,
    name,
    validFrom: validity.validFrom,
    validUntil: validity.validUntil,
    important: Boolean(req.body?.important),
    originalFilename: safeFilename(originalFilename),
    mimeType,
    fileSize: fileData.length,
    fileData
  });

  return res.status(201).json({
    document: mapDocument(created.toObject(), {
      propertyName: linked.propertyName,
      folderName: folder.folderName
    }),
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

  let folderId = existing.folderId ? String(existing.folderId) : null;
  let folderName: string | null = null;
  if (req.body?.folderId !== undefined) {
    const folder = await resolveFolder(req.user!.id, req.body.folderId);
    if (folder.error) {
      return res.status(400).json({ message: folder.error });
    }
    folderId = folder.folderId;
    folderName = folder.folderName;
  } else if (folderId) {
    const folder = await DocumentFolder.findById(folderId).lean();
    folderName = folder?.name ?? null;
  }

  existing.name = name;
  const validity = parseValidity(req.body || {}, {
    validFrom: existing.validFrom ?? null,
    validUntil: existing.validUntil ?? null
  });
  if (validity.error) {
    return res.status(400).json({ message: validity.error });
  }
  existing.validFrom = validity.validFrom;
  existing.validUntil = validity.validUntil;
  existing.scope = linked.scope;
  existing.set("propertyId", linked.propertyId);
  existing.set("folderId", folderId);
  if (req.body?.important !== undefined) {
    existing.important = Boolean(req.body.important);
  }

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
    document: mapDocument(existing.toObject(), {
      propertyName: linked.propertyName,
      folderName
    }),
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
  const mime = guessMime(filename, existing.mimeType);
  const download = String(req.query.download || "") === "1";
  res.setHeader("Content-Type", mime);
  res.setHeader("Content-Disposition", `${download ? "attachment" : "inline"}; filename="${filename}"`);
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
