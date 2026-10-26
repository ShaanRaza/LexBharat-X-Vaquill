// One attribution line for the open-india-law dataset, rendered once at the end of every page (root layout). Wording is fixed by the dataset's own attribution terms.
export default function DataAttribution() {
  return (
    <p className="border-t border-border px-4 py-3 text-center text-fs-xs leading-relaxed text-muted sm:px-6 lg:px-8">
      Data: <a href="https://huggingface.co/datasets/vaquill/open-india-law" className="underline" rel="noopener noreferrer" target="_blank">open-india-law</a> by Vaquill AI (CC BY 4.0, snapshot v2026.08). Judgments: source acknowledgment eCourts and the Supreme Court of India; source PDFs by Dattam Labs (CC BY 4.0).
    </p>
  );
}
