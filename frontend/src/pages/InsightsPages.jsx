import { useMemo, useState } from "react";
import { Button, Col, ProgressBar, Row } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SneakerFormModal } from "../components/EntityForms";
import {
  DateRangeControl,
  EmptyState,
  Icon,
  PageHeader,
  SectionCard,
  SneakerImage,
  StatCard,
  StatusBadge,
} from "../components/UI";
import { useApp } from "../context/useApp";
import {
  countBy,
  indexById,
  inRange,
  inventoryUnits,
  inventoryValue,
  isCompletedOrder,
  isInStock,
  isPendingOrder,
  isTaskOverdue,
  orderBreakdown,
  salesGroupedBy,
  salesSummary,
  timeSeries,
} from "../utils/calculations";
import {
  CHART_COLORS,
  CONDITIONS,
  DATE_RANGES,
  INVENTORY_STATUSES,
  NOTIFICATION_TYPES,
  SHIPPING_STATUSES,
} from "../utils/constants";
import {
  formatCompactMoney,
  formatDate,
  formatNumber,
  formatPercent,
  formatRelative,
  formatSize,
  sneakerName,
  todayISO,
} from "../utils/format";

const REVENUE_COLOR = "#2563eb";
const PROFIT_COLOR = "#16a34a";

function tooltipStyle() {
  return {
    background: "var(--bs-body-bg)",
    border: "1px solid var(--bs-border-color)",
    borderRadius: 10,
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.12)",
    color: "var(--bs-body-color)",
    fontSize: 13,
  };
}

function TrendChart({ data, dataKey, color, currency, label, kind = "area" }) {
  const hasData = data.some((point) => point[dataKey] !== 0);
  if (!hasData) {
    return (
      <EmptyState
        compact
        icon="graph-up"
        title={`No ${label.toLowerCase()} in this period`}
        message="Sales you mark as Paid show up here."
      />
    );
  }
  const money = (value) => formatCompactMoney(value, currency);
  const common = (
    <>
      <CartesianGrid vertical={false} strokeDasharray="3 3" />
      <XAxis
        dataKey="label"
        tickLine={false}
        axisLine={false}
        minTickGap={16}
        fontSize={12}
      />
      <YAxis
        tickFormatter={money}
        tickLine={false}
        axisLine={false}
        width={64}
        fontSize={12}
      />
      <Tooltip
        formatter={(value) => [formatCompactMoney(value, currency), label]}
        contentStyle={tooltipStyle()}
        cursor={{ fill: "rgba(148, 163, 184, 0.12)" }}
      />
    </>
  );
  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height="100%">
        {kind === "bar" ? (
          <BarChart
            data={data}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            {common}
            <Bar
              dataKey={dataKey}
              name={label}
              radius={[6, 6, 0, 0]}
              maxBarSize={36}
            >
              {data.map((point) => (
                <Cell
                  key={point.key}
                  fill={point[dataKey] < 0 ? "#dc2626" : color}
                />
              ))}
            </Bar>
          </BarChart>
        ) : (
          <AreaChart
            data={data}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient
                id={`fill-${dataKey}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            {common}
            <Area
              type="monotone"
              dataKey={dataKey}
              name={label}
              stroke={color}
              strokeWidth={2.5}
              fill={`url(#fill-${dataKey})`}
              dot={data.length < 3}
            />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

function BarBreakdown({
  data,
  dataKey = "value",
  color = REVENUE_COLOR,
  currency,
  horizontal = false,
  emptyTitle,
  height = 280,
}) {
  if (data.length === 0 || data.every((item) => !item[dataKey])) {
    return <EmptyState compact icon="bar-chart" title={emptyTitle} />;
  }
  const format = currency
    ? (value) => formatCompactMoney(value, currency)
    : (value) => formatNumber(value);
  return (
    <div className="chart-box" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout={horizontal ? "vertical" : "horizontal"}
          margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            horizontal={!horizontal}
            vertical={horizontal}
            strokeDasharray="3 3"
          />
          {horizontal ? (
            <>
              <XAxis
                type="number"
                tickFormatter={format}
                tickLine={false}
                axisLine={false}
                fontSize={12}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={150}
                tickLine={false}
                axisLine={false}
                fontSize={12}
                tickFormatter={(value) =>
                  value.length > 22 ? `${value.slice(0, 21)}…` : value
                }
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey="name"
                tickLine={false}
                axisLine={false}
                fontSize={12}
                interval={0}
                tickFormatter={(value) =>
                  value.length > 12 ? `${value.slice(0, 11)}…` : value
                }
              />
              <YAxis
                tickFormatter={format}
                tickLine={false}
                axisLine={false}
                width={currency ? 64 : 36}
                fontSize={12}
                allowDecimals={false}
              />
            </>
          )}
          <Tooltip
            formatter={(value) => [
              format(value),
              currency ? "Revenue" : "Count",
            ]}
            contentStyle={tooltipStyle()}
            cursor={{ fill: "rgba(148, 163, 184, 0.12)" }}
          />
          <Bar
            dataKey={dataKey}
            fill={color}
            radius={horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]}
            maxBarSize={32}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function DonutChart({ data, emptyTitle }) {
  const filtered = data.filter((item) => item.value > 0);
  if (filtered.length === 0) {
    return <EmptyState compact icon="pie-chart" title={emptyTitle} />;
  }
  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={filtered}
            dataKey="value"
            nameKey="name"
            innerRadius="55%"
            outerRadius="80%"
            paddingAngle={2}
            stroke="none"
          >
            {filtered.map((item) => (
              <Cell
                key={item.name}
                fill={CHART_COLORS[data.indexOf(item) % CHART_COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle()} />
          <Legend
            iconType="circle"
            iconSize={9}
            wrapperStyle={{ fontSize: 12 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function useInsights(range) {
  const { data } = useApp();
  return useMemo(() => {
    const today = todayISO();
    const sneakersById = indexById(data.sneakers);
    const rangeOrders = data.orders.filter((order) =>
      inRange(order.orderDate, range, today),
    );
    const summary = salesSummary(rangeOrders, sneakersById);
    return {
      today,
      sneakersById,
      rangeOrders,
      summary,
      series: timeSeries(data.orders, sneakersById, range, today),
      inventoryValue: inventoryValue(data.sneakers),
      inventoryUnits: inventoryUnits(data.sneakers),
    };
  }, [data, range]);
}

export function DashboardPage() {
  const { data, settings, money, user } = useApp();
  const navigate = useNavigate();
  const [range, setRange] = useState("30d");
  const [adding, setAdding] = useState(false);
  const insights = useInsights(range);
  const { summary, rangeOrders, sneakersById, today } = insights;
  const rangeLabel = DATE_RANGES.find(
    (item) => item.key === range,
  )?.label.toLowerCase();
  const currency = settings.store.currency;
  const firstName = user?.name?.trim().split(/\s+/)[0] || "";

  const pendingOrders = data.orders.filter(isPendingOrder);
  const completedOrders = rangeOrders.filter(isCompletedOrder);
  const activeTasks = data.tasks.filter((task) => task.status !== "Completed");
  const overdueTasks = activeTasks
    .filter((task) => isTaskOverdue(task, today))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const upcomingTasks = activeTasks
    .filter((task) => !isTaskOverdue(task, today))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 5);
  const recentOrders = [...data.orders]
    .sort(
      (a, b) =>
        b.orderDate.localeCompare(a.orderDate) || b.id.localeCompare(a.id),
    )
    .slice(0, 5);
  const recentInventory = [...data.sneakers]
    .sort((a, b) =>
      (b.createdAt || b.purchaseDate).localeCompare(
        a.createdAt || a.purchaseDate,
      ),
    )
    .slice(0, 5);
  const topSneakers = salesGroupedBy(
    rangeOrders,
    sneakersById,
    (sneaker, order) =>
      sneaker ? sneakerName(sneaker) : order.sneakerLabel || "Deleted sneaker",
  )
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 5);
  const notifications = [...data.notifications]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);
  const statusCounts = INVENTORY_STATUSES.map((status) => ({
    status,
    count: data.sneakers.filter((sneaker) => sneaker.status === status).length,
  }));
  const customersById = indexById(data.customers);

  const stats = [
    {
      label: "Inventory value",
      value: money(insights.inventoryValue),
      icon: "safe",
      tone: "gray",
      hint: "Cost of pairs in stock",
      to: "/inventory",
    },
    {
      label: "Total revenue",
      value: money(summary.revenue),
      icon: "cash-stack",
      tone: "blue",
      hint: `Paid sales, ${rangeLabel}`,
      to: "/analytics",
    },
    {
      label: "Total profit",
      value: money(summary.profit),
      icon: "graph-up-arrow",
      tone: summary.profit >= 0 ? "green" : "red",
      hint: `${formatPercent(summary.margin)} margin`,
      to: "/analytics",
    },
    {
      label: "Pending orders",
      value: formatNumber(pendingOrders.length),
      icon: "hourglass-split",
      tone: "amber",
      hint: "Not delivered yet",
      to: "/orders?view=pending",
    },
    {
      label: "Completed orders",
      value: formatNumber(completedOrders.length),
      icon: "bag-check",
      tone: "green",
      hint: `Delivered, ${rangeLabel}`,
      to: "/orders",
    },
    {
      label: "Active tasks",
      value: formatNumber(activeTasks.length),
      icon: "check2-square",
      tone: "blue",
      hint: "To do or in progress",
      to: "/tasks",
    },
    {
      label: "Overdue tasks",
      value: formatNumber(overdueTasks.length),
      icon: "alarm",
      tone: overdueTasks.length ? "red" : "gray",
      hint: overdueTasks.length ? "Need attention" : "All on track",
      to: "/tasks?due=overdue",
    },
    {
      label: "Avg profit per sneaker",
      value: money(summary.averageProfit),
      icon: "coin",
      tone: "violet",
      hint: `${summary.units} sold, ${rangeLabel}`,
    },
    {
      label: "Avg days to sell",
      value: summary.units ? `${summary.averageDays.toFixed(1)} days` : "—",
      icon: "stopwatch",
      tone: "teal",
      hint: "Listing to sale",
    },
    {
      label: "Inventory count",
      value: formatNumber(insights.inventoryUnits),
      icon: "box-seam",
      tone: "gray",
      hint: `${data.sneakers.filter(isInStock).length} products in stock`,
      to: "/inventory",
    },
  ];

  return (
    <>
      <PageHeader
        title={`Welcome back, ${firstName}`}
        subtitle={`Here is how ${settings.store.name} is doing.`}
        actions={
          <>
            <DateRangeControl value={range} onChange={setRange} />
            <Button variant="primary" onClick={() => setAdding(true)}>
              <Icon name="plus-lg" className="me-1" />
              Add sneaker
            </Button>
          </>
        }
      />

      <Row xs={2} md={3} xl={5} className="g-3 mb-4">
        {stats.map((stat) => (
          <Col key={stat.label}>
            <StatCard
              {...stat}
              onClick={stat.to ? () => navigate(stat.to) : undefined}
            />
          </Col>
        ))}
      </Row>

      <Row className="g-4 mb-4">
        <Col lg={6}>
          <SectionCard
            title="Revenue"
            subtitle={`${money(summary.revenue)} from ${summary.units} paid sales`}
          >
            <TrendChart
              data={insights.series}
              dataKey="revenue"
              color={REVENUE_COLOR}
              currency={currency}
              label="Revenue"
            />
          </SectionCard>
        </Col>
        <Col lg={6}>
          <SectionCard
            title="Profit"
            subtitle={`${money(summary.profit)} after purchase cost, fees and shipping`}
          >
            <TrendChart
              data={insights.series}
              dataKey="profit"
              color={PROFIT_COLOR}
              currency={currency}
              label="Profit"
              kind="bar"
            />
          </SectionCard>
        </Col>
      </Row>

      <Row className="g-4 mb-4">
        <Col xl={8}>
          <SectionCard
            title="Recent orders"
            action={
              <Link to="/orders" className="small fw-semibold">
                View all
              </Link>
            }
            flush
          >
            {recentOrders.length === 0 ? (
              <EmptyState compact icon="receipt" title="No orders yet" />
            ) : (
              <div className="list-rows">
                {recentOrders.map((order) => {
                  const sneaker = sneakersById[order.sneakerId];
                  return (
                    <Link
                      key={order.id}
                      to={`/orders/${order.id}`}
                      className="list-row"
                    >
                      <SneakerImage src={sneaker?.image} alt="" />
                      <div className="min-w-0 flex-grow-1">
                        <div className="fw-semibold text-truncate">
                          {sneaker ? sneakerName(sneaker) : order.sneakerLabel}
                        </div>
                        <div className="small text-body-secondary text-truncate">
                          {order.id} ·{" "}
                          {customersById[order.customerId]?.name ||
                            "Deleted customer"}{" "}
                          · {formatDate(order.orderDate)}
                        </div>
                      </div>
                      <div className="text-end">
                        <div className="fw-semibold">
                          {money(order.salePrice)}
                        </div>
                        <StatusBadge status={order.paymentStatus} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </Col>
        <Col xl={4}>
          <SectionCard
            title="Inventory status"
            subtitle={`${data.sneakers.length} products`}
          >
            <div className="status-bars">
              {statusCounts.map((item) => (
                <Link
                  key={item.status}
                  to={`/inventory?status=${encodeURIComponent(item.status)}`}
                  className="status-bar"
                >
                  <div className="d-flex justify-content-between small mb-1">
                    <StatusBadge status={item.status} />
                    <span className="fw-semibold">{item.count}</span>
                  </div>
                  <ProgressBar
                    now={
                      data.sneakers.length
                        ? (item.count / data.sneakers.length) * 100
                        : 0
                    }
                    className={`progress-tone tone-${item.status.replace(/\s/g, "-").toLowerCase()}`}
                  />
                </Link>
              ))}
            </div>
          </SectionCard>
        </Col>
      </Row>

      <Row className="g-4 mb-4">
        <Col lg={6}>
          <SectionCard
            title="Upcoming tasks"
            action={
              <Link to="/tasks" className="small fw-semibold">
                View all
              </Link>
            }
            flush
          >
            {upcomingTasks.length === 0 ? (
              <EmptyState
                compact
                icon="check2-all"
                title="Nothing coming up"
                message="Every open task is done or overdue."
              />
            ) : (
              <div className="list-rows">
                {upcomingTasks.map((task) => (
                  <Link
                    key={task.id}
                    to={`/tasks?task=${task.id}`}
                    className="list-row"
                  >
                    <span className="list-icon tone-blue">
                      <Icon name="calendar-check" />
                    </span>
                    <div className="min-w-0 flex-grow-1">
                      <div className="fw-semibold text-truncate">
                        {task.title}
                      </div>
                      <div className="small text-body-secondary">
                        Due {formatDate(task.dueDate)} · {task.assignee}
                      </div>
                    </div>
                    <StatusBadge status={task.priority} />
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>
        </Col>
        <Col lg={6}>
          <SectionCard
            title="Overdue tasks"
            subtitle={
              overdueTasks.length
                ? `${overdueTasks.length} past their due date`
                : undefined
            }
            action={
              <Link to="/tasks?due=overdue" className="small fw-semibold">
                View all
              </Link>
            }
            flush
          >
            {overdueTasks.length === 0 ? (
              <EmptyState
                compact
                icon="emoji-smile"
                title="No overdue tasks"
                message="Everything is on schedule."
              />
            ) : (
              <div className="list-rows">
                {overdueTasks.slice(0, 5).map((task) => (
                  <Link
                    key={task.id}
                    to={`/tasks?task=${task.id}`}
                    className="list-row"
                  >
                    <span className="list-icon tone-red">
                      <Icon name="alarm" />
                    </span>
                    <div className="min-w-0 flex-grow-1">
                      <div className="fw-semibold text-truncate">
                        {task.title}
                      </div>
                      <div className="small text-danger">
                        Was due {formatDate(task.dueDate)}
                      </div>
                    </div>
                    <StatusBadge status={task.priority} />
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>
        </Col>
      </Row>

      <Row className="g-4">
        <Col xl={4} lg={6}>
          <SectionCard
            title="Recent inventory"
            action={
              <Link to="/inventory" className="small fw-semibold">
                View all
              </Link>
            }
            flush
          >
            <div className="list-rows">
              {recentInventory.map((sneaker) => (
                <Link
                  key={sneaker.id}
                  to={`/inventory/${sneaker.id}`}
                  className="list-row"
                >
                  <SneakerImage src={sneaker.image} alt="" />
                  <div className="min-w-0 flex-grow-1">
                    <div className="fw-semibold text-truncate">
                      {sneakerName(sneaker)}
                    </div>
                    <div className="small text-body-secondary">
                      {formatSize(sneaker.size)} ·{" "}
                      {money(sneaker.purchasePrice)}
                    </div>
                  </div>
                  <StatusBadge status={sneaker.status} />
                </Link>
              ))}
            </div>
          </SectionCard>
        </Col>
        <Col xl={4} lg={6}>
          <SectionCard
            title="Top-performing sneakers"
            subtitle={`By profit, ${rangeLabel}`}
            flush
          >
            {topSneakers.length === 0 ? (
              <EmptyState
                compact
                icon="trophy"
                title="No sales in this period"
              />
            ) : (
              <div className="list-rows">
                {topSneakers.map((item, index) => (
                  <div key={item.name} className="list-row">
                    <span className="rank">{index + 1}</span>
                    <div className="min-w-0 flex-grow-1">
                      <div className="fw-semibold text-truncate">
                        {item.name}
                      </div>
                      <div className="small text-body-secondary">
                        {item.units} sold · {money(item.revenue)} revenue
                      </div>
                    </div>
                    <span
                      className={`fw-semibold ${item.profit >= 0 ? "text-success" : "text-danger"}`}
                    >
                      {money(item.profit)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </Col>
        <Col xl={4}>
          <SectionCard
            title="Notifications"
            action={
              <Link to="/notifications" className="small fw-semibold">
                View all
              </Link>
            }
            flush
          >
            {notifications.length === 0 ? (
              <EmptyState compact icon="bell" title="No notifications" />
            ) : (
              <div className="list-rows">
                {notifications.map((notification) => {
                  const meta = NOTIFICATION_TYPES[notification.type] || {
                    icon: "bell",
                    tone: "gray",
                  };
                  return (
                    <Link
                      key={notification.id}
                      to={notification.link || "/notifications"}
                      className={`list-row ${notification.read ? "" : "unread"}`}
                    >
                      <span className={`list-icon tone-${meta.tone}`}>
                        <Icon name={meta.icon} />
                      </span>
                      <div className="min-w-0 flex-grow-1">
                        <div className="fw-semibold text-truncate">
                          {notification.title}
                        </div>
                        <div className="small text-body-secondary">
                          {formatRelative(notification.createdAt)}
                        </div>
                      </div>
                      {!notification.read && <span className="unread-dot" />}
                    </Link>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </Col>
      </Row>

      {adding && (
        <SneakerFormModal
          onHide={() => setAdding(false)}
          onSaved={(id) => navigate(`/inventory/${id}`)}
        />
      )}
    </>
  );
}

export function AnalyticsPage() {
  const { data, settings, money } = useApp();
  const [range, setRange] = useState("90d");
  const insights = useInsights(range);
  const { summary, rangeOrders, sneakersById, today } = insights;
  const currency = settings.store.currency;
  const rangeLabel = DATE_RANGES.find(
    (item) => item.key === range,
  )?.label.toLowerCase();

  const rangeSneakers = data.sneakers.filter((sneaker) =>
    inRange(sneaker.purchaseDate, range, today),
  );
  const byBrand = salesGroupedBy(
    rangeOrders,
    sneakersById,
    (sneaker) => sneaker?.brand || "Other",
  ).map((item) => ({ ...item, value: item.revenue }));
  const bySneaker = salesGroupedBy(
    rangeOrders,
    sneakersById,
    (sneaker, order) =>
      sneaker ? sneakerName(sneaker) : order.sneakerLabel || "Deleted sneaker",
  )
    .slice(0, 8)
    .map((item) => ({ ...item, value: item.revenue }));
  const inventoryByStatus = countBy(
    rangeSneakers,
    (sneaker) => sneaker.status,
    INVENTORY_STATUSES,
  );
  const inventoryByCondition = countBy(
    rangeSneakers,
    (sneaker) => sneaker.condition,
    CONDITIONS,
  );
  const ordersByStatus = countBy(
    rangeOrders,
    (order) => order.shippingStatus,
    SHIPPING_STATUSES,
  );

  const kpis = [
    {
      label: "Revenue",
      value: money(summary.revenue),
      icon: "cash-stack",
      tone: "blue",
    },
    {
      label: "Net profit",
      value: money(summary.profit),
      icon: "graph-up-arrow",
      tone: summary.profit >= 0 ? "green" : "red",
    },
    {
      label: "Profit margin",
      value: formatPercent(summary.margin),
      icon: "percent",
      tone: "violet",
    },
    {
      label: "Units sold",
      value: formatNumber(summary.units),
      icon: "bag-check",
      tone: "teal",
    },
    {
      label: "Inventory value",
      value: money(insights.inventoryValue),
      icon: "safe",
      tone: "gray",
    },
    {
      label: "Avg selling price",
      value: money(summary.averagePrice),
      icon: "tag",
      tone: "blue",
    },
    {
      label: "Avg profit",
      value: money(summary.averageProfit),
      icon: "coin",
      tone: "green",
    },
    {
      label: "Avg days to sell",
      value: summary.units ? `${summary.averageDays.toFixed(1)} days` : "—",
      icon: "stopwatch",
      tone: "amber",
    },
  ];

  const bestOrder = summary.sales
    .map((order) => ({
      order,
      profit: orderBreakdown(order, sneakersById[order.sneakerId]).net,
    }))
    .sort((a, b) => b.profit - a.profit)[0];

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle={`Sales performance, ${rangeLabel}.`}
        actions={<DateRangeControl value={range} onChange={setRange} />}
      />

      <Row xs={2} md={4} className="g-3 mb-4">
        {kpis.map((kpi) => (
          <Col key={kpi.label}>
            <StatCard {...kpi} />
          </Col>
        ))}
      </Row>

      {bestOrder && (
        <div className="insight-strip mb-4">
          <Icon name="stars" />
          <span>
            Best sale {rangeLabel}:{" "}
            <Link to={`/orders/${bestOrder.order.id}`}>
              {bestOrder.order.id}
            </Link>
            , {money(bestOrder.profit)} profit on{" "}
            {sneakerName(sneakersById[bestOrder.order.sneakerId]) ===
            "Unknown sneaker"
              ? bestOrder.order.sneakerLabel
              : sneakerName(sneakersById[bestOrder.order.sneakerId])}
            .
          </span>
        </div>
      )}

      <Row className="g-4 mb-4">
        <Col lg={6}>
          <SectionCard title="Revenue by date">
            <TrendChart
              data={insights.series}
              dataKey="revenue"
              color={REVENUE_COLOR}
              currency={currency}
              label="Revenue"
            />
          </SectionCard>
        </Col>
        <Col lg={6}>
          <SectionCard title="Profit by date">
            <TrendChart
              data={insights.series}
              dataKey="profit"
              color={PROFIT_COLOR}
              currency={currency}
              label="Profit"
              kind="bar"
            />
          </SectionCard>
        </Col>
        <Col lg={5}>
          <SectionCard
            title="Sales by brand"
            subtitle="Revenue from paid sales"
          >
            <BarBreakdown
              data={byBrand}
              currency={currency}
              color={REVENUE_COLOR}
              emptyTitle="No sales in this period"
            />
          </SectionCard>
        </Col>
        <Col lg={7}>
          <SectionCard title="Sales by sneaker" subtitle="Top 8 by revenue">
            <BarBreakdown
              data={bySneaker}
              currency={currency}
              color="#111827"
              horizontal
              emptyTitle="No sales in this period"
              height={Math.max(220, bySneaker.length * 40)}
            />
          </SectionCard>
        </Col>
        <Col lg={4}>
          <SectionCard
            title="Inventory by status"
            subtitle="Sneakers bought in this period"
          >
            <DonutChart
              data={inventoryByStatus}
              emptyTitle="No sneakers bought in this period"
            />
          </SectionCard>
        </Col>
        <Col lg={4}>
          <SectionCard
            title="Inventory by condition"
            subtitle="Sneakers bought in this period"
          >
            <BarBreakdown
              data={inventoryByCondition}
              color="#7c3aed"
              emptyTitle="No sneakers bought in this period"
            />
          </SectionCard>
        </Col>
        <Col lg={4}>
          <SectionCard
            title="Orders by status"
            subtitle="Shipping status of orders in this period"
          >
            <DonutChart
              data={ordersByStatus}
              emptyTitle="No orders in this period"
            />
          </SectionCard>
        </Col>
      </Row>
    </>
  );
}
