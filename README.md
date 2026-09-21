# EFIR launcher

Исходный код лаунчера EFIR для Windows.

## Разработка

```powershell
npm install
npm --prefix tiktok-service install
npm start
```

## Сборка

```powershell
npm install
npm --prefix tiktok-service install
npm run dist
```

Общее подключение TikTok LIVE работает через `tiktok-live-connector` 2.4.4 в процессе лаунчера. Приложения получают события через локальный шлюз. Каталог и персональные права загружаются из Supabase, а запуск приложений подтверждается сервером лицензий.
