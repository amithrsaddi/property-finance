import { Router } from "express";
import { requireAuth } from "../auth.js";
import { DocumentFolder, PropertyDocument } from "../models.js";
import { mapFolder } from "../serialize.js";
import type { AuthedRequest } from "../types.js";

const router = Router();
router.use(requireAuth);

function parentKey(id: unknown): string {
  return id ? String(id) : "";
}

async function loadFolders(userId: string) {
  const folders = await DocumentFolder.find({ userId }).sort({ name: 1 }).lean();
  const files = await PropertyDocument.find({ userId }).select("folderId").lean();
  const fileCount = new Map<string, number>();
  for (const file of files) {
    const key = parentKey(file.folderId);
    fileCount.set(key, (fileCount.get(key) || 0) + 1);
  }
  const folderCount = new Map<string, number>();
  for (const folder of folders) {
    const key = parentKey(folder.parentId);
    folderCount.set(key, (folderCount.get(key) || 0) + 1);
  }
  return folders.map((folder) =>
    mapFolder(folder, {
      fileCount: fileCount.get(String(folder._id)) || 0,
      folderCount: folderCount.get(String(folder._id)) || 0
    })
  );
}

async function childrenByParent(userId: string): Promise<Map<string, string[]>> {
  const folders = await DocumentFolder.find({ userId }).select("_id parentId").lean();
  const map = new Map<string, string[]>();
  for (const folder of folders) {
    const key = parentKey(folder.parentId);
    const list = map.get(key) || [];
    list.push(String(folder._id));
    map.set(key, list);
  }
  return map;
}

async function descendantIds(userId: string, rootId: string): Promise<string[]> {
  const children = await childrenByParent(userId);
  const out: string[] = [];
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    out.push(id);
    stack.push(...(children.get(id) || []));
  }
  return out;
}

async function resolveParent(
  userId: string,
  parentIdRaw: unknown
): Promise<{ parentId: string | null; error?: string }> {
  const parentId = parentIdRaw ? String(parentIdRaw) : "";
  if (!parentId) {
    return { parentId: null };
  }
  const parent = await DocumentFolder.findOne({ _id: parentId, userId }).lean();
  if (!parent) {
    return { parentId: null, error: "Choose a valid parent folder." };
  }
  return { parentId: String(parent._id) };
}

router.get("/", async (req: AuthedRequest, res) => {
  return res.json({ folders: await loadFolders(req.user!.id) });
});

router.post("/", async (req: AuthedRequest, res) => {
  const name = String(req.body?.name || "").trim();
  if (!name) {
    return res.status(400).json({ message: "Folder name is required." });
  }
  const parent = await resolveParent(req.user!.id, req.body?.parentId);
  if (parent.error) {
    return res.status(400).json({ message: parent.error });
  }

  const created = await DocumentFolder.create({
    userId: req.user!.id,
    parentId: parent.parentId,
    name
  });

  return res.status(201).json({
    folder: mapFolder(created.toObject(), { fileCount: 0, folderCount: 0 }),
    message: "Folder created."
  });
});

router.put("/:id", async (req: AuthedRequest, res) => {
  const existing = await DocumentFolder.findOne({ _id: req.params.id, userId: req.user!.id });
  if (!existing) {
    return res.status(404).json({ message: "Folder not found." });
  }

  const name = String(req.body?.name ?? existing.name).trim();
  if (!name) {
    return res.status(400).json({ message: "Folder name is required." });
  }

  let parentId = existing.parentId ? String(existing.parentId) : null;
  if (req.body?.parentId !== undefined) {
    const parent = await resolveParent(req.user!.id, req.body.parentId);
    if (parent.error) {
      return res.status(400).json({ message: parent.error });
    }
    parentId = parent.parentId;
  }

  if (parentId && parentId === String(existing._id)) {
    return res.status(400).json({ message: "A folder cannot be placed inside itself." });
  }
  if (parentId) {
    const descendants = await descendantIds(req.user!.id, String(existing._id));
    if (descendants.includes(parentId)) {
      return res.status(400).json({ message: "A folder cannot be moved into one of its subfolders." });
    }
  }

  existing.name = name;
  existing.set("parentId", parentId);
  await existing.save();

  const folders = await loadFolders(req.user!.id);
  const mapped = folders.find((folder) => folder.id === String(existing._id));
  return res.json({
    folder: mapped,
    message: "Folder updated."
  });
});

router.delete("/:id", async (req: AuthedRequest, res) => {
  const existing = await DocumentFolder.findOne({ _id: req.params.id, userId: req.user!.id }).lean();
  if (!existing) {
    return res.status(404).json({ message: "Folder not found." });
  }

  const ids = await descendantIds(req.user!.id, String(existing._id));
  await PropertyDocument.deleteMany({ userId: req.user!.id, folderId: { $in: ids } });
  await DocumentFolder.deleteMany({ userId: req.user!.id, _id: { $in: ids } });
  return res.json({ message: "Folder deleted." });
});

export default router;
