import { buildPushPayload } from "@block65/webcrypto-web-push";

/* ----------------------------------------------------------------
   تبدیل تاریخ شمسی <-> میلادی (الگوریتم ریاضی متن‌باز رایج، چرخه ۲۸۲۰ ساله)
   ---------------------------------------------------------------- */
function div(a, b) { return Math.floor(a / b); }
function jMod(a, b) { return a - b * div(a, b); }

/* شمارش روزهای میلادی با Date.UTC (دقیق و بدون خطای فرمول نجومی) */
function gregorianDayCount(gy, gm, gd) {
  return Math.floor(Date.UTC(gy, gm - 1, gd) / 86400000);
}
function dayCountToGregorian(days) {
  const d = new Date(days * 86400000);
  return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()];
}

function j2d(jy, jm, jd) {
  const epbase = jy - (jy >= 0 ? 474 : 473);
  const epyear = 474 + jMod(epbase, 2820);
  return (
    jd +
    (jm <= 7 ? (jm - 1) * 31 : (jm - 1) * 30 + 6) +
    div(epyear * 682 - 110, 2816) +
    (epyear - 1) * 365 +
    div(epbase, 2820) * 1029983 +
    1948320
  );
}

function d2j(jdn) {
  jdn = Math.floor(jdn);
  const depoch = jdn - j2d(475, 1, 1);
  const cycle = div(depoch, 1029983);
  const cyear = jMod(depoch, 1029983);
  let ycycle;
  if (cyear === 1029982) {
    ycycle = 2820;
  } else {
    const aux1 = div(cyear, 366);
    const aux2 = jMod(cyear, 366);
    ycycle = div(2134 * aux1 + 2816 * aux2 + 2815, 1028522) + aux1 + 1;
  }
  let jy = ycycle + 2820 * cycle + 474;
  if (jy <= 0) jy -= 1;
  const yday = jdn - j2d(jy, 1, 1) + 1;
  const jm = yday <= 186 ? Math.ceil(yday / 31) : Math.ceil((yday - 6) / 30);
  const jd = jdn - j2d(jy, jm, 1) + 1;
  return [jy, jm, jd];
}

function isLeapJalali(jy) {
  return jMod((jMod(jy - (jy > 0 ? 474 : 473), 2820) + 474 + 38) * 682, 2816) < 682;
}

function jalaliMonthLength(jy, jm) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isLeapJalali(jy) ? 30 : 29;
}

/* لنگرگاه ثابت: ۱۴۰۳/۰۱/۰۱ برابر است با ۲۰۲۴-۰۳-۲۰ (نوروز) — برای هم‌تراز کردن دو شمارش روز */
const JALALI_GREGORIAN_OFFSET = gregorianDayCount(2024, 3, 20) - j2d(1403, 1, 1);

function jalaliToGregorian(jy, jm, jd) {
  return dayCountToGregorian(j2d(jy, jm, jd) + JALALI_GREGORIAN_OFFSET);
}

function gregorianToJalaliParts(gy, gm, gd) {
  return d2j(gregorianDayCount(gy, gm, gd) - JALALI_GREGORIAN_OFFSET);
}

function todayJalali() {
  const now = new Date();
  // به وقت تهران (UTC+3:30، بدون تغییر ساعت تابستانی)
  const tehran = new Date(now.getTime() + (3.5 * 60 + now.getTimezoneOffset()) * 60000);
  return gregorianToJalaliParts(tehran.getFullYear(), tehran.getMonth() + 1, tehran.getDate());
}

/* محاسبه‌ی تاریخ سررسید یک قسط مشخص (occurrence i، صفرشمار) */
function occurrenceJalali(plan, index) {
  if (!plan.start_jyear || !plan.start_jmonth || !plan.due_day) return null;
  let jy = plan.start_jyear;
  let jm = plan.start_jmonth + index;
  jy += div(jm - 1, 12);
  jm = ((jm - 1) % 12) + 1;
  const day = Math.min(plan.due_day, jalaliMonthLength(jy, jm));
  return { jy, jm, jd: day };
}

function jalaliToDayNumber(jy, jm, jd) {
  return j2d(jy, jm, jd);
}

function fmtJalali(p) {
  const z = (n) => String(n).padStart(2, "0");
  return `${p.jy}/${z(p.jm)}/${z(p.jd)}`;
}

/* ----------------------------------------------------------------
   محاسبه‌ی وضعیت هر قسط برای پاسخ API
   ---------------------------------------------------------------- */
function buildPlanView(plan) {
  const completed = plan.total_count != null && plan.paid_count >= plan.total_count;
  const nextIndex = plan.paid_count;
  const noDate = !plan.start_jyear || !plan.start_jmonth || !plan.due_day;
  const next = completed || noDate ? null : occurrenceJalali(plan, nextIndex);
  const remaining = plan.total_count != null ? Math.max(plan.total_count - plan.paid_count, 0) : null;
  const last = plan.total_count != null && !noDate ? occurrenceJalali(plan, plan.total_count - 1) : null;
  return {
    id: plan.id,
    title: plan.title,
    amount: plan.amount,
    due_day: plan.due_day,
    start_jyear: plan.start_jyear,
    start_jmonth: plan.start_jmonth,
    no_date: noDate,
    total_count: plan.total_count,
    paid_count: plan.paid_count,
    completed,
    remaining_label: plan.total_count == null ? "نامحدود" : String(remaining),
    next_due_jalali: next ? fmtJalali(next) : null,
    next_due_sort: next ? jalaliToDayNumber(next.jy, next.jm, next.jd) : Infinity,
    last_due_jalali: last ? fmtJalali(last) : null,
  };
}

/* ----------------------------------------------------------------
   کمک‌کننده‌های HTTP
   ---------------------------------------------------------------- */
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function getCookie(request, name) {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : null;
}

function isAuthed(request, env) {
  const token = getCookie(request, "auth");
  return !!token && !!env.APP_PASSWORD && token === env.APP_PASSWORD;
}

/* ----------------------------------------------------------------
   ارسال Web Push واقعی (برای آیفون: باید اپ به صفحه‌ی اصلی اضافه شده باشد)
   ---------------------------------------------------------------- */
async function sendPushToAll(env, payload, excludeEndpoint) {
  console.log("PUSH: شروع ارسال", JSON.stringify(payload));

  try {
    const { results } = await env.DB
      .prepare(
        "SELECT id, endpoint, subscription FROM push_subscriptions"
      )
      .all();

    console.log(`PUSH: تعداد Subscription ها = ${results.length}`);

    for (const row of results) {
      if (excludeEndpoint && row.endpoint === excludeEndpoint) {
        console.log(
          "PUSH: این دستگاه به دلیل excludeEndpoint رد شد"
        );
        continue;
      }

      try {
        const subscription = JSON.parse(row.subscription);

        console.log(
          `PUSH: در حال ساخت Push برای subscription id=${row.id}`
        );

        const vapid = {
          subject:
            env.VAPID_SUBJECT || "mailto:admin@example.com",
          publicKey: env.VAPID_PUBLIC_KEY,
          privateKey: env.VAPID_PRIVATE_KEY,
        };

        const message = {
          data: JSON.stringify(payload),
          options: {
            ttl: 3600,
          },
        };

        const pushRequest = await buildPushPayload(
          message,
          subscription,
          vapid
        );

        console.log(
          `PUSH: ارسال درخواست به id=${row.id}`
        );

        const response = await fetch(
          subscription.endpoint,
          {
            method: "POST",
            headers: pushRequest.headers,
            body: pushRequest.body,
          }
        );

        const responseText = await response.text();

        if (!response.ok) {
          console.error(
            `PUSH ERROR: id=${row.id}, status=${response.status}`,
            responseText
          );

          // Subscription منقضی یا حذف شده
          if (
            response.status === 404 ||
            response.status === 410
          ) {
            await env.DB
              .prepare(
                "DELETE FROM push_subscriptions WHERE id = ?"
              )
              .bind(row.id)
              .run();

            console.log(
              `PUSH: subscription نامعتبر حذف شد id=${row.id}`
            );
          }

          continue;
        }

        console.log(
          `PUSH: ارسال موفق id=${row.id}, status=${response.status}`
        );
      } catch (err) {
        console.error(
          `PUSH ERROR: id=${row.id}`,
          err?.stack || err?.message || String(err)
        );
      }
    }

    console.log("PUSH: پایان ارسال");
  } catch (err) {
    console.error(
      "PUSH ERROR: خطای کلی",
      err?.stack || err?.message || String(err)
    );
  }
}

/* ----------------------------------------------------------------
   Worker
   ---------------------------------------------------------------- */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/api/login" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      if (env.APP_PASSWORD && body.password === env.APP_PASSWORD) {
        const headers = new Headers({ "Content-Type": "application/json; charset=utf-8" });
        headers.append(
          "Set-Cookie",
          `auth=${encodeURIComponent(env.APP_PASSWORD)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`
        );
        return new Response(JSON.stringify({ ok: true }), { headers });
      }
      return json({ ok: false, error: "رمز اشتباه است" }, 401);
    }

    if (path === "/api/logout" && request.method === "POST") {
      const headers = new Headers({ "Content-Type": "application/json; charset=utf-8" });
      headers.append("Set-Cookie", "auth=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
      return new Response(JSON.stringify({ ok: true }), { headers });
    }

    if (path.startsWith("/api/")) {
      if (!isAuthed(request, env)) return json({ ok: false, error: "unauthorized" }, 401);

      if (path === "/api/me" && request.method === "GET") return json({ ok: true });

      if (path === "/api/vapid-public-key" && request.method === "GET") {
        return json({ key: env.VAPID_PUBLIC_KEY || "" });
      }

      if (path === "/api/push/subscribe" && request.method === "POST") {
        const sub = await request.json();
        await env.DB.prepare(
          "INSERT INTO push_subscriptions (endpoint, subscription) VALUES (?, ?) ON CONFLICT(endpoint) DO UPDATE SET subscription = excluded.subscription"
        ).bind(sub.endpoint, JSON.stringify(sub)).run();
        return json({ ok: true });
      }

      if (path === "/api/push/unsubscribe" && request.method === "POST") {
        const { endpoint } = await request.json();
        await env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").bind(endpoint).run();
        return json({ ok: true });
      }

      if (path === "/api/plans" && request.method === "GET") {
        const { results } = await env.DB.prepare("SELECT * FROM plans").all();
        const views = results.map(buildPlanView);
        views.sort((a, b) => {
          // انجام شده‌ها همیشه آخر لیست
          if (a.completed !== b.completed) return a.completed ? 1 : -1;
          // بدون تاریخ‌های پرداخت نشده بعد از اقساط تاریخ‌دار
          if (a.no_date !== b.no_date) return a.no_date ? 1 : -1;
          // نزدیک‌ترین سررسید اول
          return a.next_due_sort - b.next_due_sort;
        });
        const active = views.filter((v) => !v.completed);
        const totalMonthly = active.reduce((s, v) => s + v.amount, 0);
        let nextUp = null;
        for (const v of active) {
          if (!nextUp || v.next_due_sort < nextUp.next_due_sort) nextUp = v;
        }
        return json({
          ok: true,
          plans: views,
          summary: {
            total_monthly: totalMonthly,
            next_due_jalali: nextUp ? nextUp.next_due_jalali : null,
            next_due_title: nextUp ? nextUp.title : null,
            next_due_sort: nextUp ? nextUp.next_due_sort : null,
          },
        });
      }

      if (path === "/api/plans" && request.method === "POST") {
        const b = await request.json();
        if (!b.title || !b.amount) return json({ ok: false, error: "عنوان و مبلغ الزامی است" }, 400);
        const noDate = !!b.no_date;
        const startJyear = noDate ? 0 : Number(b.start_jyear);
        const startJmonth = noDate ? 0 : Number(b.start_jmonth);
        const dueDay = noDate ? 0 : Number(b.due_day);
        if (!noDate && (!startJyear || !startJmonth || !dueDay)) return json({ ok: false, error: "تاریخ سررسید را انتخاب کنید یا گزینه بدون تاریخ را فعال کنید" }, 400);
        const totalCount = b.total_count ? Number(b.total_count) : null;
        await env.DB.prepare(
          "INSERT INTO plans (title, amount, start_jyear, start_jmonth, due_day, total_count) VALUES (?,?,?,?,?,?)"
        ).bind(b.title, Number(b.amount), startJyear, startJmonth, dueDay, totalCount).run();
        ctx.waitUntil(sendPushToAll(env, { title: "قسط جدید اضافه شد", body: b.title }, b.client_endpoint));
        return json({ ok: true });
      }

      const planIdMatch = path.match(/^\/api\/plans\/(\d+)$/);
      if (planIdMatch && request.method === "PUT") {
        const id = Number(planIdMatch[1]);
        const b = await request.json();
        if (!b.title || !b.amount) return json({ ok: false, error: "عنوان و مبلغ الزامی است" }, 400);
        const noDate = !!b.no_date;
        const startJyear = noDate ? 0 : Number(b.start_jyear);
        const startJmonth = noDate ? 0 : Number(b.start_jmonth);
        const dueDay = noDate ? 0 : Number(b.due_day);
        if (!noDate && (!startJyear || !startJmonth || !dueDay)) return json({ ok: false, error: "تاریخ سررسید را انتخاب کنید یا گزینه بدون تاریخ را فعال کنید" }, 400);
        const totalCount = b.total_count ? Number(b.total_count) : null;
        await env.DB.prepare(
          "UPDATE plans SET title=?, amount=?, start_jyear=?, start_jmonth=?, due_day=?, total_count=? WHERE id=?"
        ).bind(b.title, Number(b.amount), startJyear, startJmonth, dueDay, totalCount, id).run();
        ctx.waitUntil(sendPushToAll(env, { title: "قسط ویرایش شد", body: b.title }, b.client_endpoint));
        return json({ ok: true });
      }

      if (planIdMatch && request.method === "DELETE") {
        const id = Number(planIdMatch[1]);
        const b = await request.json().catch(() => ({}));
        const plan = await env.DB.prepare("SELECT title FROM plans WHERE id=?").bind(id).first();
        await env.DB.prepare("DELETE FROM payments WHERE plan_id=?").bind(id).run();
        await env.DB.prepare("DELETE FROM plans WHERE id=?").bind(id).run();
        if (plan) ctx.waitUntil(sendPushToAll(env, { title: "قسط حذف شد", body: plan.title }, b.client_endpoint));
        return json({ ok: true });
      }

      const payMatch = path.match(/^\/api\/plans\/(\d+)\/pay$/);
      if (payMatch && request.method === "POST") {
        const id = Number(payMatch[1]);
        const b = await request.json().catch(() => ({}));
        const plan = await env.DB.prepare("SELECT * FROM plans WHERE id=?").bind(id).first();
        if (!plan) return json({ ok: false, error: "not found" }, 404);
        if (plan.total_count != null && plan.paid_count >= plan.total_count) {
          return json({ ok: false, error: "این طرح تسویه شده است" }, 400);
        }
        await env.DB.prepare("INSERT INTO payments (plan_id, occurrence_index) VALUES (?, ?)").bind(id, plan.paid_count).run();
        await env.DB.prepare("UPDATE plans SET paid_count = paid_count + 1 WHERE id=?").bind(id).run();
        ctx.waitUntil(sendPushToAll(env, { title: "پرداخت ثبت شد", body: plan.title }, b.client_endpoint));
        return json({ ok: true });
      }

      const unpayMatch = path.match(/^\/api\/plans\/(\d+)\/undo$/);
      if (unpayMatch && request.method === "POST") {
        const id = Number(unpayMatch[1]);
        const b = await request.json().catch(() => ({}));
        const plan = await env.DB.prepare("SELECT * FROM plans WHERE id=?").bind(id).first();
        if (!plan || plan.paid_count <= 0) return json({ ok: false, error: "چیزی برای لغو نیست" }, 400);
        const newCount = plan.paid_count - 1;
        await env.DB.prepare("DELETE FROM payments WHERE plan_id=? AND occurrence_index=?").bind(id, newCount).run();
        await env.DB.prepare("UPDATE plans SET paid_count = ? WHERE id=?").bind(newCount, id).run();
        ctx.waitUntil(sendPushToAll(env, { title: "لغو پرداخت", body: plan.title }, b.client_endpoint));
        return json({ ok: true });
      }

      return json({ ok: false, error: "not found" }, 404);
    }

    // فایل‌های استاتیک (رابط کاربری)
    return env.ASSETS.fetch(request);
  },

  async scheduled(event, env, ctx) {
    const { results: plans } = await env.DB.prepare("SELECT * FROM plans").all();
    const today = todayJalali();
    const todayNum = j2d(today[0], today[1], today[2]);

    for (const plan of plans) {
      const completed = plan.total_count != null && plan.paid_count >= plan.total_count;
      const noDate = !plan.start_jyear || !plan.start_jmonth || !plan.due_day;
      if (completed || noDate) continue;
      const occ = occurrenceJalali(plan, plan.paid_count);
      const occNum = j2d(occ.jy, occ.jm, occ.jd);
      const diff = occNum - todayNum;

      let kind = null;
      if (diff === 0) kind = "due_day";
      else if (diff === 1) kind = "day_before";
      if (!kind) continue;

      const already = await env.DB.prepare(
        "SELECT 1 FROM sent_notifications WHERE plan_id=? AND occurrence_index=? AND kind=?"
      ).bind(plan.id, plan.paid_count, kind).first();
      if (already) continue;

      const amountFa = Number(plan.amount).toLocaleString("en-US").replace(/,/g, "،");
      const title = kind === "due_day" ? `سررسید امروز: ${plan.title}` : `فردا سررسید دارد: ${plan.title}`;
      const bodyText = `مبلغ ${amountFa} ریال`;

      await sendPushToAll(env, { title, body: bodyText });
      await env.DB.prepare(
        "INSERT INTO sent_notifications (plan_id, occurrence_index, kind) VALUES (?,?,?)"
      ).bind(plan.id, plan.paid_count, kind).run();
    }
  },
};
