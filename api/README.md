# OTP faqat DevSMS orqali (Telegram yo'q)

## Endpointlar

```bash
# 1. OTP so'rash
POST /api/auth/send-otp
{"phone":"+998900707081","purpose":"login"}

# 2. OTP tasdiqlash
POST /api/auth/verify-otp
{"phone":"+998900707081","code":"123456"}
```

## O'rnatish

```bash
cd api
cp .env.example .env
# DATABASE_URL va DEVSMS_TOKEN ni to'ldiring
npm install
npx prisma migrate dev
npm run start:dev
```

## Dev rejim (token yo'q)

`DEVSMS_TOKEN` bo'lmasa va `NODE_ENV` production bo'lmasa, OTP kodi server konsoliga chiqadi:

```
[DEV OTP] +998900707081 → 123456
```

Production uchun haqiqiy `DEVSMS_TOKEN` qo'ying.
