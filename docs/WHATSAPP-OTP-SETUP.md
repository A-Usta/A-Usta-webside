# WhatsApp OTP inteqrasiyası

Veb və mobil müştərilər Supabase Auth telefon OTP istifadə edir. OTP-ni Supabase yaradır, müddətini və təsdiqini idarə edir, sessiyanı yaradır. Send SMS Hook yalnız Meta Authentication template təsdiq ediləndən və provider tam hazır olandan sonra OTP-ni WhatsApp-a ötürür.

## TEST üçün lazım olanlar

- Mövcud Meta tətbiq A-USTA-nın (4652223431702180) düzgün A-Usta portfolio/WABA/telefonla əlaqəsini təsdiqləyin. Business Suite-də tətbiqin qoşulmuş aktivi görünmür; WhatsApp Accounts səhifəsində görünən nömrə Meta test nömrəsidir.
- Meta Business Verification və şirkətin telefon nömrəsinin Meta rəsmi axınında qeydiyyat/təsdiqini tamamlayın. Mövcud WhatsApp hesabını köçürmə və ya silmə əməliyyatını avtomatik etməyin.
- AUTHENTICATION kateqoriyasında Copy Code OTP düyməsi olan şablon yaradın və Meta təsdiqini gözləyin.
- Supabase Auth Hook secret və Meta Graph API token/phone-number ID/template parametrlərini yalnız TEST Edge Function secrets-də saxlayın. Mobil build və veb config-ə yazmayın.
- Supabase Auth > Hooks > Send SMS-ni deploy edilmiş funksiyaya bağlayın. SMS hook secret imzası yoxlanmalıdır.
- Müştərilər channel=sms göndərir, hook WhatsApp ilə çatdırır; təsdiq type=sms olur. Mövcud hesabı telefonla bağlamaq updateUser(phone) və phone_change yoxlamasından istifadə edir və eyni user ID-ni saxlayır.

## Server-only Edge Function dəyişənləri

SUPABASE_SMS_HOOK_SECRET, WHATSAPP_OTP_ENABLED, WHATSAPP_OTP_TEMPLATE_STATUS, META_GRAPH_API_VERSION, META_WA_PHONE_NUMBER_ID, META_WA_WABA_ID, META_WA_ACCESS_TOKEN, META_WA_OTP_TEMPLATE_NAME, META_WA_OTP_TEMPLATE_LANGUAGE.

Meta real nömrə, təsdiqlənmiş şablon və server sirləri hazır olmadan canlı OTP göndərilməyəcək. Dəyişənlər çatışmazsa funksiyadan mesaj getməyəcək.
