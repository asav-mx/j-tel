import { getRepos } from "@/lib/db";
import { withAccount } from "@/lib/account-context";

export async function CarrierAccountSwitcher({
  currentSlug,
  basePath,
}: {
  currentSlug: string;
  basePath: string;
}) {
  const repos = getRepos();
  const carriers = await repos.accounts.listByType("carrier");

  if (carriers.length <= 1) return null;

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
      <span className="text-[var(--muted)]">Ver como:</span>
      {carriers.map((c) => (
        <a
          key={c.id}
          href={withAccount(basePath, c.slug)}
          className={`rounded-full px-3 py-1 ${
            c.slug === currentSlug
              ? "bg-[var(--accent)] font-medium text-black"
              : "border border-white/10 hover:border-[var(--accent)]"
          }`}
        >
          {c.name}
        </a>
      ))}
    </div>
  );
}
