import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { getFileExtension, normalizeCaseFileContentType } from "@/lib/uploadPolicies";

type CaseFile = Database["public"]["Tables"]["case_files"]["Row"];

interface UploadCaseFileOptions {
  caseId: string;
  file: File;
  userId: string;
  storagePath?: string;
  filename?: string;
  contentType?: string;
}

export async function computeSHA256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function getNextCaseFileVersion(caseId: string, hash: string): Promise<number> {
  const { data: existingFiles } = await supabase
    .from("case_files")
    .select("version")
    .eq("case_id", caseId)
    .order("version", { ascending: false })
    .limit(1);

  return existingFiles && existingFiles.length > 0 ? existingFiles[0].version + 1 : 1;
}

export async function uploadCaseFileWithMetadata({
  caseId,
  file,
  userId,
  storagePath,
  filename,
  contentType,
}: UploadCaseFileOptions): Promise<{ fileRecord: CaseFile; storagePath: string }> {
  const fileExt = getFileExtension(file.name);
  const generatedName = filename || `${crypto.randomUUID()}.${fileExt}`;
  const finalStoragePath = storagePath || `${caseId}/${generatedName}`;
  const finalContentType = contentType || normalizeCaseFileContentType(file);
  const hash = await computeSHA256(file);
  const version = await getNextCaseFileVersion(caseId, hash);
  let uploaded = false;

  if (!storagePath) {
    const { error: uploadError } = await supabase.storage
      .from("case-files")
      .upload(finalStoragePath, file, { contentType: finalContentType });

    if (uploadError) throw uploadError;
    uploaded = true;
  }

  const { data, error: dbError } = await supabase
    .from("case_files")
    .insert({
      case_id: caseId,
      filename: generatedName,
      original_filename: file.name,
      storage_path: finalStoragePath,
      file_type: finalContentType,
      file_size: file.size,
      version,
      uploaded_by: userId,
    })
    .select()
    .single();

  if (dbError) {
    if (uploaded || storagePath) {
      await supabase.storage.from("case-files").remove([finalStoragePath]);
    }
    throw dbError;
  }

  return { fileRecord: data as CaseFile, storagePath: finalStoragePath };
}

export async function rollbackCaseFile(fileId: string | null, storagePath: string | null): Promise<void> {
  if (fileId) {
    const { error } = await supabase.from("case_files").delete().eq("id", fileId);
    if (error) {
      console.warn("Case file rollback DB cleanup failed:", { fileId });
    }
  }

  if (storagePath) {
    const { error } = await supabase.storage.from("case-files").remove([storagePath]);
    if (error) {
      console.warn("Case file rollback storage cleanup failed:", { storagePath });
    }
  }
}
