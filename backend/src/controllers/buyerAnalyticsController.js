const { sequelize, Sequelize } = require('../models');
const { CampaignOperator } = require('../models');
const { QueryTypes } = Sequelize;

/**
 * viewAsUserId 권한 헬퍼
 *  - operator: 본인 ID 강제 (viewAsUserId 무시 — 위조 차단)
 *  - admin: viewAsUserId 있으면 해당 진행자 기준, 없으면 null(전체)
 *  - 그 외: null 반환 → 호출부에서 거부 처리
 *
 * 반환: { effectiveOperatorId: number|null, denied: boolean }
 *   - denied=true 면 호출부가 403 응답
 *   - effectiveOperatorId=null 이면 admin 전체 모드 (필터 안 함)
 */
function resolveEffectiveOperatorId(req) {
  const role = req.user.role;
  if (role === 'operator') {
    return { effectiveOperatorId: req.user.id, denied: false };
  }
  if (role === 'admin') {
    if (req.query.viewAsUserId != null && req.query.viewAsUserId !== '') {
      const v = parseInt(req.query.viewAsUserId, 10);
      if (!Number.isFinite(v) || v <= 0) {
        return { effectiveOperatorId: null, denied: true };
      }
      return { effectiveOperatorId: v, denied: false };
    }
    return { effectiveOperatorId: null, denied: false };
  }
  return { effectiveOperatorId: null, denied: true };
}

/**
 * 구매자 분석 - 계좌 단위 집계
 * GET /api/buyer-analytics/accounts
 *
 * 동일 계좌주(account_normalized)가 여러 가명(buyer_name/recipient_name)으로
 * 참여하는 패턴을 추적하기 위한 분석. Best/Worst 구매자 식별 및 출고유형 편중자
 * (미출고만 / 실출고만) 탐지를 위한 데이터 제공.
 *
 * 쿼리:
 *  - startDate, endDate (선택): Buyer.info_entered_at 기준
 *  - overdueDays (기본 14): 기한 일수
 *  - minParticipation (기본 3): 최소 참여건수 (계좌 단위)
 *
 * 역할 필터:
 *  - admin: 전체
 *  - operator: CampaignOperator로 본인 배정 (item_id, day_group) 조합의 buyer만.
 *    day_group=NULL 배정은 해당 item_id 전체로 해석.
 *    Buyer의 day_group 판정은 ItemSlot.buyer_id 매핑으로 결정.
 */
exports.getAccounts = async (req, res) => {
  try {
    const { effectiveOperatorId, denied } = resolveEffectiveOperatorId(req);
    if (denied) {
      return res.status(403).json({ success: false, message: '권한 없음' });
    }

    const startDate = req.query.startDate || null;
    const endDate = req.query.endDate || null;
    const overdueDays = parseInt(req.query.overdueDays, 10) || 14;
    const minParticipation = parseInt(req.query.minParticipation, 10) || 1;
    // 택배대행 필터: 'all' (전체), 'Y' (대행만), 'N' (대행 안함만)
    const courierFilter = req.query.courierFilter || 'all';
    // 계좌(account_info) 부분 일치 검색어
    const accountKeyword = (req.query.accountKeyword || '').trim();

    // effectiveOperatorId가 있으면 본인/대상 진행자 배정 (item_id, day_group) 집합 미리 계산
    let operatorScope = null; // null=전체, { itemFull: Set, itemDayGroups: Map(item_id -> Set(day_group)) }
    if (effectiveOperatorId) {
      const assignments = await CampaignOperator.findAll({
        where: { operator_id: effectiveOperatorId },
        attributes: ['item_id', 'day_group']
      });

      if (assignments.length === 0) {
        return res.json({ success: true, data: [], count: 0, _scope: 'no_assignment' });
      }

      const itemFull = new Set();          // day_group=NULL → item 전체
      const itemDayGroups = new Map();      // item_id → Set(day_group)
      for (const a of assignments) {
        if (a.item_id == null) continue;
        if (a.day_group === null || a.day_group === undefined) {
          itemFull.add(a.item_id);
        } else {
          if (!itemDayGroups.has(a.item_id)) {
            itemDayGroups.set(a.item_id, new Set());
          }
          itemDayGroups.get(a.item_id).add(a.day_group);
        }
      }
      operatorScope = { itemFull, itemDayGroups };
    }

    // 메인 쿼리: buyer 단위로 계산한 뒤 account_normalized로 그룹핑
    // ItemSlot은 buyer_id 매핑으로 LEFT JOIN (한 buyer가 슬롯에 연결되지 않을 수도 있음)
    // shipping_type 우선순위: ItemSlot.shipping_type 우선, 없으면 Item.shipping_type (하위 호환성)
    const replacements = {
      overdueDays,
      minParticipation
    };

    const conditions = [
      'b.is_temporary = false',
      'b.deleted_at IS NULL',
      "b.account_normalized IS NOT NULL",
      "b.account_normalized <> ''"
    ];

    if (startDate) {
      conditions.push('b.info_entered_at >= :startDate');
      replacements.startDate = startDate;
    }
    if (endDate) {
      conditions.push('b.info_entered_at <= :endDate');
      replacements.endDate = endDate;
    }

    // 계좌 부분 일치 검색 (account_info 안의 계좌주명/계좌번호 일부 매칭)
    if (accountKeyword) {
      conditions.push("b.account_info ILIKE :accountKeyword");
      replacements.accountKeyword = `%${accountKeyword}%`;
    }

    // 택배대행 필터: Item / ItemSlot.courier_service_yn (TEXT, 파이프 가능)
    // 'Y'면 'Y' 포함, 'N'면 'N' 포함 (대소문자 무시)
    if (courierFilter === 'Y') {
      conditions.push("UPPER(COALESCE(s.courier_service_yn, i.courier_service_yn)) LIKE '%Y%'");
    } else if (courierFilter === 'N') {
      conditions.push("UPPER(COALESCE(s.courier_service_yn, i.courier_service_yn)) LIKE '%N%'");
    }

    // operator 권한 필터를 SQL 절로 변환
    if (operatorScope) {
      const orParts = [];
      if (operatorScope.itemFull.size > 0) {
        const ids = Array.from(operatorScope.itemFull).join(',');
        orParts.push(`b.item_id IN (${ids})`);
      }
      for (const [itemId, dgSet] of operatorScope.itemDayGroups.entries()) {
        if (operatorScope.itemFull.has(itemId)) continue; // 이미 전체 커버
        const dgs = Array.from(dgSet).join(',');
        // ItemSlot의 day_group 으로 좁힘
        orParts.push(`(b.item_id = ${itemId} AND COALESCE(s.day_group, 1) IN (${dgs}))`);
      }
      if (orParts.length === 0) {
        return res.json({ success: true, data: [], count: 0 });
      }
      conditions.push(`(${orParts.join(' OR ')})`);
    }

    const whereSQL = conditions.join(' AND ');

    // 33차: 응답 행 수 상한 (DOM 폭증 방지). 기본 2000, 최대 5000.
    const limitRaw = parseInt(req.query.limit, 10);
    const limit = Math.min(5000, Math.max(1, isNaN(limitRaw) ? 2000 : limitRaw));
    replacements.limit = limit;

    const sql = `
      WITH scoped_buyers AS (
        SELECT
          b.id,
          b.item_id,
          b.account_normalized,
          b.account_info,
          b.deposit_name,
          b.buyer_name,
          b.info_entered_at,
          COALESCE(s.shipping_type, i.shipping_type) AS shipping_type,
          EXISTS(
            SELECT 1 FROM images im
            WHERE im.buyer_id = b.id AND im.status = 'approved' AND im.deleted_at IS NULL
          ) AS has_review,
          (
            SELECT MIN(im.created_at) FROM images im
            WHERE im.buyer_id = b.id AND im.status = 'approved' AND im.deleted_at IS NULL
          ) AS first_review_at
        FROM buyers b
        LEFT JOIN item_slots s ON s.buyer_id = b.id AND s.deleted_at IS NULL
        LEFT JOIN items i ON i.id = b.item_id
        WHERE ${whereSQL}
      )
      SELECT
        account_normalized,
        MAX(account_info) AS account_info,
        MAX(deposit_name) AS deposit_name,
        COUNT(*)::int AS total,
        SUM(CASE WHEN has_review THEN 1 ELSE 0 END)::int AS completed,
        SUM(
          CASE WHEN has_review
            AND info_entered_at IS NOT NULL
            AND first_review_at <= info_entered_at + (:overdueDays || ' days')::interval
          THEN 1 ELSE 0 END
        )::int AS in_time,
        SUM(
          CASE WHEN has_review
            AND info_entered_at IS NOT NULL
            AND first_review_at > info_entered_at + (:overdueDays || ' days')::interval
          THEN 1 ELSE 0 END
        )::int AS overdue_late,
        SUM(
          CASE WHEN NOT has_review
            AND info_entered_at IS NOT NULL
            AND info_entered_at < NOW() - (:overdueDays || ' days')::interval
          THEN 1 ELSE 0 END
        )::int AS overdue_pending,
        SUM(
          CASE WHEN shipping_type LIKE '%미출고%' AND shipping_type NOT LIKE '%실출고%'
          THEN 1 ELSE 0 END
        )::int AS no_ship_only,
        SUM(
          CASE WHEN shipping_type LIKE '%실출고%' AND shipping_type NOT LIKE '%미출고%'
          THEN 1 ELSE 0 END
        )::int AS real_ship_only
      FROM scoped_buyers
      GROUP BY account_normalized
      HAVING COUNT(*) >= :minParticipation
      ORDER BY COUNT(*) DESC
      LIMIT :limit
    `;

    const rows = await sequelize.query(sql, {
      replacements,
      type: QueryTypes.SELECT
    });

    res.json({
      success: true,
      data: rows,
      count: rows.length,
      limit
    });
  } catch (error) {
    console.error('Buyer analytics getAccounts error:', error);
    res.status(500).json({
      success: false,
      message: '구매자 분석 조회 실패',
      error: error.message
    });
  }
};

/**
 * 한 계좌의 buyer 상세 목록
 * GET /api/buyer-analytics/accounts/:accountNormalized/buyers
 */
exports.getAccountBuyers = async (req, res) => {
  try {
    const { effectiveOperatorId, denied } = resolveEffectiveOperatorId(req);
    if (denied) {
      return res.status(403).json({ success: false, message: '권한 없음' });
    }
    const accountNormalized = req.params.accountNormalized;

    if (!accountNormalized) {
      return res.status(400).json({ success: false, message: 'accountNormalized 필요' });
    }

    const overdueDays = parseInt(req.query.overdueDays, 10) || 14;
    const courierFilter = req.query.courierFilter || 'all';

    let courierClause = '';
    if (courierFilter === 'Y') {
      courierClause = "AND UPPER(COALESCE(s.courier_service_yn, i.courier_service_yn)) LIKE '%Y%'";
    } else if (courierFilter === 'N') {
      courierClause = "AND UPPER(COALESCE(s.courier_service_yn, i.courier_service_yn)) LIKE '%N%'";
    }

    // operator 권한 필터 (effectiveOperatorId 있으면 본인/대상 진행자 배정으로 제한)
    let operatorClause = '';
    if (effectiveOperatorId) {
      const assignments = await CampaignOperator.findAll({
        where: { operator_id: effectiveOperatorId },
        attributes: ['item_id', 'day_group']
      });
      if (assignments.length === 0) {
        return res.json({ success: true, data: [], count: 0, _scope: 'no_assignment' });
      }
      const itemFull = new Set();
      const itemDayGroups = new Map();
      for (const a of assignments) {
        if (a.item_id == null) continue;
        if (a.day_group === null || a.day_group === undefined) {
          itemFull.add(a.item_id);
        } else {
          if (!itemDayGroups.has(a.item_id)) itemDayGroups.set(a.item_id, new Set());
          itemDayGroups.get(a.item_id).add(a.day_group);
        }
      }
      const orParts = [];
      if (itemFull.size > 0) {
        orParts.push(`b.item_id IN (${Array.from(itemFull).join(',')})`);
      }
      for (const [itemId, dgSet] of itemDayGroups.entries()) {
        if (itemFull.has(itemId)) continue;
        orParts.push(`(b.item_id = ${itemId} AND COALESCE(s.day_group, 1) IN (${Array.from(dgSet).join(',')}))`);
      }
      if (orParts.length === 0) {
        return res.json({ success: true, data: [], count: 0, _scope: 'no_assignment' });
      }
      operatorClause = `AND (${orParts.join(' OR ')})`;
    }

    // 33차: 응답 행 수 상한 (DOM 폭증 방지). 기본 1000, 최대 5000.
    const limitRaw = parseInt(req.query.limit, 10);
    const limit = Math.min(5000, Math.max(1, isNaN(limitRaw) ? 1000 : limitRaw));

    const sql = `
      SELECT
        b.id,
        b.order_number,
        b.buyer_name,
        b.recipient_name,
        b.account_info,
        b.deposit_name,
        b.info_entered_at,
        b.created_at,
        b.is_temporary,
        i.id AS item_id,
        i.product_name,
        c.id AS campaign_id,
        c.name AS campaign_name,
        mb.id AS monthly_brand_id,
        mb.name AS monthly_brand_name,
        s.id AS slot_id,
        s.day_group,
        COALESCE(s.shipping_type, i.shipping_type) AS shipping_type,
        COALESCE(s.courier_service_yn, i.courier_service_yn) AS courier_service_yn,
        EXISTS(
          SELECT 1 FROM images im
          WHERE im.buyer_id = b.id AND im.status = 'approved' AND im.deleted_at IS NULL
        ) AS has_review,
        (
          SELECT MIN(im.created_at) FROM images im
          WHERE im.buyer_id = b.id AND im.status = 'approved' AND im.deleted_at IS NULL
        ) AS first_review_at,
        CASE
          WHEN b.info_entered_at IS NULL THEN 'unknown'
          WHEN EXISTS(SELECT 1 FROM images im WHERE im.buyer_id = b.id AND im.status='approved' AND im.deleted_at IS NULL) THEN
            CASE WHEN (SELECT MIN(im.created_at) FROM images im WHERE im.buyer_id = b.id AND im.status='approved' AND im.deleted_at IS NULL)
                 <= b.info_entered_at + (:overdueDays || ' days')::interval
                 THEN 'in_time' ELSE 'overdue_late' END
          WHEN b.info_entered_at < NOW() - (:overdueDays || ' days')::interval THEN 'overdue_pending'
          ELSE 'in_progress'
        END AS review_status
      FROM buyers b
      LEFT JOIN item_slots s ON s.buyer_id = b.id AND s.deleted_at IS NULL
      LEFT JOIN items i ON i.id = b.item_id
      LEFT JOIN campaigns c ON c.id = i.campaign_id
      LEFT JOIN monthly_brands mb ON mb.id = c.monthly_brand_id
      WHERE b.is_temporary = false
        AND b.deleted_at IS NULL
        AND b.account_normalized = :accountNormalized
        ${operatorClause}
        ${courierClause}
      ORDER BY b.info_entered_at DESC NULLS LAST, b.created_at DESC
      LIMIT :limit
    `;

    const rows = await sequelize.query(sql, {
      replacements: { accountNormalized, overdueDays, limit },
      type: QueryTypes.SELECT
    });

    res.json({ success: true, data: rows, count: rows.length, limit });
  } catch (error) {
    console.error('Buyer analytics getAccountBuyers error:', error);
    res.status(500).json({
      success: false,
      message: '계좌별 구매자 조회 실패',
      error: error.message
    });
  }
};
