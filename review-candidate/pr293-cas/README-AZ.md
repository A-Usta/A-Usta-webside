# A-USTA V3.5.5 — PR #293 üçün CAS düzəlişi (REVIEW ONLY)

**Bu paket production, TEST Supabase və GitHub-a tətbiq edilməyib.** PR #293-ə commit/push olunmayıb.

## Mənbə

- `assets/map/publication.js`: mövcud faylın tam əvəzedici namizəd versiyası. Köhnə birbaşa `upsert`/`update` əvəzinə `v355_apply_map_publication` RPC istifadə olunur. `revision` və təsadüfi request UUID ilə optimistic concurrency/idempotency kontraktı qurulur.
- `supabase/migrations/20261117090000_v355_map_publication_cas.sql`: yeni migration təklifi. Row lock, revision CAS, owner/request-id receipt cədvəli, grant məhdudiyyəti, server-side eligibility.
- `tests/publication-cas.local.test.cjs`: Node built-in VM ilə lokal UI davranış mockları və SQL statik kontrakt yoxlamaları.

## Lokal nəticə

- `node --check assets/map/publication.js`: PASS
- `node --test tests/publication-cas.local.test.cjs`: 3 PASS, 0 FAIL
- Chromium başlatma cəhdi bu mühitdə timeout ilə dayandırıldı; browser PASS yoxdur.
- Real PostgreSQL və Hosted Supabase testləri icra edilməyib.

## Lazım olan buraxılış gate-ləri

1. Disposable real PostgreSQL-də SQL migration icrası, rollback və iki bağlantılı concurrency/idempotency sınaqları.
2. Hazırkı frontend/db contract regressiyalarının tam yoxlanması və testlərin uyğunlaşdırılması.
3. Təhlükəsizlik baxışı: SECURITY DEFINER rol və ACL-ləri, owner isolation, receipt replay, schema cache.
4. TEST Supabase-də owner icazəsi ilə tətbiq və Hosted Gate 1–4 (Auth/Storage/Geoapify/compatibility).
5. R7W Windows runner ayrıca qalır; bu paket onu düzəltmir.
6. Bütün gate-lərdən sonra PR #293-ə commit/push və yeni GitHub CI.

## İcra göstərişi

Bu, review üçün hazırlanmış mənbə namizədidir. Migration-u heç bir uzaq layihəyə icazəsiz tətbiq etməyin. Mənfi nəticə olduqda gizli məlumatları loglarda paylaşmayın. `PR #293: MERGE READY — NO` qalır.
