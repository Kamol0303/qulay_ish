# setRole.js — Foydalanish qo'llanmasi

Bu skript `profiles/{uid}` hujjatidagi `role` maydonini yangilash uchun mo'ljallangan. Xavfsiz foydalanish uchun Firebase Admin SDK servis hisobini ishlatadi.

Eslatma: servis hisob (serviceAccount JSON) maxfiy hujjat hisoblanadi — hech qachon jamoaviy repoda joylashtirmang.

## Talablar

- Node.js o'rnatilgan bo'lishi kerak (14+)
- Firebase loyihangizdan servis hisob JSON faylini yuklab oling

## Ishlatish

1. `serviceAccountKey.json` faylini loyihangizga joylang yoki serverga yuklang (masalan `/home/ubuntu/serviceAccountKey.json`).
2. Skriptni ishga tushiring:

```bash
node scripts/setRole.js /path/to/serviceAccountKey.json <uid> <role>
```

Masalan:

```bash
node scripts/setRole.js ./serviceAccountKey.json uXyZ12345 super_admin
```

Yaroqli rollar: `worker`, `employer`, `admin`, `super_admin`.

## Xavfsizlik va tekshiruv

- Rollarni berishdan oldin `uid` to'g'riligini tekshiring (Firebase Auth → Users).
- Super Admin rolini faqat ishonchli shaxsga bering va keyin passwordni yangilang.
- Rollarni qaytarish uchun `worker` yoki `admin` ga kamaytiring yoki `status: 'blocked'` qo'ying.

## Muammo yuz bersa

- Agar ruxsat xatosi bo'lsa, servis hisobingizda Firestore yozish huquqlari mavjudligini tekshiring.
- Loglarda xatolikni ko'rish uchun skriptni boshqaruvli muhitda ishga tushiring.
