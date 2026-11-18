import { NextResponse, type NextRequest } from "next/server";
import { currentSessionFingerprint, inSessionOrder } from "@/features/account/session-order";
import * as core from "@/features/account/shop-core";

/*
 * The signed-in shopper's cart/wishlist writes, sent by the client stores as keep-alive batches
 * (`shop-writes.ts`): the browser finishes a keep-alive request even when the page is left or reloaded,
 * and these writes don't wait in Next's one-at-a-time server-action queue. A batch runs in order, in the
 * shopper's session order (`session-order.ts`). Same-origin JSON only: the session cookie must never be
 * usable from another site. Each write names the session its page was rendered for; a write from a tab
 * left over from another account (signed out / switched elsewhere) is refused as `signedOut`, and that
 * tab reloads into the current session instead of writing into someone else's cart.
 */
export const dynamic = "force-dynamic";

type Op =
  | { type: "cartAdd"; market: string; variantId: number; quantity: number }
  | { type: "cartUpdate"; market: string; itemId: number; quantity: number }
  | { type: "cartRemove"; market: string; itemId: number }
  | { type: "cartClear"; market: string }
  | { type: "wishlistToggle"; productId: number; save: boolean };
type SentOp = Op & { session?: unknown };

const MAX_OPS = 50;

function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  let host: string;
  try {
    host = new URL(origin).host;
  } catch {
    return false;
  }
  return host === request.headers.get("host") || host === request.headers.get("x-forwarded-host");
}

function run(op: Op) {
  switch (op?.type) {
    case "cartAdd":
      return core.accountCartAdd(String(op.market), Number(op.variantId), Number(op.quantity));
    case "cartUpdate":
      return core.accountCartUpdate(String(op.market), Number(op.itemId), Number(op.quantity));
    case "cartRemove":
      return core.accountCartRemove(String(op.market), Number(op.itemId));
    case "cartClear":
      return core.accountCartClear(String(op.market));
    case "wishlistToggle":
      return core.accountWishlistToggle(Number(op.productId), op.save === true);
    default:
      return Promise.resolve({ ok: false as const });
  }
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!request.headers.get("content-type")?.startsWith("application/json")) return NextResponse.json({ error: "unsupported" }, { status: 415 });

  let ops: SentOp[];
  try {
    const body = (await request.json()) as { ops?: unknown };
    if (!Array.isArray(body.ops) || body.ops.length === 0 || body.ops.length > MAX_OPS) throw new Error("bad batch");
    ops = body.ops as SentOp[];
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const current = await currentSessionFingerprint();
  const results = await inSessionOrder(async () => {
    const out: unknown[] = [];
    for (const op of ops) {
      // Written by a page of another (or no) session: never apply it to the current account.
      if (!current || op.session !== current) out.push({ ok: false, signedOut: true });
      else out.push(await run(op));
    }
    return out;
  });
  return NextResponse.json({ results }, { headers: { "Cache-Control": "no-store" } });
}
