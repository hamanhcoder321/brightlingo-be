-- =====================================================================
-- C7 — Đồng bộ thương hiệu EngNest cho dữ liệu runtime (bảng settings, email_templates)
--
-- CHƯA ĐƯỢC CHẠY trên bất kỳ database nào. Chủ dự án tự kiểm tra và chạy.
--
-- Cách dùng (psql):
--   1. Xác nhận đúng database/môi trường (dev hay production) và đã sao lưu.
--   2. Chạy riêng PHẦN 1 (preview, chỉ đọc) để xem dữ liệu hiện tại.
--   3. Chạy cả file với ON_ERROR_STOP để dừng và rollback khi có lỗi:
--        psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f 2026-10-26_engnest_branding_runtime.sql
--
-- Nguyên tắc:
--   - Chỉ cập nhật bản ghi xác định bằng key/code VÀ giá trị cũ đã biết.
--   - Không sửa primary_domain, community_group_name, tài khoản admin.
--   - Script idempotent: chạy lại khi đã cập nhật sẽ không thay đổi gì.
--   - Mọi kiểm tra không đạt sẽ RAISE EXCEPTION → transaction bị hủy (ROLLBACK).
--
-- Cột sử dụng (theo seed.sql): settings(key, value, updated_at),
--   email_templates(code, subject, body_html, body_text, updated_at).
-- =====================================================================


-- =====================================================================
-- PHẦN 1 — PREVIEW (chỉ đọc)
-- =====================================================================

-- 1a. Các khóa sẽ được xét cập nhật
SELECT key, value
FROM settings
WHERE key IN ('site_name', 'meta_title', 'support_email')
ORDER BY key;

-- 1b. Mọi setting còn chứa "brightlingo" (tham khảo; script KHÔNG tự sửa các dòng ngoài 1a,
--     ví dụ primary_domain = https://brightlingo-fe.vercel.app được giữ nguyên có chủ đích)
SELECT key, value
FROM settings
WHERE value ILIKE '%brightlingo%'
ORDER BY key;

-- 1c. Email template còn chứa tên/email thương hiệu cũ
SELECT id, code, is_active, subject,
       (body_html ILIKE '%BrightLingo%')                AS html_has_brand,
       (COALESCE(body_text, '') ILIKE '%BrightLingo%')  AS text_has_brand,
       (body_html ILIKE '%support@brightlingo.vn%'
        OR COALESCE(body_text, '') ILIKE '%support@brightlingo.vn%') AS has_old_email
FROM email_templates
WHERE subject ILIKE '%BrightLingo%'
   OR body_html ILIKE '%BrightLingo%'
   OR COALESCE(body_text, '') ILIKE '%BrightLingo%'
ORDER BY id;


-- =====================================================================
-- PHẦN 2 — CẬP NHẬT (trong transaction)
-- =====================================================================
BEGIN;

-- Điều kiện tiên quyết: mỗi key/code là duy nhất (UNIQUE theo seed.sql)
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM settings WHERE key = 'site_name') > 1
     OR (SELECT COUNT(*) FROM settings WHERE key = 'meta_title') > 1
     OR (SELECT COUNT(*) FROM settings WHERE key = 'support_email') > 1
     OR (SELECT COUNT(*) FROM email_templates WHERE code = 'ORDER_PAID_RESOURCE_DELIVERY') > 1 THEN
    RAISE EXCEPTION 'Dữ liệu không đúng giả định: key/code bị trùng. Dừng và ROLLBACK.';
  END IF;
END $$;

-- 2a. site_name: chỉ khi giá trị đúng là 'BrightLingo'
UPDATE settings
SET value = 'EngNest', updated_at = NOW()
WHERE key = 'site_name'
  AND value = 'BrightLingo';

-- 2b. meta_title: chỉ khi khớp chính xác giá trị cũ đã ghi nhận trên runtime
UPDATE settings
SET value = 'EngNest – Nền tảng học tiếng Anh online thực chiến cho mọi nhà', updated_at = NOW()
WHERE key = 'meta_title'
  AND value = 'BrightLingo – Nền tảng học tiếng Anh online thực chiến cho mọi nhà';

-- 2c. support_email: chỉ khi giá trị đúng là địa chỉ cũ
UPDATE settings
SET value = 'support@engnest.vn', updated_at = NOW()
WHERE key = 'support_email'
  AND value = 'support@brightlingo.vn';

-- 2d. Email template giao tài liệu: subject khớp chính xác giá trị seed cũ
UPDATE email_templates
SET subject = '[EngNest] Kích hoạt thành công khóa học: {{course_name}} (Đơn hàng #{{order_code}})',
    updated_at = NOW()
WHERE code = 'ORDER_PAID_RESOURCE_DELIVERY'
  AND subject = '[BrightLingo] Kích hoạt thành công khóa học: {{course_name}} (Đơn hàng #{{order_code}})';

-- 2e. Nội dung template (chỉ đúng 1 bản ghi theo code): thay email cũ trước, rồi tên thương hiệu.
--     REPLACE phân biệt hoa/thường nên không chạm vào hostname kỹ thuật viết thường (vd. brightlingo-be).
UPDATE email_templates
SET body_html = REPLACE(REPLACE(body_html, 'support@brightlingo.vn', 'support@engnest.vn'), 'BrightLingo', 'EngNest'),
    body_text = REPLACE(REPLACE(body_text, 'support@brightlingo.vn', 'support@engnest.vn'), 'BrightLingo', 'EngNest'),
    updated_at = NOW()
WHERE code = 'ORDER_PAID_RESOURCE_DELIVERY'
  AND (body_html LIKE '%BrightLingo%' OR body_html LIKE '%support@brightlingo.vn%'
       OR COALESCE(body_text, '') LIKE '%BrightLingo%' OR COALESCE(body_text, '') LIKE '%support@brightlingo.vn%');

-- Kiểm tra sau cập nhật: các bản ghi mục tiêu không còn giá trị thương hiệu cũ
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM settings WHERE key = 'site_name' AND value = 'BrightLingo') THEN
    RAISE EXCEPTION 'site_name vẫn là BrightLingo. ROLLBACK.';
  END IF;
  IF EXISTS (SELECT 1 FROM settings WHERE key = 'support_email' AND value = 'support@brightlingo.vn') THEN
    RAISE EXCEPTION 'support_email vẫn là địa chỉ cũ. ROLLBACK.';
  END IF;
  IF EXISTS (SELECT 1 FROM email_templates
             WHERE code = 'ORDER_PAID_RESOURCE_DELIVERY'
               AND (subject LIKE '%BrightLingo%' OR body_html LIKE '%BrightLingo%'
                    OR COALESCE(body_text, '') LIKE '%BrightLingo%')) THEN
    RAISE EXCEPTION 'Template ORDER_PAID_RESOURCE_DELIVERY còn BrightLingo (subject khác giá trị đã biết?). ROLLBACK và sửa qua CMS/thủ công.';
  END IF;
  -- meta_title khác giá trị đã biết: không tự sửa (tránh đoán nội dung SEO), chỉ cảnh báo
  IF EXISTS (SELECT 1 FROM settings WHERE key = 'meta_title' AND value ILIKE '%BrightLingo%') THEN
    RAISE WARNING 'meta_title vẫn chứa BrightLingo nhưng không khớp giá trị đã biết — cần sửa thủ công trong CMS (SEO & Google).';
  END IF;
  RAISE NOTICE 'Kiểm tra sau cập nhật: OK';
END $$;

-- Kết quả sau cập nhật (để đối chiếu với preview)
SELECT key, value, updated_at
FROM settings
WHERE key IN ('site_name', 'meta_title', 'support_email', 'primary_domain', 'community_group_name')
ORDER BY key;

SELECT id, code, subject, updated_at
FROM email_templates
WHERE code = 'ORDER_PAID_RESOURCE_DELIVERY';

COMMIT;
