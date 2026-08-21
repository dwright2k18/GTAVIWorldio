import { randomUUID } from "node:crypto";

import { config } from "dotenv";
import postgres, { type TransactionSql } from "postgres";

config({ path: ".env.development.local", quiet: true });

const connectionString = process.env.POSTGRES_URL_NON_POOLING;

if (!connectionString) {
  throw new Error("POSTGRES_URL_NON_POOLING is required to test newsroom policies.");
}

const client = postgres(connectionString, { max: 1, prepare: false });

type ApiRole = "anon" | "authenticated";

type PolicyCase = {
  label: string;
  apiRole?: ApiRole;
  userId?: string;
  expected: "ALLOW" | "DENY";
  action: (sql: TransactionSql) => Promise<boolean>;
};

class PolicyTestRollback extends Error {}

async function setApiIdentity(sql: TransactionSql, apiRole: ApiRole, userId?: string) {
  await sql`
    select
      set_config('request.jwt.claim.sub', ${userId ?? ""}, true),
      set_config(
        'request.jwt.claims',
        ${JSON.stringify({ role: apiRole, ...(userId ? { sub: userId } : {}) })},
        true
      )
  `;
  await sql.unsafe(`set local role ${apiRole}`);
}

async function runPolicyCase(sql: TransactionSql, testCase: PolicyCase) {
  let allowed = false;
  let denialReason = "row hidden or changed by policy";

  try {
    allowed = await sql.savepoint(async (testSql) => {
      await setApiIdentity(testSql, testCase.apiRole ?? "authenticated", testCase.userId);
      const changedOrVisible = await testCase.action(testSql);
      await testSql.unsafe("reset role");
      return changedOrVisible;
    });
  } catch (error) {
    allowed = false;
    denialReason = error instanceof Error ? error.message : "database rejected the operation";
  }

  const actual = allowed ? "ALLOW" : "DENY";
  if (actual !== testCase.expected) {
    throw new Error(
      `${testCase.label}: expected ${testCase.expected}, received ${actual} (${denialReason})`,
    );
  }

  console.log(`${actual.padEnd(5)} ${testCase.label}`);
}

async function main() {
  const runToken = randomUUID().slice(0, 8);
  const authUsers = {
    owner: randomUUID(),
    admin: randomUUID(),
    editor: randomUUID(),
    author: randomUUID(),
    factChecker: randomUUID(),
    inactive: randomUUID(),
  };
  const profiles = {
    owner: randomUUID(),
    admin: randomUUID(),
    editor: randomUUID(),
    author: randomUUID(),
    factChecker: randomUUID(),
    inactive: randomUUID(),
  };
  const bylineId = randomUUID();
  const sourceId = randomUUID();
  const authorStoryId = randomUUID();
  const reviewStoryId = randomUUID();
  const deleteStoryId = randomUUID();
  const categoryId = randomUUID();

  try {
    await client.begin(async (sql) => {
      const userRows = Object.entries(authUsers).map(([name, id]) => ({
        id,
        email: `rls-${name}-${runToken}@example.invalid`,
      }));

      await sql`
        insert into auth.users (
          instance_id,
          id,
          aud,
          role,
          email,
          encrypted_password,
          email_confirmed_at,
          raw_app_meta_data,
          raw_user_meta_data,
          created_at,
          updated_at
        )
        select
          '00000000-0000-0000-0000-000000000000'::uuid,
          test_user.id::uuid,
          'authenticated',
          'authenticated',
          test_user.email,
          '',
          now(),
          '{}'::jsonb,
          '{}'::jsonb,
          now(),
          now()
        from jsonb_to_recordset(${sql.json(userRows)})
          as test_user(id text, email text)
      `;

      await sql`
        insert into public.authors (id, slug, name, is_active)
        values (${bylineId}, ${`rls-author-${runToken}`}, 'RLS Test Author', true)
      `;

      await sql`
        insert into public.editor_profiles (
          id,
          auth_user_id,
          author_id,
          display_name,
          role,
          is_active
        ) values
          (${profiles.owner}, ${authUsers.owner}, null, 'RLS Owner', 'OWNER', true),
          (${profiles.admin}, ${authUsers.admin}, null, 'RLS Admin', 'ADMIN', true),
          (${profiles.editor}, ${authUsers.editor}, null, 'RLS Editor', 'EDITOR', true),
          (${profiles.author}, ${authUsers.author}, ${bylineId}, 'RLS Author', 'AUTHOR', true),
          (${profiles.factChecker}, ${authUsers.factChecker}, null, 'RLS Fact Checker', 'FACT_CHECKER', true),
          (${profiles.inactive}, ${authUsers.inactive}, null, 'RLS Inactive', 'AUTHOR', false)
      `;

      await sql`
        insert into public.sources (id, name, url, source_type, created_by)
        values (
          ${sourceId},
          'RLS Test Source',
          ${`https://example.invalid/rls-${runToken}`},
          'FIRST_PARTY',
          ${profiles.editor}
        )
      `;

      await sql`
        insert into public.categories (id, code, slug, name, is_active)
        values (
          ${categoryId},
          ${`RLS_${runToken.toUpperCase()}`},
          ${`rls-${runToken}`},
          'RLS Test Category',
          true
        )
      `;

      const articleBody = [
        { type: "paragraph", content: "A substantive policy-test article body." },
      ];
      const summary = "A policy-test summary long enough to satisfy the publication workflow constraint.";

      await sql`
        insert into public.stories (
          id,
          headline,
          slug,
          url_path,
          summary,
          body,
          body_text,
          status,
          author_id,
          editor_id,
          primary_source_id,
          created_by
        ) values
          (
            ${authorStoryId},
            'RLS author-owned draft',
            ${`rls-author-draft-${runToken}`},
            ${`/news/rls-author-draft-${runToken}`},
            ${summary},
            ${sql.json(articleBody)},
            'A substantive policy-test article body.',
            'DRAFTING',
            ${bylineId},
            ${profiles.author},
            ${sourceId},
            ${profiles.author}
          ),
          (
            ${reviewStoryId},
            'RLS editorial review story',
            ${`rls-review-${runToken}`},
            ${`/news/rls-review-${runToken}`},
            ${summary},
            ${sql.json(articleBody)},
            'A substantive policy-test article body.',
            'NEEDS_REVIEW',
            ${bylineId},
            ${profiles.editor},
            ${sourceId},
            ${profiles.editor}
          ),
          (
            ${deleteStoryId},
            'RLS administrator delete target',
            ${`rls-delete-${runToken}`},
            ${`/news/rls-delete-${runToken}`},
            ${summary},
            ${sql.json(articleBody)},
            'A substantive policy-test article body.',
            'APPROVED',
            ${bylineId},
            ${profiles.editor},
            ${sourceId},
            ${profiles.editor}
          )
      `;

      const cases: PolicyCase[] = [
        {
          label: "anonymous users cannot read newsroom stories",
          apiRole: "anon",
          expected: "DENY",
          action: async (testSql) => (await testSql`select id from public.stories limit 1`).length > 0,
        },
        {
          label: "inactive profiles cannot read newsroom stories",
          userId: authUsers.inactive,
          expected: "DENY",
          action: async (testSql) => (await testSql`select id from public.stories limit 1`).length > 0,
        },
        {
          label: "authors can read their own draft",
          userId: authUsers.author,
          expected: "ALLOW",
          action: async (testSql) =>
            (await testSql`select id from public.stories where id = ${authorStoryId}`).length === 1,
        },
        {
          label: "authors cannot read another unpublished story",
          userId: authUsers.author,
          expected: "DENY",
          action: async (testSql) =>
            (await testSql`select id from public.stories where id = ${reviewStoryId}`).length > 0,
        },
        {
          label: "authors can submit their own draft for review",
          userId: authUsers.author,
          expected: "ALLOW",
          action: async (testSql) =>
            (
              await testSql`
                update public.stories
                set status = 'NEEDS_REVIEW'
                where id = ${authorStoryId}
                returning id
              `
            ).length === 1,
        },
        {
          label: "authors cannot publish through the direct API",
          userId: authUsers.author,
          expected: "DENY",
          action: async (testSql) =>
            (
              await testSql`
                update public.stories
                set status = 'PUBLISHED', published_at = now()
                where id = ${authorStoryId}
                returning id
              `
            ).length > 0,
        },
        {
          label: "authors cannot modify arbitrary stories",
          userId: authUsers.author,
          expected: "DENY",
          action: async (testSql) =>
            (
              await testSql`
                update public.stories
                set summary = 'Unauthorized author edit that must never be visible.'
                where id = ${reviewStoryId}
                returning id
              `
            ).length > 0,
        },
        {
          label: "authors cannot delete stories",
          userId: authUsers.author,
          expected: "DENY",
          action: async (testSql) =>
            (await testSql`delete from public.stories where id = ${authorStoryId} returning id`).length > 0,
        },
        {
          label: "authors cannot escalate their profile role",
          userId: authUsers.author,
          expected: "DENY",
          action: async (testSql) =>
            (
              await testSql`
                update public.editor_profiles
                set role = 'OWNER'
                where auth_user_id = ${authUsers.author}
                returning id
              `
            ).length > 0,
        },
        {
          label: "fact checkers can update source verification notes",
          userId: authUsers.factChecker,
          expected: "ALLOW",
          action: async (testSql) =>
            (
              await testSql`
                update public.sources
                set verification_notes = 'Verified during the direct-access policy test.'
                where id = ${sourceId}
                returning id
              `
            ).length === 1,
        },
        {
          label: "fact checkers cannot rewrite source creator attribution",
          userId: authUsers.factChecker,
          expected: "DENY",
          action: async (testSql) =>
            (
              await testSql`
                update public.sources
                set created_by = ${profiles.factChecker}
                where id = ${sourceId}
                returning id
              `
            ).length > 0,
        },
        {
          label: "fact checkers can move review stories into fact check",
          userId: authUsers.factChecker,
          expected: "ALLOW",
          action: async (testSql) =>
            (
              await testSql`
                update public.stories
                set status = 'FACT_CHECK'
                where id = ${reviewStoryId}
                returning id
              `
            ).length === 1,
        },
        {
          label: "fact checkers cannot publish through the direct API",
          userId: authUsers.factChecker,
          expected: "DENY",
          action: async (testSql) =>
            (
              await testSql`
                update public.stories
                set status = 'PUBLISHED', published_at = now()
                where id = ${reviewStoryId}
                returning id
              `
            ).length > 0,
        },
        {
          label: "fact checkers cannot rewrite protected publishing fields",
          userId: authUsers.factChecker,
          expected: "DENY",
          action: async (testSql) =>
            (
              await testSql`
                update public.stories
                set breaking = true
                where id = ${reviewStoryId}
                returning id
              `
            ).length > 0,
        },
        {
          label: "fact checkers can add an attributed correction",
          userId: authUsers.factChecker,
          expected: "ALLOW",
          action: async (testSql) =>
            (
              await testSql`
                insert into public.corrections (
                  story_id,
                  original_issue,
                  correction,
                  significance,
                  editor_id,
                  is_public
                ) values (
                  ${reviewStoryId},
                  'A fact-check issue identified during policy testing.',
                  'A fact-check correction recorded during policy testing.',
                  'NON_MATERIAL',
                  ${profiles.factChecker},
                  false
                )
                returning id
              `
            ).length === 1,
        },
        {
          label: "fact checkers cannot impersonate another correction editor",
          userId: authUsers.factChecker,
          expected: "DENY",
          action: async (testSql) =>
            (
              await testSql`
                insert into public.corrections (
                  story_id,
                  original_issue,
                  correction,
                  significance,
                  editor_id,
                  is_public
                ) values (
                  ${reviewStoryId},
                  'An unauthorized attribution attempt during policy testing.',
                  'This correction attribution must be rejected by policy.',
                  'NON_MATERIAL',
                  ${profiles.editor},
                  false
                )
                returning id
              `
            ).length > 0,
        },
        {
          label: "fact checkers cannot delete stories",
          userId: authUsers.factChecker,
          expected: "DENY",
          action: async (testSql) =>
            (await testSql`delete from public.stories where id = ${reviewStoryId} returning id`).length > 0,
        },
        {
          label: "editors can approve newsroom stories",
          userId: authUsers.editor,
          expected: "ALLOW",
          action: async (testSql) =>
            (
              await testSql`
                update public.stories
                set status = 'APPROVED', editor_id = ${profiles.editor}
                where id = ${reviewStoryId}
                returning id
              `
            ).length === 1,
        },
        {
          label: "editors can publish fully validated stories",
          userId: authUsers.editor,
          expected: "ALLOW",
          action: async (testSql) =>
            (
              await testSql`
                update public.stories
                set status = 'PUBLISHED', published_at = now(), editor_id = ${profiles.editor}
                where id = ${reviewStoryId}
                returning id
              `
            ).length === 1,
        },
        {
          label: "editors cannot rewrite story creator attribution",
          userId: authUsers.editor,
          expected: "DENY",
          action: async (testSql) =>
            (
              await testSql`
                update public.stories
                set created_by = ${profiles.author}
                where id = ${reviewStoryId}
                returning id
              `
            ).length > 0,
        },
        {
          label: "editors cannot delete arbitrary stories",
          userId: authUsers.editor,
          expected: "DENY",
          action: async (testSql) =>
            (await testSql`delete from public.stories where id = ${reviewStoryId} returning id`).length > 0,
        },
        {
          label: "editors can manage editorial taxonomy",
          userId: authUsers.editor,
          expected: "ALLOW",
          action: async (testSql) =>
            (
              await testSql`
                update public.categories
                set description = 'Updated through the allowed editor policy.'
                where id = ${categoryId}
                returning id
              `
            ).length === 1,
        },
        {
          label: "administrators can delete editorial content",
          userId: authUsers.admin,
          expected: "ALLOW",
          action: async (testSql) =>
            (await testSql`delete from public.stories where id = ${deleteStoryId} returning id`).length === 1,
        },
        {
          label: "even owners cannot modify protected profiles through the public API",
          userId: authUsers.owner,
          expected: "DENY",
          action: async (testSql) =>
            (
              await testSql`
                update public.editor_profiles
                set role = 'OWNER', is_active = false
                where auth_user_id = ${authUsers.author}
                returning id
              `
            ).length > 0,
        },
      ];

      for (const testCase of cases) {
        await runPolicyCase(sql, testCase);
      }

      console.log(`\n${cases.length} direct database/API authorization checks passed.`);
      throw new PolicyTestRollback("Rollback policy-test fixtures.");
    });
  } catch (error) {
    if (!(error instanceof PolicyTestRollback)) {
      throw error;
    }
  }
}

async function run() {
  try {
    await main();
  } finally {
    await client.end();
  }
}

void run();
