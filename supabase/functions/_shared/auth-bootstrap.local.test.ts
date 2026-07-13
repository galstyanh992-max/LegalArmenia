import {
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
    throw new Error(
      "Local Auth bootstrap test refuses a non-local Supabase URL",
    );
  }
}

const clientOptions = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
};

Deno.test({
  name:
    "local Auth bootstrap creates a non-privileged profile and blocks forged roles",
  ignore: !canRun,
  async fn() {
    const service = createClient(url, serviceKey, clientOptions);
    const marker = crypto.randomUUID();
    const email = `bootstrap-${marker}@example.test`;
    const password = `Local-${marker}-Aa1!`;
    let userId: string | undefined;

    try {
      const { data: created, error: createError } = await service.auth.admin
        .createUser({ email, password, email_confirm: true });
      assertEquals(createError, null);
      userId = created.user?.id;
      assertExists(userId);

      const { data: profile, error: profileError } = await service
        .from("profiles")
        .select("id,email,full_name,role,is_active")
        .eq("id", userId)
        .single();
      assertEquals(profileError, null);
      assertEquals(profile?.email, email);
      assertEquals(profile?.full_name, "User");
      assertEquals(profile?.role, "client");
      assertEquals(profile?.is_active, true);

      const userClient = createClient(url, publishableKey, clientOptions);
      const { error: signInError } = await userClient.auth.signInWithPassword({
        email,
        password,
      });
      assertEquals(signInError, null);

      await userClient
        .from("profiles")
        .update({ role: "admin" })
        .eq("id", userId)
        .select("id");

      const { data: persistedProfile, error: persistedProfileError } =
        await service
          .from("profiles")
          .select("role")
          .eq("id", userId)
          .single();
      assertEquals(persistedProfileError, null);
      assertEquals(
        persistedProfile?.role,
        "client",
        "authenticated client must not elevate its persisted profile role",
      );

      const { error: forgedRoleError } = await userClient
        .from("user_roles")
        .insert({ user_id: userId, role: "admin" });
      assertExists(
        forgedRoleError,
        "authenticated client must not insert a forged role",
      );
    } finally {
      if (userId) {
        await service.from("profiles").delete().eq("id", userId);
        await service.auth.admin.deleteUser(userId);
      }
    }
  },
});
