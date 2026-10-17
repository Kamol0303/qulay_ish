# Mehrli qo'llar

Samarqanddagi ishchi va buyurtmachilar uchun platforma. Sayt: [ishliayol.uz](https://ishliayol.uz). Telefon ilovasi ham shu serverga ulanadi: `https://ishliayol.uz/api`.

Ish bitta joyda turadi: GitHub dagi `main` branch. Boshqa branch ishlatilmaydi.

## Saytda nima bor

- Kirish telefon raqami va SMS kod bilan. Ro'yxatdan o'tish faqat ishchi uchun.
- Buyurtmalar sahifasida e'lon emas, ishchilar chiqadi.
- Buyurtmachi e'lon qo'ya olmaydi. Ishchini ko'radi, qo'ng'iroq qiladi yoki chat yozadi.
- Qo'ng'iroq tugmasi odam ro'yxatdan o'tgan raqamga qo'ng'iroq qiladi.
- Tasdiqlash markazi hali tasdiqlamagan bo'lsa ham ishchi ishlayveradi.
- Qidiruvdagi joy faqat Samarqand.
- Bosh sahifadagi raqamlar admin paneldagi haqiqiy sanoq: jami odam, ishchi, buyurtmachi, faol buyurtma, ariza, shartnoma.
- Rezyume yo'q.

## Telefon raqami chiqmasa

Tugma to'g'ri yozilgan. Raqam chiqmasa, telefonga yangi ilova emas, serverdagi eski API sabab. Eski API telefonni yashiradi, shuning uchun kartada «Telefon ko'rsatilmagan» turadi va tugma o'chiq qoladi.

Serverni yangilang (pastdagi «Saytni yangilash»). Shundan keyin kim qaysi raqam bilan yozilgan bo'lsa, kartada o'sha raqam chiqadi va tugma shu raqamga qo'ng'iroq qiladi.

## Telefon ilovasini yig'ish

O'z kompyuteringizda, loyiha papkasida (`~/ishliayol1`):

```bash
cd ~/ishliayol1
git pull origin main
./run.sh apk
```

Tayyor fayl:

`~/ishliayol1/artifacts/mexrliqollar-release-latest.apk`

Eski ilovani telefondan o'chirib, keyin yangisini o'rnating. Telefon kompyuterga ulanmasa, APK ni Telegramdagi «Saqlangan xabarlar» orqali yuboring.

`npm run apk:debug` ishlatmang. `bash run.shj` ham xato yozilgan buyruq.

## Saytni yangilash

Bu buyruqlar kompyuteringizda emas, serverda ishlaydi.

```bash
ssh root@185.203.237.57
cd /var/www/qulay-ish
git pull origin main
./scripts/redeploy-api-production.sh
```

Papka boshqa joyda bo'lsa, serverda `qulay-ish` yoki `qulay_ish` nomli papkani toping. Shu skript API ni yangilaydi: telefon raqami, hisoblar, SMS.

Saytning ko'rinishi (bosh sahifa, tugmalar) o'zgargan bo'lsa, o'sha papkada yana `npm run build` qiling va tayyor `dist` ni sayt ochadigan joyga qo'ying.

`api/.env` serverda turadi. Uni gitga solmang. Ichida SMS token (`DEVSMS_TOKEN`) va admin paroli bor. Token bo'sh bo'lsa, SMS ketmaydi.

## Kompyuterda sinab ko'rish

```bash
cd ~/ishliayol1
git pull origin main
npm run dev
```

Sayt: http://localhost:3000  
API: http://localhost:4000/api

`npm run dev:web` faqat sahifani ochadi, API yo'q. SMS va ro'yxat shu rejimda ishlamaydi.

Birinchi marta baza ochilmasa:

```bash
sudo -u postgres psql -d postgres -c "ALTER DATABASE postgres REFRESH COLLATION VERSION;"
sudo -u postgres psql -d postgres -c "ALTER DATABASE template1 REFRESH COLLATION VERSION;"
sudo -u postgres psql -d postgres -c "ALTER USER qulay_ish WITH CREATEDB;"
sudo -u postgres psql -d postgres -c "CREATE DATABASE qulay_ish OWNER qulay_ish;"
npm run dev
```

## Tez-tez uchraydigan holat

| Nima ko'rinyapti | Nima qilish |
|---|---|
| Tugmada raqam yo'q | Serverda `git pull` va `./scripts/redeploy-api-production.sh` |
| SMS ketmayapti | Serverdagi `api/.env` da `DEVSMS_TOKEN` bor-yo'qligini tekshiring, keyin skriptni qayta ishga tushiring |
| `permission denied to create database` | Yuqoridagi postgres buyruqlarini bajaring |
| APK yig'ishda `javac` yo'q | `sudo apt install -y openjdk-21-jdk`, keyin `./run.sh apk` |
| Ilova o'rnatilmayapti | Eski ilovani o'chirib, yangi APK ni qayta o'rnating |
| `Some chunks are larger than 500 kB` | Bu xato emas, APK baribir tayyor |

## Orqaga qaytarish

Serverdagi papkada eski holatga qaytish kerak bo'lsa, oldingi `git pull` dan keyin chiqqan commit raqamini yozib qo'ying. Qaytarish:

```bash
git checkout <eski-commit>
./scripts/redeploy-api-production.sh
```

Ish tugagach yana `main` ga qayting: `git checkout main`.
