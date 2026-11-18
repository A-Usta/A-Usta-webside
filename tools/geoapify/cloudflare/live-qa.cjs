"use strict";
// Explicit manual TEST only. No provider credential, HAR, trace or raw header capture.
const fs = require("node:fs"),
  path = require("node:path"),
  { chromium } = require("../../../tests/node_modules/playwright");
const origin = "https://austa-map-test.austahelper.workers.dev";
const regions = [
  ["Bakı", 40.4093, 49.8671],
  ["Sumqayıt", 40.5897, 49.6682],
  ["Gəncə", 40.6828, 46.3606],
  ["Şəki", 41.1919, 47.1706],
  ["Quba", 41.3611, 48.5134],
  ["Xınalıq", 41.1786, 48.1268],
  ["Lənkəran", 38.752, 48.8506],
  ["Ağdam", 39.9908, 46.9274],
  ["Naxçıvan", 39.2089, 45.4122],
];
(async () => {
  if (
    process.env.AUSTA_CF_LIVE_APPROVED !== "YES_TEST_ONLY" ||
    !process.env.AUSTA_CF_EVIDENCE
  )
    throw Error("MANUAL_TEST_APPROVAL_REQUIRED");
  const dir = path.resolve(process.env.AUSTA_CF_EVIDENCE);
  fs.mkdirSync(dir, { recursive: true });
  const report = {
    source: "real deployed TEST; no fixtures",
    regional: [],
    visual: [],
    status: "INCOMPLETE",
    requests: 0,
  };
  let b;
  try {
    b = await chromium.launch({ args: ["--no-sandbox"] });
    for (const width of [1536, 390]) {
      const context = await b.newContext({
          viewport: { width, height: 1100 },
          serviceWorkers: "block",
          ignoreHTTPSErrors: false,
        }),
        p = await context.newPage();
      let leaked = false,
        rate = false;
      const errors = [];
      p.on("request", (r) => {
        const u = new URL(r.url());
        if (u.searchParams.has("apiKey") || u.hostname.endsWith("geoapify.com"))
          leaked = true;
        if (u.origin === origin && u.pathname.startsWith("/map-api/"))
          report.requests++;
      });
      p.on("response", (r) => {
        if (r.status() === 429 && new URL(r.url()).origin === origin)
          rate = true;
      });
      p.on("pageerror", () => errors.push("PAGE_ERROR"));
      const response = await p.goto(origin, { timeout: 30000 });
      if (response.status() !== 200) throw Error("TEST_ORIGIN_REJECTED");
      await p.locator("#austaMapEntry").click();
      await p.waitForSelector(".am-marker", { timeout: 25000 });
      await p.waitForFunction(
        () => document.querySelectorAll(".leaflet-tile-loaded").length >= 4,
        { timeout: 25000 },
      );
      const result = await p.evaluate(() => ({
        width: innerWidth,
        tiles: [...document.querySelectorAll(".leaflet-tile-loaded")].filter(
          (i) => i.naturalWidth > 0,
        ).length,
        markers: document.querySelectorAll(".am-marker").length,
        keyFree: AUSTA_MAP_SETTINGS.geoapifyBrowserKey === "",
        cookieHidden: !document.cookie.includes("__Host-austa-map"),
        overflow: document.documentElement.scrollWidth > innerWidth,
        names: [...document.querySelectorAll(".am-result")].map(
          (x) => x.textContent,
        ),
      }));
      if (
        leaked ||
        !result.keyFree ||
        !result.cookieHidden ||
        result.overflow ||
        errors.length
      )
        throw Error("VISUAL_SECURITY_GATE");
      await p.locator(".am-map").scrollIntoViewIfNeeded();
      await p.screenshot({ path: path.join(dir, `baku-${width}.png`) });
      await p.locator(".am-marker").first().click();
      await p.waitForSelector(".leaflet-popup");
      const link = await p
        .locator(".leaflet-popup .am-directions")
        .getAttribute("href");
      if (
        !link?.startsWith("https://www.google.com/maps/dir/?api=1&destination=")
      )
        throw Error("DIRECTIONS_GATE");
      await p.screenshot({ path: path.join(dir, `baku-popup-${width}.png`) });
      report.visual.push({
        ...result,
        popup: true,
        directions: link,
        rateLimited: rate,
      });
      // Capture both widths before bounded regional sampling; never reset a backend budget.
      if (width === 390) {
        for (const [name, lat, lon] of regions) {
          const data = await p.evaluate(
            async ({ origin, lat, lon }) => {
              const box = [
                lon - 0.025,
                lat - 0.025,
                lon + 0.025,
                lat + 0.025,
              ].join(",");
              const r = await fetch(
                origin +
                  "/map-api/places?category=all&box=" +
                  encodeURIComponent(box),
                {
                  credentials: "same-origin",
                  cache: "no-store",
                  redirect: "error",
                },
              );
              if (r.status !== 200) return { status: r.status };
              const j = await r.json();
              return { status: 200, features: j.features };
            },
            { origin, lat, lon },
          );
          const counts = { fuel: 0, charging: 0, repair: 0, wash: 0 };
          for (const f of data.features || []) {
            for (const [k, c] of Object.entries({
              fuel: "service.vehicle.fuel",
              charging: "service.vehicle.charging_station",
              repair: "service.vehicle.repair",
              wash: "service.vehicle.car_wash",
            }))
              if (
                f.properties.categories?.some(
                  (x) => x === c || x.startsWith(c + "."),
                )
              )
                counts[k]++;
          }
          report.regional.push({ name, status: data.status, ...counts });
          if (data.status === 429) {
            report.budgetStopped = true;
            break;
          }
          if (data.status !== 200) throw Error("REGIONAL_UPSTREAM_GATE");
          await p.waitForTimeout(600);
        }
      }
      await context.close();
    }
    report.status =
      report.regional.length === 9 &&
      report.regional.every((x) => x.status === 200) &&
      report.visual.length === 2
        ? "PARTIAL_API_AND_BAKU_VISUAL"
        : "PARTIAL_BUDGET_OR_COVERAGE";
    // Partial coverage is not a green live release gate.
    if (report.status !== "COMPLETE") process.exitCode = 1;
    // Region API coverage is distinct from full nine-region interaction certification.
  } catch (e) {
    report.error = String(e.message)
      .split("\n")[0]
      .replace(/https?:\/\/\S+/g, "[URL]")
      .slice(0, 180);
    report.status = "BLOCKED_OR_FAILED";
    process.exitCode = 1;
  } finally {
    await b?.close();
    fs.writeFileSync(
      path.join(dir, "report.json"),
      JSON.stringify(report, null, 2),
    );
    console.log(
      JSON.stringify({
        status: report.status,
        visual: report.visual.length,
        regions: report.regional.length,
        requests: report.requests,
      }),
    );
  }
})();
