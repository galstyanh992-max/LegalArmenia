export const MB = 1024 * 1024;

export const CASE_FILE_MAX_BYTES = 50 * MB;
export const AUTOFILL_MAX_BYTES = 15 * MB;
export const PDF_OCR_MAX_BYTES = 15 * MB;
export const AUDIO_TRANSCRIPTION_MAX_BYTES = 25 * MB;

export const CASE_FILE_ACCEPT = ".pdf,.doc,.docx,.jpg,.jpeg,.png,.tiff,.tif,.mp3,.wav,.m4a,.ogg";
export const AUTOFILL_ACCEPT = ".pdf,.jpg,.jpeg,.png,.tiff,.tif";
export const PDF_OCR_ACCEPT = ".pdf,.jpg,.jpeg,.png,.tiff,.tif";
export const AUDIO_TRANSCRIPTION_ACCEPT = ".mp3,.wav,.m4a,.ogg";

export const AUTOFILL_SUPPORTED_LABEL = "PDF, JPG, PNG, TIFF (max 15MB)";
export const PDF_OCR_SUPPORTED_LABEL = "PDF, JPG, PNG, TIFF (max 15MB)";
export const AUDIO_TRANSCRIPTION_SUPPORTED_LABEL = "MP3, WAV, M4A, OGG (max 25MB)";
export const CASE_FILE_SUPPORTED_LABEL = "PDF, DOC, DOCX, JPG, PNG, TIFF, MP3, WAV, M4A, OGG";

const PDF_MIME = "application/pdf";
const IMAGE_MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  tif: "image/tiff",
  tiff: "image/tiff",
};

const AUDIO_MIME_BY_EXT: Record<string, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
};

const AUDIO_MIME_NORMALIZATION: Record<string, string> = {
  "audio/mpeg": "audio/mpeg",
  "audio/mp3": "audio/mpeg",
  "audio/wav": "audio/wav",
  "audio/x-wav": "audio/wav",
  "audio/wave": "audio/wav",
  "audio/mp4": "audio/mp4",
  "audio/x-m4a": "audio/mp4",
  "audio/m4a": "audio/mp4",
  "audio/ogg": "audio/ogg",
};

export function getFileExtension(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() || "";
}

/**
 * Storage object keys only tolerate a narrow ASCII charset. A user-controlled
 * extension (non-ASCII, spaces, separators) must never reach the key — it
 * either 400s at the Storage API or tampers with the intended path shape.
 */
export function sanitizeStorageExtension(fileName: string, fallback = "bin"): string {
  const raw = getFileExtension(fileName).replace(/[^a-z0-9]/g, "");
  return raw.length > 0 && raw.length <= 10 ? raw : fallback;
}

/** Deterministic, non-user-controlled path for temporary complaint uploads. */
export function buildComplaintStoragePath(userId: string, fileName: string): string {
  return `${userId}/complaints/${Date.now()}-${Math.random().toString(36).slice(2)}.${sanitizeStorageExtension(fileName)}`;
}

/** Canonical extension for a normalized audio MIME — never taken from the filename. */
export const AUDIO_EXT_BY_MIME: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/mp4": "m4a",
  "audio/ogg": "ogg",
};

export function formatMaxBytes(bytes: number): string {
  return `${Math.floor(bytes / MB)}MB`;
}

export function normalizeCaseFileContentType(file: Pick<File, "type" | "name">): string {
  const audioType = getAudioTranscriptionMime(file);
  if (audioType) return audioType;

  const extension = getFileExtension(file.name);
  if (extension === "pdf") return PDF_MIME;
  if (extension === "doc") return "application/msword";
  if (extension === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (IMAGE_MIME_BY_EXT[extension]) return IMAGE_MIME_BY_EXT[extension];

  return file.type || "application/octet-stream";
}

export function getAutofillMime(file: Pick<File, "type" | "name">): string | null {
  const extension = getFileExtension(file.name);
  const type = file.type.toLowerCase();

  if (extension === "pdf" || type === PDF_MIME) return PDF_MIME;
  if (IMAGE_MIME_BY_EXT[extension]) return IMAGE_MIME_BY_EXT[extension];
  if (type === "image/jpeg" || type === "image/png" || type === "image/tiff") return type;

  return null;
}

export function isAutofillSupportedFile(file: Pick<File, "type" | "name" | "size">): boolean {
  return file.size <= AUTOFILL_MAX_BYTES && getAutofillMime(file) !== null;
}

export function getPdfOcrMime(file: Pick<File, "type" | "name">): string | null {
  return getAutofillMime(file);
}

export function isPdfOcrSupportedFile(file: Pick<File, "type" | "name" | "size">): boolean {
  return file.size <= PDF_OCR_MAX_BYTES && getPdfOcrMime(file) !== null;
}

export function getAudioTranscriptionMime(file: Pick<File, "type" | "name">): string | null {
  const extension = getFileExtension(file.name);
  const normalizedByType = AUDIO_MIME_NORMALIZATION[file.type.toLowerCase()];
  const normalizedByExt = AUDIO_MIME_BY_EXT[extension];

  if (normalizedByExt && (!normalizedByType || normalizedByExt === normalizedByType)) {
    return normalizedByExt;
  }

  return normalizedByType && Object.values(AUDIO_MIME_BY_EXT).includes(normalizedByType)
    ? normalizedByType
    : null;
}

export function isAudioTranscriptionSupportedFile(file: Pick<File, "type" | "name" | "size">): boolean {
  return file.size <= AUDIO_TRANSCRIPTION_MAX_BYTES && getAudioTranscriptionMime(file) !== null;
}

export const COMPLAINT_MAX_BYTES = 10 * MB;
export const COMPLAINT_ACCEPT = ".pdf,.jpg,.jpeg,.png,.txt,.md,.docx";
export const COMPLAINT_SUPPORTED_LABEL = "PDF, JPG, PNG, TXT, MD, DOCX (max 10MB)";

const COMPLAINT_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png"]);

export function getComplaintMime(file: Pick<File, "type" | "name">): string | null {
  const extension = getFileExtension(file.name);
  const type = file.type.toLowerCase();

  if (extension === "txt" || extension === "md" || type === "text/plain" || type === "text/markdown") {
    return type || (extension === "md" ? "text/markdown" : "text/plain");
  }
  if (extension === "pdf" || type === "application/pdf") return "application/pdf";
  if (extension === "docx" || type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (COMPLAINT_IMAGE_EXTENSIONS.has(extension)) return IMAGE_MIME_BY_EXT[extension] || type;
  if (type === "image/jpeg" || type === "image/png") return type;

  return null;
}

export function isComplaintSupportedFile(file: Pick<File, "type" | "name" | "size">): boolean {
  return file.size <= COMPLAINT_MAX_BYTES && getComplaintMime(file) !== null;
}
