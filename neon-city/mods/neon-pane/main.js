// A pane's header, for layouts that frame their panes:
//   { "tab": "active", "pane": { "header": { "content": { "mod": "islands-pane" } } } }
// Shows the program's icon (the app's program table), the agent's name or
// the terminal's title, the folder, and the agent's status; buttons split, zoom and close
// this pane. Props from the app: { pane, terminal }. Click: focus the pane.

import { View, div, svg, image } from "gpui-kit";
import { h_flex } from "gpui-base";
import { panes, props, run, theme, home, shared } from "herdr";

// The header at "main_opacity" in islands-workspace-chrome/settings.json (1 when unset), like the pane under it.
const mainFill = (c) => {
  const o = shared("islands.mainOpacity");
  if (typeof o !== "number" || o >= 1 || !/^#[0-9a-f]{6}$/i.test(c)) return c;
  return c + Math.round(Math.max(0, o) * 255).toString(16).padStart(2, "0");
};

function icon(p, size, color) {
  if (!p?.icon) return null;
  return p.tint ? svg(p.icon).size(size).flex_none().text_color(color) : image(p.icon).w(size).h(size).flex_none();
}

function folder(cwd) {
  if (!cwd) return "";
  const h = home();
  return cwd === h ? "~" : cwd.startsWith(h + "/") ? "~" + cwd.slice(h.length) : cwd;
}

export default class Pane extends View {
  init() { this.hovered = false; }

  me() {
    return panes().find((p) => p.pane === props()?.pane);
  }

  button(t, id, icon, command, args) {
    return div()
      .id(id)
      .p(3)
      .rounded(4)
      .text_color(t.dim)
      .hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_click((_e, cx) => {
        cx.stop_propagation();
        run(command, args);
      })
      .child(svg(`mods/pane/${icon}.svg`).size(14));
  }

  render(cx) {
    const t = theme();
    const p = this.me();
    if (!p) return div();
    const name = ((p.program?.agent || p.program?.shell) && p.program.name) || p.title || p.program?.name || "shell";
    const pic = icon(p.program, 14, t.dim);
    const st = p.status;
    // The header's line follows the agent: thin cyan while working, thicker and tinted otherwise.
    const LINE = { working: { w: 1, c: t.border }, idle: { w: 2, c: t.dim + "99" }, blocked: { w: 3, c: t.blocked }, error: { w: 3, c: t.blocked }, done: { w: 2, c: t.done } };
    const line = LINE[st] ?? { w: 1, c: t.border };
    const pane = p.pane;
    return h_flex()
      .id(`pane-head-${pane}`)
      .size_full()
      .px(10)
      .gap(8)
      .items_center()
      .rounded_t(13).bg(mainFill(t.background)) // sits inside a 14px card
      .border_b(line.w)
      .border_color(line.c)
      .text_size(12)
      .on_hover((hovered, cx) => { this.hovered = hovered; cx.notify(); })
      .on_click(() => run("pane.focus", { pane }))
      .when(Boolean(pic), (el) => el.child(pic))
      .child(div().flex_none().truncate().max_w(260).font_medium().text_color(t.foreground).child(name))
      .child(div().flex_1().truncate().text_color(t.dim).child(folder(p.cwd)))
      .when(Boolean(st), el => el.child(neonStatus(t, st, { key: pane })))
      .when(this.hovered, el => el
        .child(this.button(t, `ph-r-${pane}`, "split-right", "pane.split", { direction: "right", pane }))
        .child(this.button(t, `ph-d-${pane}`, "split-down", "pane.split", { direction: "down", pane }))
        .child(this.button(t, `ph-z-${pane}`, p.zoomed ? "unzoom" : "zoom", "pane.zoom", { pane }))
        .child(this.button(t, `ph-x-${pane}`, "close", "pane.close", { pane })));
  }
}

// ---- neon status badges (added for the neon-islands layout) ----
// working: two cells cycling through alien glyphs; idle (paused): breathing pause bars;
// blocked (needs you): solid pulsing alert; done: green check.
const range = (a, b, skip = () => false) => { const o = []; for (let c = a; c <= b; c++) if (!skip(c)) o.push(String.fromCodePoint(c)); return o; };
// Cyan: Runic, Ogham, Canadian syllabics (~180 glyphs).
const RUNES = [...range(0x16A0, 0x16EA), ...range(0x1681, 0x169A), ...range(0x1401, 0x1450)];
// Magenta: technical symbols (minus the emoji ones), operators, shapes, hexagons, alchemical (~230 glyphs).
const TECH = [...range(0x2300, 0x23FF, (c) => (c >= 0x231A && c <= 0x231B) || (c >= 0x23E9 && c <= 0x23F3) || (c >= 0x23F8 && c <= 0x23FA)),
  ...range(0x2A00, 0x2A2F), ...range(0x25E0, 0x25FC), ...range(0x2B21, 0x2B2F), ...range(0x1F700, 0x1F773)];
// Both cells mix both sets. Colour is per element, so two layers share one clock:
// the cyan layer shows a rune (else blank) and the magenta layer a tech glyph (else blank) on each frame.
function mixedFrames(runeShare, seed) {
  let x = seed, ri = seed % RUNES.length, ti = (seed * 7) % TECH.length;
  const rnd = () => ((x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const run = [], tec = [];
  for (let i = 0; i < 48; i++) {
    if (rnd() < runeShare) { ri = (ri + 1 + Math.floor(rnd() * 17)) % RUNES.length; run.push(RUNES[ri]); tec.push(""); }
    else { ti = (ti + 1 + Math.floor(rnd() * 17)) % TECH.length; run.push(""); tec.push(TECH[ti]); }
  }
  return [run, tec];
}
// Frames run on one shared clock, so a badge can't start late. Instead each badge (by key) gets its
// own glyph sequence and a speed within about +/-15%, so no two look alike.
const _seq = new Map();
function seqFor(key) {
  if (_seq.has(key)) return _seq.get(key);
  let h = 2166136261;
  for (const ch of String(key)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const q = { left: mixedFrames(0.75, (h % 9973) + 1), right: mixedFrames(0.25, ((h >>> 9) % 9973) + 1),
    lms: Math.round(103 * (0.85 + (h % 31) / 100)), rms: Math.round(145 * (0.85 + ((h >>> 5) % 31) / 100)) };
  _seq.set(key, q);
  return q;
}
const MAGENTA = "#ff40da"; // theme accent +10% white
const INK = "#0a0613";
// size: "full" (pill with label), "mini" (compact pill), "rail" (one narrow cell)
function neonStatus(t, status, { size = "full", key = "" } = {}) {
  const layer = (list, ms, color) => div().absolute().inset_0().flex().items_center().justify_center().font_bold().text_color(color).frames(list, ms);
  const cell = ([run, tec], ms, t, w) => div().relative().w(w).h_full().flex_none().child(layer(run, ms, t.working)).child(layer(tec, ms, MAGENTA));
  if (status === "working") {
    const q = seqFor(key);
    const w = size === "rail" ? 12 : 9;
    return h_flex().flex_none().items_center().h(size === "rail" ? 14 : 18).px(size === "rail" ? 0 : 4).rounded(5)
      .text_size(size === "rail" ? 10 : 12)
      .when(size !== "rail", el => el.bg(t.working + "22").border(1).border_color(t.working + "88"))
      .child(cell(q.left, q.lms, t, w))
      .when(size !== "rail", el => el.child(cell(q.right, q.rms, t, w)))
      .loop("opacity", { from: 0.7, to: 1, period: 700 });
  }
  if (status === "blocked" || status === "error") {
    if (size !== "full") return div().size(size === "rail" ? 14 : 16).flex_none().rounded(4).bg(t.blocked).text_size(11).font_bold().text_color(INK).flex().items_center().justify_center().child("!").loop("opacity", { from: 0.4, to: 1, period: 600 });
    return h_flex().flex_none().items_center().gap(4).px(7).h(20).rounded(6).bg(t.blocked).border(1).border_color("#ffffff66").text_size(10.5).font_bold().text_color(INK)
      .child(div().frames(["▲", "△"], 420)).child("NEEDS YOU")
      .loop("opacity", { from: 0.45, to: 1, period: 600 });
  }
  if (status === "done") {
    if (size !== "full") return div().flex_none().w(size === "rail" ? 12 : 14).flex().justify_center().text_size(12).font_bold().text_color(t.done).child("✓");
    return h_flex().flex_none().items_center().gap(4).px(6).h(18).rounded(5).bg(t.done + "26").border(1).border_color(t.done).text_size(10.5).font_bold().text_color(t.done).child("✓").child("DONE")
      .loop("opacity", { from: 0.75, to: 1, period: 1600 });
  }
  if (status === "idle") {
    return h_flex().flex_none().items_center().h(size === "rail" ? 14 : 18).px(size === "rail" ? 1 : 5).rounded(5).text_size(8).text_color(t.idle ?? t.dim)
      .when(size === "full", el => el.border(1).border_color((t.idle ?? t.dim) + "55"))
      .child("❚❚").loop("opacity", { from: 0.3, to: 0.95, period: 2600 });
  }
  return div().size(7).mx(3).flex_none().rounded(4).bg(t.dim);
}
