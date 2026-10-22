import type { ComponentPropsWithoutRef, ElementType } from "react";
import { cn } from "@/lib/utils/cn";

type ContainerProps<T extends ElementType> = { as?: T } & ComponentPropsWithoutRef<T>;

/** Page-width container: 16px gutters on phones; 1344px content at a 1440px viewport (48px gutters), never wider. */
export function Container<T extends ElementType = "div">({ as, className, ...props }: ContainerProps<T>) {
  const Component = as ?? "div";
  return <Component className={cn("mx-auto w-full max-w-[88rem] px-4 sm:px-6 lg:px-8", className)} {...props} />;
}
