import { useMemo, useState } from 'react'
import { Button, Card, Col, Dropdown, Form, Row } from 'react-bootstrap'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { DataTable, RowActions } from '../components/DataTable'
import { CustomerFormModal, OrderFormModal } from '../components/EntityForms'
import {
  Avatar,
  ConfirmModal,
  DetailList,
  EmptyState,
  Icon,
  InlineAlert,
  PageHeader,
  ProfitBreakdown,
  SectionCard,
  SneakerImage,
  StatCard,
  StatusBadge,
} from '../components/UI'
import { useApp } from '../context/useApp'
import {
  customerStats,
  indexById,
  isCompletedOrder,
  isInStock,
  isPendingOrder,
  isSale,
  matchesQuery,
  orderBreakdown,
  sortItems,
} from '../utils/calculations'
import { PAYMENT_STATUSES, SHIPPING_STATUSES } from '../utils/constants'
import { formatDate, formatNumber, formatSize, sneakerName } from '../utils/format'

const ORDER_VIEWS = [
  { key: 'all', label: 'All orders', test: () => true },
  { key: 'pending', label: 'Pending', test: isPendingOrder },
  { key: 'unshipped', label: 'Paid, not shipped', test: (order) => isSale(order) && order.shippingStatus === 'Processing' },
  { key: 'completed', label: 'Completed', test: isCompletedOrder },
]

const ORDER_SORTS = [
  { key: 'newest', label: 'Newest', get: (row) => row.orderDate + row.id, direction: 'desc' },
  { key: 'oldest', label: 'Oldest', get: (row) => row.orderDate + row.id, direction: 'asc' },
  { key: 'revenue-desc', label: 'Highest revenue', get: (row) => row.salePrice, direction: 'desc' },
  { key: 'revenue-asc', label: 'Lowest revenue', get: (row) => row.salePrice, direction: 'asc' },
  { key: 'profit-desc', label: 'Highest profit', get: (row) => row.profit, direction: 'desc' },
  { key: 'profit-asc', label: 'Lowest profit', get: (row) => row.profit, direction: 'asc' },
]

const CUSTOMER_SEGMENTS = [
  { key: 'all', label: 'All customers', test: () => true },
  { key: 'repeat', label: 'Repeat buyers', test: (row) => row.orderCount >= 2 },
  { key: 'one', label: 'One order', test: (row) => row.orderCount === 1 },
  { key: 'none', label: 'No orders yet', test: (row) => row.orderCount === 0 },
]

const CUSTOMER_SORTS = [
  { key: 'name', label: 'Name A–Z', get: (row) => row.name.toLowerCase(), direction: 'asc' },
  { key: 'spent', label: 'Highest spending', get: (row) => row.totalSpent, direction: 'desc' },
  { key: 'orders', label: 'Most orders', get: (row) => row.orderCount, direction: 'desc' },
  { key: 'recent', label: 'Most recent order', get: (row) => row.lastOrderDate, direction: 'desc' },
  { key: 'newest', label: 'Newest customer', get: (row) => row.createdAt, direction: 'desc' },
]

function BackLink({ to, label }) {
  return (
    <Link to={to} className="back-link">
      <Icon name="arrow-left" className="me-1" />
      {label}
    </Link>
  )
}

function shippingAllowed(status, paymentStatus) {
  if (status === 'Cancelled' && paymentStatus === 'Paid') return false
  if ((status === 'Shipped' || status === 'Delivered') && (paymentStatus === 'Failed' || paymentStatus === 'Refunded')) return false
  return true
}

export function OrdersPage() {
  const { data, actions, money, notify } = useApp()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [query, setQuery] = useState('')
  const [view, setView] = useState(ORDER_VIEWS.some((item) => item.key === params.get('view')) ? params.get('view') : 'all')
  const [payment, setPayment] = useState('')
  const [shipping, setShipping] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [sortKey, setSortKey] = useState('newest')
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const rows = useMemo(() => {
    const sneakersById = indexById(data.sneakers)
    const customersById = indexById(data.customers)
    const viewTest = ORDER_VIEWS.find((item) => item.key === view).test
    const sort = ORDER_SORTS.find((item) => item.key === sortKey)
    const enriched = data.orders.map((order) => {
      const sneaker = sneakersById[order.sneakerId]
      return {
        ...order,
        sneaker,
        customer: customersById[order.customerId],
        sneakerTitle: sneaker ? sneakerName(sneaker) : order.sneakerLabel || 'Deleted sneaker',
        profit: orderBreakdown(order, sneaker).net,
      }
    })
    const filtered = enriched.filter(
      (row) =>
        viewTest(row) &&
        matchesQuery(query, [row.id, row.customer?.name, row.customer?.email, row.sneakerTitle, row.sneaker?.sku]) &&
        (!payment || row.paymentStatus === payment) &&
        (!shipping || row.shippingStatus === shipping) &&
        (!from || row.orderDate >= from) &&
        (!to || row.orderDate <= to),
    )
    return sortItems(filtered, sort.get, sort.direction)
  }, [data, view, query, payment, shipping, from, to, sortKey])

  const paidRows = rows.filter(isSale)
  const revenue = paidRows.reduce((sum, row) => sum + row.salePrice, 0)
  const profit = paidRows.reduce((sum, row) => sum + row.profit, 0)
  const dateError = from && to && from > to
  const filtersActive = query || payment || shipping || from || to || view !== 'all'

  function clearFilters() {
    setQuery('')
    setView('all')
    setPayment('')
    setShipping('')
    setFrom('')
    setTo('')
  }

  function confirmDelete() {
    actions.remove('order', deleting.id)
    notify(`Order ${deleting.id} deleted.`)
    setDeleting(null)
  }

  const columns = [
    { key: 'id', label: 'Order', sortValue: (row) => row.id, render: (row) => <span className="fw-semibold">{row.id}</span> },
    {
      key: 'customer',
      label: 'Customer',
      hideBelow: 'sm',
      sortValue: (row) => row.customer?.name || '',
      render: (row) => (row.customer ? row.customer.name : <span className="text-body-secondary">Deleted customer</span>),
    },
    {
      key: 'sneaker',
      label: 'Sneaker',
      hideBelow: 'lg',
      render: (row) => (
        <div className="d-flex align-items-center gap-2 min-w-0">
          <SneakerImage src={row.sneaker?.image} alt="" variant="mini" />
          <span className="text-truncate table-name">{row.sneakerTitle}</span>
        </div>
      ),
    },
    { key: 'date', label: 'Date', hideBelow: 'md', sortValue: (row) => row.orderDate, render: (row) => formatDate(row.orderDate) },
    { key: 'revenue', label: 'Revenue', align: 'end', sortValue: (row) => row.salePrice, render: (row) => money(row.salePrice) },
    {
      key: 'profit',
      label: 'Net profit',
      align: 'end',
      hideBelow: 'lg',
      sortValue: (row) => row.profit,
      render: (row) => <span className={row.profit >= 0 ? 'text-success' : 'text-danger'}>{money(row.profit)}</span>,
    },
    { key: 'payment', label: 'Payment', render: (row) => <StatusBadge status={row.paymentStatus} /> },
    { key: 'shipping', label: 'Shipping', hideBelow: 'md', render: (row) => <StatusBadge status={row.shippingStatus} /> },
    {
      key: 'actions',
      label: <span className="visually-hidden">Actions</span>,
      align: 'end',
      render: (row) => (
        <RowActions>
          <Button size="sm" variant="light" as={Link} to={`/orders/${row.id}`} title="View" aria-label={`View ${row.id}`}>
            <Icon name="eye" />
          </Button>
          <Button size="sm" variant="light" onClick={() => setEditing(row)} title="Edit" aria-label={`Edit ${row.id}`}>
            <Icon name="pencil" />
          </Button>
          <Button size="sm" variant="light" className="text-danger" onClick={() => setDeleting(row)} title="Delete" aria-label={`Delete ${row.id}`}>
            <Icon name="trash" />
          </Button>
        </RowActions>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Orders"
        subtitle={`${formatNumber(rows.length)} orders · ${money(revenue)} paid revenue · ${money(profit)} net profit`}
        actions={
          <Button variant="primary" onClick={() => setEditing({})}>
            <Icon name="plus-lg" className="me-1" />
            Create order
          </Button>
        }
      />
      <Card className="section-card mb-4">
        <Card.Body>
          <div className="segmented mb-3" role="tablist" aria-label="Order views">
            {ORDER_VIEWS.map((item) => (
              <button key={item.key} type="button" role="tab" aria-selected={view === item.key} className={view === item.key ? 'active' : ''} onClick={() => setView(item.key)}>
                {item.label}
                <span className="segmented-count">{data.orders.filter(item.test).length}</span>
              </button>
            ))}
          </div>
          <div className="toolbar">
            <div className="toolbar-search">
              <Icon name="search" />
              <Form.Control type="search" placeholder="Search order, customer or sneaker" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search orders" />
            </div>
            <Form.Select className="toolbar-filter" value={payment} onChange={(event) => setPayment(event.target.value)} aria-label="Filter by payment status">
              <option value="">Any payment</option>
              {PAYMENT_STATUSES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </Form.Select>
            <Form.Select className="toolbar-filter" value={shipping} onChange={(event) => setShipping(event.target.value)} aria-label="Filter by shipping status">
              <option value="">Any shipping</option>
              {SHIPPING_STATUSES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </Form.Select>
            <div className="d-flex gap-2 align-items-center toolbar-dates">
              <Form.Control type="date" value={from} onChange={(event) => setFrom(event.target.value)} isInvalid={dateError} aria-label="Orders from" />
              <span className="text-body-secondary small">to</span>
              <Form.Control type="date" value={to} onChange={(event) => setTo(event.target.value)} isInvalid={dateError} aria-label="Orders to" />
            </div>
            <Form.Select className="toolbar-sort" value={sortKey} onChange={(event) => setSortKey(event.target.value)} aria-label="Sort orders">
              {ORDER_SORTS.map((item) => (
                <option key={item.key} value={item.key}>
                  Sort: {item.label}
                </option>
              ))}
            </Form.Select>
          </div>
          {dateError && <div className="small text-danger mt-2">The start date must be before the end date.</div>}
        </Card.Body>
      </Card>
      <SectionCard flush>
        <DataTable
          key={JSON.stringify([query, view, payment, shipping, from, to, sortKey])}
          columns={columns}
          rows={rows}
          onRowClick={(row) => navigate(`/orders/${row.id}`)}
          label="orders"
          empty={
            <div className="p-3">
              <EmptyState
                icon="receipt"
                title={data.orders.length ? 'No orders match' : 'No orders yet'}
                message={data.orders.length ? 'Try a different search or clear the filters.' : 'Create your first order when a sneaker sells.'}
                action={
                  filtersActive ? (
                    <Button variant="outline-secondary" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  ) : (
                    <Button variant="primary" onClick={() => setEditing({})}>
                      Create order
                    </Button>
                  )
                }
              />
            </div>
          }
        />
      </SectionCard>
      {editing && <OrderFormModal record={editing} onHide={() => setEditing(null)} />}
      <ConfirmModal
        show={Boolean(deleting)}
        title={`Delete order ${deleting?.id || ''}?`}
        message={
          deleting?.inventoryApplied
            ? 'This order is paid, so deleting it puts one pair back into stock and removes it from revenue.'
            : 'The order will be removed from your records.'
        }
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  )
}

export function OrderDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data, actions, money, notify } = useApp()
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const order = data.orders.find((item) => item.id === id)

  if (!order) {
    return (
      <>
        <PageHeader title="Order not found" back={<BackLink to="/orders" label="Orders" />} />
        <SectionCard>
          <EmptyState
            icon="question-octagon"
            title="This order does not exist"
            message={`There is no order with ID ${id}. It may have been deleted.`}
            action={
              <Button as={Link} to="/orders" variant="primary">
                Back to orders
              </Button>
            }
          />
        </SectionCard>
      </>
    )
  }

  const sneaker = data.sneakers.find((item) => item.id === order.sneakerId)
  const customer = data.customers.find((item) => item.id === order.customerId)
  const breakdown = orderBreakdown(order, sneaker)

  function update(patch, message) {
    actions.save('order', { ...order, ...patch })
    notify(message)
  }

  function confirmDelete() {
    actions.remove('order', order.id)
    notify(`Order ${order.id} deleted.`)
    navigate('/orders')
  }

  return (
    <>
      <PageHeader
        back={<BackLink to="/orders" label="Orders" />}
        title={`Order ${order.id}`}
        subtitle={`Placed ${formatDate(order.orderDate)}`}
        actions={
          <>
            <Dropdown>
              <Dropdown.Toggle variant="outline-secondary">Payment: {order.paymentStatus}</Dropdown.Toggle>
              <Dropdown.Menu>
                {PAYMENT_STATUSES.map((status) => (
                  <Dropdown.Item
                    key={status}
                    active={status === order.paymentStatus}
                    disabled={!shippingAllowed(order.shippingStatus, status) || (status === 'Paid' && !order.inventoryApplied && !(sneaker && isInStock(sneaker)))}
                    onClick={() => status !== order.paymentStatus && update({ paymentStatus: status }, `Payment marked ${status}.`)}
                  >
                    {status}
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown>
            <Dropdown>
              <Dropdown.Toggle variant="outline-secondary">Shipping: {order.shippingStatus}</Dropdown.Toggle>
              <Dropdown.Menu>
                {SHIPPING_STATUSES.map((status) => (
                  <Dropdown.Item
                    key={status}
                    active={status === order.shippingStatus}
                    disabled={!shippingAllowed(status, order.paymentStatus)}
                    onClick={() => status !== order.shippingStatus && update({ shippingStatus: status }, `Shipping marked ${status}.`)}
                  >
                    {status}
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown>
            <Button variant="primary" onClick={() => setEditing(true)}>
              <Icon name="pencil" className="me-1" />
              Edit
            </Button>
            <Button variant="outline-danger" onClick={() => setConfirming(true)} aria-label="Delete order">
              <Icon name="trash" />
            </Button>
          </>
        }
      />

      {order.paymentStatus === 'Failed' && (
        <InlineAlert variant="danger" title="Payment failed">
          Contact {customer?.name || 'the customer'} to retry the payment before shipping.
        </InlineAlert>
      )}
      {isSale(order) && order.shippingStatus === 'Processing' && (
        <InlineAlert variant="warning" title="Ready to ship">
          This order is paid and waiting to be shipped.
        </InlineAlert>
      )}

      <Row className="g-4">
        <Col lg={8}>
          <SectionCard title="Order details">
            <DetailList
              items={[
                { label: 'Order ID', value: order.id },
                { label: 'Customer ID', value: order.customerId },
                { label: 'Sneaker ID', value: order.sneakerId },
                { label: 'Order date', value: formatDate(order.orderDate) },
                { label: 'Sale price', value: money(order.salePrice) },
                { label: 'Shipping fee', value: money(order.shippingFee) },
                { label: 'Platform fee', value: money(order.platformFee) },
                { label: 'Total revenue', value: money(order.salePrice) },
                { label: 'Net profit', value: <span className={breakdown.net >= 0 ? 'text-success' : 'text-danger'}>{money(breakdown.net)}</span> },
                { label: 'Payment status', value: <StatusBadge status={order.paymentStatus} /> },
                { label: 'Shipping status', value: <StatusBadge status={order.shippingStatus} /> },
                { label: 'Counts as a sale', value: isSale(order) ? 'Yes' : 'No, it is not paid' },
              ]}
            />
            {order.notes && (
              <>
                <hr />
                <div className="small text-body-secondary mb-1">Notes</div>
                <p className="mb-0 preline">{order.notes}</p>
              </>
            )}
          </SectionCard>
          <Row className="g-4 mt-0">
            <Col md={6}>
              <SectionCard title="Sneaker" className="h-100">
                {sneaker ? (
                  <Link to={`/inventory/${sneaker.id}`} className="linked-card">
                    <SneakerImage src={sneaker.image} alt={sneakerName(sneaker)} variant="card" />
                    <div className="fw-semibold mt-3">{sneakerName(sneaker)}</div>
                    <div className="small text-body-secondary">
                      {sneaker.sku} · {formatSize(sneaker.size)} · {sneaker.condition}
                    </div>
                    <div className="mt-2">
                      <StatusBadge status={sneaker.status} /> <span className="small text-body-secondary ms-1">{sneaker.quantity} left</span>
                    </div>
                  </Link>
                ) : (
                  <EmptyState compact icon="box" title="Sneaker deleted" message={`${order.sneakerLabel || 'This sneaker'} is no longer in your inventory.`} />
                )}
              </SectionCard>
            </Col>
            <Col md={6}>
              <SectionCard title="Customer" className="h-100">
                {customer ? (
                  <Link to={`/customers/${customer.id}`} className="linked-card">
                    <div className="d-flex align-items-center gap-3 mb-3">
                      <Avatar name={customer.name} size={44} />
                      <div className="min-w-0">
                        <div className="fw-semibold">{customer.name}</div>
                        <div className="small text-body-secondary text-truncate">{customer.email}</div>
                      </div>
                    </div>
                    <div className="small">
                      <Icon name="telephone" className="me-2 text-body-secondary" />
                      {customer.phone}
                    </div>
                    <div className="small mt-1 d-flex">
                      <Icon name="geo-alt" className="me-2 text-body-secondary" />
                      <span>{customer.address}</span>
                    </div>
                  </Link>
                ) : (
                  <EmptyState compact icon="person-x" title="Customer deleted" message={`Customer ${order.customerId} is no longer in your records.`} />
                )}
              </SectionCard>
            </Col>
          </Row>
        </Col>
        <Col lg={4}>
          <SectionCard title="Profit">
            <ProfitBreakdown breakdown={breakdown} money={money} title="" note={isSale(order) ? undefined : 'This order is not paid, so it is not counted in revenue or profit yet.'} />
          </SectionCard>
        </Col>
      </Row>

      {editing && <OrderFormModal record={order} onHide={() => setEditing(false)} />}
      <ConfirmModal
        show={confirming}
        title={`Delete order ${order.id}?`}
        message={order.inventoryApplied ? 'This order is paid, so deleting it puts one pair back into stock.' : 'The order will be removed from your records.'}
        onConfirm={confirmDelete}
        onCancel={() => setConfirming(false)}
      />
    </>
  )
}

export function CustomersPage() {
  const { data, actions, money, notify } = useApp()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [segment, setSegment] = useState('all')
  const [sortKey, setSortKey] = useState('name')
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const allRows = useMemo(() => data.customers.map((customer) => ({ ...customer, ...customerStats(customer.id, data.orders) })), [data.customers, data.orders])
  const rows = useMemo(() => {
    const test = CUSTOMER_SEGMENTS.find((item) => item.key === segment).test
    const sort = CUSTOMER_SORTS.find((item) => item.key === sortKey)
    return sortItems(
      allRows.filter((row) => test(row) && matchesQuery(query, [row.name, row.email, row.phone, row.address, row.id])),
      sort.get,
      sort.direction,
    )
  }, [allRows, query, segment, sortKey])

  function confirmDelete() {
    actions.remove('customer', deleting.id)
    notify(`${deleting.name} deleted.`)
    setDeleting(null)
  }

  const columns = [
    {
      key: 'name',
      label: 'Customer',
      sortValue: (row) => row.name.toLowerCase(),
      render: (row) => (
        <div className="d-flex align-items-center gap-3 min-w-0">
          <Avatar name={row.name} size={36} />
          <div className="min-w-0">
            <div className="fw-semibold text-truncate">{row.name}</div>
            <div className="small text-body-secondary text-truncate">{row.email}</div>
          </div>
        </div>
      ),
    },
    { key: 'phone', label: 'Phone', hideBelow: 'lg', render: (row) => row.phone },
    { key: 'orders', label: 'Orders', align: 'end', sortValue: (row) => row.orderCount, render: (row) => row.orderCount },
    { key: 'spent', label: 'Total spent', align: 'end', sortValue: (row) => row.totalSpent, render: (row) => money(row.totalSpent) },
    { key: 'average', label: 'Avg order', align: 'end', hideBelow: 'xl', sortValue: (row) => row.averageOrder, render: (row) => money(row.averageOrder) },
    { key: 'last', label: 'Last order', hideBelow: 'md', sortValue: (row) => row.lastOrderDate, render: (row) => (row.lastOrderDate ? formatDate(row.lastOrderDate) : '—') },
    {
      key: 'actions',
      label: <span className="visually-hidden">Actions</span>,
      align: 'end',
      render: (row) => (
        <RowActions>
          <Button size="sm" variant="light" as={Link} to={`/customers/${row.id}`} title="View" aria-label={`View ${row.name}`}>
            <Icon name="eye" />
          </Button>
          <Button size="sm" variant="light" onClick={() => setEditing(row)} title="Edit" aria-label={`Edit ${row.name}`}>
            <Icon name="pencil" />
          </Button>
          <Button size="sm" variant="light" className="text-danger" onClick={() => setDeleting(row)} title="Delete" aria-label={`Delete ${row.name}`}>
            <Icon name="trash" />
          </Button>
        </RowActions>
      ),
    },
  ]

  const totalSpent = allRows.reduce((sum, row) => sum + row.totalSpent, 0)

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle={`${data.customers.length} customers · ${money(totalSpent)} lifetime spending`}
        actions={
          <Button variant="primary" onClick={() => setEditing({})}>
            <Icon name="plus-lg" className="me-1" />
            Add customer
          </Button>
        }
      />
      <Card className="section-card mb-4">
        <Card.Body>
          <div className="toolbar">
            <div className="toolbar-search">
              <Icon name="search" />
              <Form.Control type="search" placeholder="Search name, email, phone or address" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search customers" />
            </div>
            <Form.Select className="toolbar-filter" value={segment} onChange={(event) => setSegment(event.target.value)} aria-label="Filter customers">
              {CUSTOMER_SEGMENTS.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </Form.Select>
            <Form.Select className="toolbar-sort" value={sortKey} onChange={(event) => setSortKey(event.target.value)} aria-label="Sort customers">
              {CUSTOMER_SORTS.map((item) => (
                <option key={item.key} value={item.key}>
                  Sort: {item.label}
                </option>
              ))}
            </Form.Select>
          </div>
        </Card.Body>
      </Card>
      <SectionCard flush>
        <DataTable
          key={JSON.stringify([query, segment, sortKey])}
          columns={columns}
          rows={rows}
          onRowClick={(row) => navigate(`/customers/${row.id}`)}
          label="customers"
          empty={
            <div className="p-3">
              <EmptyState
                icon="people"
                title={data.customers.length ? 'No customers match' : 'No customers yet'}
                message={data.customers.length ? 'Try a different search or filter.' : 'Add a customer to start recording orders.'}
                action={
                  <Button variant="primary" onClick={() => setEditing({})}>
                    Add customer
                  </Button>
                }
              />
            </div>
          }
        />
      </SectionCard>
      {editing && <CustomerFormModal record={editing} onHide={() => setEditing(null)} />}
      <ConfirmModal
        show={Boolean(deleting)}
        title={`Delete ${deleting?.name || 'customer'}?`}
        message={deleting?.orderCount ? `Their ${deleting.orderCount} orders stay in your records but will show as a deleted customer.` : 'This customer will be removed.'}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  )
}

export function CustomerDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data, actions, money, notify } = useApp()
  const [modal, setModal] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const customer = data.customers.find((item) => item.id === id)

  if (!customer) {
    return (
      <>
        <PageHeader title="Customer not found" back={<BackLink to="/customers" label="Customers" />} />
        <SectionCard>
          <EmptyState
            icon="person-x"
            title="This customer does not exist"
            message={`There is no customer with ID ${id}. They may have been deleted.`}
            action={
              <Button as={Link} to="/customers" variant="primary">
                Back to customers
              </Button>
            }
          />
        </SectionCard>
      </>
    )
  }

  const stats = customerStats(customer.id, data.orders)
  const sneakersById = indexById(data.sneakers)
  const historyRows = stats.history.map((order) => ({ ...order, sneaker: sneakersById[order.sneakerId] }))

  function confirmDelete() {
    actions.remove('customer', customer.id)
    notify(`${customer.name} deleted.`)
    navigate('/customers')
  }

  return (
    <>
      <PageHeader
        back={<BackLink to="/customers" label="Customers" />}
        title={customer.name}
        subtitle={`Customer since ${formatDate(customer.createdAt)}`}
        actions={
          <>
            <Button variant="outline-secondary" onClick={() => setModal('order')}>
              <Icon name="receipt" className="me-1" />
              Create order
            </Button>
            <Button variant="primary" onClick={() => setModal('edit')}>
              <Icon name="pencil" className="me-1" />
              Edit
            </Button>
            <Button variant="outline-danger" onClick={() => setConfirming(true)} aria-label="Delete customer">
              <Icon name="trash" />
            </Button>
          </>
        }
      />
      <Row xs={2} md={4} className="g-3 mb-4">
        <Col>
          <StatCard label="Orders" value={formatNumber(stats.orderCount)} icon="receipt" tone="blue" />
        </Col>
        <Col>
          <StatCard label="Total spending" value={money(stats.totalSpent)} icon="cash-stack" tone="green" />
        </Col>
        <Col>
          <StatCard label="Average order value" value={money(stats.averageOrder)} icon="calculator" tone="violet" />
        </Col>
        <Col>
          <StatCard label="Last order" value={stats.lastOrderDate ? formatDate(stats.lastOrderDate) : '—'} icon="calendar3" tone="gray" />
        </Col>
      </Row>
      <Row className="g-4">
        <Col lg={4}>
          <SectionCard title="Contact information">
            <div className="d-flex align-items-center gap-3 mb-3">
              <Avatar name={customer.name} size={52} />
              <div className="min-w-0">
                <div className="fw-semibold">{customer.name}</div>
                <div className="small text-body-secondary">{customer.id}</div>
              </div>
            </div>
            <ul className="contact-list">
              <li>
                <Icon name="envelope" />
                <a href={`mailto:${customer.email}`}>{customer.email}</a>
              </li>
              <li>
                <Icon name="telephone" />
                <a href={`tel:${customer.phone.replace(/\s/g, '')}`}>{customer.phone}</a>
              </li>
              <li>
                <Icon name="geo-alt" />
                <span>{customer.address}</span>
              </li>
            </ul>
          </SectionCard>
          <SectionCard title="Notes" className="mt-4">
            <p className="mb-0 preline">{customer.notes || 'No notes yet.'}</p>
          </SectionCard>
        </Col>
        <Col lg={8}>
          <SectionCard title="Order history" subtitle={`${stats.orderCount} ${stats.orderCount === 1 ? 'order' : 'orders'}`} flush>
            <DataTable
              rows={historyRows}
              onRowClick={(order) => navigate(`/orders/${order.id}`)}
              label="orders"
              empty={<EmptyState compact icon="receipt" title="No orders yet" message="Orders for this customer will show up here." />}
              columns={[
                { key: 'id', label: 'Order', render: (order) => <span className="fw-semibold">{order.id}</span> },
                {
                  key: 'sneaker',
                  label: 'Sneaker',
                  hideBelow: 'md',
                  render: (order) => (
                    <div className="d-flex align-items-center gap-2 min-w-0">
                      <SneakerImage src={order.sneaker?.image} alt="" variant="mini" />
                      <span className="text-truncate table-name">{order.sneaker ? sneakerName(order.sneaker) : order.sneakerLabel}</span>
                    </div>
                  ),
                },
                { key: 'date', label: 'Date', hideBelow: 'sm', render: (order) => formatDate(order.orderDate) },
                { key: 'price', label: 'Total', align: 'end', render: (order) => money(order.salePrice) },
                { key: 'payment', label: 'Payment', render: (order) => <StatusBadge status={order.paymentStatus} /> },
                { key: 'shipping', label: 'Shipping', hideBelow: 'lg', render: (order) => <StatusBadge status={order.shippingStatus} /> },
              ]}
            />
          </SectionCard>
        </Col>
      </Row>
      {modal === 'edit' && <CustomerFormModal record={customer} onHide={() => setModal(null)} />}
      {modal === 'order' && <OrderFormModal record={{ customerId: customer.id }} onHide={() => setModal(null)} onSaved={(orderId) => navigate(`/orders/${orderId}`)} />}
      <ConfirmModal
        show={confirming}
        title={`Delete ${customer.name}?`}
        message={stats.orderCount ? `Their ${stats.orderCount} orders stay in your records but will show as a deleted customer.` : 'This customer will be removed.'}
        onConfirm={confirmDelete}
        onCancel={() => setConfirming(false)}
      />
    </>
  )
}
