import {
  assert,
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL") ?? "";
const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const canRun = url.length > 0 && publishableKey.length > 0 &&
  serviceKey.length > 0;

if (canRun) {
  const hostname = new URL(url).hostname;
  if (hostname !== "127.0.0.1" && hostname !== "localhost") {
    throw new Error("Local Storage matrix refuses a non-local Supabase URL");
  }
}

const clientOptions = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
};

type TestUser = {
  id: string;
  client: ReturnType<typeof createClient>;
};

Deno.test({
  name: "local Storage matrix enforces case membership and private boundaries",
  ignore: !canRun,
  async fn() {
    const service = createClient(url, serviceKey, clientOptions);
    const anon = createClient(url, publishableKey, clientOptions);
    const marker = crypto.randomUUID();
    const users: TestUser[] = [];
    let caseId: string | undefined;
    let objectPath: string | undefined;
    let fileId: string | undefined;
    let transcriptionId: string | undefined;

    async function createUser(label: string, role: "lawyer" | "client") {
      const email = `${label}-${marker}@example.test`;
      const password = `Local-${label}-${marker}-Aa1!`;
      const { data: created, error: createError } = await service.auth.admin
        .createUser({ email, password, email_confirm: true });
      assertEquals(createError, null);
      const id = created.user?.id;
      assertExists(id);
      if (role === "lawyer") {
        const { error: roleError } = await service.rpc("admin_set_user_role", {
          p_user_id: id,
          p_role: "lawyer",
        });
        assertEquals(roleError, null);
      }
      const client = createClient(url, publishableKey, clientOptions);
      const { error: signInError } = await client.auth.signInWithPassword({
        email,
        password,
      });
      assertEquals(signInError, null);
      const user = { id, client };
      users.push(user);
      return user;
    }

    try {
      const lawyer = await createUser("storage-lawyer", "lawyer");
      const member = await createUser("storage-member", "client");
      const outsider = await createUser("storage-outsider", "client");

      const { data: caseRows, error: caseError } = await lawyer.client
        .from("cases")
        .insert({ title: `Storage case ${marker}`, lawyer_id: lawyer.id })
        .select("id");
      assertEquals(caseError, null);
      caseId = caseRows?.[0]?.id as string | undefined;
      assertExists(caseId);

      const { error: memberError } = await service.from("case_members").insert({
        case_id: caseId,
        user_id: member.id,
        case_role: "client",
      });
      assertEquals(memberError, null);

      objectPath = `${caseId}/${marker}.txt`;
      const payload = new TextEncoder().encode("synthetic local fixture");
      const { error: uploadError } = await member.client.storage
        .from("case-files")
        .upload(objectPath, payload, { contentType: "text/plain" });
      assertEquals(uploadError, null);

      const { data: ownDownload, error: ownDownloadError } = await member.client
        .storage.from("case-files").download(objectPath);
      assertEquals(ownDownloadError, null);
      assertExists(ownDownload);

      const { data: fileRows, error: fileError } = await member.client
        .from("case_files")
        .insert({
          case_id: caseId,
          filename: `${marker}.txt`,
          original_filename: `${marker}.txt`,
          storage_path: objectPath,
          file_size: payload.length,
          uploaded_by: member.id,
        })
        .select("id");
      assertEquals(fileError, null);
      fileId = fileRows?.[0]?.id as string | undefined;
      assertExists(fileId);

      const { data: transcriptionRows, error: transcriptionError } =
        await service.from("audio_transcriptions").insert({
          file_id: fileId,
          transcription_text: "synthetic local transcription",
        }).select("id");
      assertEquals(transcriptionError, null);
      transcriptionId = transcriptionRows?.[0]?.id as string | undefined;
      assertExists(transcriptionId);

      const { data: ownTranscriptionRows, error: ownTranscriptionError } =
        await member.client.from("audio_transcriptions").select("id").eq(
          "id",
          transcriptionId,
        );
      assertEquals(ownTranscriptionError, null);
      assertEquals(ownTranscriptionRows?.length, 1);

      const {
        data: foreignTranscriptionRows,
        error: foreignTranscriptionError,
      } = await outsider.client.from("audio_transcriptions").select("id").eq(
        "id",
        transcriptionId,
      );
      assertEquals(foreignTranscriptionError, null);
      assertEquals(
        foreignTranscriptionRows?.length,
        0,
        "outsider must not read another case's transcription",
      );

      const { data: foreignDownload, error: foreignDownloadError } =
        await outsider.client.storage.from("case-files").download(objectPath);
      assert(
        foreignDownloadError !== null || foreignDownload === null,
        "foreign case user must not download a private object",
      );

      const { data: anonDownload, error: anonDownloadError } = await anon
        .storage
        .from("case-files")
        .download(objectPath);
      assert(
        anonDownloadError !== null || anonDownload === null,
        "anonymous user must not download a private object",
      );

      const { error: arbitraryUploadError } = await member.client.storage
        .from("case-files")
        .upload(`not-a-case/${marker}.txt`, payload, {
          contentType: "text/plain",
        });
      assertExists(
        arbitraryUploadError,
        "arbitrary non-case object path must be denied",
      );

      const { data: ownSigned, error: ownSignedError } = await member.client
        .storage.from("case-files").createSignedUrl(objectPath, 60);
      assertEquals(ownSignedError, null);
      assertExists(ownSigned?.signedUrl);

      const { data: foreignSigned, error: foreignSignedError } = await outsider
        .client.storage.from("case-files").createSignedUrl(
          objectPath,
          60,
        );
      assert(
        foreignSignedError !== null || !foreignSigned?.signedUrl,
        "foreign case user must not create a signed URL",
      );
    } finally {
      if (transcriptionId) {
        await service.from("audio_transcriptions").delete().eq(
          "id",
          transcriptionId,
        );
      }
      if (fileId) {
        await service.from("case_files").delete().eq("id", fileId);
      }
      if (objectPath) {
        await service.storage.from("case-files").remove([objectPath]);
      }
      if (caseId) {
        await service.from("cases").delete().eq("id", caseId);
      }
      if (users.length > 0) {
        await service.from("audit_logs").delete().in(
          "record_id",
          users.map((user) => user.id),
        );
      }
      for (const user of users) {
        await service.from("profiles").delete().eq("id", user.id);
        await service.auth.admin.deleteUser(user.id);
      }
    }
  },
});

Deno.test({
  name: "local Storage matrix isolates legacy media uploads by owner folder",
  ignore: !canRun,
  async fn() {
    const service = createClient(url, serviceKey, clientOptions);
    const marker = crypto.randomUUID();
    const userIds: string[] = [];
    let objectPath: string | undefined;

    async function createUser(label: string) {
      const email = `${label}-${marker}@example.test`;
      const password = `Local-${label}-${marker}-Aa1!`;
      const { data: created, error: createError } = await service.auth.admin
        .createUser({ email, password, email_confirm: true });
      assertEquals(createError, null);
      const id = created.user?.id;
      assertExists(id);
      userIds.push(id);
      const client = createClient(url, publishableKey, clientOptions);
      const { error: signInError } = await client.auth.signInWithPassword({
        email,
        password,
      });
      assertEquals(signInError, null);
      return { id, client };
    }

    try {
      const owner = await createUser("media-owner");
      const outsider = await createUser("media-outsider");
      objectPath = `${owner.id}/${marker}.txt`;
      const payload = new TextEncoder().encode("synthetic legacy media");

      const { error: uploadError } = await owner.client.storage
        .from("media-uploads")
        .upload(objectPath, payload, { contentType: "text/plain" });
      assertEquals(uploadError, null);

      const { data: ownDownload, error: ownDownloadError } = await owner.client
        .storage.from("media-uploads").download(objectPath);
      assertEquals(ownDownloadError, null);
      assertExists(ownDownload);

      const { data: foreignDownload, error: foreignDownloadError } =
        await outsider.client.storage.from("media-uploads").download(
          objectPath,
        );
      assert(
        foreignDownloadError !== null || foreignDownload === null,
        "authenticated outsider must not read another user's legacy media",
      );
    } finally {
      if (objectPath) {
        await service.storage.from("media-uploads").remove([objectPath]);
      }
      for (const userId of userIds) {
        await service.from("profiles").delete().eq("id", userId);
        await service.auth.admin.deleteUser(userId);
      }
    }
  },
});
