import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { convertV4MiniflareOptions, Miniflare } from 'miniflare';
import { unstable_splitSqlQuery } from 'wrangler';

const output = await mkdtemp(path.join(tmpdir(), 'closer-runtime-'));
let runtime;
let outbound = 0;
try {
  execFileSync(
    process.execPath,
    [
      'node_modules/wrangler/bin/wrangler.js',
      'deploy',
      '--dry-run',
      '-c',
      path.resolve('wrangler.toml'),
      '--outdir',
      output,
    ],
    { stdio: 'inherit' },
  );
  const script = await readFile(path.join(output, 'index.js'), 'utf8');
  runtime = new Miniflare(
    convertV4MiniflareOptions({
      name: 'closer-synthetic-test',
      modules: true,
      script,
      compatibilityDate: '2026-09-01',
      d1Databases: { DB: 'synthetic-test' },
      outboundService: () => {
        outbound++;
        throw new Error('Unexpected external request in isolated test');
      },
    }),
  );
  const db = await runtime.getD1Database('DB');
  const apply = async (file) => {
    for (const sql of unstable_splitSqlQuery(await readFile(file, 'utf8')))
      await db.prepare(sql).run();
  };
  for (const file of (await readdir('migrations')).filter((f) => f.endsWith('.sql')).sort())
    await apply(path.join('migrations', file));
  await apply('seeds/barbers.sql');
  const request = (route, init) => runtime.dispatchFetch(`https://example.invalid${route}`, init);
  const json = async (route) => {
    const response = await request(route);
    assert.equal(response.status, 200);
    return response.json();
  };
  const home = await request('/');
  assert.equal(home.status, 200);
  assert.match(await home.text(), /CONCEPT DEMO|concept demo|Concept demo/);
  assert.equal((await request('/admin')).status, 503);
  assert.equal((await request('/not-found')).status, 404);
  const { barbers } = await json('/api/barbers');
  assert.ok(barbers.length > 0);
  const barber = barbers[0].id;
  const { services } = await json(`/api/services?barber=${encodeURIComponent(barber)}`);
  assert.ok(services.length > 0);
  const service = services[0].slug;
  const { dates } = await json(`/api/dates?barber=${encodeURIComponent(barber)}`);
  let chosen;
  for (const date of dates) {
    const { slots } = await json(
      `/api/slots?barber=${encodeURIComponent(barber)}&service=${encodeURIComponent(service)}&date=${date}`,
    );
    if (slots.length > 1) {
      chosen = { date, slots };
      break;
    }
  }
  assert.ok(chosen, 'seeded barber must have real availability within the booking window');
  const body = () =>
    new URLSearchParams({
      barber,
      service,
      date: chosen.date,
      slotStart: String(chosen.slots[0].startTs),
      name: 'Synthetic Test',
      phone: '4155550100',
      email: '',
      notes: 'Isolated runtime test',
    });
  const booked = await request('/api/book', { method: 'POST', body: body(), redirect: 'manual' });
  assert.equal(booked.status, 303);
  const location = booked.headers.get('location');
  assert.match(location, /^\/book\/CSH-[0-9A-F]{32}$/);
  assert.equal(
    (await request('/api/book', { method: 'POST', body: body(), redirect: 'manual' })).status,
    409,
  );
  const confirmation = await request(location);
  assert.equal(confirmation.status, 200);
  assert.match(await confirmation.text(), /Synthetic Test/);
  const count = await db
    .prepare("SELECT COUNT(*) AS n FROM bookings WHERE status='confirmed'")
    .first();
  assert.equal(count.n, 1);
  const cancelled = await request(`${location}/cancel`, { method: 'POST' });
  assert.equal(cancelled.status, 200);
  const row = await db
    .prepare('SELECT status FROM bookings WHERE id=?')
    .bind(location.split('/').at(-1))
    .first();
  assert.equal(row.status, 'cancelled');
  await db
    .prepare("UPDATE bookings SET id='CSH-OLD001', status='confirmed' WHERE id=?")
    .bind(location.split('/').at(-1))
    .run();
  assert.equal((await request('/book/CSH-OLD001')).status, 200);
  assert.equal((await request('/book/CSH-OLD001/cancel', { method: 'POST' })).status, 200);
  assert.equal(outbound, 0);
  console.log(
    JSON.stringify({
      runtime: 'workerd',
      database: 'isolated D1',
      bundleSha256: createHash('sha256').update(script).digest('hex'),
      checks: [
        'SSR',
        'admin fail closed',
        '404',
        'barber/service/date/slot APIs',
        'booking',
        'duplicate rejection',
        'confirmation',
        'cancellation',
        'saved legacy reference compatibility',
      ],
      externalRequests: outbound,
    }),
  );
} finally {
  if (runtime) await runtime.dispose();
  await rm(output, { recursive: true, force: true });
}
