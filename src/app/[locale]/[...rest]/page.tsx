import { notFound } from "next/navigation";

/** Any unknown localized path renders the localized 404 (with header/footer) and a 404 status. */
export default function CatchAllPage() {
  notFound();
}
