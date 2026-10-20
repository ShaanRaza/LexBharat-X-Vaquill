// The developer console (Overview, Playground, API keys) is a demo: its responses, key and credits are simulated. The notice is rendered here, in a
// server component, so it is in the served HTML and is shown in release builds too.
export default function DeveloperLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div role="note" className="bg-warning px-4 py-1.5 text-center text-[12px] font-medium text-white">Demo developer console · responses, API key and credits are simulated in this browser · nothing here calls a live service</div>
      {children}
    </>
  );
}
