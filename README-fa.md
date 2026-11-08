# راهنمای بالا آوردن «کنترل اقساط» روی Cloudflare Workers (رایگان)

همه‌چیز روی **Workers** است (نه Pages)، با دیتابیس D1 به نام `aghsat-a7`،
تقویم شمسی خانگی (بدون کتابخانه)، اعلان واقعی iOS با Web Push، تم مشکی،
و امکان Sync بین چند دستگاه (چون داده روی سرور/دیتابیس مشترک است).

پیش‌نیاز: Node.js نصب باشد (نسخه ۱۸ به بالا). PowerShell را باز کن و مرحله‌به‌مرحله دستورات را بزن.

---

## ۱. نصب Wrangler و ورود به حساب Cloudflare

```powershell
cd C:\path\to\aghsat-a7
npm install
npm install -g wrangler
wrangler login
```

یک تب مرورگر باز می‌شود؛ با حساب Cloudflare (رایگان) وارد شو و اجازه بده.

---

## ۲. ساخت دیتابیس D1 به نام aghsat-a7

```powershell
wrangler d1 create aghsat-a7
```

خروجی چیزی شبیه این می‌دهد:

```
[[d1_databases]]
binding = "DB"
database_name = "aghsat-a7"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

مقدار `database_id` را کپی کن و در فایل `wrangler.toml` به‌جای
`REPLACE_WITH_DATABASE_ID` جایگزین کن (فایل را با هر ادیتوری مثل Notepad باز کن).

---

## ۳. اجرای اسکیمای دیتابیس

```powershell
wrangler d1 execute aghsat-a7 --remote --file=./schema.sql
```

---

## ۴. ساخت کلیدهای VAPID (برای اعلان واقعی روی آیفون)

```powershell
node generate-vapid.js
```

دو خط خروجی می‌گیری، شبیه:

```
VAPID_PUBLIC_KEY=BI...
VAPID_PRIVATE_KEY=k9...
```

این‌ها را در مرحله‌ی بعد استفاده می‌کنیم (هرجا نوشته `<PUBLIC_KEY>` یا `<PRIVATE_KEY>`
مقدار واقعی خودت را جایگزین کن).

---

## ۵. تنظیم رمزهای امنیتی (Secrets) روی Cloudflare

هر کدام را جدا اجرا کن؛ بعد از هر دستور، مقدار را در PowerShell تایپ/پیست کن و Enter بزن:

```powershell
wrangler secret put APP_PASSWORD
```
(یک رمز دلخواه برای ورود به اپ وارد کن — همین رمز را روی همه‌ی دستگاه‌ها استفاده می‌کنی تا Sync شوند)

```powershell
wrangler secret put VAPID_PUBLIC_KEY
```
(مقدار VAPID_PUBLIC_KEY از مرحله‌ی ۴)

```powershell
wrangler secret put VAPID_PRIVATE_KEY
```
(مقدار VAPID_PRIVATE_KEY از مرحله‌ی ۴)

```powershell
wrangler secret put VAPID_SUBJECT
```
(یک ایمیل خودت، مثلاً: mailto:you@example.com)

---

## ۶. دیپلوی روی Cloudflare Workers

```powershell
wrangler deploy
```

در پایان یک آدرس مثل زیر می‌دهد:

```
https://aghsat-a7.<your-subdomain>.workers.dev
```

همین آدرس، اپ توست — رایگان و همیشه در دسترس.

---

## ۷. استفاده از اپ

1. آدرس بالا را در مرورگر (روی گوشی و لپ‌تاپ) باز کن.
2. رمزی که در مرحله‌ی ۵ ساختی را وارد کن (روی همه‌ی دستگاه‌ها همین رمز → داده‌ها Sync می‌شوند، چون همه به یک دیتابیس وصل‌اند).
3. با دکمه‌ی «+ افزودن قسط جدید» اولین قسط را بساز: عنوان، مبلغ (با جداکننده‌ی سه‌رقمی خودکار)، تاریخ اولین سررسید از تقویم شمسی، و تعداد کل اقساط (اگر خالی بگذاری، نامحدود می‌شود).

### فعال کردن اعلان واقعی روی آیفون
اپل فقط به اپ‌هایی که به «صفحه‌ی اصلی» اضافه شده‌اند اجازه‌ی اعلان می‌دهد (iOS 16.4 به بعد). پس:
1. سایت را در **سافاری** باز کن.
2. دکمه‌ی Share (مربع با فلش) → **Add to Home Screen**.
3. از روی آیکون اضافه‌شده اپ را باز کن (نه از تب سافاری).
4. داخل اپ روی «فعال‌سازی اعلان» بزن و اجازه بده.

از این به بعد، هر روز ساعت ۸ صبح به وقت تهران، اگر قسطی «امروز» یا «فردا» سررسید داشته باشد، اعلان واقعی می‌آید.

---

## بعداً اگر خواستی چیزی را عوض کنی

بعد از هر تغییر در کدها، فقط دوباره این را بزن:

```powershell
wrangler deploy
```

## نکات فنی
- ارسال اعلان با کتابخانه‌ی `web-push` و پروتکل استاندارد Web Push انجام می‌شود، دقیقاً همان چیزی که سافاری/iOS برای PWAها پشتیبانی می‌کند — نه شبیه‌سازی، نوتیفیکیشن واقعی سیستم‌عامل.
- تقویم شمسی با یک الگوریتم ریاضی مستقل (بدون کتابخانه‌ی npm) داخل `src/index.js` و `public/index.html` پیاده شده.
- رمز ورود در یک کوکی HttpOnly ذخیره می‌شود؛ چون همه‌ی دستگاه‌ها با یک رمز به یک دیتابیس مشترک وصل می‌شوند، Sync خودکار است.
