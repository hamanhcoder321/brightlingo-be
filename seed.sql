-- ============================================================================
-- BRIGHTLINGO / WOWUP MVP 1.0 - POSTGRESQL SCHEMA SCRIPT
-- Tuân thủ tài liệu BA ngày 08/10/2026 và các quy tắc nghiệp vụ BR-01 -> BR-15
-- ============================================================================

-- 1. BẢNG ADMINS (Tài khoản Quản trị CMS)
CREATE TABLE IF NOT EXISTS admins (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'ADMIN', -- ADMIN, SUPER_ADMIN
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. BẢNG COURSES (Khóa học & Tài liệu số)
CREATE TABLE IF NOT EXISTS courses (
    id VARCHAR(50) PRIMARY KEY,
    slug VARCHAR(100) UNIQUE NOT NULL,
    category_name VARCHAR(100) NOT NULL,
    tag_badge VARCHAR(255) NOT NULL,
    type_badge VARCHAR(50) NOT NULL DEFAULT 'Trọn đời',
    title VARCHAR(255) NOT NULL,
    rating NUMERIC(2, 1) DEFAULT 4.9,
    reviews_count VARCHAR(50) DEFAULT '1.2k đánh giá',
    students_count VARCHAR(50) DEFAULT '8.500+ học viên',
    last_updated VARCHAR(50) DEFAULT 'Cập nhật mới nhất 2026',
    price INT NOT NULL,
    original_price INT NOT NULL,
    discount_percent INT DEFAULT 0,
    image TEXT NOT NULL,
    video_demo_title VARCHAR(255) DEFAULT 'Xem video demo bài giảng (2 phút)',
    video_demo_duration VARCHAR(50) DEFAULT '2:15',
    video_demo_subtitle VARCHAR(255) DEFAULT 'Phương pháp phản xạ tình huống độc quyền',
    video_url TEXT,
    benefits JSONB NOT NULL DEFAULT '[]'::jsonb,
    curriculum JSONB NOT NULL DEFAULT '{}'::jsonb,
    bank_info JSONB NOT NULL DEFAULT '{}'::jsonb,
    resource_link TEXT NOT NULL, -- BẢO MẬT: Tuyệt đối không trả về qua Public API (BR-02)
    seo_title VARCHAR(255),
    seo_description TEXT,
    og_image TEXT,
    views_count INT DEFAULT 0,
    buyers_count INT DEFAULT 0,
    is_social_proof_enabled BOOLEAN DEFAULT true,
    is_featured BOOLEAN NOT NULL DEFAULT false,
    status VARCHAR(30) NOT NULL DEFAULT 'PUBLISHED', -- DRAFT, PUBLISHED, HIDDEN
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE -- Soft delete (BR-10)
);

-- 3. BẢNG COURSE_FAQS (Hỏi đáp theo khóa học)
CREATE TABLE IF NOT EXISTS course_faqs (
    id BIGSERIAL PRIMARY KEY,
    course_id VARCHAR(50) NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3.1 BẢNG COURSE_VIEWS (Thống kê lượt xem thực tế khóa học)
CREATE TABLE IF NOT EXISTS course_views (
    id BIGSERIAL PRIMARY KEY,
    course_id VARCHAR(50) NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    course_slug VARCHAR(100),
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. BẢNG CUSTOMERS (Khách mua hàng)
CREATE TABLE IF NOT EXISTS customers (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    total_orders INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. BẢNG ORDERS (Đơn hàng & Snapshot bất biến - BR-07, BR-08, BR-09)
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(50) PRIMARY KEY,
    order_code VARCHAR(50) UNIQUE NOT NULL, -- VD: BL-8921 dùng làm nội dung chuyển khoản
    customer_name VARCHAR(100) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(20),
    course_id VARCHAR(50) REFERENCES courses(id),
    course_title VARCHAR(255) NOT NULL,  -- Snapshot tên khóa tại thời điểm mua
    course_slug VARCHAR(100) NOT NULL,   -- Snapshot slug
    original_price INT NOT NULL,         -- Snapshot giá gốc
    unit_price INT NOT NULL,             -- Snapshot giá bán
    discount_amount INT DEFAULT 0,       -- Snapshot số tiền giảm
    total_amount INT NOT NULL,           -- Tổng tiền cần thanh toán
    coupon_id BIGINT,
    coupon_code VARCHAR(50),             -- Snapshot mã coupon đã áp dụng
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING, PAID, CANCELLED, EXPIRED
    -- Marketing Tracking / Attribution First-touch
    ref VARCHAR(100),
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),
    utm_content VARCHAR(100),
    utm_term VARCHAR(100),
    landing_url TEXT,
    referrer_url TEXT,
    paid_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. BẢNG PAYMENTS (Giao dịch BankNoti & Idempotency - BR-03, BR-04)
CREATE TABLE IF NOT EXISTS payments (
    id BIGSERIAL PRIMARY KEY,
    order_id VARCHAR(50) REFERENCES orders(id),
    order_code VARCHAR(50) NOT NULL,
    gateway VARCHAR(50) NOT NULL DEFAULT 'BANKNOTI',
    account_number VARCHAR(50),
    virtual_account VARCHAR(50),
    transaction_date TIMESTAMP WITH TIME ZONE,
    amount INT NOT NULL,
    description TEXT,
    bill_id VARCHAR(100),
    external_transaction_id VARCHAR(100) UNIQUE, -- Idempotency: Cấm trùng lặp giao dịch
    is_matched BOOLEAN NOT NULL DEFAULT true,
    webhook_payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. BẢNG COUPONS (Mã giảm giá)
CREATE TABLE IF NOT EXISTS coupons (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL, -- Chuẩn hóa viết hoa
    type VARCHAR(20) NOT NULL DEFAULT 'PERCENT', -- PERCENT, FIXED
    value INT NOT NULL, -- Giá trị % hoặc số tiền
    min_order_amount INT DEFAULT 0,
    max_discount_amount INT,
    scope VARCHAR(20) NOT NULL DEFAULT 'ALL', -- ALL, SPECIFIC
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    usage_limit INT,
    usage_count INT DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, INACTIVE
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- 8. BẢNG COUPON_COURSES (Phạm vi áp dụng coupon cho khóa học cụ thể)
CREATE TABLE IF NOT EXISTS coupon_courses (
    id BIGSERIAL PRIMARY KEY,
    coupon_id BIGINT NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
    course_id VARCHAR(50) NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(coupon_id, course_id)
);

-- 9. BẢNG EMAIL_TEMPLATES (Cấu hình mẫu Email CMS - BR-11)
CREATE TABLE IF NOT EXISTS email_templates (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL, -- ORDER_PAID_RESOURCE_DELIVERY
    subject VARCHAR(255) NOT NULL,
    body_html TEXT NOT NULL, -- Chứa placeholder {{resource_link}}
    body_text TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. BẢNG EMAIL_LOGS (Lịch sử giao tài liệu & Resend - BR-05, BR-06)
CREATE TABLE IF NOT EXISTS email_logs (
    id BIGSERIAL PRIMARY KEY,
    order_id VARCHAR(50) NOT NULL REFERENCES orders(id),
    recipient_email VARCHAR(255) NOT NULL,
    template_id BIGINT REFERENCES email_templates(id),
    status VARCHAR(20) NOT NULL DEFAULT 'QUEUED', -- QUEUED, SENT, FAILED, DELIVERED
    provider_message_id VARCHAR(255),
    send_at TIMESTAMP WITH TIME ZONE,
    last_error TEXT,
    resend_count INT NOT NULL DEFAULT 0, -- Tăng khi Admin bấm Resend
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. BẢNG CONSULTATION_LEADS (Đăng ký tư vấn 30 phút)
CREATE TABLE IF NOT EXISTS consultation_leads (
    id BIGSERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    course_slug VARCHAR(100),
    course_name VARCHAR(255),
    message TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'NEW', -- NEW, CONTACTED, COMPLETED
    ref VARCHAR(100),
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- 12. BẢNG PAGES (Chính sách & Điều khoản)
CREATE TABLE IF NOT EXISTS pages (
    id BIGSERIAL PRIMARY KEY,
    slug VARCHAR(100) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    seo_title VARCHAR(255),
    seo_description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED', -- DRAFT, PUBLISHED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- 13. BẢNG SETTINGS (Cấu hình hệ thống, Hotline, SEO, Payment)
CREATE TABLE IF NOT EXISTS settings (
    id BIGSERIAL PRIMARY KEY,
    group_name VARCHAR(50) NOT NULL, -- BRANDING, SUPPORT, PAYMENT, EMAIL, SEO
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 14. BẢNG AUDIT_LOGS (Nhật ký hành động Admin - BR-06, BR-10, BR-15)
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    admin_id BIGINT REFERENCES admins(id) ON DELETE SET NULL,
    admin_name VARCHAR(100),
    action VARCHAR(100) NOT NULL, -- RESEND_EMAIL, UPDATE_PRICE, UPDATE_RESOURCE_LINK, SOFT_DELETE
    target_entity VARCHAR(50) NOT NULL, -- orders, courses, coupons, settings
    target_id VARCHAR(100) NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- CÁC CHỈ MỤC TỐI ƯU HÓA TRUY VẤN (INDEXES)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_courses_slug ON courses(slug);
CREATE INDEX IF NOT EXISTS idx_courses_status ON courses(status);
CREATE INDEX IF NOT EXISTS idx_orders_order_code ON orders(order_code);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_payments_external_tx ON payments(external_transaction_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_code ON payments(order_code);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_consultation_leads_status ON consultation_leads(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_order_id ON email_logs(order_id);

-- ============================================================================
-- NẠP DỮ LIỆU KHỞI TẠO BAN ĐẦU (SEED DATA MẪU)
-- ============================================================================

-- 1. Seed Khóa học đầu tiên (Khớp 100% với giao diện hiện tại)
INSERT INTO courses (
    id, slug, category_name, tag_badge, type_badge, title,
    rating, reviews_count, students_count, last_updated,
    price, original_price, discount_percent, image,
    video_demo_title, video_demo_duration, video_demo_subtitle, video_url,
    benefits, curriculum, bank_info, resource_link, is_featured, status
) VALUES (
    'course-1',
    'english-for-real-life',
    'Khóa học giao tiếp',
    'English for Real Life - Giao tiếp tự tin trong mọi tình huống',
    'Trọn đời',
    'English for Real Life – Khóa học video thực tế & Ebook số trọn đời',
    4.9,
    '1.2k đánh giá',
    '8.500+ học viên đã học',
    'Cập nhật mới nhất 2026',
    399000,
    699000,
    43,
    'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80',
    'Xem video demo bài giảng (2 phút)',
    '2:15',
    'Phương pháp phản xạ tình huống độc quyền',
    '',
    '[
        {"id": "benefit-1", "title": "Tự tin phản xạ tự nhiên trong 30 ngày", "description": "Xóa bỏ hoàn toàn rào cản sợ sai, hình thành tư duy nói không cần dịch từ trong đầu."},
        {"id": "benefit-2", "title": "1.000+ mẫu câu và tình huống đàm thoại thực tế", "description": "Tuyển tập câu giao tiếp thông dụng chuẩn văn phong bản xứ phục vụ đi làm và du lịch."},
        {"id": "benefit-3", "title": "Sở hữu trọn đời kèm trọn bộ Ebook & Audio độc quyền", "description": "Tải về máy học mọi lúc mọi nơi trên điện thoại, máy tính không giới hạn thời gian."}
    ]'::jsonb,
    '{
        "summary": "8 phần học • 42 bài giảng video HD • Ebook PDF & Audio files tải về máy",
        "totalDuration": "Tổng thời lượng: 18 giờ",
        "sections": [
            {
                "id": "section-1",
                "title": "Phần 1: Khởi động - Phản xạ giao tiếp chào hỏi & Kết nối ban đầu (5 bài)",
                "lessonsCount": 5,
                "lessons": [
                    {"id": "s1-l1", "title": "Bài 01: Vượt qua tâm lý ngại nói tiếng Anh", "duration": "14:20", "badgeText": "Có video & Script"},
                    {"id": "s1-l2", "title": "Bài 02: 10 mẫu câu mở đầu cuộc trò chuyện tự nhiên", "duration": "18:45", "badgeText": "Có video & Script"},
                    {"id": "s1-l3", "title": "Bài 03: Phản xạ Small Talk trong thang máy & quán cafe", "duration": "22:10", "badgeText": "Có video & Script"}
                ]
            },
            {
                "id": "section-2",
                "title": "Phần 2: Giao tiếp công sở & Phỏng vấn (6 bài)",
                "lessonsCount": 6,
                "lessons": [
                    {"id": "s2-l1", "title": "Bài 06: Giới thiệu bản thân ấn tượng trong 60 giây", "duration": "19:15", "badgeText": "Có video & Script"}
                ]
            }
        ]
    }'::jsonb,
    '{
        "bankName": "MBBANK",
        "accountName": "HA VAN MANH",
        "accountNumber": "0399046519",
        "orderCodePrefix": "BL"
    }'::jsonb,
    'https://drive.google.com/drive/folders/tai-lieu-english-for-real-life-vip',
    true,
    'PUBLISHED'
) ON CONFLICT (slug) DO NOTHING;

-- 2. Seed Email Template mặc định gửi tài liệu sau khi thanh toán thành công
INSERT INTO email_templates (
    name, code, subject, body_html, body_text, is_active
) VALUES (
    'Email giao tài liệu sau thanh toán',
    'ORDER_PAID_RESOURCE_DELIVERY',
    '[BrightLingo] Kích hoạt thành công khóa học: {{course_name}} (Đơn hàng #{{order_code}})',
    '<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px;">
        <h2 style="color: #2563eb; margin-top: 0;">Chào mừng bạn đến với BrightLingo!</h2>
        <p>Xin chào <strong>{{customer_name}}</strong>,</p>
        <p>Hệ thống đã xác nhận thanh toán thành công cho đơn hàng <strong>#{{order_code}}</strong> với số tiền <strong>{{amount_paid}}đ</strong>.</p>
        <div style="background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 16px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0 0 8px 0; font-size: 14px; color: #64748b;">Khóa học / Tài liệu:</p>
            <p style="margin: 0; font-size: 18px; font-weight: bold; color: #1e293b;">{{course_name}}</p>
        </div>
        <p>Bạn có thể truy cập trọn bộ tài liệu và bài giảng độc quyền theo đường dẫn bên dưới:</p>
        <p style="text-align: center; margin: 30px 0;">
            <a href="{{resource_link}}" style="background-color: #2563eb; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                👉 TẢI TÀI LIỆU & BÀI HỌC TRỌN ĐỜI
            </a>
        </p>
        <p style="font-size: 13px; color: #64748b;">(Hoặc copy link trực tiếp vào trình duyệt: {{resource_link}})</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="font-size: 13px; color: #64748b; margin: 0;">Nếu cần hỗ trợ kỹ thuật, vui lòng liên hệ hotline: {{support_phone}} hoặc email: {{support_email}}.</p>
    </div>',
    'Xin chào {{customer_name}}, đơn hàng #{{order_code}} đã thanh toán thành công. Truy cập tài liệu tại: {{resource_link}}',
    true
) ON CONFLICT (code) DO NOTHING;

-- 3. Seed Cấu hình Hệ thống cơ bản (Settings)
INSERT INTO settings (group_name, key, value, description) VALUES
('BRANDING', 'site_name', 'BrightLingo', 'Tên thương hiệu website'),
('SUPPORT', 'support_phone', '1900 8989', 'Hotline hỗ trợ học viên'),
('SUPPORT', 'support_email', 'support@brightlingo.vn', 'Hộp thư hỗ trợ khách hàng'),
('PAYMENT', 'bank_name', 'MBBANK', 'Tên ngân hàng nhận thanh toán'),
('PAYMENT', 'account_number', '0399046519', 'Số tài khoản nhận tiền'),
('PAYMENT', 'account_name', 'HA VAN MANH', 'Tên chủ tài khoản ngân hàng')
ON CONFLICT (key) DO NOTHING;
