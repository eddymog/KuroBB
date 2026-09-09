import type { TdHTMLAttributes, ThHTMLAttributes } from "react";

// STYLE.md §5 "Tables" — one convention shared by every admin table
// (admin.forums, admin.groups, admin.groups.$groupId): surface-2 header
// row, uppercase muted header text, border-separated body rows, no zebra
// striping (borders already separate rows). §7 wraps it in overflow-x-auto
// rather than trying to reflow columns on narrow screens.
export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      {...props}
      className="bg-surface-2 px-3 py-2 text-xs font-semibold tracking-wide text-ink-muted uppercase"
    >
      {children}
    </th>
  );
}

export function Td({ children, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td {...props} className="border-b border-border px-3 py-2 text-ink">
      {children}
    </td>
  );
}
