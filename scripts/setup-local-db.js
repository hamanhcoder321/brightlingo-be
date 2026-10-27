/**
 * Script khởi tạo và nạp dữ liệu mẫu cho Database PostgreSQL Local
 * Đảm bảo lập trình viên clone về có thể chạy ngay mà không động chạm tới Cloud DB.
 */
require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function setupLocalDb() {
  console.log('\n======================================================');
  console.log('   ENGNEST - LOCAL POSTGRESQL DATABASE SETUP');
  console.log('======================================================\n');

  const connectionString = process.env.DATABASE_URL;
  const isCloud =
    Boolean(connectionString && !connectionString.includes('localhost') && !connectionString.includes('127.0.0.1')) ||
    (process.env.DB_HOST && process.env.DB_HOST !== 'localhost' && process.env.DB_HOST !== '127.0.0.1');

  if (isCloud && process.env.NODE_ENV === 'production') {
    console.error('❌ BẢO VỆ AN TOÀN: Script này chỉ dành cho khởi tạo database LOCAL!');
    console.error('Hệ thống phát hiện biến môi trường trỏ tới Cloud / Production.');
    process.exit(1);
  }

  const clientConfig = connectionString
    ? {
        connectionString,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'admin',
        database: process.env.DB_NAME || 'brightlingo_db',
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      };

  console.log(`📡 Đang kết nối tới PostgreSQL...`);
  console.log(`   Host: ${clientConfig.host || 'DATABASE_URL'}`);
  console.log(`   Port: ${clientConfig.port || 5432}`);
  console.log(`   Database: ${clientConfig.database || ''}`);
  console.log(`   User: ${clientConfig.user || ''}`);
  console.log(`   SSL: ${clientConfig.ssl ? 'true' : 'false'}\n`);

  const client = new Client(clientConfig);

  try {
    await client.connect();
    console.log('✅ Kết nối PostgreSQL thành công!');

    const seedPath = path.join(__dirname, '..', 'seed.sql');
    if (!fs.existsSync(seedPath)) {
      throw new Error(`Không tìm thấy file seed tại: ${seedPath}`);
    }

    console.log('🚀 Đang thực thi seed.sql (tạo 16 bảng và nạp dữ liệu mẫu EngNest)...');
    const sql = fs.readFileSync(seedPath, 'utf8');
    await client.query(sql);

    console.log('✅ Đã nạp thành công toàn bộ bảng, khóa học, cài đặt và trang chính sách!');
    console.log('🎉 Cơ sở dữ liệu Local đã sẵn sàng để phát triển và kiểm thử.\n');
  } catch (err) {
    console.error('❌ Lỗi khi thiết lập cơ sở dữ liệu local:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

setupLocalDb();
