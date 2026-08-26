'use strict';

/*
 * Server-side payment-receipt protection.
 *
 * The stamp is burned into the image on the SERVER, so a customer cannot bypass
 * it from the browser. It carries the current context (table, amount due, the
 * server time and a unique token), which makes a reused/old screenshot obvious
 * to the cashier: the burned-in amount/time will not match the bank slip.
 *
 * Note: Jimp's bundled bitmap fonts are Latin/ASCII only, so the stamp text uses
 * numbers and short English labels (clear and universal for a security stamp).
 */

const crypto = require('crypto');
const Jimp = require('jimp');

const DATA_URL = /^data:image\/(png|jpe?g|webp|gif);base64,(.+)$/i;

// Fonts are loaded once and cached for reuse
let _big, _small, _tile;
async function loadFonts() {
  if (!_big) _big = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
  if (!_small) _small = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);
  if (!_tile) _tile = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);
  return { big: _big, small: _small, tile: _tile };
}

// sha256 of the decoded image bytes — used to detect a re-uploaded (identical) file
function hashImage(dataUrl) {
  const m = DATA_URL.exec(dataUrl || '');
  if (!m) return '';
  return crypto.createHash('sha256').update(Buffer.from(m[2], 'base64')).digest('hex');
}

// A short, unique verification token for this upload
function makeToken() {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

// "YYYY-MM-DD HH:MM" in local server time (ASCII, locale-independent)
function fmtTime(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// Keep only printable ASCII (Jimp fonts can't render Persian/Arabic)
function ascii(s, fallback) {
  const out = String(s || '').replace(/[^\x20-\x7E]/g, '').trim();
  return out || fallback;
}

/*
 * Burn the protective stamp into a receipt image.
 * info: { table, amount, amountText, cafe, token, date }
 * Returns a JPEG data URL (or the original input if it isn't a decodable image).
 */
async function stampReceipt(dataUrl, info) {
  const m = DATA_URL.exec(dataUrl || '');
  if (!m) return dataUrl;

  let img;
  try {
    img = await Jimp.read(Buffer.from(m[2], 'base64'));
  } catch (e) {
    return dataUrl; // unreadable image — save as-is rather than fail the upload
  }

  // Normalise size: legible stamp + smaller stored file
  if (img.bitmap.width > 1000) img.resize(1000, Jimp.AUTO);
  const W = img.bitmap.width;
  const H = img.bitmap.height;

  const { big, small, tile } = await loadFonts();
  const bandFont = W >= 560 ? big : small;
  const lineH = W >= 560 ? 34 : 20;

  const token = info.token || makeToken();
  const when = fmtTime(info.date || new Date());
  const amount = info.amountText != null ? info.amountText : String(info.amount != null ? info.amount : '');
  const cafe = ascii(info.cafe, 'CAFE');

  const lines = [
    `${cafe} - PAYMENT VERIFY`,
    `TABLE ${ascii(info.table, '?')}   DUE ${amount}`,
    `${when}   #${token}`,
  ];

  // 1) translucent dark band along the bottom with the main stamp
  const bandH = lineH * lines.length + 16;
  const band = new Jimp(W, bandH, 0x000000a0); // black at ~63% alpha
  img.composite(band, 0, H - bandH);
  lines.forEach((t, i) => img.print(bandFont, 12, H - bandH + 8 + i * lineH, t, W - 24));

  // 2) small stamp top-left, so cropping the band off still leaves evidence
  const top = new Jimp(Math.min(W, 360), lineH + 12, 0x000000a0);
  img.composite(top, 0, 0);
  img.print(small, 10, 6, `#${token}  ${when}`, W - 20);

  // 3) faint tiled token across the middle, hard to crop out entirely
  const layer = new Jimp(W, H, 0x00000000);
  const tileText = `${cafe} #${token}`;
  const stepX = Math.max(220, Math.round(W / 2));
  const stepY = Math.max(120, Math.round(H / 4));
  for (let y = Math.round(stepY / 2); y < H - bandH; y += stepY) {
    for (let x = 0; x < W; x += stepX) {
      layer.print(tile, x + ((y / stepY) % 2 ? Math.round(stepX / 2) : 0), y, tileText);
    }
  }
  layer.opacity(0.16);
  img.composite(layer, 0, 0);

  return img.getBase64Async(Jimp.MIME_JPEG);
}

module.exports = { stampReceipt, hashImage, makeToken, fmtTime };
