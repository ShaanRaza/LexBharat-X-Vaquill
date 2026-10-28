"use client";
import { usePathname } from "next/navigation";
import { Tabs } from "@/components/kit";
import { WORK_TABS, areaOf, workTabOf } from "@/lib/shell/areas.mjs";
import workspace from "@/config/workspace.json";

// Under the page title in Work: Drafts, Reviews, Vault. A tab for a feature switched off in src/config/workspace.json is left out. Renders nothing outside Work.
export default function WorkTabs() {
  const pathname = usePathname();
  if (areaOf(pathname) !== "work") return null;
  const items = WORK_TABS.filter((t) => workspace.features[t.feature].enabled).map((t) => ({ id: t.id, label: t.label, href: t.href }));
  return <Tabs items={items} current={workTabOf(pathname)} label="Work" className="mx-auto mt-4 max-w-4xl" />;
}
