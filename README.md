# EngNest API | Hệ Thống Bán Khóa Học & Tài Liệu Trực Tuyến (MVP 1.0)

Backend API phục vụ nền tảng thương mại điện tử khóa học & tài nguyên số **EngNest** (https://engnest.vn), tuân thủ đặc tả nghiệp vụ **BA Spec MVP 1.0**. Hệ thống xây dựng trên nền tảng **NestJS**, tích hợp **PostgreSQL** tối ưu truy vấn qua Connection Pool, tích hợp cổng thanh toán tự động **PayOS (VietQR Pro)** và dịch vụ chuyển phát email tài nguyên số.

> **Lưu ý quan trọng cho Developer clone về:**
> Mặc định mã nguồn được cấu hình để chạy **100% chế độ Local độc lập**. Toàn bộ dữ liệu, file upload, email đều được cô lập tại máy cá nhân, không ảnh hưởng tới dữ liệu Production (Neon Cloud / Cloudflare R2 / Render).

---

## 🛠 Công Nghệ & Thư Viện

- **Framework:** NestJS (Express Platform)
- **Ngôn ngữ:** TypeScript
- **Cơ sở dữ liệu:** PostgreSQL 15+
- **Database Client:** `pg` (node-postgres connection pool)
- **Cổng thanh toán:** `@payos/node` (Tích hợp PayOS VietQR & Webhook HMAC-SHA256)
- **Email Service:** Resend API / SMTP Mailer
- **Kiến trúc:** Modular Clean Architecture (Config, Core, Common, Feature Modules)
- **Kiểm soát mã nguồn & Linter:** Oxlint, Prettier

---

## 📂 Cấu Trúc Thư Mục (Modular Clean Architecture)

Dự án được chuẩn hóa theo kiến trúc module phân lớp, đảm bảo khả năng mở rộng lâu dài và dễ bảo trì:

```text
lingo-api/
├─ src/
│  ├─ config/                     # Quản lý cấu hình tập trung từ biến môi trường
│  │  ├─ app.config.ts            # Cấu hình cổng, CORS, Base URL
│  │  ├─ database.config.ts       # Cấu hình kết nối PostgreSQL
│  │  ├─ mail.config.ts           # Cấu hình Resend / SMTP
│  │  ├─ payment.config.ts        # Cấu hình PayOS & MBBank
│  │  └─ index.ts
│  ├─ core/                       # Các dịch vụ dùng chung toàn hệ thống (Global Services)
│  │  ├─ database/                # DatabaseModule & DatabaseService (Connection Pool)
│  │  ├─ mail/                    # MailModule & MailService (Resend wrapper)
│  │  ├─ storage/                 # StorageService (Quản lý file & S3/R2 placeholder)
│  │  └─ index.ts
│  ├─ common/                     # Thư viện dùng chung (Cross-cutting Concerns)
│  │  ├─ constants/               # Reserved Slugs, System Roles, Error Codes
│  │  ├─ filters/                 # HttpExceptionFilter (Chuẩn hóa lỗi trả về JSON)
│  │  ├─ guards/                  # AdminAuthGuard (Bảo vệ endpoint quản trị)
│  │  ├─ interceptors/            # LoggingInterceptor (Log thời gian phản hồi)
│  │  ├─ utils/                   # Hàm sinh mã đơn hàng số nguyên, chuẩn hóa text
│  │  └─ index.ts
│  ├─ modules/                    # Các module nghiệp vụ (Feature Modules)
│  │  ├─ courses/                 # Quản lý khóa học, chương trình, FAQs (BR-01, BR-02)
│  │  ├─ orders/                  # Tạo đơn hàng, snapshot giá & coupon, tra cứu (BR-03)
│  │  ├─ payments/                # Tạo link PayOS VietQR, xử lý Webhook Idempotency (BR-04)
│  │  ├─ coupons/                 # Kiểm tra và áp dụng mã giảm giá (BR-07, BR-08)
│  │  ├─ leads/                   # Tiếp nhận đăng ký form tư vấn & UTM (BR-10)
│  │  ├─ email/                   # Tự động gửi email giao link học khi đơn PAID (BR-05)
│  │  ├─ admin/                   # Xác thực quản trị viên, Dashboard metrics, duyệt đơn thủ công
│  │  ├─ pages/                   # Quản lý trang tĩnh (Chính sách, Giới thiệu)
│  │  ├─ settings/                # Quản lý thông tin website, hotline, tài khoản ngân hàng
│  │  ├─ audit/                   # Ghi vết lịch sử thao tác hệ thống (Audit Logs)
│  │  └─ index.ts
│  ├─ app.module.ts               # Root Module nạp toàn bộ cấu hình và Feature Modules
│  └─ main.ts                     # Entry point khởi chạy app, cấu hình CORS, Global Pipes
├─ seed.sql                       # Toàn bộ DDL 14 bảng dữ liệu chuẩn BA và dữ liệu mẫu ban đầu
├─ .env.example                   # Mẫu khai báo biến môi trường cho team dev
├─ package.json
└─ tsconfig.json
```

---

## 🗄 Cơ Sở Dữ Liệu (14 Bảng Chuẩn BA MVP 1.0)

Toàn bộ lược đồ được định nghĩa tại `seed.sql`:

1. `admins`: Tài khoản quản trị viên hệ thống.
2. `courses`: Thông tin khóa học, giá niêm yết, giá khuyến mãi, link học (`resource_link`), SEO metadata.
3. `course_faqs`: Câu hỏi thường gặp theo từng khóa học.
4. `customers`: Thông tin khách hàng, số đơn đã mua, tổng tiền tích lũy.
5. `orders`: Đơn hàng, snapshot thông tin khóa học, coupon, UTM tại thời điểm mua, trạng thái (`PENDING`, `PAID`, `CANCELLED`, `REFUNDED`).
6. `payments`: Lịch sử giao dịch từ PayOS, mã tham chiếu ngân hàng, kiểm tra khớp giao dịch.
7. `coupons`: Mã giảm giá, loại giảm (`PERCENT`, `FIXED`), hạn mức sử dụng, thời hạn áp dụng.
8. `coupon_courses`: Liên kết rằng buộc mã giảm giá chỉ áp dụng cho khóa học nhất định.
9. `email_templates`: Mẫu email giao tài liệu, email chăm sóc khách hàng.
10. `email_logs`: Lịch sử gửi email giao link học, số lần gửi lại, trạng thái giao mail.
11. `consultation_leads`: Danh sách khách hàng để lại thông tin tư vấn.
12. `pages`: Nội dung các trang tĩnh SEO (Điều khoản, Chính sách bảo mật, Hoàn tiền).
13. `settings`: Cấu hình hệ thống (Hotline, Email hỗ trợ, Bank MBBank fallback).
14. `audit_logs`: Lịch sử thao tác thay đổi dữ liệu của Admin.

---

## ⚙️ Cấu Hình Môi Trường (.env)

Sao chép file mẫu `.env.example` thành `.env` tại thư mục gốc:

```env
PORT=4000
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_postgres_password
DB_NAME=brightlingo_db

# Cổng thanh toán PayOS (MBBank)
PAYOS_CLIENT_ID=your_client_id
PAYOS_API_KEY=your_api_key
PAYOS_CHECKSUM_KEY=your_checksum_key

# Thông tin tài khoản ngân hàng hiển thị (Fallback VietQR)
PAYMENT_BANK_NAME=MBBANK
PAYMENT_ACCOUNT_NUMBER=0399046519
PAYMENT_ACCOUNT_NAME=HA VAN MANH

# Dịch vụ gửi Email giao tài liệu (Resend)
RESEND_API_KEY=re_your_api_key_here
MAIL_FROM=support@brightlingo.vn
```

---

## 🚀 Hướng Dẫn Khởi Chạy Dự Án

### 1. Cài đặt thư viện & Cấu hình môi trường
```bash
# Cài đặt thư viện
npm install

# Sao chép cấu hình local
cp .env.example .env
```

### 2. Khởi tạo Cơ sở dữ liệu Local
- Tạo database `brightlingo_db` trong PostgreSQL (qua pgAdmin 4 hoặc `psql -U postgres`).
- Chạy lệnh tự động nạp bảng và dữ liệu mẫu:
```bash
npm run db:setup
```
*(Lệnh này tự động thực thi `seed.sql` tạo 16 bảng, khóa học, dữ liệu mẫu và các trang chính sách pháp lý).*

### 3. Chạy ở môi trường Development
```bash
npm run start:dev
```
Backend sẽ khởi chạy tại: `http://localhost:4000`.

### 4. Kiểm tra Build
```bash
npm run build
```

---

## 💳 Tích Hợp PayOS & Test Webhook qua Ngrok

PayOS gửi thông báo giao dịch thành công (Webhook) qua giao thức HTTP POST an toàn. Để test trên máy local:

1. **Mở ngrok lắng nghe cổng 4000:**
   ```bash
   ngrok http 4000
   ```
2. **Cấu hình Webhook trên PayOS Dashboard:**
   - Đăng nhập [my.payos.vn](https://my.payos.vn/) $\rightarrow$ Chọn kênh thanh toán **Brightlingo**.
   - Vào tab **Cài đặt** $\rightarrow$ Dán URL:
     `https://<ngrok-domain>.ngrok-free.dev/api/webhooks/payos`
   - Bấm **Xác nhận Webhook**. Backend sẽ kiểm tra chữ ký và trả về `200 OK`.

---

## 📡 Danh Sách API Chính (Core API Endpoints)

### 1. Khóa học (Courses)
- `GET /api/courses`: Danh sách khóa học đang hoạt động (`PUBLISHED`). *(Không lộ `resource_link` theo BR-02)*.
- `GET /api/courses/:slug`: Chi tiết khóa học và danh sách FAQs theo slug.

### 2. Đơn hàng (Orders)
- `POST /api/orders`: Tạo đơn hàng mới. Tự động liên kết PayOS tạo link thanh toán VietQR động và snapshot giá.
- `GET /api/orders/:orderCode`: Tra cứu trạng thái đơn hàng (phục vụ Frontend polling).

### 3. Thanh toán & Webhook (Payments)
- `POST /api/webhooks/payos`: Nhận webhook thanh toán từ PayOS, tự động cập nhật đơn hàng thành `PAID` và kích hoạt gửi email.
- `POST /api/webhooks/payos/confirm`: Hỗ trợ đăng ký nhanh Webhook URL với PayOS qua API.

### 4. Mã giảm giá (Coupons)
- `POST /api/coupons/validate`: Kiểm tra tính hợp lệ của mã giảm giá cho khóa học và tính số tiền được giảm.

### 5. Đăng ký tư vấn (Leads)
- `POST /api/leads`: Tiếp nhận form tư vấn từ Landing Page kèm nguồn UTM.

### 6. Quản trị (Admin)
- `POST /api/admin/login`: Đăng nhập quản trị viên.
- `GET /api/admin/orders`: Xem danh sách tất cả đơn hàng kèm bộ lọc.
- `PATCH /api/admin/orders/:id/status`: Cập nhật trạng thái đơn hàng thủ công.
- `POST /api/admin/orders/:id/resend-email`: Gửi lại email tài liệu số cho học viên.

---

## 🛡 Tuân Thủ Quy Chuẩn Nghiệp Vụ (BA Spec Compliance)

- **BR-02 (Bảo mật tài nguyên):** Public API tuyệt đối không trả về `resource_link`. Link học chỉ được cấp phát qua email sau khi đơn hàng chuyển trạng thái `PAID`.
- **BR-03 (Chuyển trạng thái đơn hàng):** Đơn hàng tạo ở trạng thái `PENDING`. Khi nhận webhook hợp lệ, chuyển sang `PAID` kèm timestamp `paid_at`.
- **BR-04 (Chống trùng tiền - Idempotency):** Kiểm tra `external_transaction_id` trong bảng `payments`. Nếu giao dịch đã tồn tại thì bỏ qua, không kích hoạt gửi mail lần 2.
- **BR-05 (Giao tài liệu tự động):** Kích hoạt `EmailService.sendDeliveryEmail()` ngay khi đơn chuyển `PAID`, ghi nhận nhật ký vào `email_logs`.
- **BR-07 / BR-08 (Snapshot & Tính Coupon):** Tính toán giảm giá độc quyền phía server; lưu snapshot giá gốc, giá bán, mã coupon và UTM vào đơn hàng để phục vụ đối soát.

---

## 🌿 Quy Trình Git & Quản Lý Nhánh (Git Flow)

- Nhánh **`dev`** là nhánh tích hợp nền tảng (Foundation Integration Branch).
- Khi phát triển tính năng mới, luôn tạo nhánh nhánh con từ `dev`:
  ```bash
  git checkout dev
  git pull origin dev
  git checkout -b feature/ten-tinh-nang
  ```
- Khi hoàn thành tính năng, merge trở lại vào `dev`:
  ```bash
  git checkout dev
  git pull origin dev
  git merge feature/ten-tinh-nang
  git push origin dev
  ```
