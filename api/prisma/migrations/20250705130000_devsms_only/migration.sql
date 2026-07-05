-- DevSMS OTP: default channel sms (Telegram olib tashlangan)
ALTER TABLE "otp_sessions" ALTER COLUMN "channel" SET DEFAULT 'sms';
