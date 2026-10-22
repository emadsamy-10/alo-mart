"use client";

import Image, { type ImageProps } from "next/image";
import { ImageOff } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { isUsableUrl } from "@/lib/images";

/**
 * The ONLY wrapper around next/image in the app.
 *
 * - Ratio mode (`ratio="4/5"`): renders its own aspect-locked box and fills
 *   it — zero layout shift whatever the source dimensions.
 * - Fixed mode (`width` + `height`): behaves like next/image.
 * - `priority` marks an above-the-fold LCP candidate (eager + high fetch
 *   priority — Next 16 deprecates the old `priority` prop). Everything else
 *   lazy-loads.
 * - Missing URL or load error → an on-brand placeholder with the same box,
 *   never a broken-image icon or a collapsed card.
 */

type BaseProps = Omit<ImageProps, "src" | "alt" | "fill" | "priority" | "preload" | "loading" | "placeholder"> & {
  src: string | null | undefined;
  /** Meaningful description, or "" when purely decorative. */
  alt: string;
  fit?: "cover" | "contain";
  priority?: boolean;
  /** Text announced/shown when there is no image (defaults to nothing visible). */
  fallbackLabel?: string;
};

/** `"fill"` covers a positioned parent whose size is set elsewhere. */
type RatioProps = BaseProps & {
  ratio: `${number}/${number}` | "fill";
  wrapperClassName?: string;
  width?: never;
  height?: never;
};
type FixedProps = BaseProps & { ratio?: undefined; wrapperClassName?: undefined; width: number; height: number };

export type AppImageProps = RatioProps | FixedProps;

export function AppImage(props: AppImageProps) {
  const {
    src,
    alt,
    fit = "cover",
    priority = false,
    fallbackLabel,
    className,
    ratio,
    wrapperClassName,
    sizes,
    quality = 75,
    ...rest
  } = props;
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const usable = isUsableUrl(src) && failedSrc !== src;

  const loadingProps = priority
    ? ({ loading: "eager", fetchPriority: "high" } as const)
    : ({ loading: "lazy" } as const);

  const fitClass = fit === "contain" ? "object-contain" : "object-cover";

  const fallback = (
    <span
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      className={cn(
        "flex h-full w-full flex-col items-center justify-center gap-2 bg-surface-muted text-muted-foreground",
        className,
      )}
    >
      <ImageOff className="size-6 opacity-60" aria-hidden />
      {fallbackLabel ? <span className="px-3 text-center text-xs">{fallbackLabel}</span> : null}
    </span>
  );

  if (ratio) {
    return (
      <span
        className={cn(
          ratio === "fill" ? "absolute inset-0 block overflow-hidden" : "relative block w-full overflow-hidden",
          wrapperClassName,
        )}
        style={ratio === "fill" ? undefined : { aspectRatio: ratio }}
      >
        {usable ? (
          <Image
            {...rest}
            src={src}
            alt={alt}
            fill
            sizes={sizes ?? "100vw"}
            quality={quality}
            className={cn(fitClass, className)}
            onError={() => setFailedSrc(src)}
            {...loadingProps}
          />
        ) : (
          <span className="absolute inset-0">{fallback}</span>
        )}
      </span>
    );
  }

  if (!usable) {
    return (
      <span className="inline-block" style={{ width: props.width, height: props.height }}>
        {fallback}
      </span>
    );
  }

  return (
    <Image
      {...rest}
      src={src}
      alt={alt}
      width={props.width}
      height={props.height}
      sizes={sizes}
      quality={quality}
      className={cn(fitClass, className)}
      onError={() => setFailedSrc(src)}
      {...loadingProps}
    />
  );
}
