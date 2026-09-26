import { notFound } from "next/navigation";
import { normalizeShareCode } from "@smartroute/core/application/shopping-list/generate-share-code";
import { shoppingListRepository } from "@/src/infrastructure/container";
import { SharedLinkLanding } from "@/src/presentation/components/landing/SharedLinkLanding";
import { he } from "@smartroute/core/i18n/he";

// Landing for a shared-list link opened outside the app - the list itself is
// viewed and edited in the mobile app.
export default async function MyListPage({ params }: { params: Promise<{ code: string }> }) {
  const code = normalizeShareCode((await params).code);
  if (!(await shoppingListRepository.findByShareCode(code))) notFound();

  return (
    <SharedLinkLanding
      title={he.landing.sharedList.title}
      body={he.landing.sharedList.body}
      deepPath={`/my-list/${code}`}
      code={code}
    />
  );
}
