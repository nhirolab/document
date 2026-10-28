// メルマガ登録者プレゼントの ZIP を作る。
//   使い方: FONT_DIR=<Noto Sans JP の noto-local.css と fonts/ があるフォルダ> node build.js
//   できるもの: dist/動画くるっと回転_平日30分のAI創作ログ.zip
//     ├ 動画くるっと回転.html（アプリ）
//     ├ 使い方ガイド.pdf
//     └ 利用ルール.txt
const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { chromium } = require("playwright");

const GIFT = __dirname;
const APP_DIR = path.dirname(GIFT);
const FONT_DIR = process.env.FONT_DIR;
const DIST = path.join(GIFT, "dist");
const PACK = path.join(DIST, "動画くるっと回転_平日30分のAI創作ログ");
const ZIP = PACK + ".zip";

if (!FONT_DIR || !fs.existsSync(path.join(FONT_DIR, "noto-local.css"))) {
  console.error("FONT_DIR に noto-local.css と fonts/ があるフォルダを指定してください。");
  process.exit(1);
}

const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2" };

// video-rotate/ を配る。フォントだけは FONT_DIR から配る。
function serve(req, res) {
  const url = decodeURIComponent(req.url.split("?")[0]);
  const file = url.startsWith("/gift/noto-local.css") || url.startsWith("/gift/fonts/")
    ? path.join(FONT_DIR, url.slice("/gift/".length))
    : path.join(APP_DIR, url);
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
}

// Windows のメモ帳でも文字化けしないように、BOM つき・改行 CRLF にする
const toWindowsText = (text) => "﻿" + text.replace(/\r?\n/g, "\r\n");

(async () => {
  fs.rmSync(PACK, { recursive: true, force: true });
  fs.rmSync(ZIP, { force: true });
  fs.mkdirSync(PACK, { recursive: true });

  const server = http.createServer(serve).listen(0);
  const port = server.address().port;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`http://localhost:${port}/gift/guide.html`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({
    path: path.join(PACK, "使い方ガイド.pdf"),
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: true,
    headerTemplate: "<span></span>",
    footerTemplate: '<div style="width:100%;text-align:center;font-size:8pt;color:#5b6678;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
  });
  await browser.close();
  server.close();

  fs.copyFileSync(path.join(APP_DIR, "index.html"), path.join(PACK, "動画くるっと回転.html"));
  fs.writeFileSync(path.join(PACK, "利用ルール.txt"), toWindowsText(fs.readFileSync(path.join(GIFT, "利用ルール.txt"), "utf8")));

  // ZIP（日本語のファイル名が化けないように UTF-8 で記録する）
  execFileSync("python3", ["-I", "-c", `
import os, sys, zipfile
pack, out = sys.argv[1], sys.argv[2]
base = os.path.basename(pack)
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for name in sorted(os.listdir(pack)):
        z.write(os.path.join(pack, name), base + "/" + name)
`, PACK, ZIP]);
  console.log("できました:", ZIP);
})();
