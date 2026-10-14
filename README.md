# BrightLingo Backend API | Bán Khóa Học & Tài Liệu Online

Dự án Backend API xây dựng hệ thống quản lý và phục vụ dữ liệu cho website bán khóa học & tài liệu trực tuyến BrightLingo (MVP 1.0). Thiết kế theo kiến trúc module của NestJS, tối ưu hiệu năng truy vấn với PostgreSQL Connection Pool và đảm bảo an toàn bảo mật dữ liệu.

## 🛠 Công Nghệ Sử Dụng

- **Framework:** NestJS 11/12 (Express platform)
- **Ngôn ngữ:** TypeScript
- **Cơ sở dữ liệu:** PostgreSQL
- **Database Client:** `pg` (node-postgres connection pool)
- **Cấu hình & Môi trường:** `@nestjs/config` (dotenv)
- **Kiến trúc:** Modular Architecture (Global DatabaseModule, Feature Modules)
- **Linter & Code Quality:** Prettier, Oxlint / ESLint

## 📂 Cấu Trúc Dự Án

```text
src/
├─ database/            # Module kết nối cơ sở dữ liệu PostgreSQL
│  ├─ database.module.ts   # Module toàn cục (Global Module) cung cấp kết nối DB
│  └─ database.service.ts  # Quản lý Connection Pool & hàm thực thi query SQL
├─ courses/             # Module nghiệp vụ khóa học
│  ├─ courses.controller.ts # Định nghĩa các Endpoint RESTful API (/api/courses)
│  ├─ courses.service.ts    # Logic truy vấn DB & chuyển đổi snake_case sang camelCase
│  └─ courses.module.ts    # Khai báo Controller & Service cho Courses
├─ app.controller.ts    # Controller cơ sở
├─ app.service.ts       # Service cơ sở
├─ app.module.ts        # ROOT MODULE: Tích hợp Config, Database và các Feature Modules
└─ main.ts              # Entry point: Cấu hình CORS (port 3000) & Port khởi chạy (4000)
seed.sql                # Script tạo bảng và seed dữ liệu khóa học mẫu ban đầu
.env.example            # File mẫu cấu hình biến môi trường
```

## ⚙️ Cấu Hình Môi Trường (.env)

Tạo file `.env` ở thư mục gốc (hoặc sao chép từ `.env.example`):

```env
PORT=4000
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=admin
DB_NAME=brightlingo_db
```

*(Lưu ý: Thay đổi `DB_USER` và `DB_PASSWORD` cho đúng với tài khoản PostgreSQL trên máy của bạn).*

## 🚀 Hướng Dẫn Chạy Dự Án

1. **Khởi tạo Database & Seed Dữ Liệu:**
   - Mở pgAdmin, DBeaver hoặc terminal `psql`.
   - Tạo database `brightlingo_db`.
   - Mở file `seed.sql` và thực thi script để tạo bảng `courses` và nạp dữ liệu khóa học mẫu đầu tiên (`english-for-real-life`).

2. **Cài đặt thư viện:**
   ```bash
   npm install
   ```

3. **Khởi chạy môi trường Dev:**
   ```bash
   npm run start:dev
   ```
   Sau đó kiểm tra API tại:
   - Danh sách khóa học: `http://localhost:4000/api/courses`
   - Chi tiết khóa học: `http://localhost:4000/api/courses/english-for-real-life`

4. **Build và chạy môi trường Production:**
   ```bash
   npm run build
   npm run start:prod
   ```

## 🔄 API & Luồng Nghiệp Vụ Chính (Critical Endpoints)

1. **`GET /api/courses`**: Trả về danh sách tất cả khóa học có trạng thái `PUBLISHED` để hiển thị trên trang chủ và danh mục.
2. **`GET /api/courses/:slug`**: Trả về thông tin chi tiết của khóa học theo slug (curriculum, benefits, bankInfo, demo video).
   - Tự động chuẩn hóa dữ liệu từ `snake_case` (DB) sang `camelCase` phù hợp với Frontend Next.js.
   - Bảo mật tài nguyên số: Không trả về link tải tài liệu thật (`resource_link`) tại public endpoint.
3. **CORS:** Đã được cấu hình sẵn sàng cho phép gọi từ Frontend Next.js tại `http://localhost:3000` và `http://127.0.0.1:3000`.
