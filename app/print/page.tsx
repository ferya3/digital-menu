import { redirect } from "next/navigation";
import { isAuthed } from "@/lib/auth";
import { getOrder, getSetting, openBillOrders } from "@/lib/queries";
import { formatMoney, fmtDateTime, orderCode, num } from "@/lib/utils";
import type { CafeInfo, Order, OrderCodeMode } from "@/lib/types";
import { PrintBar } from "./print-bar";
import { tenantPage } from "@/lib/tenant-page";

export const dynamic = "force-dynamic";
export const metadata = { title: "Print receipt", robots: { index: false, follow: false } };

/** Printed receipt: one order (?order=) / several orders (?orders=a,b) / a table's open bill (?table=) */
export default async function PrintPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  return tenantPage(async () => {
  if (!(await isAuthed())) redirect("/staff");
  const cafe = getSetting<CafeInfo>("cafe", { name: "My Café", logo: "☕", tagline: "", currency: "USD" });
  const mode = getSetting<OrderCodeMode>("orderCode", "number");
  const money = (n: number) => formatMoney(n, cafe.currency);

  let list: Order[] = [];
  if (sp.order) list = [getOrder(sp.order)].filter(Boolean) as Order[];
  else if (sp.orders) list = sp.orders.split(",").map((id) => getOrder(id)).filter(Boolean) as Order[];
  else if (sp.table) list = openBillOrders(sp.table);

  if (list.length === 0) {
    return <div className="grid min-h-screen place-items-center p-6 text-center">{sp.table ? "There's no open bill for this table." : "Order not found."}<PrintBar auto={false} /></div>;
  }

  const multi = list.length > 1;
  const total = list.reduce((s, o) => s + o.total, 0);
  const phone = list.find((o) => o.phone)?.phone || "";
  const single = !multi ? list[0] : null;
  const logo = cafe.logo && !/^(https?:|\/)/.test(cafe.logo) ? cafe.logo : "";

  return (
    <div className="min-h-screen bg-neutral-100 py-6 text-black print:bg-white print:py-0">
      <PrintBar auto />
      <div className="mx-auto w-[80mm] max-w-full bg-white p-4 font-medium shadow print:shadow-none" style={{ fontSize: 13 }}>
        <div className="text-center">
          {cafe.logo && /^(https?:|\/)/.test(cafe.logo) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cafe.logo} alt="" className="mx-auto size-12 rounded-full object-cover" />
          ) : <div className="text-3xl">{logo || "☕"}</div>}
          <div className="mt-1 text-lg font-black">{cafe.name || "My Café"}</div>
          <div className="text-xs text-neutral-600">Sales receipt</div>
        </div>
        <hr className="my-2 border-dashed border-neutral-400" />
        <Row k="Table" v={num(list[0].table)} />
        {single ? (
          <>
            <Row k="Order" v={orderCode(single, mode)} />
            <Row k="Date" v={fmtDateTime(single.createdAt)} />
          </>
        ) : <Row k="Orders" v={num(list.length)} />}
        {phone && <Row k="Phone" v={phone} />}
        <hr className="my-2 border-dashed border-neutral-400" />
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-neutral-300"><th className="py-1 text-left">Item</th><th className="py-1 text-center">Qty</th><th className="py-1 text-right">Amount</th></tr>
          </thead>
          <tbody>
            {list.map((o) => (
              <OrderRows key={o.id} o={o} multi={multi} mode={mode} money={money} />
            ))}
          </tbody>
        </table>
        <hr className="my-2 border-dashed border-neutral-400" />
        <div className="flex justify-between text-base font-black"><span>Total</span><span>{money(total)}</span></div>
        {single && <Row k="Payment" v={single.paid ? "Paid" : "Unpaid"} />}
        {single?.note && <p className="mt-1 text-[11px]">Note: {single.note}</p>}
        <div className="mt-3 text-center text-xs text-neutral-600">Thank you for your visit! 🙏<br />{cafe.name}{cafe.address ? <><br />{cafe.address}</> : null}</div>
      </div>
    </div>
  );
  });
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between py-0.5"><span className="text-neutral-600">{k}</span><span>{v}</span></div>;
}
function OrderRows({ o, multi, mode, money }: { o: Order; multi: boolean; mode: OrderCodeMode; money: (n: number) => string }) {
  return (
    <>
      {multi && <tr><td colSpan={3} className="pt-2 text-[11px] font-bold text-neutral-600">{orderCode(o, mode)} · {fmtDateTime(o.createdAt)}</td></tr>}
      {o.items.map((it, i) => (
        <tr key={i}>
          <td className="py-0.5">{it.name}</td>
          <td className="py-0.5 text-center">{num(it.qty)}</td>
          <td className="py-0.5 text-right">{money(it.price * it.qty)}</td>
        </tr>
      ))}
    </>
  );
}
