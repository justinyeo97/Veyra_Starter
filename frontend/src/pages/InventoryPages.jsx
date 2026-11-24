import { useMemo, useState } from 'react'
import { Badge, Button, Card, Col, Collapse, Dropdown, Form, Row } from 'react-bootstrap'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { DataTable, RowActions, TablePagination } from '../components/DataTable'
import { ListingFormModal, OrderFormModal, SneakerFormModal, TaskFormModal } from '../components/EntityForms'
import { BrandMark, StandaloneShell } from '../components/Layout'
import {
  ConfirmModal,
  DetailList,
  EmptyState,
  Icon,
  InlineAlert,
  PageHeader,
  ProfitBreakdown,
  SectionCard,
  SneakerImage,
  StatusBadge,
  ViewToggle,
} from '../components/UI'
import { useApp } from '../context/useApp'
import {
  estimatedBreakdown,
  indexById,
  isInStock,
  isSale,
  matchesQuery,
  orderBreakdown,
  paginate,
  profitBreakdown,
  sortItems,
  toNumber,
} from '../utils/calculations'
import { CONDITIONS, IN_STOCK_STATUSES, INVENTORY_STATUSES, LISTING_STATUSES, PLATFORMS, SIZES } from '../utils/constants'
import { formatDate, formatDateTime, formatSize, sneakerName } from '../utils/format'

const SORTS = [
  { key: 'newest', label: 'Newest', get: (s) => s.purchaseDate, direction: 'desc' },
  { key: 'oldest', label: 'Oldest', get: (s) => s.purchaseDate, direction: 'asc' },
  { key: 'price-asc', label: 'Lowest price', get: (s) => toNumber(s.listingPrice), direction: 'asc' },
  { key: 'price-desc', label: 'Highest price', get: (s) => toNumber(s.listingPrice), direction: 'desc' },
  { key: 'profit-desc', label: 'Highest profit', get: (s, settings) => estimatedBreakdown(s, settings).net, direction: 'desc' },
  { key: 'profit-asc', label: 'Lowest profit', get: (s, settings) => estimatedBreakdown(s, settings).net, direction: 'asc' },
]

const EMPTY_FILTERS = { brand: '', size: '', condition: '', status: '', minPrice: '', maxPrice: '', from: '', to: '' }

function BackLink({ to, label }) {
  return (
    <Link to={to} className="back-link">
      <Icon name="arrow-left" className="me-1" />
      {label}
    </Link>
  )
}

function SneakerCard({ sneaker, settings, money, onEdit, onDelete }) {
  const profit = estimatedBreakdown(sneaker, settings).net
  return (
    <Card className="sneaker-card h-100">
      <Link to={`/inventory/${sneaker.id}`} className="sneaker-card-image">
        <SneakerImage src={sneaker.image} alt={sneakerName(sneaker)} variant="card" />
        <StatusBadge status={sneaker.status} className="sneaker-card-status" />
      </Link>
      <Card.Body className="d-flex flex-column">
        <div className="small text-body-secondary">{sneaker.brand}</div>
        <Link to={`/inventory/${sneaker.id}`} className="sneaker-card-title">
          {sneaker.model}
        </Link>
        <div className="small text-body-secondary mb-3">
          {formatSize(sneaker.size)} · {sneaker.condition} · Qty {sneaker.quantity}
        </div>
        <div className="d-flex justify-content-between align-items-end mt-auto">
          <div>
            <div className="fw-bold fs-5">{money(sneaker.listingPrice)}</div>
            <div className={`small ${profit >= 0 ? 'text-success' : 'text-danger'}`}>{money(profit)} est. profit</div>
          </div>
          <div className="d-flex gap-1">
            <Button size="sm" variant="outline-secondary" onClick={() => onEdit(sneaker)} aria-label={`Edit ${sneakerName(sneaker)}`}>
              <Icon name="pencil" />
            </Button>
            <Button size="sm" variant="outline-danger" onClick={() => onDelete(sneaker)} aria-label={`Delete ${sneakerName(sneaker)}`}>
              <Icon name="trash" />
            </Button>
          </div>
        </div>
      </Card.Body>
    </Card>
  )
}

export function InventoryPage() {
  const { data, settings, actions, money, notify } = useApp()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS, status: INVENTORY_STATUSES.includes(params.get('status')) ? params.get('status') : '' })
  const [showFilters, setShowFilters] = useState(Boolean(params.get('status')))
  const [sortKey, setSortKey] = useState('newest')
  const [view, setView] = useState('table')
  const [cardPage, setCardPage] = useState(1)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const brands = useMemo(() => [...new Set(data.sneakers.map((sneaker) => sneaker.brand))].sort((a, b) => a.localeCompare(b)), [data.sneakers])
  const activeFilters = Object.values(filters).filter(Boolean).length

  const results = useMemo(() => {
    const sort = SORTS.find((item) => item.key === sortKey)
    const filtered = data.sneakers.filter((sneaker) => {
      if (!matchesQuery(query, [sneaker.brand, sneaker.model, sneaker.sku, sneaker.colorway, sneaker.id, sneaker.notes])) return false
      if (filters.brand && sneaker.brand !== filters.brand) return false
      if (filters.size && String(sneaker.size) !== filters.size) return false
      if (filters.condition && sneaker.condition !== filters.condition) return false
      if (filters.status && sneaker.status !== filters.status) return false
      if (filters.minPrice !== '' && toNumber(sneaker.listingPrice) < toNumber(filters.minPrice)) return false
      if (filters.maxPrice !== '' && toNumber(sneaker.listingPrice) > toNumber(filters.maxPrice)) return false
      if (filters.from && sneaker.purchaseDate < filters.from) return false
      if (filters.to && sneaker.purchaseDate > filters.to) return false
      return true
    })
    return sortItems(filtered, (sneaker) => sort.get(sneaker, settings), sort.direction)
  }, [data.sneakers, query, filters, sortKey, settings])

  function setFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value }))
    setCardPage(1)
  }

  function confirmDelete() {
    actions.remove('sneaker', deleting.id)
    notify(`${sneakerName(deleting)} deleted.`)
    setDeleting(null)
  }

  const priceError = filters.minPrice !== '' && filters.maxPrice !== '' && toNumber(filters.minPrice) > toNumber(filters.maxPrice)
  const dateError = filters.from && filters.to && filters.from > filters.to
  const resetKey = JSON.stringify([query, filters, sortKey])
  const cards = paginate(results, cardPage, 12)

  const columns = [
    {
      key: 'sneaker',
      label: 'Sneaker',
      render: (sneaker) => (
        <div className="d-flex align-items-center gap-3 min-w-0">
          <SneakerImage src={sneaker.image} alt="" />
          <div className="min-w-0">
            <div className="fw-semibold text-truncate table-name">{sneakerName(sneaker)}</div>
            <div className="small text-body-secondary">{sneaker.sku}</div>
          </div>
        </div>
      ),
    },
    { key: 'size', label: 'Size', render: (sneaker) => formatSize(sneaker.size) },
    { key: 'condition', label: 'Condition', hideBelow: 'xl', render: (sneaker) => sneaker.condition },
    { key: 'status', label: 'Status', render: (sneaker) => <StatusBadge status={sneaker.status} /> },
    { key: 'purchasePrice', label: 'Cost', align: 'end', hideBelow: 'lg', render: (sneaker) => money(sneaker.purchasePrice) },
    { key: 'listingPrice', label: 'Price', align: 'end', hideBelow: 'md', render: (sneaker) => money(sneaker.listingPrice) },
    {
      key: 'profit',
      label: 'Est. profit',
      align: 'end',
      hideBelow: 'lg',
      render: (sneaker) => {
        const net = estimatedBreakdown(sneaker, settings).net
        return <span className={net >= 0 ? 'text-success' : 'text-danger'}>{money(net)}</span>
      },
    },
    { key: 'quantity', label: 'Qty', align: 'end', hideBelow: 'sm', render: (sneaker) => sneaker.quantity },
    {
      key: 'actions',
      label: <span className="visually-hidden">Actions</span>,
      align: 'end',
      render: (sneaker) => (
        <RowActions>
          <Button size="sm" variant="light" as={Link} to={`/inventory/${sneaker.id}`} aria-label={`View ${sneakerName(sneaker)}`} title="View">
            <Icon name="eye" />
          </Button>
          <Button size="sm" variant="light" onClick={() => setEditing(sneaker)} aria-label={`Edit ${sneakerName(sneaker)}`} title="Edit">
            <Icon name="pencil" />
          </Button>
          <Button size="sm" variant="light" className="text-danger" onClick={() => setDeleting(sneaker)} aria-label={`Delete ${sneakerName(sneaker)}`} title="Delete">
            <Icon name="trash" />
          </Button>
        </RowActions>
      ),
    },
  ]

  const empty = (
    <EmptyState
      icon={data.sneakers.length ? 'search' : 'box-seam'}
      title={data.sneakers.length ? 'No sneakers match' : 'Your inventory is empty'}
      message={data.sneakers.length ? 'Try a different search or clear the filters.' : 'Add your first pair to start tracking stock and profit.'}
      action={
        data.sneakers.length ? (
          <Button
            variant="outline-secondary"
            onClick={() => {
              setQuery('')
              setFilters(EMPTY_FILTERS)
            }}
          >
            Clear search and filters
          </Button>
        ) : (
          <Button variant="primary" onClick={() => setEditing({})}>
            Add sneaker
          </Button>
        )
      }
    />
  )

  return (
    <>
      <PageHeader
        title="Inventory"
        subtitle={`${data.sneakers.filter(isInStock).length} products in stock across ${data.sneakers.length} records.`}
        actions={
          <Button variant="primary" onClick={() => setEditing({})}>
            <Icon name="plus-lg" className="me-1" />
            Add sneaker
          </Button>
        }
      />

      <Card className="section-card mb-4">
        <Card.Body>
          <div className="toolbar">
            <div className="toolbar-search">
              <Icon name="search" />
              <Form.Control
                type="search"
                placeholder="Search brand, model, SKU or colorway"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setCardPage(1)
                }}
                aria-label="Search inventory"
              />
            </div>
            <Button variant={showFilters ? 'secondary' : 'outline-secondary'} onClick={() => setShowFilters((current) => !current)} aria-expanded={showFilters}>
              <Icon name="funnel" className="me-1" />
              Filters
              {activeFilters > 0 && (
                <Badge bg="dark" pill className="ms-2">
                  {activeFilters}
                </Badge>
              )}
            </Button>
            <Form.Select value={sortKey} onChange={(event) => setSortKey(event.target.value)} aria-label="Sort inventory" className="toolbar-sort">
              {SORTS.map((sort) => (
                <option key={sort.key} value={sort.key}>
                  Sort: {sort.label}
                </option>
              ))}
            </Form.Select>
            <ViewToggle
              value={view}
              onChange={setView}
              options={[
                { value: 'table', label: 'Table view', icon: 'list-ul' },
                { value: 'cards', label: 'Card view', icon: 'grid-3x2-gap' },
              ]}
            />
          </div>
          <Collapse in={showFilters}>
            <div>
              <Row className="g-3 pt-3">
                <Col xs={6} md={4} xl={3}>
                  <Form.Label className="small">Brand</Form.Label>
                  <Form.Select size="sm" value={filters.brand} onChange={(event) => setFilter('brand', event.target.value)}>
                    <option value="">All brands</option>
                    {brands.map((brand) => (
                      <option key={brand}>{brand}</option>
                    ))}
                  </Form.Select>
                </Col>
                <Col xs={6} md={4} xl={3}>
                  <Form.Label className="small">Size</Form.Label>
                  <Form.Select size="sm" value={filters.size} onChange={(event) => setFilter('size', event.target.value)}>
                    <option value="">All sizes</option>
                    {SIZES.map((size) => (
                      <option key={size} value={String(size)}>
                        {formatSize(size)}
                      </option>
                    ))}
                  </Form.Select>
                </Col>
                <Col xs={6} md={4} xl={3}>
                  <Form.Label className="small">Condition</Form.Label>
                  <Form.Select size="sm" value={filters.condition} onChange={(event) => setFilter('condition', event.target.value)}>
                    <option value="">All conditions</option>
                    {CONDITIONS.map((condition) => (
                      <option key={condition}>{condition}</option>
                    ))}
                  </Form.Select>
                </Col>
                <Col xs={6} md={4} xl={3}>
                  <Form.Label className="small">Status</Form.Label>
                  <Form.Select size="sm" value={filters.status} onChange={(event) => setFilter('status', event.target.value)}>
                    <option value="">All statuses</option>
                    {INVENTORY_STATUSES.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </Form.Select>
                </Col>
                <Col xs={12} md={4} xl={3}>
                  <Form.Label className="small">Listing price</Form.Label>
                  <div className="d-flex gap-2">
                    <Form.Control size="sm" type="number" min="0" placeholder="Min" value={filters.minPrice} onChange={(event) => setFilter('minPrice', event.target.value)} isInvalid={priceError} aria-label="Minimum price" />
                    <Form.Control size="sm" type="number" min="0" placeholder="Max" value={filters.maxPrice} onChange={(event) => setFilter('maxPrice', event.target.value)} isInvalid={priceError} aria-label="Maximum price" />
                  </div>
                  {priceError && <div className="small text-danger mt-1">Min must be lower than max.</div>}
                </Col>
                <Col xs={12} md={4} xl={3}>
                  <Form.Label className="small">Purchased between</Form.Label>
                  <div className="d-flex gap-2">
                    <Form.Control size="sm" type="date" value={filters.from} onChange={(event) => setFilter('from', event.target.value)} isInvalid={dateError} aria-label="Purchased from" />
                    <Form.Control size="sm" type="date" value={filters.to} onChange={(event) => setFilter('to', event.target.value)} isInvalid={dateError} aria-label="Purchased to" />
                  </div>
                  {dateError && <div className="small text-danger mt-1">Start date must be before end date.</div>}
                </Col>
                <Col xs={12} xl={6} className="d-flex align-items-end justify-content-xl-end">
                  <Button variant="link" size="sm" className="px-0" onClick={() => setFilters(EMPTY_FILTERS)} disabled={activeFilters === 0}>
                    Clear filters
                  </Button>
                </Col>
              </Row>
            </div>
          </Collapse>
        </Card.Body>
      </Card>

      {view === 'table' ? (
        <SectionCard flush>
          <DataTable key={resetKey} columns={columns} rows={results} onRowClick={(sneaker) => navigate(`/inventory/${sneaker.id}`)} empty={<div className="p-3">{empty}</div>} label="sneakers" />
        </SectionCard>
      ) : results.length === 0 ? (
        <SectionCard>{empty}</SectionCard>
      ) : (
        <>
          <Row xs={1} sm={2} lg={3} xxl={4} className="g-3">
            {cards.items.map((sneaker) => (
              <Col key={sneaker.id}>
                <SneakerCard sneaker={sneaker} settings={settings} money={money} onEdit={setEditing} onDelete={setDeleting} />
              </Col>
            ))}
          </Row>
          <SectionCard className="mt-3" flush>
            <TablePagination page={cards.page} pageCount={cards.pageCount} total={results.length} pageSize={12} onChange={setCardPage} label="sneakers" />
          </SectionCard>
        </>
      )}

      {editing && <SneakerFormModal record={editing} onHide={() => setEditing(null)} />}
      <ConfirmModal
        show={Boolean(deleting)}
        title="Delete this sneaker?"
        message={deleting ? `${sneakerName(deleting)} (${formatSize(deleting.size)}) and its listings will be removed. Past orders keep their records.` : ''}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  )
}

export function SneakerDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data, settings, actions, money, notify } = useApp()
  const [modal, setModal] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const sneaker = data.sneakers.find((item) => item.id === id)

  const related = useMemo(() => {
    const customersById = indexById(data.customers)
    return {
      orders: data.orders
        .filter((order) => order.sneakerId === id)
        .sort((a, b) => b.orderDate.localeCompare(a.orderDate))
        .map((order) => ({ ...order, customer: customersById[order.customerId] })),
      listings: data.listings.filter((listing) => listing.sneakerId === id),
      tasks: data.tasks.filter((task) => task.sneakerId === id),
    }
  }, [data, id])

  if (!sneaker) {
    return (
      <>
        <PageHeader title="Sneaker not found" back={<BackLink to="/inventory" label="Inventory" />} />
        <SectionCard>
          <EmptyState
            icon="question-octagon"
            title="This sneaker does not exist"
            message={`There is no inventory record with ID ${id}. It may have been deleted.`}
            action={
              <Button as={Link} to="/inventory" variant="primary">
                Back to inventory
              </Button>
            }
          />
        </SectionCard>
      </>
    )
  }

  const estimated = estimatedBreakdown(sneaker, settings)
  const sales = related.orders.filter(isSale)
  const actualParts = sales.map((order) => orderBreakdown(order, sneaker))
  const actual = profitBreakdown({
    salePrice: actualParts.reduce((sum, part) => sum + part.gross, 0),
    purchasePrice: actualParts.reduce((sum, part) => sum + part.cost, 0),
    platformFee: actualParts.reduce((sum, part) => sum + part.platformFee, 0),
    shippingFee: actualParts.reduce((sum, part) => sum + part.shippingFee, 0),
  })
  const history = [...(sneaker.history || [])].sort((a, b) => a.date.localeCompare(b.date))
  const allowedStatuses = toNumber(sneaker.quantity) === 0 ? ['Sold', 'Shipped'] : IN_STOCK_STATUSES

  function changeStatus(status) {
    actions.save('sneaker', { ...sneaker, status })
    notify(`Status changed to ${status}.`)
  }

  function confirmDelete() {
    actions.remove('sneaker', sneaker.id)
    notify(`${sneakerName(sneaker)} deleted.`)
    navigate('/inventory')
  }

  return (
    <>
      <PageHeader
        back={<BackLink to="/inventory" label="Inventory" />}
        title={sneakerName(sneaker)}
        subtitle={`${sneaker.sku} · ${formatSize(sneaker.size)} · ${sneaker.colorway}`}
        actions={
          <>
            <Button variant="outline-secondary" onClick={() => setModal('task')}>
              <Icon name="check2-square" className="me-1" />
              Create task
            </Button>
            <Button variant="outline-secondary" onClick={() => setModal('listing')} disabled={['Sold', 'Shipped'].includes(sneaker.status)}>
              <Icon name="shop" className="me-1" />
              Create listing
            </Button>
            <Button variant="outline-secondary" onClick={() => setModal('order')} disabled={!isInStock(sneaker)} title={isInStock(sneaker) ? undefined : 'No pairs in stock'}>
              <Icon name="receipt" className="me-1" />
              Create order
            </Button>
            <Button variant="primary" onClick={() => setModal('edit')}>
              <Icon name="pencil" className="me-1" />
              Edit
            </Button>
            <Button variant="outline-danger" onClick={() => setConfirming(true)} aria-label="Delete sneaker">
              <Icon name="trash" />
            </Button>
          </>
        }
      />

      <Row className="g-4">
        <Col lg={5}>
          <SectionCard bodyClassName="p-3">
            <SneakerImage src={sneaker.image} alt={sneakerName(sneaker)} variant="hero" />
          </SectionCard>
          <SectionCard title="Description" className="mt-4">
            <p className="mb-0 preline">{sneaker.description || 'No description yet.'}</p>
          </SectionCard>
          <SectionCard title="Notes" className="mt-4">
            <p className="mb-0 preline">{sneaker.notes || 'No notes yet.'}</p>
          </SectionCard>
          <SectionCard title="Maintenance Notes" className="mt-4">
            <p className="mb-0 preline">{sneaker.maintenanceNotes || 'No maintenance notes yet.'}</p>
          </SectionCard>
        </Col>
        <Col lg={7}>
          <SectionCard
            title="Details"
            action={
              <Dropdown align="end">
                <Dropdown.Toggle size="sm" variant="outline-secondary">
                  <StatusBadge status={sneaker.status} />
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  <Dropdown.Header>Change status</Dropdown.Header>
                  {allowedStatuses.map((status) => (
                    <Dropdown.Item key={status} active={status === sneaker.status} onClick={() => status !== sneaker.status && changeStatus(status)}>
                      {status}
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              </Dropdown>
            }
          >
            <DetailList
              items={[
                { label: 'Brand', value: sneaker.brand },
                { label: 'Model', value: sneaker.model },
                { label: 'SKU', value: sneaker.sku },
                { label: 'Size', value: formatSize(sneaker.size) },
                { label: 'Colorway', value: sneaker.colorway },
                { label: 'Condition', value: sneaker.condition },
                { label: 'Purchase price', value: money(sneaker.purchasePrice) },
                { label: 'Listing price', value: money(sneaker.listingPrice) },
                { label: 'Quantity', value: `${sneaker.quantity} ${Number(sneaker.quantity) === 1 ? 'pair' : 'pairs'}` },
                { label: 'Status', value: <StatusBadge status={sneaker.status} /> },
                { label: 'Purchase date', value: formatDate(sneaker.purchaseDate) },
                { label: 'Listing date', value: sneaker.listingDate ? formatDate(sneaker.listingDate) : 'Not listed yet' },
              ]}
            />
          </SectionCard>
          <Row className="g-4 mt-0">
            <Col md={6}>
              <SectionCard title="Estimated profit" subtitle="Per pair at the listing price">
                <ProfitBreakdown breakdown={estimated} money={money} title="" note={`Uses your default ${settings.store.platformFee}% platform fee and ${money(settings.store.shippingFee)} shipping.`} />
              </SectionCard>
            </Col>
            <Col md={6}>
              <SectionCard title="Actual profit" subtitle={sales.length ? `From ${sales.length} paid ${sales.length === 1 ? 'sale' : 'sales'}` : 'No paid sales yet'}>
                {sales.length ? (
                  <ProfitBreakdown breakdown={actual} money={money} title="" />
                ) : (
                  <EmptyState compact icon="cash" title="Nothing sold yet" message="Profit appears here once an order for this sneaker is paid." />
                )}
              </SectionCard>
            </Col>
          </Row>
          <SectionCard title="Activity timeline" className="mt-4">
            {history.length === 0 ? (
              <EmptyState compact icon="clock-history" title="No activity yet" />
            ) : (
              <ol className="timeline">
                {history.map((entry) => (
                  <li key={entry.id} className="timeline-item">
                    <span className="timeline-dot" />
                    <div className="d-flex flex-wrap align-items-center gap-2">
                      <StatusBadge status={entry.status} />
                      <span className="small text-body-secondary">{formatDateTime(entry.date)}</span>
                    </div>
                    <div className="small mt-1">{entry.note}</div>
                  </li>
                ))}
              </ol>
            )}
          </SectionCard>
        </Col>
      </Row>

      <Row className="g-4 mt-0">
        <Col xl={6}>
          <SectionCard title="Orders" subtitle={`${related.orders.length} for this sneaker`} flush>
            <DataTable
              rows={related.orders}
              onRowClick={(order) => navigate(`/orders/${order.id}`)}
              paginated={false}
              empty={<EmptyState compact icon="receipt" title="No orders yet" />}
              columns={[
                { key: 'id', label: 'Order', render: (order) => <span className="fw-semibold">{order.id}</span> },
                { key: 'customer', label: 'Customer', hideBelow: 'sm', render: (order) => order.customer?.name || 'Deleted customer' },
                { key: 'date', label: 'Date', hideBelow: 'md', render: (order) => formatDate(order.orderDate) },
                { key: 'price', label: 'Price', align: 'end', render: (order) => money(order.salePrice) },
                { key: 'payment', label: 'Payment', render: (order) => <StatusBadge status={order.paymentStatus} /> },
              ]}
            />
          </SectionCard>
        </Col>
        <Col xl={6}>
          <SectionCard title="Listings and tasks" flush>
            {related.listings.length === 0 && related.tasks.length === 0 ? (
              <EmptyState compact icon="shop" title="No listings or tasks" message="Create one with the buttons at the top of the page." />
            ) : (
              <div className="list-rows">
                {related.listings.map((listing) => (
                  <Link key={listing.id} to={`/listings/${listing.id}`} className="list-row">
                    <span className="list-icon tone-blue">
                      <Icon name="shop" />
                    </span>
                    <div className="min-w-0 flex-grow-1">
                      <div className="fw-semibold">
                        {listing.platform} listing · {money(listing.price)}
                      </div>
                      <div className="small text-body-secondary">Listed {formatDate(listing.dateListed)}</div>
                    </div>
                    <StatusBadge status={listing.status} />
                  </Link>
                ))}
                {related.tasks.map((task) => (
                  <Link key={task.id} to={`/tasks?task=${task.id}`} className="list-row">
                    <span className="list-icon tone-gray">
                      <Icon name="check2-square" />
                    </span>
                    <div className="min-w-0 flex-grow-1">
                      <div className="fw-semibold text-truncate">{task.title}</div>
                      <div className="small text-body-secondary">Due {formatDate(task.dueDate)}</div>
                    </div>
                    <StatusBadge status={task.status} />
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>
        </Col>
      </Row>

      {modal === 'edit' && <SneakerFormModal record={sneaker} onHide={() => setModal(null)} />}
      {modal === 'task' && <TaskFormModal record={{ sneakerId: sneaker.id, title: `Work on ${sneakerName(sneaker)}` }} onHide={() => setModal(null)} />}
      {modal === 'listing' && <ListingFormModal record={{ sneakerId: sneaker.id }} onHide={() => setModal(null)} />}
      {modal === 'order' && <OrderFormModal record={{ sneakerId: sneaker.id }} onHide={() => setModal(null)} onSaved={(orderId) => navigate(`/orders/${orderId}`)} />}
      <ConfirmModal
        show={confirming}
        title="Delete this sneaker?"
        message={`${sneakerName(sneaker)} and its ${related.listings.length} listings will be removed. Orders keep their records.`}
        onConfirm={confirmDelete}
        onCancel={() => setConfirming(false)}
      />
    </>
  )
}

export function ListingsPage() {
  const { data, actions, money, notify } = useApp()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [platform, setPlatform] = useState('')
  const [status, setStatus] = useState('')
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const sneakersById = useMemo(() => indexById(data.sneakers), [data.sneakers])

  const rows = useMemo(
    () =>
      sortItems(
        data.listings.filter(
          (listing) =>
            matchesQuery(query, [listing.title, listing.id, listing.description, sneakersById[listing.sneakerId]?.sku]) &&
            (!platform || listing.platform === platform) &&
            (!status || listing.status === status),
        ),
        (listing) => listing.dateListed,
        'desc',
      ),
    [data.listings, query, platform, status, sneakersById],
  )
  const active = data.listings.filter((listing) => listing.status === 'Active')

  function confirmDelete() {
    actions.remove('listing', deleting.id)
    notify('Listing deleted.')
    setDeleting(null)
  }

  const columns = [
    {
      key: 'title',
      label: 'Listing',
      sortValue: (listing) => listing.title,
      render: (listing) => (
        <div className="d-flex align-items-center gap-3 min-w-0">
          <SneakerImage src={listing.images?.[0] || sneakersById[listing.sneakerId]?.image} alt="" />
          <div className="min-w-0">
            <div className="fw-semibold text-truncate table-name">{listing.title}</div>
            <div className="small text-body-secondary">{listing.id}</div>
          </div>
        </div>
      ),
    },
    { key: 'platform', label: 'Platform', sortValue: (listing) => listing.platform, render: (listing) => <span className="platform-badge">{listing.platform}</span> },
    { key: 'price', label: 'Price', align: 'end', sortValue: (listing) => listing.price, render: (listing) => money(listing.price) },
    { key: 'size', label: 'Size', hideBelow: 'md', render: (listing) => formatSize(listing.size) },
    { key: 'condition', label: 'Condition', hideBelow: 'xl', render: (listing) => listing.condition },
    { key: 'status', label: 'Status', sortValue: (listing) => listing.status, render: (listing) => <StatusBadge status={listing.status} /> },
    { key: 'date', label: 'Listed', hideBelow: 'lg', sortValue: (listing) => listing.dateListed, render: (listing) => formatDate(listing.dateListed) },
    {
      key: 'actions',
      label: <span className="visually-hidden">Actions</span>,
      align: 'end',
      render: (listing) => (
        <RowActions>
          <Button size="sm" variant="light" as={Link} to={`/listings/${listing.id}`} title="Preview" aria-label={`Preview ${listing.title}`}>
            <Icon name="eye" />
          </Button>
          <Button size="sm" variant="light" onClick={() => setEditing(listing)} title="Edit" aria-label={`Edit ${listing.title}`}>
            <Icon name="pencil" />
          </Button>
          <Button size="sm" variant="light" className="text-danger" onClick={() => setDeleting(listing)} title="Delete" aria-label={`Delete ${listing.title}`}>
            <Icon name="trash" />
          </Button>
        </RowActions>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Listings"
        subtitle={`${active.length} active listings worth ${money(active.reduce((sum, listing) => sum + toNumber(listing.price), 0))}.`}
        actions={
          <Button variant="primary" onClick={() => setEditing({})}>
            <Icon name="plus-lg" className="me-1" />
            Create listing
          </Button>
        }
      />
      <Card className="section-card mb-4">
        <Card.Body>
          <div className="toolbar">
            <div className="toolbar-search">
              <Icon name="search" />
              <Form.Control type="search" placeholder="Search title, ID or SKU" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search listings" />
            </div>
            <Form.Select value={platform} onChange={(event) => setPlatform(event.target.value)} aria-label="Filter by platform" className="toolbar-filter">
              <option value="">All platforms</option>
              {PLATFORMS.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </Form.Select>
            <Form.Select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by status" className="toolbar-filter">
              <option value="">All statuses</option>
              {LISTING_STATUSES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </Form.Select>
          </div>
        </Card.Body>
      </Card>
      <SectionCard flush>
        <DataTable
          key={JSON.stringify([query, platform, status])}
          columns={columns}
          rows={rows}
          onRowClick={(listing) => navigate(`/listings/${listing.id}`)}
          label="listings"
          empty={
            <div className="p-3">
              <EmptyState
                icon="shop"
                title={data.listings.length ? 'No listings match' : 'No listings yet'}
                message={data.listings.length ? 'Try another search or filter.' : 'Create a listing from any sneaker in your inventory.'}
                action={
                  <Button variant="primary" onClick={() => setEditing({})}>
                    Create listing
                  </Button>
                }
              />
            </div>
          }
        />
      </SectionCard>
      {editing && <ListingFormModal record={editing} onHide={() => setEditing(null)} />}
      <ConfirmModal
        show={Boolean(deleting)}
        title="Delete this listing?"
        message={deleting ? `"${deleting.title}" on ${deleting.platform} will be removed. The sneaker stays in your inventory.` : ''}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  )
}

export function ListingPreviewPage() {
  const { id } = useParams()
  const { data, settings, money, notify } = useApp()
  const [activeImage, setActiveImage] = useState(0)
  const [editing, setEditing] = useState(false)
  const listing = data.listings.find((item) => item.id === id)
  const sneaker = listing ? data.sneakers.find((item) => item.id === listing.sneakerId) : null

  if (!listing) {
    return (
      <StandaloneShell>
        <div className="preview-page">
          <div className="container py-5">
            <EmptyState
              icon="shop"
              title="Listing not found"
              message={`There is no listing with ID ${id}. It may have been deleted.`}
              action={
                <Button as={Link} to="/listings" variant="primary">
                  Back to listings
                </Button>
              }
            />
          </div>
        </div>
      </StandaloneShell>
    )
  }

  const images = listing.images?.length ? listing.images : [sneaker?.image].filter(Boolean)
  const current = images[Math.min(activeImage, Math.max(0, images.length - 1))]

  return (
    <StandaloneShell>
      <div className="preview-page">
        <div className="preview-bar">
          <div className="container d-flex flex-wrap align-items-center gap-2 justify-content-between">
            <span className="small">
              <Icon name="eye" className="me-2" />
              Customer preview of <strong>{listing.id}</strong> on {listing.platform}
            </span>
            <div className="d-flex gap-2">
              <Button as={Link} to="/listings" size="sm" variant="outline-light">
                <Icon name="arrow-left" className="me-1" />
                Listings
              </Button>
              <Button size="sm" variant="outline-light" onClick={() => setEditing(true)}>
                <Icon name="pencil" className="me-1" />
                Edit listing
              </Button>
            </div>
          </div>
        </div>
        <header className="preview-header">
          <div className="container d-flex align-items-center gap-2">
            <BrandMark size={28} />
            <span className="fw-bold">{settings.store.name}</span>
          </div>
        </header>
        <div className="container py-4 py-lg-5">
          {listing.status !== 'Active' && (
            <InlineAlert variant="warning" title={`This listing is ${listing.status}`}>
              Customers cannot buy it until its status is Active.
            </InlineAlert>
          )}
          <Row className="g-4 g-lg-5">
            <Col lg={7}>
              <div className="preview-gallery">
                <SneakerImage src={current} alt={listing.title} variant="hero" />
              </div>
              {images.length > 1 && (
                <div className="preview-thumbs">
                  {images.map((image, index) => (
                    <button key={image} type="button" className={`preview-thumb ${index === activeImage ? 'active' : ''}`} onClick={() => setActiveImage(index)} aria-label={`Show image ${index + 1}`}>
                      <SneakerImage src={image} alt="" />
                    </button>
                  ))}
                </div>
              )}
            </Col>
            <Col lg={5}>
              <div className="small text-uppercase fw-semibold text-body-secondary letter-wide">{sneaker?.brand || 'Sneaker'}</div>
              <h1 className="preview-title">{listing.title}</h1>
              <div className="preview-price">{money(listing.price)}</div>
              <div className="d-flex flex-wrap gap-2 my-3">
                <span className="preview-chip">
                  <Icon name="rulers" className="me-1" />
                  {formatSize(listing.size)}
                </span>
                <span className="preview-chip">
                  <Icon name="patch-check" className="me-1" />
                  {listing.condition}
                </span>
                {sneaker?.colorway && <span className="preview-chip">{sneaker.colorway}</span>}
              </div>
              <div className="d-grid gap-2 my-4">
                <Button size="lg" variant="primary" disabled={listing.status !== 'Active'} onClick={() => notify('Checkout is disabled in preview mode.', 'danger')}>
                  {listing.status === 'Active' ? 'Buy now' : listing.status === 'Sold' ? 'Sold out' : 'Not available'}
                </Button>
                <Button size="lg" variant="outline-secondary" onClick={() => notify('Saved to favourites in preview mode.')} disabled={listing.status !== 'Active'}>
                  <Icon name="heart" className="me-2" />
                  Save
                </Button>
              </div>
              <ul className="preview-perks">
                <li>
                  <Icon name="shield-check" /> Authenticated by {settings.store.name}
                </li>
                <li>
                  <Icon name="truck" /> Ships within 2 business days
                </li>
                <li>
                  <Icon name="arrow-repeat" /> Returns accepted within 7 days if unworn
                </li>
              </ul>
              <h2 className="h6 mt-4">Description</h2>
              <p className="preline text-body-secondary">{listing.description}</p>
              {sneaker?.sku && <p className="small text-body-secondary mb-0">Style code: {sneaker.sku}</p>}
              <hr />
              <div className="small text-body-secondary">
                Sold by <strong className="text-body">{settings.store.name}</strong>. {settings.store.description}
              </div>
            </Col>
          </Row>
        </div>
      </div>
      {editing && <ListingFormModal record={listing} onHide={() => setEditing(false)} />}
    </StandaloneShell>
  )
}

