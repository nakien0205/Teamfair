import { supabase } from "@/lib/supabaseClient";

export type StorageBucket = "materials" | "evidence";

type BucketConfig = {
  maxBytes: number;
  allowedMimeTypes: Set<string>;
  allowedExtensions: Set<string>;
};

const MB = 1024 * 1024;

export const STORAGE_BUCKETS: Record<StorageBucket, BucketConfig> = {
  materials: {
    maxBytes: 25 * MB,
    allowedMimeTypes: new Set([
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain",
      "text/csv",
      "application/zip",
    ]),
    allowedExtensions: new Set([".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx", ".txt", ".csv", ".zip"]),
  },
  evidence: {
    maxBytes: 10 * MB,
    allowedMimeTypes: new Set(["image/png", "image/jpeg", "image/gif", "application/pdf", "text/plain"]),
    allowedExtensions: new Set([".png", ".jpg", ".jpeg", ".gif", ".pdf", ".txt"]),
  },
};

export type StorageValidationResult =
  | { valid: true; sanitizedName: string }
  | { valid: false; reason: "size" | "type" | "name"; message: string };

export type UploadedStorageFile = {
  bucket: StorageBucket;
  path: string;
  fileName: string;
  size: number;
};

export function sanitizeStorageFileName(fileName: string): string {
  const cleaned = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_");
  const fallback = cleaned || "upload";
  if (fallback.length <= 100) return fallback;

  const dotIndex = fallback.lastIndexOf(".");
  const extension = dotIndex > 0 ? fallback.slice(dotIndex) : "";
  const base = dotIndex > 0 ? fallback.slice(0, dotIndex) : fallback;
  return `${base.slice(0, 100 - extension.length)}${extension}`;
}

function fileExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : "";
}

export function validateStorageFile(bucket: StorageBucket, file: File): StorageValidationResult {
  const config = STORAGE_BUCKETS[bucket];
  const sanitizedName = sanitizeStorageFileName(file.name);
  const extension = fileExtension(sanitizedName);

  if (!sanitizedName || sanitizedName === "." || sanitizedName === "..") {
    return { valid: false, reason: "name", message: "Invalid file name." };
  }

  if (file.size > config.maxBytes) {
    return {
      valid: false,
      reason: "size",
      message: `File is too large. Max size is ${Math.round(config.maxBytes / MB)}MB.`,
    };
  }

  if (!config.allowedExtensions.has(extension) || (file.type && !config.allowedMimeTypes.has(file.type))) {
    return { valid: false, reason: "type", message: "File type is not supported." };
  }

  return { valid: true, sanitizedName };
}

export function buildStoragePath(groupId: string, userId: string, fileName: string): string {
  return `${groupId}/${userId}/${Date.now()}_${sanitizeStorageFileName(fileName)}`;
}

export async function uploadTeamFile(
  bucket: StorageBucket,
  groupId: string,
  userId: string,
  file: File,
): Promise<UploadedStorageFile> {
  const validation = validateStorageFile(bucket, file);
  if (!validation.valid) throw new Error(validation.message);

  const path = buildStoragePath(groupId, userId, validation.sanitizedName);
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (error) throw new Error(error.message);
  return { bucket, path, fileName: validation.sanitizedName, size: file.size };
}

export async function createSignedFileUrl(bucket: StorageBucket, path: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) throw new Error(error.message);
  if (!data?.signedUrl) throw new Error("Could not create a download link.");
  return data.signedUrl;
}

export async function deleteStorageFile(bucket: StorageBucket, path: string): Promise<boolean> {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) {
    console.warn("Failed to delete storage object:", error.message);
    return false;
  }
  return true;
}
