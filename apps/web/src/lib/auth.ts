import type { UserMembership } from "@jtel/auth-rbac";
import { getRepos } from "./db";

const DEV_USER_HEADER = "x-jtel-user";

export async function getAccessContext(): Promise<{
  clerkUserId: string;
  memberships: UserMembership[];
}> {
  const { headers } = await import("next/headers");
  const headerStore = await headers();
  const devUser = headerStore.get(DEV_USER_HEADER) ?? process.env.JTEL_DEV_USER ?? "tecma_admin";

  const repos = getRepos();
  const rows = await repos.memberships.findForUser(devUser);

  const memberships: UserMembership[] = rows.map((row) => ({
    accountId: row.accountId,
    clerkUserId: row.clerkUserId,
    role: row.role,
    scopeType: row.scopeType,
    scopeId: row.scopeId,
  }));

  return { clerkUserId: devUser, memberships };
}

export async function getClientMemberships(accountId?: string) {
  const ctx = await getAccessContext();
  if (accountId) {
    return ctx.memberships.filter((m) => m.accountId === accountId);
  }
  const repos = getRepos();
  const accounts = await Promise.all(
    ctx.memberships.map((m) => repos.accounts.findById(m.accountId)),
  );
  return ctx.memberships.filter((_, i) => accounts[i]?.type === "client");
}

export async function getCarrierMemberships() {
  const ctx = await getAccessContext();
  const repos = getRepos();
  const memberships = [];
  for (const m of ctx.memberships) {
    const account = await repos.accounts.findById(m.accountId);
    if (account?.type === "carrier") memberships.push(m);
  }
  return memberships;
}

export async function getCarrierMembership() {
  const memberships = await getCarrierMemberships();
  return memberships[0] ?? null;
}

export async function getJStaffMemberships() {
  const ctx = await getAccessContext();
  const repos = getRepos();
  const memberships = [];
  for (const m of ctx.memberships) {
    const account = await repos.accounts.findById(m.accountId);
    if (account?.type === "jstaff") memberships.push(m);
  }
  return memberships;
}
