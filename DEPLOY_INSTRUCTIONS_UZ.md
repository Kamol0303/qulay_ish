# Firebase Hosting ga yuklash — bosqichma‑bosqich (o‘zbekcha)

Quyidagi ko‘rsatma `scripts/deploy_firebase.sh` skripti bilan birga ishlaydi. Agar siz server yoki shaxsiy mashinangizda ishlayotgan bo‘lsangiz, ushbu skriptni ishga tushiring.

1) Tayyorlaning
- Loyihani klon qiling va ishchi papkaga o‘ting.

```bash
git clone <repo-url>
cd ish
```

2) Muhit o‘zgaruvchilari
- Root papkada `.env.local` faylini yarating va Firebase production ma’lumotlarini qo‘ying (README.md dagi misolga qarang).

3) Skriptni ishga tushirish
- Skriptni bajarishdan oldin unga ruxsat bering:

```bash
chmod +x scripts/deploy_firebase.sh
```

- Keyin quyidagicha ishga tushiring (o‘rniga `your-project-id` qo‘ying):

```bash
./scripts/deploy_firebase.sh your-project-id .env.local
```

Skript quyidagilarni bajaradi:
- `npm install`
- `npm run clean` va `npm run build`
- `firebase login` (brauzer orqali autentifikatsiya so‘raladi)
- `firebase use --project <PROJECT_ID>` yoki `firebase use --add`
- `firebase deploy --only hosting --project <PROJECT_ID>`

4) Agar `firebase` global o‘rnatilmagan bo‘lsa
- Global o‘rnatish uchun:

```bash
npm install -g firebase-tools
```

Yoki har bir buyruqni `npx firebase ...` bilan ishlating.

5) Agar sizga yordam kerak bo‘lsa
- Agar xato chiqsa, CLI chiqishini nusxa qilib yuboring — men tahlil qilib yordam beraman.

6) Xavfsizlik
- `.env.local` va `serviceAccountKey.json` fayllarini hech qachon jamoaviy repoga yuklamang.
