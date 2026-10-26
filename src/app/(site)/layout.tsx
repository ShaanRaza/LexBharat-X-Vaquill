import Nav from "@/components/Nav";
import SiteFooter from "@/components/SiteFooter";
import DevOnly from "@/components/DevOnly";

// Shared shell for every public marketing/content page: mock banner, nav, footer.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DevOnly>
        <div className="absolute inset-x-0 top-0 z-40 bg-warning px-4 py-1.5 text-center text-fs-xs font-medium text-white">
          LexBharat local build · placeholder content · all backend behavior is MOCKED
        </div>
      </DevOnly>
      <Nav />
      <main id="main" tabIndex={-1} className="outline-none relative">{children}</main>
      <SiteFooter />
    </>
  );
}
