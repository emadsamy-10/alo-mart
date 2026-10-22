import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/** Locale-preserving navigation primitives — use these instead of next/link. */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
