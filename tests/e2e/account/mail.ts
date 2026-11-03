import fs from "node:fs";
import { expect } from "@playwright/test";

/**
 * Reads the LOCAL backend's mail log (MAIL_MAILER=log): the project's own
 * test mail transport. Nothing is delivered anywhere; tests read the links a
 * customer would receive.
 */
export const MAIL_LOG = process.env.E2E_MAIL_LOG ?? "";

/** Decode quoted-printable (=XX bytes, UTF-8) — used for RFC 2047 header words only. */
function decodeQp(raw: string): string {
  const joined = raw.replace(/=\r?\n/g, "");
  const bytes = joined.replace(/=([0-9A-F]{2})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
  return Buffer.from(bytes, "latin1").toString("utf8");
}

/** Every message to this address (one segment per "To:" header, oldest first). */
function messagesTo(email: string): string[] {
  const raw = MAIL_LOG && fs.existsSync(MAIL_LOG) ? fs.readFileSync(MAIL_LOG, "utf8") : "";
  // The log transport writes bodies already decoded; only headers (Subject) are RFC 2047 encoded.
  return raw
    .split(/(?=^To: )/m)
    .filter((segment) => segment.startsWith(`To: ${email}`));
}

const LINK = {
  "verify-email": /https?:\/\/[^"'\s<>]+\/verify-email\?[^"'\s<>]+/g,
  "reset-password": /https?:\/\/[^"'\s<>]+\/reset-password\?[^"'\s<>]+/g,
  login: /https?:\/\/[^"'\s<>]+\/(?:ar|en)\/login(?=["'\s<>])/g,
  "forgot-password": /https?:\/\/[^"'\s<>]+\/(?:ar|en)\/forgot-password(?=["'\s<>])/g,
} as const;
export type MailLinkKind = keyof typeof LINK;

function linksIn(message: string, kind: MailLinkKind): string[] {
  return [...message.matchAll(LINK[kind])].map((m) => m[0].replace(/&amp;/g, "&"));
}

/** Messages to this address that contain a link of this kind. */
export function mailCount(email: string, kind: MailLinkKind): number {
  return messagesTo(email).filter((m) => linksIn(m, kind).length > 0).length;
}

/** The link in the newest such message, waiting until more than `after` exist. */
export async function mailLink(email: string, kind: MailLinkKind, { after = 0 } = {}): Promise<string> {
  expect(MAIL_LOG, "E2E_MAIL_LOG must point at the local mail log").not.toBe("");
  for (let attempt = 0; attempt < 40; attempt++) {
    const withLinks = messagesTo(email).filter((m) => linksIn(m, kind).length > 0);
    if (withLinks.length > after) return linksIn(withLinks[withLinks.length - 1], kind)[0];
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no ${kind} mail for ${email}`);
}

/** Decoded Subject lines sent to this address, oldest first. */
export function mailSubjects(email: string): string[] {
  return messagesTo(email).map((m) => {
    const line = m.match(/^Subject: (.*)$/m)?.[1] ?? "";
    return line.replace(/=\?utf-8\?Q\?(.*?)\?=/gi, (_, word: string) => decodeQp(word.replace(/_/g, " ")));
  });
}
