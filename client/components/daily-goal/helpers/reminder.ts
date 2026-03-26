// Daily goal reminder bildirimleri artik server-side cron job ile gonderiliyor.
// Bkz: server/services/cron.ts → initDailyGoalReminderCronJob()
// Client-side interval kaldirildi — uygulama kapaliyken calismiyordu.
