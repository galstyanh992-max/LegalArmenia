import { describe, it, expect } from "vitest";
import {
  COMPLAINT_MAX_BYTES,
  COMPLAINT_ACCEPT,
  getComplaintMime,
  isComplaintSupportedFile,
} from "./uploadPolicies";

const MB = 1024 * 1024;

function file(name: string, type: string, size: number): Pick<File, "type" | "name" | "size"> {
  return { name, type, size };
}

describe("Complaint upload centralized policy (F-02)", () => {
  it("advertises only the centralized complaint accept list", () => {
    expect(COMPLAINT_ACCEPT).toBe(".pdf,.jpg,.jpeg,.png,.txt,.md,.docx");
  });

  it("accepts TXT and MD as text under the centralized policy", () => {
    expect(getComplaintMime(file("notes.txt", "text/plain", 100))).toBe("text/plain");
    expect(getComplaintMime(file("notes.md", "text/markdown", 100))).toBe("text/markdown");
    expect(isComplaintSupportedFile(file("notes.txt", "text/plain", 100))).toBe(true);
    expect(isComplaintSupportedFile(file("notes.md", "text/markdown", 100))).toBe(true);
  });

  it("accepts PDF, JPG, PNG, DOCX within size limit", () => {
    expect(isComplaintSupportedFile(file("doc.pdf", "application/pdf", MB))).toBe(true);
    expect(isComplaintSupportedFile(file("photo.jpg", "image/jpeg", MB))).toBe(true);
    expect(isComplaintSupportedFile(file("photo.png", "image/png", MB))).toBe(true);
    expect(isComplaintSupportedFile(file("doc.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", MB))).toBe(true);
  });

  it("rejects files over 10MB even when type is supported", () => {
    expect(isComplaintSupportedFile(file("big.pdf", "application/pdf", 11 * MB))).toBe(false);
    expect(isComplaintSupportedFile(file("big.txt", "text/plain", 11 * MB))).toBe(false);
  });

  it("rejects unsupported types (TIFF, DOC, EXE, video) to prevent policy bypass", () => {
    expect(getComplaintMime(file("img.tiff", "image/tiff", 100))).toBeNull();
    expect(getComplaintMime(file("legacy.doc", "application/msword", 100))).toBeNull();
    expect(getComplaintMime(file("clip.mp4", "video/mp4", 100))).toBeNull();
    expect(getComplaintMime(file("payload.exe", "application/octet-stream", 100))).toBeNull();
    expect(isComplaintSupportedFile(file("img.tiff", "image/tiff", 100))).toBe(false);
  });

  it("enforces 10MB boundary inclusively", () => {
    expect(isComplaintSupportedFile(file("edge.pdf", "application/pdf", COMPLAINT_MAX_BYTES))).toBe(true);
  });
});
