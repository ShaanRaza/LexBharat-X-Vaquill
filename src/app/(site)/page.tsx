import Hero from "@/components/Hero";
import Proof from "@/components/Proof";
import CoverageMap from "@/components/CoverageMap";
import AccessAndDemo from "@/components/AccessAndDemo";
import PricingFaq from "@/components/PricingFaq";
import HomeClosing from "@/components/HomeClosing";
import { DataNote } from "@/components/ui";

export default function Home() {
  return (
    <>
      <Hero />
      <Proof />
      <CoverageMap />
      <AccessAndDemo />
      <PricingFaq />
      <HomeClosing />
      <DataNote kind="mixed" files={["src/data/jurisdictions.ts", "src/components/*.tsx (hardcoded copy)", "/api/mock/resolve", "/api/mock/subscribe"]} />
    </>
  );
}
