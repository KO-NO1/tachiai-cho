var EVENTS = ["view", "app_open", "first_mark", "summary", "print_blocked", "print", "pay_click", "unlock_seen", "import_fail", "export"];

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status,
    headers: { "content-type": "application/json", "cache-control": "no-store" }
  });
}

export async function onRequestPost(context) {
  var text;
  try {
    text = await context.request.text();
  } catch (e) {
    return json({ error: "bad" }, 400);
  }
  var payload;
  try {
    payload = JSON.parse(text);
  } catch (e2) {
    return json({ error: "bad" }, 400);
  }
  var name = payload && payload.event;
  if (EVENTS.indexOf(name) === -1) return json({ error: "unknown" }, 400);
  var kv = context.env && context.env.METRICS;
  if (!kv) return json({ ok: true, stored: false }, 202);
  var day = new Date().toISOString().slice(0, 10);
  await bump(kv, "total:" + name);
  await bump(kv, day + ":" + name);
  return json({ ok: true, stored: true }, 200);
}

async function bump(kv, key) {
  var current = Number(await kv.get(key)) || 0;
  await kv.put(key, String(current + 1));
}
