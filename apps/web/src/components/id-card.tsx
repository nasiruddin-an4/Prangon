/** A CR80-proportioned ID card face; prints well several to a page. */
export function IdCard({ institution, title, name, code, lines, footer, emergency }: { institution: string; title: string; name: string; code: string; lines: string[]; footer: string[]; emergency: string }) {
  const initials = name.replace(/^(Dr\.|Md\.)\s+/, "").split(/\s+/).slice(0, 2).map((p) => p[0]).join("");
  return (
    <div className="flex aspect-[1.586] flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-soft break-inside-avoid">
      <div className="bg-slate-900 px-4 py-2 text-white">
        <p className="truncate text-[13px] font-semibold">{institution}</p>
        <p className="text-[10px] tracking-wider text-indigo-200 uppercase">{title}</p>
      </div>
      <div className="flex flex-1 gap-3 px-4 py-3">
        <div className="grid h-20 w-16 shrink-0 place-items-center rounded-md border border-dashed border-border-strong bg-surface-2 text-lg font-semibold text-muted" aria-label="Photo">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{name}</p>
          <p className="font-mono text-xs font-semibold text-accent">{code}</p>
          {lines.map((l) => (
            <p key={l} className="truncate text-[11px] text-muted">
              {l}
            </p>
          ))}
        </div>
      </div>
      <div className="flex justify-between border-t border-border px-4 py-1.5 text-[10px] text-muted">
        <span>{footer[0]}</span>
        <span>{footer[1]}</span>
        <span>Emergency {emergency}</span>
      </div>
    </div>
  );
}
