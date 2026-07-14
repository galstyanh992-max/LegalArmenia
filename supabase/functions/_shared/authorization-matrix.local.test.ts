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
    throw new Error(
      "Local authorization matrix refuses a non-local Supabase URL",
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

type TestUser = {
  id: string;
  email: string;
  password: string;
  client: ReturnType<typeof createClient>;
};

Deno.test({
  name: "local authorization matrix isolates cases, profiles, and admin paths",
  ignore: !canRun,
  async fn() {
    const service = createClient(url, serviceKey, clientOptions);
    const anon = createClient(url, publishableKey, clientOptions);
    const marker = crypto.randomUUID();
    const users: TestUser[] = [];
    const caseIds: string[] = [];

    async function createUser(
      label: string,
      role: "admin" | "lawyer" | "client",
    ) {
      const email = `${label}-${marker}@example.test`;
      const password = `Local-${label}-${marker}-Aa1!`;
      const { data: created, error: createError } = await service.auth.admin
        .createUser({ email, password, email_confirm: true });
      assertEquals(createError, null);
      const id = created.user?.id;
      assertExists(id);

      if (role !== "client") {
        const { error: roleError } = await service.rpc("admin_set_user_role", {
          p_user_id: id,
          p_role: role,
        });
        assertEquals(roleError, null);
      }

      const client = createClient(url, publishableKey, clientOptions);
      const { error: signInError } = await client.auth.signInWithPassword({
        email,
        password,
      });
      assertEquals(signInError, null);
      const user = { id, email, password, client };
      users.push(user);
      return user;
    }

    try {
      const clientA = await createUser("client-a", "client");
      const clientB = await createUser("client-b", "client");
      const lawyerA = await createUser("lawyer-a", "lawyer");
      const lawyerB = await createUser("lawyer-b", "lawyer");
      const admin = await createUser("admin", "admin");

      const { data: caseARows, error: caseAError } = await lawyerA.client
        .from("cases")
        .insert({ title: `Case A ${marker}`, lawyer_id: lawyerA.id })
        .select("id");
      assertEquals(caseAError, null);
      const caseAId = caseARows?.[0]?.id as string | undefined;
      assertExists(caseAId);
      caseIds.push(caseAId);

      const { data: caseBRows, error: caseBError } = await lawyerB.client
        .from("cases")
        .insert({ title: `Case B ${marker}`, lawyer_id: lawyerB.id })
        .select("id");
      assertEquals(caseBError, null);
      const caseBId = caseBRows?.[0]?.id as string | undefined;
      assertExists(caseBId);
      caseIds.push(caseBId);

      const { error: memberAError } = await service.from("case_members").insert(
        {
          case_id: caseAId,
          user_id: clientA.id,
          case_role: "client",
        },
      );
      assertEquals(memberAError, null);
      const { error: memberBError } = await service.from("case_members").insert(
        {
          case_id: caseBId,
          user_id: clientB.id,
          case_role: "client",
        },
      );
      assertEquals(memberBError, null);

      const { data: anonRows, error: anonError } = await anon
        .from("cases")
        .select("id")
        .eq("id", caseAId);
      assert(
        anonError !== null || (anonRows?.length ?? 0) === 0,
        "anon must not read protected case data",
      );

      const { data: clientOwnRows, error: clientOwnError } = await clientA
        .client
        .from("cases")
        .select("id")
        .eq("id", caseAId);
      assertEquals(clientOwnError, null);
      assertEquals(clientOwnRows?.length, 1);

      const { data: clientForeignRows, error: clientForeignError } =
        await clientA.client.from("cases").select("id").eq("id", caseBId);
      assertEquals(clientForeignError, null);
      assertEquals(clientForeignRows?.length, 0);

      const { data: lawyerOwnRows, error: lawyerOwnError } = await lawyerA
        .client
        .from("cases")
        .select("id")
        .eq("id", caseAId);
      assertEquals(lawyerOwnError, null);
      assertEquals(lawyerOwnRows?.length, 1);

      const { data: lawyerForeignRows, error: lawyerForeignError } =
        await lawyerB.client.from("cases").select("id").eq("id", caseAId);
      assertEquals(lawyerForeignError, null);
      assertEquals(lawyerForeignRows?.length, 0);

      const { data: foreignProfileRows, error: foreignProfileError } =
        await clientA.client.from("profiles").select("id").eq("id", clientB.id);
      assertEquals(foreignProfileError, null);
      assertEquals(foreignProfileRows?.length, 0);

      const {
        data: foreignProfileUpdateRows,
        error: foreignProfileUpdateError,
      } = await clientA.client
        .from("profiles")
        .update({ full_name: "forged" })
        .eq("id", clientB.id)
        .select("id");
      assert(
        foreignProfileUpdateError !== null ||
          (foreignProfileUpdateRows?.length ?? 0) === 0,
        "user A must not update user B private profile",
      );

      const { data: adminRows, error: adminError } = await admin.client
        .from("cases")
        .select("id")
        .in("id", [caseAId, caseBId]);
      assertEquals(adminError, null);
      assertEquals(adminRows?.length, 2);
    } finally {
      for (const caseId of caseIds) {
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
