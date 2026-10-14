-- 1. Tạo Database
-- CREATE DATABASE brightlingo_db;

-- 2. Tạo bảng courses
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
    resource_link TEXT NOT NULL,
    status VARCHAR(30) DEFAULT 'PUBLISHED',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Seed dữ liệu mẫu khóa học đầu tiên
INSERT INTO courses (
    id, slug, category_name, tag_badge, type_badge, title,
    rating, reviews_count, students_count, last_updated,
    price, original_price, discount_percent, image,
    video_demo_title, video_demo_duration, video_demo_subtitle, video_url,
    benefits, curriculum, bank_info, resource_link, status
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
        "bankName": "VIETCOMBANK",
        "accountName": "NGUYEN THI ANH",
        "accountNumber": "1028475829",
        "orderCodePrefix": "BL"
    }'::jsonb,
    'https://drive.google.com/drive/folders/tai-lieu-english-for-real-life-vip',
    'PUBLISHED'
) ON CONFLICT (slug) DO UPDATE 
SET title = EXCLUDED.title,
    price = EXCLUDED.price;
