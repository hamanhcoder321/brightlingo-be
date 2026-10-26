import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '@/core/database';

export interface HomepageSectionConfig {
  id: string;
  order: number;
  name: string;
  description: string;
  enabled: boolean;
  phase2?: boolean;
}

export interface BannerItemConfig {
  id: string;
  name: string;
  dimensions: string;
  position:
    | 'home_hero'
    | 'announcement_bar'
    | 'home_after_courses'
    | 'home_community'
    | 'course_detail_bottom';
  positionLabel: string;
  priority: number;
  startDate: string;
  endDate: string;
  status: 'active' | 'scheduled' | 'inactive';
  desktopImage: string;
  mobileImage: string;
  altText: string;
  title: string;
  subtitle?: string;
  badgeText?: string;
  ctaText: string;
  ctaLink: string;
  openInNewTab: boolean;
}

export interface Redirect301Item {
  id: string;
  from: string;
  to: string;
  note: string;
}

export const DEFAULT_HOMEPAGE_SECTIONS: HomepageSectionConfig[] = [
  {
    id: 'announcement',
    order: 1,
    name: 'Thanh thông báo',
    description: 'Dải chữ trên cùng – khuyến mãi, tin mới',
    enabled: true,
  },
  {
    id: 'hero',
    order: 2,
    name: 'Banner chính (Hero)',
    description: 'Ảnh + tiêu đề + nút',
    enabled: true,
  },
  {
    id: 'courses',
    order: 3,
    name: 'Khóa nổi bật & danh sách',
    description: 'Lấy từ menu Khóa học',
    enabled: true,
  },
  {
    id: 'how_to_buy',
    order: 4,
    name: 'Mua hàng 3 bước',
    description: 'Nội dung cố định',
    enabled: true,
  },
  {
    id: 'community',
    order: 5,
    name: 'Cộng đồng Facebook',
    description: 'Ảnh, link nhóm, số thành viên',
    enabled: true,
  },
  {
    id: 'blog',
    order: 6,
    name: 'Góc chia sẻ (Bài viết)',
    description: 'Mở ở giai đoạn 2',
    enabled: false,
    phase2: true,
  },
  {
    id: 'faq',
    order: 7,
    name: 'Hỏi đáp & Chính sách',
    description: 'Lấy từ menu Chính sách & Hỏi đáp',
    enabled: true,
  },
  {
    id: 'consultation',
    order: 8,
    name: 'Form tư vấn',
    description: 'Gửi về menu Yêu cầu tư vấn',
    enabled: true,
  },
];

export const DEFAULT_BANNERS: BannerItemConfig[] = [
  {
    id: 'banner-hero-main',
    name: 'Hero chính',
    dimensions: '1440×720 · 780×960',
    position: 'home_hero',
    positionLabel: 'Trang chủ › Đầu trang',
    priority: 1,
    startDate: '',
    endDate: '',
    status: 'active',
    desktopImage: '',
    mobileImage: '',
    altText: 'Mẹ và con cùng học sách tranh tiếng Anh',
    title: 'Học tiếng Anh tại nhà – cho bạn và cho con',
    subtitle:
      'Khóa học video & tài liệu PDF ngắn gọn, dùng được ngay. Mua một lần, nhận link học qua email trong vài phút, học trọn đời – không cần tạo tài khoản.',
    badgeText: 'Tiếng Anh thực chiến cho người Việt',
    ctaText: 'Xem các khóa học',
    ctaLink: '/#khoa-hoc-noi-bat',
    openInNewTab: false,
  },
  {
    id: 'banner-hero-tet',
    name: 'Hero Tết (dự phòng)',
    dimensions: '1440×720 · 780×960',
    position: 'home_hero',
    positionLabel: 'Trang chủ › Đầu trang',
    priority: 2,
    startDate: '2026-01-20',
    endDate: '2026-02-10',
    status: 'scheduled',
    desktopImage: '',
    mobileImage: '',
    altText: 'Đón Tết học tiếng Anh cùng con tại nhà',
    title: 'Khai xuân học tiếng Anh – Ưu đãi đầu năm cho mẹ và bé',
    subtitle: 'Tặng thêm bộ thẻ từ vựng Tết song ngữ PDF khi đăng ký trong dịp Tết.',
    badgeText: 'Ưu đãi Tết',
    ctaText: 'Xem các khóa học',
    ctaLink: '/#khoa-hoc-noi-bat',
    openInNewTab: false,
  },
  {
    id: 'banner-announcement',
    name: 'Thông báo khuyến mãi',
    dimensions: 'Chữ + link',
    position: 'announcement_bar',
    positionLabel: 'Mọi trang › Thanh thông báo',
    priority: 1,
    startDate: '2026-10-15',
    endDate: '2026-10-31',
    status: 'active',
    desktopImage: '',
    mobileImage: '',
    altText: 'Thông báo khuyến mãi',
    title:
      'Ưu đãi đặc biệt: Giảm tới 40% các khóa học tiếng Anh thực chiến — Nhận tài liệu qua Email ngay sau khi thanh toán QR!',
    ctaText: 'Xem khóa học',
    ctaLink: '/#khoa-hoc-noi-bat',
    openInNewTab: false,
  },
  {
    id: 'banner-detail-1000',
    name: 'Gợi ý “1.000 câu”',
    dimensions: '1200×300',
    position: 'course_detail_bottom',
    positionLabel: 'Chi tiết › Dưới nội dung',
    priority: 1,
    startDate: '',
    endDate: '',
    status: 'active',
    desktopImage: '',
    mobileImage: '',
    altText: '1.000 câu tiếng Anh mẹ nói với con mỗi ngày',
    title: '1.000 câu tiếng Anh giao tiếp & mẹ nói với con mỗi ngày',
    subtitle: 'Bộ mẫu câu kèm âm thanh chuẩn bản xứ, áp dụng ngay trong sinh hoạt hằng ngày.',
    ctaText: 'Xem chi tiết khóa này',
    ctaLink: '/khoa-hoc/ngu-phap-1000-mau-cau-so',
    openInNewTab: false,
  },
  {
    id: 'banner-community',
    name: 'Ảnh khối cộng đồng',
    dimensions: '800×600',
    position: 'home_community',
    positionLabel: 'Trang chủ › Cộng đồng',
    priority: 1,
    startDate: '',
    endDate: '',
    status: 'active',
    desktopImage: '',
    mobileImage: '',
    altText: 'Cộng đồng Dạy con tiếng Anh tự nhiên',
    title: 'Tham gia nhóm Dạy con tiếng Anh tự nhiên',
    ctaText: 'Tham gia nhóm Facebook',
    ctaLink: 'https://facebook.com/groups/',
    openInNewTab: true,
  },
  {
    id: 'banner-after-courses',
    name: 'Banner khóa phát âm',
    dimensions: '1200×300',
    position: 'home_after_courses',
    positionLabel: 'Trang chủ › Sau khóa học',
    priority: 1,
    startDate: '',
    endDate: '',
    status: 'inactive',
    desktopImage: '',
    mobileImage: '',
    altText: 'Phát âm chuẩn từ đầu cho người lớn',
    title: 'Phát âm chuẩn từ đầu cho người lớn – Tự tin nói chuẩn sau 30 ngày',
    subtitle: 'Video hướng dẫn khẩu hình chi tiết kèm bài tập luyện shadowing mỗi ngày.',
    ctaText: 'Tìm hiểu khóa phát âm',
    ctaLink: '/khoa-hoc/phat-am-chuan-my-shadowing',
    openInNewTab: false,
  },
];

export const DEFAULT_REDIRECTS_301: Redirect301Item[] = [
  {
    id: 'red-1',
    from: '/khoa-hoc/day-con-tieng-anh',
    to: '/khoa-hoc/me-day-con-tieng-anh',
    note: 'Tự tạo khi đổi slug',
  },
];

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private readonly db: DatabaseService) {}

  private parseJsonSafe<T>(raw: string | undefined, fallback: T): T {
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  private parseBool(raw: string | undefined, fallback: boolean): boolean {
    if (raw === undefined || raw === null || raw === '') return fallback;
    return raw === 'true' || raw === '1';
  }

  /**
   * Kiểm tra một banner có đang trong thời gian hiệu lực không.
   * Quy tắc:
   * - Nếu status === 'inactive' -> không hiện
   * - Nếu có startDate và hôm nay < startDate -> chưa tới hạn
   * - Nếu có endDate và hôm nay > endDate -> đã hết hạn (tự chuyển sang banner ưu tiên kế tiếp)
   */
  public resolveActiveBannersByPosition(banners: BannerItemConfig[]): Record<string, BannerItemConfig | null> {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const positions = [
      'home_hero',
      'announcement_bar',
      'home_after_courses',
      'home_community',
      'course_detail_bottom',
    ];

    const activeByPosition: Record<string, BannerItemConfig | null> = {};

    for (const pos of positions) {
      const candidates = banners
        .filter((b) => {
          if (b.position !== pos) return false;
          if (b.status === 'inactive') return false;
          if (b.startDate && b.startDate > today) return false;
          if (b.endDate && b.endDate < today) return false;
          return true;
        })
        .sort((a, b) => (Number(a.priority) || 99) - (Number(b.priority) || 99));

      activeByPosition[pos] = candidates[0] || null;
    }

    return activeByPosition;
  }

  /**
   * Lấy toàn bộ cấu hình cho CMS Admin (bao gồm SEO, Giao diện & Banner, Liên hệ, Ngân hàng và thống kê Sitemap/SEO)
   */
  async getAllSettings() {
    const res = await this.db.query(`SELECT group_name, key, value FROM settings`);
    const map: Record<string, string> = {};
    for (const row of res.rows) {
      map[row.key] = row.value;
    }

    // Đếm số lượng khóa học và kiểm tra khóa học thiếu ảnh SEO
    let publishedCoursesCount = 0;
    let missingSeoImageCount = 0;
    try {
      const courseRes = await this.db.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE (og_image IS NULL OR og_image = '') AND (image IS NULL OR image = ''))::int AS missing_seo
         FROM courses
         WHERE deleted_at IS NULL AND UPPER(status) = 'PUBLISHED'`,
      );
      publishedCoursesCount = courseRes.rows[0]?.total || 0;
      missingSeoImageCount = courseRes.rows[0]?.missing_seo || 0;
    } catch {
      publishedCoursesCount = 5;
      missingSeoImageCount = 0;
    }

    const homepageSections = this.parseJsonSafe<HomepageSectionConfig[]>(
      map.homepage_sections,
      DEFAULT_HOMEPAGE_SECTIONS,
    );
    const banners = this.parseJsonSafe<BannerItemConfig[]>(map.banners, DEFAULT_BANNERS);
    const redirects301 = this.parseJsonSafe<Redirect301Item[]>(
      map.redirects_301,
      DEFAULT_REDIRECTS_301,
    );

    const primaryDomain = map.primary_domain || 'https://engnest.vn';
    const defaultRobotsTxt = `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /thanh-toan\n\nSitemap: ${primaryDomain.replace(/\/$/, '')}/sitemap.xml`;

    return {
      // 1. Branding & Payment
      site_name: map.site_name || 'EngNest',
      hotline: map.hotline || map.support_phone || '0989 898 989',
      support_email: map.support_email || 'hotro@engnest.vn',
      working_hours: map.working_hours || '8:00–21:00 hằng ngày',
      vietqr_bank_code: map.vietqr_bank_code || map.bank_name || 'MBBANK',
      vietqr_account_number: map.vietqr_account_number || map.account_number || '0399046519',
      vietqr_account_name: map.vietqr_account_name || map.account_name || 'HA VAN MANH',

      // 2. Liên kết, mạng xã hội & cộng đồng
      zalo_url: map.zalo_url || 'https://zalo.me/0989898989',
      fanpage_url: map.fanpage_url || 'https://facebook.com/engnest.vn',
      community_group_url: map.community_group_url || 'https://facebook.com/groups/daycontienganhtunhien',
      community_group_name: map.community_group_name || 'Dạy con tiếng Anh tự nhiên',
      community_members: map.community_members || '12.000+',
      youtube_tiktok_url: map.youtube_tiktok_url || '',
      company_name: map.company_name || 'Hộ kinh doanh Giáo dục EngNest',
      tax_id: map.tax_id || '0109876543',
      company_address: map.company_address || 'Cầu Giấy, Hà Nội',

      // 3. Giao diện & Banner
      homepage_sections: homepageSections,
      banners,
      active_banners: this.resolveActiveBannersByPosition(banners),

      // 4. SEO & Google
      meta_title:
        map.meta_title || 'EngNest – Tự học tiếng Anh tại nhà',
      meta_description:
        map.meta_description ||
        'Khóa học tiếng Anh dạng video & PDF, mua một lần học trọn đời. Không cần tài khoản – thanh toán QR, nhận tài liệu qua email trong vài phút.',
      og_image: map.og_image || '',
      favicon: map.favicon || '/logo-tab-1.png',
      google_site_verification:
        map.google_site_verification !== undefined
          ? map.google_site_verification
          : '<meta name="google-site-verification" content="xxxxxxxx" />',
      google_analytics_id: map.google_analytics_id || '',
      gtm_id: map.gtm_id || '',
      facebook_pixel_id: map.facebook_pixel_id || '',
      send_purchase_event: this.parseBool(map.send_purchase_event, true),
      robots_txt: map.robots_txt || defaultRobotsTxt,
      noindex: this.parseBool(map.noindex, false),
      primary_domain: primaryDomain,
      www_redirect: map.www_redirect || 'non-www',
      redirects_301: redirects301,
      schema_organization: this.parseBool(map.schema_organization, true),
      schema_course: this.parseBool(map.schema_course, true),
      schema_faq: this.parseBool(map.schema_faq, true),
      schema_breadcrumb: this.parseBool(map.schema_breadcrumb, true),
      schema_article: this.parseBool(map.schema_article, false),

      // 5. Sitemap & SEO Health Diagnostics
      sitemap_last_generated: map.sitemap_last_generated || '09:12 hôm nay',
      sitemap_url_count: publishedCoursesCount + 6, // Trang chủ + Khóa học + 4 trang chính sách + các khóa học
      missing_seo_image_count: missingSeoImageCount,
    };
  }

  /**
   * Lấy cấu hình công khai cho lingo-frontend (SSR & Client)
   */
  async getPublicSettings() {
    const all = await this.getAllSettings();
    return {
      site_name: all.site_name,
      hotline: all.hotline,
      support_email: all.support_email,
      working_hours: all.working_hours,
      zalo_url: all.zalo_url,
      fanpage_url: all.fanpage_url,
      community_group_url: all.community_group_url,
      community_group_name: all.community_group_name,
      community_members: all.community_members,
      youtube_tiktok_url: all.youtube_tiktok_url,
      company_name: all.company_name,
      tax_id: all.tax_id,
      company_address: all.company_address,
      meta_title: all.meta_title,
      meta_description: all.meta_description,
      og_image: all.og_image,
      favicon: all.favicon,
      google_site_verification: all.google_site_verification,
      google_analytics_id: all.google_analytics_id,
      gtm_id: all.gtm_id,
      facebook_pixel_id: all.facebook_pixel_id,
      send_purchase_event: all.send_purchase_event,
      robots_txt: all.robots_txt,
      noindex: all.noindex,
      primary_domain: all.primary_domain,
      www_redirect: all.www_redirect,
      redirects_301: all.redirects_301,
      schema_organization: all.schema_organization,
      schema_course: all.schema_course,
      schema_faq: all.schema_faq,
      schema_breadcrumb: all.schema_breadcrumb,
      homepage_sections: all.homepage_sections,
      banners: all.banners,
      active_banners: all.active_banners,
    };
  }

  /**
   * Cập nhật cấu hình từ CMS (Hỗ trợ lưu từng phần hoặc toàn bộ)
   */
  async updateSettings(payload: Record<string, any>) {
    const groupMap: Record<string, string> = {
      site_name: 'BRANDING',
      favicon: 'BRANDING',
      og_image: 'SEO',
      hotline: 'SUPPORT',
      support_phone: 'SUPPORT',
      support_email: 'SUPPORT',
      working_hours: 'SUPPORT',
      zalo_url: 'SUPPORT',
      fanpage_url: 'SUPPORT',
      community_group_url: 'SUPPORT',
      community_group_name: 'SUPPORT',
      community_members: 'SUPPORT',
      youtube_tiktok_url: 'SUPPORT',
      company_name: 'BRANDING',
      tax_id: 'BRANDING',
      company_address: 'BRANDING',
      vietqr_bank_code: 'PAYMENT',
      bank_name: 'PAYMENT',
      vietqr_account_number: 'PAYMENT',
      account_number: 'PAYMENT',
      vietqr_account_name: 'PAYMENT',
      account_name: 'PAYMENT',
      homepage_sections: 'LAYOUT',
      banners: 'LAYOUT',
      meta_title: 'SEO',
      meta_description: 'SEO',
      google_site_verification: 'SEO',
      google_analytics_id: 'SEO',
      gtm_id: 'SEO',
      facebook_pixel_id: 'SEO',
      send_purchase_event: 'SEO',
      robots_txt: 'SEO',
      noindex: 'SEO',
      primary_domain: 'SEO',
      www_redirect: 'SEO',
      redirects_301: 'SEO',
      schema_organization: 'SEO',
      schema_course: 'SEO',
      schema_faq: 'SEO',
      schema_breadcrumb: 'SEO',
      schema_article: 'SEO',
      sitemap_last_generated: 'SEO',
    };

    const allowedKeys = Object.keys(groupMap);

    for (const key of allowedKeys) {
      if (payload[key] !== undefined) {
        const rawVal = payload[key];
        const strVal =
          typeof rawVal === 'object' && rawVal !== null
            ? JSON.stringify(rawVal)
            : String(rawVal);

        const group = groupMap[key] || 'GENERAL';
        await this.db.query(
          `INSERT INTO settings (group_name, key, value, updated_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (key) DO UPDATE SET
             group_name = EXCLUDED.group_name,
             value = EXCLUDED.value,
             updated_at = NOW()`,
          [group, key, strVal],
        );

        // Đồng bộ khóa cũ trong DB nếu cập nhật hotline hoặc ngân hàng
        if (key === 'hotline') {
          await this.db.query(
            `INSERT INTO settings (group_name, key, value, updated_at)
             VALUES ('SUPPORT', 'support_phone', $1, NOW())
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
            [strVal],
          );
        }
        if (key === 'vietqr_bank_code') {
          await this.db.query(
            `INSERT INTO settings (group_name, key, value, updated_at)
             VALUES ('PAYMENT', 'bank_name', $1, NOW())
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
            [strVal],
          );
        }
        if (key === 'vietqr_account_number') {
          await this.db.query(
            `INSERT INTO settings (group_name, key, value, updated_at)
             VALUES ('PAYMENT', 'account_number', $1, NOW())
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
            [strVal],
          );
        }
        if (key === 'vietqr_account_name') {
          await this.db.query(
            `INSERT INTO settings (group_name, key, value, updated_at)
             VALUES ('PAYMENT', 'account_name', $1, NOW())
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
            [strVal],
          );
        }
      }
    }

    this.logger.log(`Settings updated by admin (${Object.keys(payload).join(', ')})`);
    return this.getAllSettings();
  }

  /**
   * Tạo lại Sitemap XML & trả về danh sách URL thực tế từ DB
   */
  async regenerateSitemap() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const timeLabel = `${hh}:${mm} hôm nay`;

    await this.updateSettings({ sitemap_last_generated: timeLabel });

    const all = await this.getAllSettings();
    const domain = (all.primary_domain || 'https://engnest.vn').replace(/\/$/, '');

    const coursesRes = await this.db.query(
      `SELECT slug, updated_at FROM courses WHERE deleted_at IS NULL AND UPPER(status) = 'PUBLISHED' ORDER BY id ASC`,
    );

    const staticPaths = [
      '/',
      '/khoa-hoc',
      '/loi-ich',
      '/danh-gia',
      '/chinh-sach-thanh-toan',
      '/giao-tai-lieu-so',
      '/chinh-sach-bao-mat',
      '/dieu-khoan-su-dung',
    ];

    const urls = [
      ...staticPaths.map((p) => ({
        loc: `${domain}${p}`,
        lastmod: now.toISOString().slice(0, 10),
        priority: p === '/' ? '1.0' : '0.8',
      })),
      ...coursesRes.rows.map((c) => ({
        loc: `${domain}/khoa-hoc/${c.slug}`,
        lastmod: c.updated_at
          ? new Date(c.updated_at).toISOString().slice(0, 10)
          : now.toISOString().slice(0, 10),
        priority: '0.9',
      })),
    ];

    const xmlLines = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...urls.map(
        (u) =>
          `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n    <priority>${u.priority}</priority>\n  </url>`,
      ),
      '</urlset>',
    ];

    return {
      success: true,
      sitemap_last_generated: timeLabel,
      sitemap_url_count: urls.length,
      urls,
      xml: xmlLines.join('\n'),
    };
  }
}
