// Server-only endpoint and response contracts, ported from proxy/core.py.
export const ORIGIN = "https://austa-map-test.austahelper.workers.dev";
export const LIMIT = 2000000;
export const CATS = {
  fuel: "service.vehicle.fuel",
  charging: "service.vehicle.charging_station",
  repair: "service.vehicle.repair",
  wash: "service.vehicle.car_wash",
};
export class Denied extends Error {
  constructor(code = "DENIED", status = 403) {
    super(code);
    this.code = code;
    this.status = status;
  }
}
const deny = (code = "PARAMETERS", status = 400) => {
  throw new Denied(code, status);
};
export const sha = async (text) =>
  [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
    ),
  ]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
export function boundary(shape) {
  if (!["Polygon", "MultiPolygon"].includes(shape.type)) deny("BOUNDARY", 503);
  const polys = (
    shape.type === "Polygon" ? [shape.coordinates] : shape.coordinates
  ).map((p) => {
    const xs = p[0].map((c) => c[0]),
      ys = p[0].map((c) => c[1]);
    return {
      p,
      b: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
    };
  });
  const ring = (r, x, y) => {
    let inside = false;
    for (let i = 1; i < r.length; i++) {
      const [a, b] = r[i - 1],
        [c, d] = r[i];
      if (
        Math.min(a, c) <= x &&
        x <= Math.max(a, c) &&
        Math.min(b, d) <= y &&
        y <= Math.max(b, d) &&
        Math.abs((x - a) * (d - b) - (y - b) * (c - a)) < 1e-12
      )
        return true;
      if (b > y !== d > y && x < ((c - a) * (y - b)) / (d - b) + a)
        inside = !inside;
    }
    return inside;
  };
  return (x, y) =>
    Number.isFinite(x) &&
    Number.isFinite(y) &&
    polys.some(
      ({ p, b }) =>
        x >= b[0] &&
        x <= b[2] &&
        y >= b[1] &&
        y <= b[3] &&
        ring(p[0], x, y) &&
        !p.slice(1).some((h) => ring(h, x, y)),
    );
}
export function viewport(value, contains) {
  const b = value?.split(",").map(Number);
  if (!b || b.length !== 4 || b.some((x) => !Number.isFinite(x)))
    deny("BOUNDS");
  const [w, s, e, n] = b;
  if (
    !(
      44.7 <= w &&
      w < e &&
      e <= 50.95 &&
      38.3 <= s &&
      s < n &&
      n <= 41.95 &&
      e - w <= 0.5 &&
      n - s <= 0.5 &&
      contains((w + e) / 2, (s + n) / 2)
    )
  )
    deny("BOUNDS");
  return b;
}
export function plan(url, contains) {
  if (url.search.length > 1600) deny();
  const pairs = [...url.searchParams];
  const p = Object.fromEntries(pairs);
  if (pairs.length !== Object.keys(p).length) deny();
  const route = url.pathname.replace("/map-api", "");
  let endpoint,
    q,
    cost,
    ttl,
    box = null;
  const exact = (allowed, required = allowed) => {
    if (
      Object.keys(p).some((k) => !allowed.includes(k)) ||
      required.some((k) => !Object.hasOwn(p, k))
    )
      deny();
  };
  const txt = (s, min = 0) =>
    typeof s === "string" &&
    s.length >= min &&
    s.length <= 120 &&
    !/[\x00-\x1f\x7f]/.test(s);
  if (route === "/places") {
    exact(["box", "category", "page", "name"], ["box", "category"]);
    box = viewport(p.box, contains);
    if (
      ![...Object.keys(CATS), "all"].includes(p.category) ||
      !["0", "1", "2"].includes(p.page || "0") ||
      !txt(p.name || "")
    )
      deny();
    endpoint = "https://api.geoapify.com/v2/places";
    q = {
      categories: CATS[p.category] || Object.values(CATS).join(","),
      filter: "rect:" + box.join(","),
      limit: "20",
      offset: String(Number(p.page || 0) * 20),
      lang: "az",
    };
    if (p.name) q.name = p.name;
    cost = 12;
    ttl = 60;
  } else if (route === "/geocode") {
    exact(["text"]);
    if (!txt(p.text, 2)) deny();
    endpoint = "https://api.geoapify.com/v1/geocode/search";
    q = {
      text: /azərbaycan|azerbaijan|азербайджан/i.test(p.text)
        ? p.text
        : p.text + ", Azərbaycan",
      filter: "countrycode:az",
      limit: "5",
      lang: "az",
    };
    cost = 4;
    ttl = 0;
  } else if (route === "/tile") {
    exact(["box", "z", "x", "y"]);
    box = viewport(p.box, contains);
    if (["z", "x", "y"].some((k) => !/^\d{1,6}$/.test(p[k]))) deny();
    const z = Number(p.z),
      x = Number(p.x),
      y = Number(p.y),
      m = 2 ** z;
    if (z < 12 || z > 18 || x >= m || y >= m) deny();
    const lat = (r) =>
      (Math.atan(Math.sinh(Math.PI * (1 - (2 * r) / m))) * 180) / Math.PI;
    const w = (x / m) * 360 - 180,
      e = ((x + 1) / m) * 360 - 180,
      s = lat(y + 1),
      n = lat(y);
    if (e < box[0] || w > box[2] || n < box[1] || s > box[3]) deny("BOUNDS");
    endpoint = `https://maps.geoapify.com/v1/tile/osm-carto/${z}/${x}/${y}.png`;
    q = {};
    cost = 1;
    ttl = 300;
  } else deny("ENDPOINT", 404);
  const u = new URL(endpoint);
  for (const k of Object.keys(q).sort()) u.searchParams.set(k, q[k]);
  return { route, url: u.href, cost, ttl, box };
}
export function png(body) {
  const a = new Uint8Array(body),
    v = new DataView(a.buffer, a.byteOffset, a.byteLength);
  if (
    a.length < 45 ||
    [137, 80, 78, 71, 13, 10, 26, 10].some((x, i) => a[i] !== x)
  )
    deny("UPSTREAM", 502);
  let o = 8,
    count = 0,
    idat = false,
    ended = false;
  while (o < a.length) {
    if (o + 12 > a.length || ++count > 1024) deny("UPSTREAM", 502);
    const size = v.getUint32(o),
      end = o + 12 + size,
      kind = String.fromCharCode(...a.slice(o + 4, o + 8));
    if (
      end > a.length ||
      !["IHDR", "PLTE", "IDAT", "tRNS", "IEND"].includes(kind)
    )
      deny("UPSTREAM", 502);
    let crc = 0xffffffff;
    for (let j = o + 4; j < end - 4; j++) {
      crc ^= a[j];
      for (let k = 0; k < 8; k++)
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    if ((crc ^ 0xffffffff) >>> 0 !== v.getUint32(end - 4))
      deny("UPSTREAM", 502);
    if (count === 1) {
      if (
        kind !== "IHDR" ||
        size !== 13 ||
        ![v.getUint32(16), v.getUint32(20)].every((n) => n >= 1 && n <= 512)
      )
        deny("UPSTREAM", 502);
    } else if (kind === "IHDR") deny("UPSTREAM", 502);
    idat ||= kind === "IDAT";
    o = end;
    if (kind === "IEND") {
      if (size || o !== a.length || !idat) deny("UPSTREAM", 502);
      ended = true;
      break;
    }
  }
  if (!ended) deny("UPSTREAM", 502);
  return a;
}
export async function safeResponse(response, p, contains, secret) {
  if (response.status !== 200 || response.redirected) deny("UPSTREAM", 502);
  const mime = (response.headers.get("content-type") || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (!response.body) deny("UPSTREAM", 502);
  const reader = response.body.getReader(),
    parts = [];
  let size = 0;
  try {
    while (true) {
      const r = await reader.read();
      if (r.done) break;
      size += r.value.length;
      if (size > LIMIT) deny("UPSTREAM", 502);
      parts.push(r.value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const a of parts) {
    body.set(a, offset);
    offset += a.length;
  }
  if (new TextDecoder().decode(body).includes(secret)) deny("UPSTREAM", 502);
  if (p.route === "/tile") {
    if (mime !== "image/png") deny("UPSTREAM", 502);
    return { mime, body: png(body) };
  }
  if (!["application/json", "application/geo+json"].includes(mime))
    deny("UPSTREAM", 502);
  let data;
  try {
    data = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
  } catch {
    deny("UPSTREAM", 502);
  }
  if (
    data?.type !== "FeatureCollection" ||
    !Array.isArray(data.features) ||
    data.features.length > (p.route === "/geocode" ? 5 : 20)
  )
    deny("UPSTREAM", 502);
  const features = [];
  for (const f of data.features) {
    const pr = f?.properties,
      c = f?.geometry?.coordinates;
    if (
      !pr ||
      typeof pr !== "object" ||
      f.geometry.type !== "Point" ||
      !Array.isArray(c) ||
      c.length !== 2 ||
      c.some((x) => typeof x !== "number" || !Number.isFinite(x))
    )
      deny("UPSTREAM", 502);
    const [x, y] = c;
    if (
      String(pr.country_code).toLowerCase() !== "az" ||
      !contains(x, y) ||
      (p.box &&
        !(p.box[0] <= x && x <= p.box[2] && p.box[1] <= y && y <= p.box[3]))
    )
      continue;
    const safe = { country_code: "az" };
    for (const field of [
      "name",
      "brand",
      "operator",
      "formatted",
      "city",
      "county",
      "address_line2",
      "place_id",
    ]) {
      const s = pr[field];
      if (
        typeof s === "string" &&
        s.length <= (field === "place_id" ? 2048 : 300)
      ) {
        if (/[\x00-\x1f\x7f]/.test(s) || s.includes(secret))
          deny("UPSTREAM", 502);
        safe[field] = s;
      }
    }
    if (p.route === "/places") {
      if (!Array.isArray(pr.categories)) deny("UPSTREAM", 502);
      safe.categories = pr.categories
        .filter(
          (c) =>
            typeof c === "string" &&
            c.length < 100 &&
            Object.values(CATS).some((b) => c === b || c.startsWith(b + ".")),
        )
        .slice(0, 20);
      if (!safe.categories.length) continue;
    }
    const phone = pr.contact?.phone || pr.datasource?.raw?.phone;
    if (typeof phone === "string" && /^\+?[0-9 ()-]{5,30}$/.test(phone))
      safe.contact = { phone };
    const raw = {};
    for (const k of ["service:vehicle:tyres", "service:vehicle:tyres_repair", "service:vehicle:alignment"])
      if (pr.datasource?.raw?.[k] === "yes") raw[k] = "yes";
    if (pr.datasource?.raw?.shop === "tyres") raw.shop = "tyres";
    if (Object.keys(raw).length) safe.datasource = { raw };
    features.push({
      type: "Feature",
      properties: safe,
      geometry: { type: "Point", coordinates: c },
    });
  }
  return {
    mime: "application/json",
    body: new TextEncoder().encode(
      JSON.stringify({ type: "FeatureCollection", features, ...(p.route === "/places" ? {hasMore: data.features.length === 20} : {}) }),
    ),
  };
}
