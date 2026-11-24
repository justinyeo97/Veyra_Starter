import { IN_STOCK_STATUSES } from "./constants";
import {
  addDays,
  daysBetween,
  formatShortDate,
  parseDate,
  sneakerName,
  toISODate,
  todayISO,
} from "./format";

export function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function isSale(order) {
  return order.paymentStatus === "Paid" && order.shippingStatus !== "Cancelled";
}

export function isPendingOrder(order) {
  return (
    order.shippingStatus !== "Cancelled" &&
    order.shippingStatus !== "Delivered" &&
    order.paymentStatus !== "Refunded" &&
    order.paymentStatus !== "Failed"
  );
}

export function isCompletedOrder(order) {
  return order.shippingStatus === "Delivered" && order.paymentStatus === "Paid";
}

export function profitBreakdown({
  salePrice,
  purchasePrice,
  platformFee,
  shippingFee,
}) {
  const gross = toNumber(salePrice);
  const cost = toNumber(purchasePrice);
  const fees = toNumber(platformFee);
  const shipping = toNumber(shippingFee);
  const net = gross - cost - fees - shipping;
  const margin = gross > 0 ? (net / gross) * 100 : 0;
  return { gross, cost, platformFee: fees, shippingFee: shipping, net, margin };
}

export function orderPurchasePrice(order, sneaker) {
  if (
    order.purchasePrice !== undefined &&
    order.purchasePrice !== null &&
    order.purchasePrice !== ""
  ) {
    return toNumber(order.purchasePrice);
  }
  return toNumber(sneaker?.purchasePrice);
}

export function orderBreakdown(order, sneaker) {
  return profitBreakdown({
    salePrice: order.salePrice,
    purchasePrice: orderPurchasePrice(order, sneaker),
    platformFee: order.platformFee,
    shippingFee: order.shippingFee,
  });
}

export function orderRevenue(order) {
  return toNumber(order.salePrice);
}

export function orderProfit(order, sneaker) {
  return orderBreakdown(order, sneaker).net;
}

export function estimatedBreakdown(sneaker, settings) {
  const price = toNumber(sneaker.listingPrice);
  return profitBreakdown({
    salePrice: price,
    purchasePrice: sneaker.purchasePrice,
    platformFee: (price * toNumber(settings.store.platformFee)) / 100,
    shippingFee: settings.store.shippingFee,
  });
}

export function isInStock(sneaker) {
  return (
    IN_STOCK_STATUSES.includes(sneaker.status) && toNumber(sneaker.quantity) > 0
  );
}

export function inventoryValue(sneakers) {
  return sneakers
    .filter(isInStock)
    .reduce(
      (sum, sneaker) =>
        sum + toNumber(sneaker.purchasePrice) * toNumber(sneaker.quantity),
      0,
    );
}

export function inventoryUnits(sneakers) {
  return sneakers
    .filter(isInStock)
    .reduce((sum, sneaker) => sum + toNumber(sneaker.quantity), 0);
}

export function isTaskOverdue(task, today = todayISO()) {
  return (
    task.status !== "Completed" && Boolean(task.dueDate) && task.dueDate < today
  );
}

export function rangeStart(rangeKey, today = todayISO()) {
  switch (rangeKey) {
    case "today":
      return today;
    case "7d":
      return addDays(today, -6);
    case "30d":
      return addDays(today, -29);
    case "90d":
      return addDays(today, -89);
    case "year":
      return `${today.slice(0, 4)}-01-01`;
    default:
      return "0000-01-01";
  }
}

export function inRange(date, rangeKey, today = todayISO()) {
  if (!date) return false;
  const day = date.slice(0, 10);
  return day >= rangeStart(rangeKey, today) && day <= today;
}

export function indexById(items) {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

function bucketKey(date, mode) {
  if (mode === "month") return date.slice(0, 7);
  if (mode === "week") {
    const parsed = parseDate(date);
    const weekday = (parsed.getDay() + 6) % 7;
    parsed.setDate(parsed.getDate() - weekday);
    return toISODate(parsed);
  }
  return date.slice(0, 10);
}

export function timeSeries(orders, sneakersById, rangeKey, today = todayISO()) {
  const start = rangeStart(rangeKey, today);
  const mode =
    rangeKey === "year" ? "month" : rangeKey === "90d" ? "week" : "day";
  const buckets = new Map();
  let cursor = start;
  while (cursor <= today) {
    const key = bucketKey(cursor, mode);
    if (!buckets.has(key)) {
      const label =
        mode === "month"
          ? parseDate(`${key}-01`).toLocaleDateString(undefined, {
              month: "short",
            })
          : formatShortDate(key);
      buckets.set(key, { key, label, revenue: 0, profit: 0, orders: 0 });
    }
    cursor = addDays(cursor, 1);
  }
  orders
    .filter(
      (order) => isSale(order) && inRange(order.orderDate, rangeKey, today),
    )
    .forEach((order) => {
      const bucket = buckets.get(bucketKey(order.orderDate, mode));
      if (!bucket) return;
      bucket.revenue += orderRevenue(order);
      bucket.profit += orderProfit(order, sneakersById[order.sneakerId]);
      bucket.orders += 1;
    });
  return [...buckets.values()].map((bucket) => ({
    ...bucket,
    revenue: Math.round(bucket.revenue * 100) / 100,
    profit: Math.round(bucket.profit * 100) / 100,
  }));
}

export function salesGroupedBy(orders, sneakersById, getName) {
  const groups = new Map();
  orders.filter(isSale).forEach((order) => {
    const sneaker = sneakersById[order.sneakerId];
    const name = getName(sneaker, order);
    const group = groups.get(name) || { name, units: 0, revenue: 0, profit: 0 };
    group.units += 1;
    group.revenue += orderRevenue(order);
    group.profit += orderProfit(order, sneaker);
    groups.set(name, group);
  });
  return [...groups.values()].sort((a, b) => b.revenue - a.revenue);
}

export function countBy(items, getKey, keys = []) {
  const counts = new Map(keys.map((key) => [key, 0]));
  items.forEach((item) => {
    const key = getKey(item);
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return [...counts.entries()].map(([name, value]) => ({ name, value }));
}

export function averageDaysToSell(orders, sneakersById) {
  const durations = orders
    .filter(isSale)
    .map((order) => {
      const sneaker = sneakersById[order.sneakerId];
      if (!sneaker) return null;
      return daysBetween(
        sneaker.listingDate || sneaker.purchaseDate,
        order.orderDate,
      );
    })
    .filter((days) => days !== null && days >= 0);
  if (durations.length === 0) return 0;
  return durations.reduce((sum, days) => sum + days, 0) / durations.length;
}

export function salesSummary(orders, sneakersById) {
  const sales = orders.filter(isSale);
  const revenue = sales.reduce((sum, order) => sum + orderRevenue(order), 0);
  const profit = sales.reduce(
    (sum, order) => sum + orderProfit(order, sneakersById[order.sneakerId]),
    0,
  );
  return {
    sales,
    units: sales.length,
    revenue,
    profit,
    margin: revenue > 0 ? (profit / revenue) * 100 : 0,
    averagePrice: sales.length ? revenue / sales.length : 0,
    averageProfit: sales.length ? profit / sales.length : 0,
    averageDays: averageDaysToSell(sales, sneakersById),
  };
}

export function customerStats(customerId, orders) {
  const history = orders
    .filter((order) => order.customerId === customerId)
    .sort((a, b) => b.orderDate.localeCompare(a.orderDate));
  const paid = history.filter(isSale);
  const totalSpent = paid.reduce((sum, order) => sum + orderRevenue(order), 0);
  return {
    history,
    orderCount: history.length,
    totalSpent,
    averageOrder: paid.length ? totalSpent / paid.length : 0,
    lastOrderDate: history[0]?.orderDate || "",
  };
}

export function matchesQuery(query, values) {
  const text = query.trim().toLowerCase();
  if (!text) return true;
  return values.some((value) =>
    String(value ?? "")
      .toLowerCase()
      .includes(text),
  );
}

export function sortItems(items, getValue, direction = "asc") {
  const factor = direction === "desc" ? -1 : 1;
  return [...items].sort((a, b) => {
    const left = getValue(a);
    const right = getValue(b);
    if (left === right) return 0;
    if (left === undefined || left === null || left === "") return 1;
    if (right === undefined || right === null || right === "") return -1;
    if (typeof left === "number" && typeof right === "number")
      return (left - right) * factor;
    return (
      String(left).localeCompare(String(right), undefined, { numeric: true }) *
      factor
    );
  });
}

export function paginate(items, page, size) {
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, page), pageCount);
  return {
    page: current,
    pageCount,
    items: items.slice((current - 1) * size, current * size),
  };
}

const SEARCH_FIELDS = ["id", "brand", "model", "sku", "colorway", "status"];

function searchScore(sneaker, words) {
  const fields = SEARCH_FIELDS.map((field) =>
    String(sneaker[field] ?? "").toLowerCase(),
  );
  let score = 0;
  for (const word of words) {
    let best = 0;
    for (const field of fields) {
      if (!field.includes(word)) continue;
      const tokens = field.split(/[^a-z0-9]+/).filter(Boolean);
      let points = 1;
      if (tokens.some((token) => token.startsWith(word))) points = 2;
      if (tokens.includes(word)) points = 3;
      if (field === word) points = 4;
      best = Math.max(best, points);
    }
    if (best === 0) return 0;
    score += best;
  }
  return score;
}

export function globalSearch(data, query, limit = 5) {
  const words = String(query ?? "")
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return [];

  const matches = (data?.sneakers || [])
    .map((sneaker, index) => ({
      sneaker,
      index,
      score: searchScore(sneaker, words),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.sneaker);

  if (matches.length === 0) return [];

  return [
    {
      key: "inventory",
      label: "Inventory",
      icon: "box-seam",
      total: matches.length,
      items: (limit > 0 ? matches.slice(0, limit) : matches).map((sneaker) => ({
        id: sneaker.id,
        title: sneakerName(sneaker),
        subtitle: [sneaker.sku, sneaker.colorway, `US ${sneaker.size}`]
          .filter(Boolean)
          .join(" · "),
        image: sneaker.image,
        to: `/inventory/${sneaker.id}`,
      })),
    },
  ];
}
