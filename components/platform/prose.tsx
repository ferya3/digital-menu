import Link from "next/link";

/**
 * نمایشِ متنِ مارک‌داونِ ساده (مقاله‌ها و صفحه‌های موضوعی) با تگ‌های معنایی برای سئو:
 * ## h2، ### h3، «- » فهرست، «1. » فهرستِ شماره‌دار، «> » نکته، **پررنگ**، [متن](/آدرس یا https://…).
 * HTML خام پشتیبانی نمی‌شود (همه‌چیز متن است) پس متنِ پنل نمی‌تواند اسکریپت تزریق کند.
 */
function inline(text: string, key: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(((?:\/|https:\/\/)[^\s)]*)\)/g;
  let last = 0, m: RegExpExecArray | null, n = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${key}-${n++}`;
    if (m[1]) out.push(<strong key={k} className="font-bold text-foreground">{m[1]}</strong>);
    else if (m[3].startsWith("/")) out.push(<Link key={k} href={m[3]} className="font-semibold text-primary underline-offset-4 hover:underline">{m[2]}</Link>);
    else out.push(<a key={k} href={m[3]} target="_blank" rel="noopener" className="font-semibold text-primary underline-offset-4 hover:underline">{m[2]}</a>);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Prose({ text, className = "" }: { text: string; className?: string }) {
  const lines = String(text || "").replace(/\r/g, "").split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0, b = 0;
  while (i < lines.length) {
    const l = lines[i].trimEnd();
    const k = `b${b++}`;
    if (!l.trim()) { i++; continue; }
    if (l.startsWith("### ")) { blocks.push(<h3 key={k} className="pt-2 text-lg font-extrabold text-foreground sm:text-xl">{inline(l.slice(4), k)}</h3>); i++; continue; }
    if (l.startsWith("## ")) { blocks.push(<h2 key={k} className="pt-4 text-xl font-black text-foreground sm:text-2xl">{inline(l.slice(3), k)}</h2>); i++; continue; }
    if (l.startsWith("> ")) {
      const q: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) q.push(lines[i++].slice(2));
      blocks.push(<blockquote key={k} className="rounded-2xl border-s-4 border-primary bg-primary/[0.06] px-4 py-3 text-foreground/90">{inline(q.join(" "), k)}</blockquote>);
      continue;
    }
    if (/^- /.test(l)) {
      const items: string[] = [];
      while (i < lines.length && /^- /.test(lines[i])) items.push(lines[i++].slice(2));
      blocks.push(<ul key={k} className="space-y-2 ps-1">{items.map((t, j) => <li key={j} className="flex gap-2.5"><span aria-hidden className="mt-3 size-1.5 shrink-0 rounded-full bg-primary" /><span>{inline(t, `${k}-${j}`)}</span></li>)}</ul>);
      continue;
    }
    if (/^\d+\. /.test(l)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) items.push(lines[i++].replace(/^\d+\. /, ""));
      blocks.push(
        <ol key={k} className="space-y-2.5">
          {items.map((t, j) => (
            <li key={j} className="flex gap-3">
              <span aria-hidden className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg bg-primary/10 text-xs font-black text-primary">{(j + 1).toLocaleString("fa-IR")}</span>
              <span>{inline(t, `${k}-${j}`)}</span>
            </li>
          ))}
        </ol>,
      );
      continue;
    }
    // پاراگراف: خط‌های پشتِ هم تا خطِ خالی یا شروعِ بلوکِ دیگر
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{2,3} |> |- |\d+\. )/.test(lines[i])) para.push(lines[i++].trim());
    blocks.push(<p key={k}>{inline(para.join(" "), k)}</p>);
  }
  return <div className={`space-y-4 text-[0.95rem] leading-8 text-muted-foreground sm:text-base sm:leading-9 ${className}`}>{blocks}</div>;
}
