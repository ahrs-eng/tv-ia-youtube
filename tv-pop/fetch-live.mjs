import { writeFileSync, readFileSync } from "node:fs";
import { get } from "node:https";

const rss = "https://news.google.com/rss/search?q=Marina+Ruy+Barbosa+OR+Anitta+OR+Ludmilla&hl=pt-BR&gl=BR&ceid=BR:pt-419";
const file = new URL("./live.json", import.meta.url);

function fetchText(url) {
  return new Promise(function (resolve, reject) {
    get(url, { headers: { "User-Agent": "tv-pop-live" } }, function (res) {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchText(res.headers.location).then(resolve, reject);
        res.resume();
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error("HTTP " + res.statusCode));
        return;
      }
      const chunks = [];
      res.on("data", function (c) { chunks.push(c); });
      res.on("end", function () { resolve(Buffer.concat(chunks).toString("utf8")); });
    }).on("error", reject);
  });
}

function decode(text) {
  return text
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function weightOf(title) {
  const t = title.toLowerCase();
  if (t.indexOf("marina") >= 0 || t.indexOf("luma costa") >= 0 || t.indexOf("anitta") >= 0 || t.indexOf("ludmilla") >= 0) return 3;
  return 1;
}

function themeOf(title) {
  const t = title.toLowerCase();
  if (t.indexOf("marina") >= 0 || t.indexOf("luma") >= 0 || t.indexOf("nati") >= 0) return "marina";
  if (t.indexOf("anitta") >= 0) return "anitta";
  if (t.indexOf("ludmilla") >= 0) return "ludmilla";
  return "pop";
}

const xml = await fetchText(rss);
const live = JSON.parse(readFileSync(file, "utf8"));
const headlines = [];
const re = /<item>([\s\S]*?)<\/item>/g;
let match;
while ((match = re.exec(xml)) && headlines.length < 12) {
  const block = match[1];
  const title = decode((block.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "").replace(/\s+/g, " ").trim();
  const date = ((block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || "").trim();
  if (!title || title.length < 24) continue;
  const source = title.split(" - ").pop().trim();
  const text = title.split(" - ").slice(0, -1).join(" - ").trim() || title;
  headlines.push({
    text: text,
    source: source,
    date: date ? date.replace(/^(\w+,\s*)?/, "").slice(0, 11).trim() : "NÃO DEFINIDO",
    hot: weightOf(title) >= 3,
    theme: themeOf(title),
    weight: weightOf(title)
  });
}
if (!headlines.length) {
  console.error("RSS sem manchete. live.json permanece.");
  process.exit(0);
}
live.updated = new Date().toISOString();
live.headlines = headlines;
writeFileSync(file, JSON.stringify(live, null, 2) + "\n");
console.log("manchetes", headlines.length);
