// ---------------------------------------------------------------------------
// Taurus AI — set an organization's billing plan (dev / testing helper)
//
// Puts an organization on any plan in the catalog (starter | growth | scale)
// without going through Stripe — useful for testing plan-gated features (BYOK,
// Performance Review, higher quotas) in a dev / simulated environment. Plan
// entitlements and feature flags are derived from the plan id, so setting the id
// is all that's needed. Emits a billing audit event.
//
// Usage:
//   DATABASE_URL=<url> node scripts/set-plan.mjs --org "Acme Inc" --plan scale
//   DATABASE_URL=<url> node scripts/set-plan.mjs --org <organizationId> --plan growth
// ---------------------------------------------------------------------------

import pg from "pg";

const VALID_PLANS = ["starter", "growth", "scale"];

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const orgRef = arg("org");
const planId = (arg("plan") ?? "scale").toLowerCase();
if (!orgRef) {
  console.error('Missing --org. Pass an organization name or id, e.g. --org "Acme Inc".');
  process.exit(1);
}
if (!VALID_PLANS.includes(planId)) {
  console.error(`Invalid --plan "${planId}". Must be one of: ${VALID_PLANS.join(", ")}.`);
  process.exit(1);
}

const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orgRef);
const client = new pg.Client({ connectionString: databaseUrl });

async function main() {
  await client.connect();

  const orgRes = await client.query(
    isUuid
      ? "select id, name from organizations where id = $1"
      : "select id, name from organizations where name = $1",
    [orgRef],
  );
  if (orgRes.rows.length === 0) {
    throw new Error(`No organization found for ${isUuid ? "id" : "name"} "${orgRef}".`);
  }
  if (orgRes.rows.length > 1) {
    throw new Error(`Multiple organizations named "${orgRef}"; pass the organization id instead.`);
  }
  const org = orgRes.rows[0];

  // Upsert the subscription row (one per org). No Stripe ids — provider stays simulated.
  const existing = await client.query(
    "select id, plan_id from billing_subscriptions where organization_id = $1",
    [org.id],
  );
  const previousPlanId = existing.rows[0]?.plan_id ?? null;

  if (existing.rows.length > 0) {
    await client.query(
      "update billing_subscriptions set plan_id = $2, status = 'active', updated_at = now() where organization_id = $1",
      [org.id, planId],
    );
  } else {
    await client.query(
      `insert into billing_subscriptions
         (organization_id, plan_id, status, current_period_end, provider)
       values ($1, $2, 'active', now() + interval '30 days', 'simulated')`,
      [org.id, planId],
    );
  }

  await client.query(
    `insert into billing_events (organization_id, event_type, plan_id, status, provider, metadata)
     values ($1, 'subscription.plan_changed', $2, 'active', 'simulated', $3)`,
    [org.id, planId, JSON.stringify({ previousPlanId, newPlanId: planId, via: "set-plan-script" })],
  );

  console.log(`set-plan: ${org.name} (${org.id}) → ${planId} (was ${previousPlanId ?? "none"}).`);
}

main()
  .catch((err) => {
    console.error("set-plan failed:", err.message);
    process.exitCode = 1;
  })
  .finally(() => client.end());
