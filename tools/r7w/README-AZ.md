# R7W clipboard preflight

Supabase TEST Publishable Key üçün Copy basın, `Start-R7W.ps1` açın və Enter basın. Python açarı clipboard-dan öz prosesində oxuyur. Açar command-line, environment, fayl və loga verilmir. Native Python lazımdır; mövcud `.venv` və ya Windows Python launcher istifadə edilir. Quraşdırma və paket download-u edilmir.

Launcher əvvəl SHA-256 manifest və doqquz offline kontrakt testini yoxlayır. Sonra yalnız `xnhxneziasqthkhhntkv.supabase.co` ünvanına sistem CA-ları və hostname yoxlaması ilə bir GET edir. Redirect, başqa layihə, secret/service-role açarı və artıq whitespace qəbul edilmir. `sb_publishable_` opaque açarının formatı təkbaşına layihə sübutu deyil; TEST endpoint-in uğurlu autentifikasiya cavabı tələb olunur.

Bu nəticə yalnız public-key/TLS preflight-dır. A/B login, Storage silinməsi, cleanup, hosted CAS və merge PASS deyil. 401/403/404 heç vaxt silinmə sübutu sayılmır. Bu launcher parol istəmir, Auth/Storage/publication mutation etmir. Əvvəlki test paketinin geniş suite-i və təhlükəsizlik kilidləri saxlanılır; onun köhnə publication PATCH/DELETE axını yeni application CAS migration-dan sonra yenidən uyğunlaşdırılmadan işlədilməməlidir.

Windows clipboard/PowerShell real CI sübutu ayrıca tələb olunur. Mock test PASS canlı Supabase sübutu deyil. Clipboard istifadəçinin kompüterində qalır; Python immutable string-lərin fiziki RAM sıfırlanmasına təminat verilmir.
