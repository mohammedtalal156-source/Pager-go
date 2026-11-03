import { test } from "node:test";
import assert from "node:assert/strict";
import { isLinkToken, linkMessage, subscriberLinkUrl, whatsAppShareUrl } from "./subscriber-link";

const T = "a".repeat(64);

test("subscriber link: url and token check", () => {
  assert.equal(subscriberLinkUrl("https://isp-manager-one.vercel.app/", T), `https://isp-manager-one.vercel.app/s/${T}`);
  assert.equal(isLinkToken(T), true);
  for (const v of ["", "abc", "A".repeat(64), "a".repeat(63), `${T}0`, "../settings"]) assert.equal(isLinkToken(v), false, v);
});

test("subscriber link: WhatsApp message to the subscriber's number", () => {
  const msg = linkMessage("علي", "2026/12/03", "https://x/s/1");
  assert.match(msg, /علي/);
  assert.match(msg, /2026\/12\/03/);
  assert.ok(msg.endsWith("https://x/s/1"));
  assert.doesNotMatch(linkMessage("علي", null, "u"), /ينتهي/);
  const url = whatsAppShareUrl("07701234567", msg);
  assert.ok(url.startsWith("https://wa.me/9647701234567?text="));
  assert.equal(decodeURIComponent(url.split("text=")[1]), msg);
  assert.ok(whatsAppShareUrl("123", "x").startsWith("https://wa.me/?text="), "invalid number: WhatsApp asks for the contact");
});
