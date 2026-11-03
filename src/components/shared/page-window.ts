/** Page numbers to show: first, last, and a window around the current page. */
export function pageWindow(page: number, lastPage: number): (number | "gap")[] {
  const pages = new Set([1, lastPage, page - 1, page, page + 1].filter((p) => p >= 1 && p <= lastPage));
  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("gap");
    out.push(p);
  });
  return out;
}
