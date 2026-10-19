// Route group for the authenticated developer console clone (Playground). Each page wraps itself in <ConsoleShell>.
// The mock notice lives here, in a server component, so it is in the served HTML (visible before hydration and with JavaScript off) and is
// always shown, including in release/production builds: this console imitates a Vaquill product, so it must say it is a local mock.
export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div role="note" className="bg-warning px-4 py-1.5 text-center text-[12px] font-medium text-white">Local mock of the Vaquill developer console · responses, API key and credits are simulated on this computer · not affiliated with Vaquill</div>
      {children}
    </>
  );
}
