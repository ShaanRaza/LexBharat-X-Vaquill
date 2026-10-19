import { Wordmark } from "@/components/Nav";
import DevOnly from "@/components/DevOnly";

// Minimal shell for sign-in / sign-up screens (the public originals are simple centered cards).
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" tabIndex={-1} className="outline-none min-h-screen bg-background">
      <DevOnly>
        <div className="bg-warning px-4 py-1.5 text-center text-[12px] font-medium text-white">
          LexBharat local build · this sign-in screen is a MOCK: no accounts exist
        </div>
      </DevOnly>
      <div className="mx-auto flex max-w-[440px] flex-col items-center px-4 pb-16 pt-14">
        <Wordmark />
        <div className="mt-10 w-full">{children}</div>
      </div>
    </main>
  );
}
