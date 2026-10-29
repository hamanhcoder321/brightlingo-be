import { Injectable, BadRequestException, NotFoundException, OnModuleInit, Logger } from '@nestjs/common';
import { DatabaseService } from '@/core/database';
import { AuditService } from '@/modules/audit/audit.service';
import { CreateCouponDto, UpdateCouponDto, QueryCouponDto } from './dto/coupon.dto';

@Injectable()
export class CouponsService implements OnModuleInit {
  private readonly logger = new Logger(CouponsService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly auditService: AuditService,
  ) {}

  async onModuleInit() {
    await this.ensureDefaultCoupons();
  }

  async ensureDefaultCoupons() {
    const defaultCoupons = [
      {
        code: 'ENGNEST',
        type: 'PERCENT',
        value: 20,
        scope: 'ALL',
        status: 'ACTIVE',
        note: 'Ưu đãi thành viên mới EngNest giảm 20%',
      },
      {
        code: 'GIAM20',
        type: 'PERCENT',
        value: 20,
        scope: 'ALL',
        status: 'ACTIVE',
        note: 'Mã giảm giá ưu đãi 20%',
      },
      {
        code: 'BRIGHT50',
        type: 'FIXED',
        value: 50000,
        scope: 'ALL',
        status: 'ACTIVE',
        note: 'Mã giảm trực tiếp 50.000đ',
      },
    ];

    for (const c of defaultCoupons) {
      try {
        const existing = await this.databaseService.query(
          `SELECT id FROM coupons WHERE code = $1 AND deleted_at IS NULL`,
          [c.code],
        );
        if (existing.rows.length === 0) {
          await this.databaseService.query(
            `INSERT INTO coupons (
              code, type, value, min_order_amount, max_discount_amount,
              scope, start_date, end_date, usage_limit, status, note, created_at, updated_at
            ) VALUES ($1, $2, $3, 0, NULL, $4, NOW(), NOW() + INTERVAL '10 years', 1000, $5, $6, NOW(), NOW())`,
            [c.code, c.type, c.value, c.scope, c.status, c.note],
          );
          this.logger.log(`Initialized default active coupon: ${c.code}`);
        }
      } catch (err: any) {
        // Silent catch if coupons table does not exist or has different schema
      }
    }
  }

  // 1. Áp dụng coupon và tính toán chiết khấu cho khách hàng (BR-07)
  async applyCoupon(couponCodeInput: string, courseId: string, currentPrice?: number) {
    if (!couponCodeInput) {
      throw new BadRequestException('Mã giảm giá không được để trống');
    }

    const normalizedCouponCode = couponCodeInput.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{1,50}$/.test(normalizedCouponCode)) {
      throw new BadRequestException('Mã giảm giá chứa ký tự không hợp lệ');
    }

    // Lấy thông tin khóa học từ Database để đảm bảo tính toàn vẹn giá (Source of Truth)
    const courseQueryResult = await this.databaseService.query(
      `SELECT id, title, price, original_price FROM courses WHERE (id = $1 OR slug = $1) AND status = 'PUBLISHED' AND deleted_at IS NULL`,
      [courseId],
    );
    if (courseQueryResult.rows.length === 0) {
      throw new NotFoundException('Khóa học không tồn tại hoặc đã ngừng mở bán');
    }

    const targetCourse = courseQueryResult.rows[0];
    const effectiveCoursePrice = currentPrice !== undefined && currentPrice > 0 ? currentPrice : targetCourse.price;

    // Tìm mã giảm giá hợp lệ theo thời gian và trạng thái kích hoạt
    let couponLookupResult = await this.databaseService.query(
      `SELECT * FROM coupons 
       WHERE code = $1 AND status = 'ACTIVE' AND deleted_at IS NULL
         AND (start_date IS NULL OR start_date <= NOW())
         AND (end_date IS NULL OR end_date >= NOW())`,
      [normalizedCouponCode],
    );

    let activeCoupon = couponLookupResult.rows[0];

    if (!activeCoupon) {
      if (['ENGNEST', 'GIAM20', 'BRIGHT50'].includes(normalizedCouponCode)) {
        await this.ensureDefaultCoupons();
        const retry = await this.databaseService.query(
          `SELECT * FROM coupons 
           WHERE code = $1 AND status = 'ACTIVE' AND deleted_at IS NULL
             AND (start_date IS NULL OR start_date <= NOW())
             AND (end_date IS NULL OR end_date >= NOW())`,
          [normalizedCouponCode],
        );
        if (retry.rows.length > 0) {
          activeCoupon = retry.rows[0];
        }
      }
    }

    if (!activeCoupon) {
      throw new BadRequestException('Mã giảm giá không hợp lệ, đã hết hạn hoặc tạm đóng');
    }

    // Kiểm tra giới hạn số lượt sử dụng
    if (activeCoupon.usage_limit && activeCoupon.usage_count >= activeCoupon.usage_limit) {
      throw new BadRequestException('Mã giảm giá đã hết lượt sử dụng');
    }

    // Kiểm tra phạm vi áp dụng (scope = SPECIFIC thì khóa học phải nằm trong coupon_courses)
    if (activeCoupon.scope === 'SPECIFIC') {
      const courseScopeQueryResult = await this.databaseService.query(
        `SELECT id FROM coupon_courses WHERE coupon_id = $1 AND (course_id = $2 OR course_id = $3)`,
        [activeCoupon.id, courseId, targetCourse.id],
      );
      if (courseScopeQueryResult.rows.length === 0) {
        throw new BadRequestException('Mã giảm giá này không áp dụng cho khóa học bạn đang chọn');
      }
    }

    // Kiểm tra giá trị đơn hàng tối thiểu
    if (activeCoupon.min_order_amount && effectiveCoursePrice < activeCoupon.min_order_amount) {
      throw new BadRequestException(
        `Đơn hàng tối thiểu phải từ ${Number(activeCoupon.min_order_amount).toLocaleString('vi-VN')}đ`,
      );
    }

    // Tính toán số tiền được giảm theo loại chiết khấu
    let calculatedDiscountAmount = 0;
    if (activeCoupon.type === 'PERCENT') {
      calculatedDiscountAmount = Math.round((effectiveCoursePrice * activeCoupon.value) / 100);
      if (activeCoupon.max_discount_amount && calculatedDiscountAmount > activeCoupon.max_discount_amount) {
        calculatedDiscountAmount = activeCoupon.max_discount_amount;
      }
    } else {
      calculatedDiscountAmount = activeCoupon.value;
    }

    // Số tiền giảm không thể vượt quá giá trị đơn hàng
    if (calculatedDiscountAmount > effectiveCoursePrice) {
      calculatedDiscountAmount = effectiveCoursePrice;
    }

    const calculatedFinalPrice = Math.max(0, effectiveCoursePrice - calculatedDiscountAmount);

    return {
      code: activeCoupon.code,
      discountAmount: calculatedDiscountAmount,
      finalPrice: calculatedFinalPrice,
      isApplied: true,
      message: `Đã áp dụng mã giảm giá ${activeCoupon.code} thành công!`,
    };
  }

  // 2. Danh sách mã giảm giá cho Admin CMS (kèm bộ lọc & phân trang)
  async findAllForAdmin(filterParams: QueryCouponDto) {
    const currentPage = Math.max(1, filterParams.page || 1);
    const pageSize = Math.max(1, Math.min(100, filterParams.limit || 20));
    const offsetRows = (currentPage - 1) * pageSize;

    const sqlFilterClauses: string[] = ['couponsTable.deleted_at IS NULL'];
    const sqlFilterValues: any[] = [];
    let sqlParamPlaceholderIndex = 1;

    if (filterParams.search && filterParams.search.trim()) {
      const formattedSearchKeyword = `%${filterParams.search.trim().toUpperCase()}%`;
      sqlFilterClauses.push(
        `(couponsTable.code ILIKE $${sqlParamPlaceholderIndex} OR couponsTable.note ILIKE $${sqlParamPlaceholderIndex})`,
      );
      sqlFilterValues.push(formattedSearchKeyword);
      sqlParamPlaceholderIndex++;
    }

    if (filterParams.status && filterParams.status !== 'ALL') {
      sqlFilterClauses.push(`couponsTable.status = $${sqlParamPlaceholderIndex}`);
      sqlFilterValues.push(filterParams.status.toUpperCase());
      sqlParamPlaceholderIndex++;
    }

    if (filterParams.scope && filterParams.scope !== 'ALL') {
      sqlFilterClauses.push(`couponsTable.scope = $${sqlParamPlaceholderIndex}`);
      sqlFilterValues.push(filterParams.scope.toUpperCase());
      sqlParamPlaceholderIndex++;
    }

    const whereClauseString =
      sqlFilterClauses.length > 0 ? `WHERE ${sqlFilterClauses.join(' AND ')}` : '';

    const countQueryResult = await this.databaseService.query(
      `SELECT COUNT(*) as total FROM coupons couponsTable ${whereClauseString}`,
      sqlFilterValues,
    );
    const totalCouponCount = parseInt(countQueryResult.rows[0]?.total || '0', 10);

    const couponDataSqlQuery = `
      SELECT 
        couponsTable.id,
        couponsTable.code,
        couponsTable.type,
        couponsTable.value,
        couponsTable.min_order_amount,
        couponsTable.max_discount_amount,
        couponsTable.scope,
        couponsTable.start_date,
        couponsTable.end_date,
        couponsTable.usage_limit,
        couponsTable.usage_count,
        couponsTable.status,
        couponsTable.note,
        couponsTable.created_at,
        couponsTable.updated_at,
        COALESCE(
          (
            SELECT json_agg(json_build_object(
              'id', courseRecord.id,
              'title', courseRecord.title,
              'slug', courseRecord.slug,
              'price', courseRecord.price
            ))
            FROM coupon_courses couponCourseMapping
            JOIN courses courseRecord ON couponCourseMapping.course_id = courseRecord.id
            WHERE couponCourseMapping.coupon_id = couponsTable.id
          ),
          '[]'::json
        ) as courses
      FROM coupons couponsTable
      ${whereClauseString}
      ORDER BY couponsTable.created_at DESC
      LIMIT $${sqlParamPlaceholderIndex} OFFSET $${sqlParamPlaceholderIndex + 1}
    `;

    sqlFilterValues.push(pageSize, offsetRows);
    const couponListQueryResult = await this.databaseService.query(couponDataSqlQuery, sqlFilterValues);

    return {
      items: couponListQueryResult.rows,
      total: totalCouponCount,
      page: currentPage,
      limit: pageSize,
      totalPages: Math.ceil(totalCouponCount / pageSize),
    };
  }

  // 3. Chi tiết 1 mã giảm giá theo ID
  async findById(couponId: string | number) {
    const couponDetailQueryResult = await this.databaseService.query(
      `SELECT 
        couponsTable.*,
        COALESCE(
          (
            SELECT json_agg(json_build_object(
              'id', courseRecord.id,
              'title', courseRecord.title,
              'slug', courseRecord.slug,
              'price', courseRecord.price
            ))
            FROM coupon_courses couponCourseMapping
            JOIN courses courseRecord ON couponCourseMapping.course_id = courseRecord.id
            WHERE couponCourseMapping.coupon_id = couponsTable.id
          ),
          '[]'::json
        ) as courses
      FROM coupons couponsTable
      WHERE couponsTable.id = $1 AND couponsTable.deleted_at IS NULL`,
      [couponId],
    );

    if (couponDetailQueryResult.rows.length === 0) {
      throw new NotFoundException('Mã giảm giá không tồn tại hoặc đã bị xóa');
    }

    return couponDetailQueryResult.rows[0];
  }

  // 4. Tạo mã giảm giá mới
  async create(createCouponDto: CreateCouponDto, currentAdminUser?: any, clientIpAddress?: string) {
    const normalizedCouponCode = createCouponDto.code.trim().toUpperCase();

    // Kiểm tra trùng mã giảm giá
    const duplicateCouponCheckResult = await this.databaseService.query(
      `SELECT id FROM coupons WHERE code = $1 AND deleted_at IS NULL`,
      [normalizedCouponCode],
    );
    if (duplicateCouponCheckResult.rows.length > 0) {
      throw new BadRequestException(`Mã giảm giá "${normalizedCouponCode}" đã tồn tại trên hệ thống`);
    }

    // Kiểm tra tính hợp lệ của mức giảm %
    if (createCouponDto.type === 'PERCENT' && createCouponDto.value > 100) {
      throw new BadRequestException('Mức giảm theo phần trăm không được vượt quá 100%');
    }

    // Kiểm tra phạm vi áp dụng
    const selectedScope = createCouponDto.scope || 'ALL';
    const applicableCourseIds = Array.isArray(createCouponDto.courseIds) ? createCouponDto.courseIds : [];
    if (selectedScope === 'SPECIFIC' && applicableCourseIds.length === 0) {
      throw new BadRequestException('Vui lòng chọn ít nhất một khóa học áp dụng khi chọn phạm vi cụ thể');
    }

    const initialCouponStatus = createCouponDto.status || 'ACTIVE';

    const dbClient = await this.databaseService.getPool().connect();
    try {
      await dbClient.query('BEGIN');

      const insertCouponResult = await dbClient.query(
        `INSERT INTO coupons (
          code, type, value, min_order_amount, max_discount_amount,
          scope, start_date, end_date, usage_limit, status, note
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`,
        [
          normalizedCouponCode,
          createCouponDto.type,
          createCouponDto.value,
          createCouponDto.minOrderAmount || 0,
          createCouponDto.maxDiscountAmount || null,
          selectedScope,
          createCouponDto.startDate ? new Date(createCouponDto.startDate) : null,
          createCouponDto.endDate ? new Date(createCouponDto.endDate) : null,
          createCouponDto.usageLimit || null,
          initialCouponStatus,
          createCouponDto.note || null,
        ],
      );

      const newlyCreatedCoupon = insertCouponResult.rows[0];

      // Lưu danh sách khóa học liên kết nếu là phạm vi cụ thể
      if (selectedScope === 'SPECIFIC' && applicableCourseIds.length > 0) {
        for (const singleCourseId of applicableCourseIds) {
          await dbClient.query(
            `INSERT INTO coupon_courses (coupon_id, course_id) 
             VALUES ($1, $2) ON CONFLICT (coupon_id, course_id) DO NOTHING`,
            [newlyCreatedCoupon.id, singleCourseId],
          );
        }
      }

      await dbClient.query('COMMIT');

      // Ghi nhật ký thao tác Admin (Audit Log)
      await this.auditService.log({
        adminId: currentAdminUser?.id,
        adminName: currentAdminUser?.username || currentAdminUser?.email || 'Admin',
        action: 'CREATE_COUPON',
        targetEntity: 'coupons',
        targetId: String(newlyCreatedCoupon.id),
        details: {
          code: normalizedCouponCode,
          type: createCouponDto.type,
          value: createCouponDto.value,
          scope: selectedScope,
          status: initialCouponStatus,
        },
        ipAddress: clientIpAddress,
      });

      return this.findById(newlyCreatedCoupon.id);
    } catch (databaseError) {
      await dbClient.query('ROLLBACK');
      throw databaseError;
    } finally {
      dbClient.release();
    }
  }

  // 5. Cập nhật mã giảm giá
  async update(
    couponId: string | number,
    updateCouponDto: UpdateCouponDto,
    currentAdminUser?: any,
    clientIpAddress?: string,
  ) {
    const existingCoupon = await this.findById(couponId);

    let updatedCouponCode = existingCoupon.code;
    if (updateCouponDto.code) {
      updatedCouponCode = updateCouponDto.code.trim().toUpperCase();
      if (updatedCouponCode !== existingCoupon.code) {
        const duplicateCouponCheckResult = await this.databaseService.query(
          `SELECT id FROM coupons WHERE code = $1 AND id != $2 AND deleted_at IS NULL`,
          [updatedCouponCode, couponId],
        );
        if (duplicateCouponCheckResult.rows.length > 0) {
          throw new BadRequestException(`Mã giảm giá "${updatedCouponCode}" đã tồn tại`);
        }
      }
    }

    const updatedType = updateCouponDto.type || existingCoupon.type;
    const updatedDiscountValue =
      updateCouponDto.value !== undefined ? updateCouponDto.value : existingCoupon.value;
    if (updatedType === 'PERCENT' && updatedDiscountValue > 100) {
      throw new BadRequestException('Mức giảm theo phần trăm không được vượt quá 100%');
    }

    const updatedScope = updateCouponDto.scope || existingCoupon.scope;
    const applicableCourseIds = updateCouponDto.courseIds;
    if (updatedScope === 'SPECIFIC' && applicableCourseIds && applicableCourseIds.length === 0) {
      throw new BadRequestException('Vui lòng chọn ít nhất một khóa học áp dụng khi chọn phạm vi cụ thể');
    }

    const dbClient = await this.databaseService.getPool().connect();
    try {
      await dbClient.query('BEGIN');

      await dbClient.query(
        `UPDATE coupons SET
          code = $1,
          type = $2,
          value = $3,
          min_order_amount = $4,
          max_discount_amount = $5,
          scope = $6,
          start_date = $7,
          end_date = $8,
          usage_limit = $9,
          status = $10,
          note = $11,
          updated_at = NOW()
        WHERE id = $12`,
        [
          updatedCouponCode,
          updatedType,
          updatedDiscountValue,
          updateCouponDto.minOrderAmount !== undefined
            ? updateCouponDto.minOrderAmount
            : existingCoupon.min_order_amount,
          updateCouponDto.maxDiscountAmount !== undefined
            ? updateCouponDto.maxDiscountAmount
            : existingCoupon.max_discount_amount,
          updatedScope,
          updateCouponDto.startDate !== undefined
            ? updateCouponDto.startDate
              ? new Date(updateCouponDto.startDate)
              : null
            : existingCoupon.start_date,
          updateCouponDto.endDate !== undefined
            ? updateCouponDto.endDate
              ? new Date(updateCouponDto.endDate)
              : null
            : existingCoupon.end_date,
          updateCouponDto.usageLimit !== undefined
            ? updateCouponDto.usageLimit
            : existingCoupon.usage_limit,
          updateCouponDto.status !== undefined ? updateCouponDto.status : existingCoupon.status,
          updateCouponDto.note !== undefined ? updateCouponDto.note : existingCoupon.note,
          couponId,
        ],
      );

      // Cập nhật quan hệ coupon_courses nếu thay đổi danh sách khóa học hoặc thay đổi scope
      if (applicableCourseIds !== undefined || updatedScope !== existingCoupon.scope) {
        await dbClient.query(`DELETE FROM coupon_courses WHERE coupon_id = $1`, [couponId]);
        if (updatedScope === 'SPECIFIC' && applicableCourseIds && applicableCourseIds.length > 0) {
          for (const singleCourseId of applicableCourseIds) {
            await dbClient.query(
              `INSERT INTO coupon_courses (coupon_id, course_id) 
               VALUES ($1, $2) ON CONFLICT (coupon_id, course_id) DO NOTHING`,
              [couponId, singleCourseId],
            );
          }
        }
      }

      await dbClient.query('COMMIT');

      // Ghi audit log
      await this.auditService.log({
        adminId: currentAdminUser?.id,
        adminName: currentAdminUser?.username || currentAdminUser?.email || 'Admin',
        action: 'UPDATE_COUPON',
        targetEntity: 'coupons',
        targetId: String(couponId),
        details: {
          code: updatedCouponCode,
          type: updatedType,
          value: updatedDiscountValue,
          scope: updatedScope,
          status: updateCouponDto.status || existingCoupon.status,
        },
        ipAddress: clientIpAddress,
      });

      return this.findById(couponId);
    } catch (databaseError) {
      await dbClient.query('ROLLBACK');
      throw databaseError;
    } finally {
      dbClient.release();
    }
  }

  // 6. Bật / Tắt trạng thái mã giảm giá (ACTIVE <=> INACTIVE)
  async toggleStatus(couponId: string | number, currentAdminUser?: any, clientIpAddress?: string) {
    const existingCoupon = await this.findById(couponId);
    const toggledStatus = existingCoupon.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    await this.databaseService.query(
      `UPDATE coupons SET status = $1, updated_at = NOW() WHERE id = $2`,
      [toggledStatus, couponId],
    );

    await this.auditService.log({
      adminId: currentAdminUser?.id,
      adminName: currentAdminUser?.username || currentAdminUser?.email || 'Admin',
      action: 'TOGGLE_COUPON_STATUS',
      targetEntity: 'coupons',
      targetId: String(couponId),
      details: {
        previousStatus: existingCoupon.status,
        newStatus: toggledStatus,
        code: existingCoupon.code,
      },
      ipAddress: clientIpAddress,
    });

    return {
      id: existingCoupon.id,
      code: existingCoupon.code,
      status: toggledStatus,
      message: `Đã ${toggledStatus === 'ACTIVE' ? 'bật (kích hoạt)' : 'đóng (tạm dừng)'} mã giảm giá ${existingCoupon.code}`,
    };
  }

  // 7. Xóa mã giảm giá (Soft Delete an toàn - giải phóng code để có thể tái sử dụng nếu cần)
  async remove(couponId: string | number, currentAdminUser?: any, clientIpAddress?: string) {
    const existingCoupon = await this.findById(couponId);

    await this.databaseService.query(
      `UPDATE coupons 
       SET deleted_at = NOW(), 
           status = 'INACTIVE', 
           code = code || '__del_' || SUBSTRING(MD5(RANDOM()::text), 1, 8) 
       WHERE id = $1`,
      [couponId],
    );

    await this.auditService.log({
      adminId: currentAdminUser?.id,
      adminName: currentAdminUser?.username || currentAdminUser?.email || 'Admin',
      action: 'DELETE_COUPON',
      targetEntity: 'coupons',
      targetId: String(couponId),
      details: { code: existingCoupon.code },
      ipAddress: clientIpAddress,
    });

    return {
      success: true,
      message: `Đã xóa mã giảm giá ${existingCoupon.code} thành công`,
    };
  }
}
