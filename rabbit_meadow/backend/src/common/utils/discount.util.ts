import { DiscountTargetType, DiscountType, Prisma } from '@prisma/client';
import { decimalToNumber, roundTo2 } from './decimal.util';

export type ActiveDiscountRecord = Prisma.DiscountGetPayload<{
  include: { targets: true };
}>;

export type DiscountCandidate = {
  id: string;
  title: string;
  type: DiscountType;
  value: number;
  targetType: DiscountTargetType;
};

export type DiscountIndex = {
  byProductId: Map<string, DiscountCandidate[]>;
  byCategoryId: Map<string, DiscountCandidate[]>;
};

export type ResolvedDiscount = {
  discount: DiscountCandidate;
  originalPrice: number;
  finalPrice: number;
  discountAmount: number;
};

export function buildDiscountIndex(discounts: ActiveDiscountRecord[]): DiscountIndex {
  const byProductId = new Map<string, DiscountCandidate[]>();
  const byCategoryId = new Map<string, DiscountCandidate[]>();

  for (const discount of discounts) {
    const candidate: DiscountCandidate = {
      id: discount.id,
      title: discount.title,
      type: discount.type,
      value: decimalToNumber(discount.value),
      targetType: DiscountTargetType.PRODUCT,
    };

    for (const target of discount.targets) {
      if (
        target.targetType === DiscountTargetType.PRODUCT &&
        typeof target.productId === 'string' &&
        target.productId
      ) {
        const next = {
          ...candidate,
          targetType: DiscountTargetType.PRODUCT,
        };
        pushMapValue(byProductId, target.productId, next);
      }

      if (
        target.targetType === DiscountTargetType.CATEGORY &&
        typeof target.categoryId === 'string' &&
        target.categoryId
      ) {
        const next = {
          ...candidate,
          targetType: DiscountTargetType.CATEGORY,
        };
        pushMapValue(byCategoryId, target.categoryId, next);
      }
    }
  }

  return { byProductId, byCategoryId };
}

export function resolveBestDiscount(
  basePrice: number,
  productId: string,
  categoryId: string,
  index: DiscountIndex,
): ResolvedDiscount | null {
  if (basePrice <= 0) return null;

  const productDiscounts = index.byProductId.get(productId) || [];
  const categoryDiscounts = index.byCategoryId.get(categoryId) || [];
  const unique = new Map<string, DiscountCandidate>();

  for (const discount of productDiscounts) {
    unique.set(discount.id, discount);
  }
  for (const discount of categoryDiscounts) {
    if (!unique.has(discount.id)) {
      unique.set(discount.id, discount);
    }
  }

  if (!unique.size) return null;

  let best: ResolvedDiscount | null = null;

  for (const discount of unique.values()) {
    const finalPrice = applyDiscount(basePrice, discount.type, discount.value);
    const discountAmount = roundTo2(Math.max(0, basePrice - finalPrice));
    const resolved: ResolvedDiscount = {
      discount,
      originalPrice: basePrice,
      finalPrice,
      discountAmount,
    };

    if (!best) {
      best = resolved;
      continue;
    }

    if (resolved.finalPrice < best.finalPrice) {
      best = resolved;
      continue;
    }

    if (resolved.finalPrice === best.finalPrice && resolved.discountAmount > best.discountAmount) {
      best = resolved;
    }
  }

  return best;
}

export function applyDiscount(price: number, type: DiscountType, value: number): number {
  const base = Math.max(0, Number(price) || 0);
  const normalizedValue = Math.max(0, Number(value) || 0);

  if (type === DiscountType.PERCENT) {
    const cappedPercent = Math.min(normalizedValue, 100);
    return roundTo2(Math.max(0, base - (base * cappedPercent) / 100));
  }

  return roundTo2(Math.max(0, base - normalizedValue));
}

function pushMapValue(map: Map<string, DiscountCandidate[]>, key: string, value: DiscountCandidate) {
  const existing = map.get(key) || [];
  existing.push(value);
  map.set(key, existing);
}
