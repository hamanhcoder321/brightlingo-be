-- ============================================================================
-- MIGRATION: FIX P0 STORAGE, PUBLIC API DATA & CHARSET ENCODING
-- Ngày thực hiện: 26/10/2026
-- ============================================================================

BEGIN;

-- 1. Sửa lỗi mã hóa tiếng Việt tên khóa học course-com-5 (Task H5)
UPDATE courses 
SET title = 'Nghệ thuật Small Talk & Giao tiếp tự nhiên tại Nhà hàng, Cafe',
    updated_at = NOW()
WHERE id = 'course-com-5' OR slug = 'tieng-anh-nha-hang-cafe-smalltalk';

-- 2. Migrate các URL ảnh/video/favicon từ localhost:4000 sang production URL (Task C1)
UPDATE courses 
SET image = REPLACE(image, 'http://localhost:4000/uploads/', 'https://brightlingo-be.onrender.com/uploads/'),
    video_url = CASE 
      WHEN video_url LIKE '%localhost:4000%' THEN REPLACE(video_url, 'http://localhost:4000/uploads/', 'https://brightlingo-be.onrender.com/uploads/')
      ELSE video_url 
    END,
    og_image = CASE 
      WHEN og_image LIKE '%localhost:4000%' THEN REPLACE(og_image, 'http://localhost:4000/uploads/', 'https://brightlingo-be.onrender.com/uploads/')
      ELSE og_image 
    END,
    updated_at = NOW()
WHERE image LIKE '%localhost:4000%' OR video_url LIKE '%localhost:4000%' OR og_image LIKE '%localhost:4000%';

UPDATE settings 
SET value = REPLACE(value, 'http://localhost:4000/uploads/', 'https://brightlingo-be.onrender.com/uploads/'),
    updated_at = NOW()
WHERE value LIKE '%localhost:4000%';

-- 3. Đồng bộ thương hiệu BrightLingo & tắt noindex chặn bot tìm kiếm (Task C6, H4)
UPDATE settings SET value = 'BrightLingo Education', updated_at = NOW() WHERE key = 'company_name';
UPDATE settings SET value = 'BrightLingo', updated_at = NOW() WHERE key = 'site_name';
UPDATE settings SET value = 'https://brightlingo-fe.vercel.app', updated_at = NOW() WHERE key = 'primary_domain';
UPDATE settings SET value = 'BrightLingo – Nền tảng học tiếng Anh online thực chiến cho mọi nhà', updated_at = NOW() WHERE key = 'meta_title';
UPDATE settings SET value = 'false', updated_at = NOW() WHERE key = 'noindex';
UPDATE settings SET value = E'User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /thanh-toan\n\nSitemap: https://brightlingo-fe.vercel.app/sitemap.xml', updated_at = NOW() WHERE key = 'robots_txt';
UPDATE settings SET value = '', updated_at = NOW() WHERE key = 'google_site_verification';

COMMIT;
