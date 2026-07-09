import { AppNav } from "@/components/ui";
import { ClientAccountSwitcher } from "@/components/account-switcher";
import { ConfigWizardNav } from "@/components/config-wizard-nav";
import { clientNavLinks } from "@/lib/client-nav";
import type { ConfigStepId } from "@/lib/config-wizard";

export function ClientConfigShell({
  client,
  title,
  step,
  basePath,
  children,
}: {
  client: { slug: string; name: string };
  title: string;
  step: ConfigStepId;
  basePath: string;
  children?: React.ReactNode;
}) {
  return (
    <>
      <AppNav title={title} links={clientNavLinks(client.slug)} />
      <ClientAccountSwitcher currentSlug={client.slug} basePath={basePath} />
      <ConfigWizardNav clientSlug={client.slug} current={step} />
      {children}
    </>
  );
}
