import { useMemo, useRef, useState } from "react";
import { Button, Col, Form, InputGroup, Row, Spinner } from "react-bootstrap";
import { Link } from "react-router-dom";
import { useApp } from "../context/useApp";
import { searchSneakers } from "../services/sneakerApi";
import { isInStock, profitBreakdown, toNumber } from "../utils/calculations";
import {
  CONDITIONS,
  INVENTORY_STATUSES,
  LISTING_STATUSES,
  PAYMENT_STATUSES,
  PLATFORMS,
  SHIPPING_STATUSES,
  SIZES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TEAM_MEMBERS,
} from "../utils/constants";
import { formatSize, sneakerName, todayISO } from "../utils/format";
import { useForm, wait } from "../utils/validation";
import { Field, FormModal } from "./FormFields";
import {
  EmptyState,
  Icon,
  InlineAlert,
  LoadingState,
  ProfitBreakdown,
  SneakerImage,
} from "./UI";

const SIZE_OPTIONS = SIZES.map((size) => ({
  value: String(size),
  label: formatSize(size),
}));

function asText(value) {
  return value === undefined || value === null ? "" : String(value);
}

function notInFuture(label) {
  return (value) =>
    value > todayISO() ? `${label} cannot be in the future.` : "";
}

const SNEAKER_RULES = {
  brand: { required: true, label: "Brand", maxLength: 60 },
  model: { required: true, label: "Model", maxLength: 140 },
  sku: { required: true, label: "SKU", maxLength: 40 },
  size: { required: true, label: "Size" },
  colorway: { required: true, label: "Colorway", maxLength: 120 },
  condition: { required: true, label: "Condition" },
  purchasePrice: {
    required: true,
    type: "number",
    min: 0,
    label: "Purchase price",
  },
  listingPrice: {
    required: true,
    type: "number",
    min: 0,
    label: "Listing price",
  },
  quantity: {
    required: true,
    type: "number",
    integer: true,
    min: 0,
    max: 999,
    label: "Quantity",
  },
  purchaseDate: {
    required: true,
    type: "date",
    label: "Purchase date",
    custom: notInFuture("Purchase date"),
  },
  listingDate: {
    type: "date",
    label: "Listing date",
    custom: (value, values) =>
      values.purchaseDate && value < values.purchaseDate
        ? "Listing date cannot be before the purchase date."
        : "",
  },
  status: {
    required: true,
    label: "Status",
    custom: (value, values) => {
      const inStock = [
        "Purchased",
        "Cleaning",
        "Ready to List",
        "Listed",
      ].includes(value);
      if (inStock && Number(values.quantity) === 0)
        return "A sneaker with 0 pairs left must be Sold or Shipped.";
      if (!inStock && values.quantity !== "" && Number(values.quantity) > 0)
        return `Set the quantity to 0 to mark it ${value}.`;
      return "";
    },
  },
  image: { type: "url", label: "Image URL" },
  description: { label: "Description", maxLength: 1200 },
  notes: { label: "Notes", maxLength: 1000 },
};

function SneakerSearch({ onSelect, selectedId }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("idle");
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState("");
  const controller = useRef(null);

  async function runSearch() {
    const text = query.trim();
    if (text.length < 2) {
      setError('Type at least 2 characters, like "Dunk Low Panda" or a SKU.');
      setStatus("error");
      return;
    }
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setStatus("loading");
    setError("");
    setSearched(text);
    try {
      const products = await searchSneakers(text, { signal: current.signal });
      if (current.signal.aborted) return;
      setResults(products);
      setStatus(products.length ? "done" : "empty");
    } catch (searchError) {
      if (current.signal.aborted) return;
      setResults([]);
      setError(searchError.message || "The sneaker search failed.");
      setStatus("error");
    }
  }

  function handleKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      runSearch();
    }
  }

  return (
    <div className="api-search">
      <div className="api-search-head">
        <div>
          <div className="fw-semibold">
            <Icon name="search" className="me-2" />
            Find the sneaker
          </div>
          <div className="small text-body-secondary">
            Search the sneaker database by name or SKU to fill in the brand,
            model, colorway, image and description.
          </div>
        </div>
      </div>
      <InputGroup className="mt-3">
        <Form.Control
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. Jordan 4 Military Black or DH6927-111"
          aria-label="Search the sneaker database"
          disabled={status === "loading"}
        />
        <Button
          variant="primary"
          onClick={runSearch}
          disabled={status === "loading"}
        >
          {status === "loading" ? (
            <Spinner animation="border" size="sm" />
          ) : (
            <Icon name="search" />
          )}
          <span className="ms-2 d-none d-sm-inline">Search</span>
        </Button>
      </InputGroup>

      {status === "loading" && (
        <LoadingState compact label={`Searching for "${searched}"…`} />
      )}
      {status === "error" && (
        <InlineAlert
          variant="danger"
          className="mt-3 mb-0"
          onRetry={query.trim().length >= 2 ? runSearch : undefined}
        >
          {error} You can also fill in the details by hand below.
        </InlineAlert>
      )}
      {status === "empty" && (
        <EmptyState
          compact
          icon="search"
          title="No sneakers found"
          message={`Nothing matched "${searched}". Try fewer words, the SKU, or enter the details by hand.`}
        />
      )}
      {status === "done" && (
        <div className="api-results" role="list">
          {results.map((product) => (
            <button
              key={product.apiId}
              type="button"
              role="listitem"
              className={`api-result ${selectedId === product.apiId ? "selected" : ""}`}
              onClick={() => onSelect(product)}
            >
              <SneakerImage
                src={product.image}
                alt={product.name}
                variant="result"
              />
              <span className="api-result-body">
                <span className="api-result-brand">
                  {product.brand || "Unknown brand"}
                </span>
                <span className="api-result-name">
                  {product.name || "Unnamed product"}
                </span>
                <span className="api-result-meta">
                  {[product.sku, product.colorway]
                    .filter(Boolean)
                    .join(" · ") || "Some details missing"}
                </span>
              </span>
              {selectedId === product.apiId && (
                <span className="api-result-check">
                  <Icon name="check-circle-fill" />
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SneakerFormModal({ record = {}, onHide, onSaved }) {
  const { actions, notify } = useApp();
  const editing = Boolean(record.id);
  const [showSearch, setShowSearch] = useState(!editing);
  const [selected, setSelected] = useState(null);

  const form = useForm({
    initialValues: {
      brand: record.brand || "",
      model: record.model || "",
      sku: record.sku || "",
      size: asText(record.size || ""),
      colorway: record.colorway || "",
      condition: record.condition || "New / Deadstock",
      purchasePrice: asText(record.purchasePrice),
      listingPrice: asText(record.listingPrice),
      quantity: asText(record.quantity ?? 1),
      purchaseDate: record.purchaseDate || todayISO(),
      listingDate: record.listingDate || "",
      status: record.status || "Purchased",
      image: record.image || "",
      description: record.description || "",
      notes: record.notes || "",
      maintenanceNotes: record.maintenanceNotes || "",
    },
    rules: SNEAKER_RULES,
    onSubmit: async (values) => {
      await wait();
      const id = actions.save("sneaker", {
        ...(editing ? { id: record.id } : {}),
        brand: values.brand.trim(),
        model: values.model.trim(),
        sku: values.sku.trim().toUpperCase(),
        size: Number(values.size),
        colorway: values.colorway.trim(),
        condition: values.condition,
        purchasePrice: Number(values.purchasePrice),
        listingPrice: Number(values.listingPrice),
        quantity: Number(values.quantity),
        purchaseDate: values.purchaseDate,
        listingDate: values.listingDate,
        status: values.status,
        image: values.image.trim(),
        description: values.description.trim(),
        notes: values.notes.trim(),
        maintenanceNotes: values.maintenanceNotes,
      });
      notify(editing ? "Sneaker updated." : "Sneaker added to inventory.");
      onSaved?.(id);
      onHide();
    },
  });

  function applyProduct(product) {
    setSelected(product);
    const patch = {};
    if (product.brand) patch.brand = product.brand;
    if (product.model) patch.model = product.model;
    if (product.colorway) patch.colorway = product.colorway;
    if (product.image) patch.image = product.image;
    if (product.description)
      patch.description = product.description.slice(0, 1200);
    if (product.sku) patch.sku = product.sku;
    form.patchValues(patch);
    ["brand", "model", "colorway", "sku", "image"].forEach((field) =>
      form.touch(field),
    );
  }

  const filled = selected
    ? ["brand", "model", "colorway", "image", "description"].filter(
        (field) => selected[field],
      )
    : [];

  return (
    <FormModal
      title={editing ? `Edit ${sneakerName(record)}` : "Add sneaker"}
      onHide={onHide}
      form={form}
      submitLabel={editing ? "Save changes" : "Add sneaker"}
      size="xl"
    >
      {editing && !showSearch && (
        <Button
          variant="outline-secondary"
          size="sm"
          className="mb-3"
          onClick={() => setShowSearch(true)}
        >
          <Icon name="search" className="me-2" />
          Search the sneaker database
        </Button>
      )}
      {showSearch && (
        <SneakerSearch onSelect={applyProduct} selectedId={selected?.apiId} />
      )}
      {selected && (
        <InlineAlert
          variant={selected.missing.length ? "warning" : "success"}
          className="mt-3"
        >
          {filled.length > 0
            ? `Filled in ${filled.join(", ")} from "${selected.name}".`
            : `"${selected.name}" had no product details to copy.`}{" "}
          {selected.missing.length > 0 &&
            `The API had no ${selected.missing.join(", ")} for this sneaker, so add them by hand.`}
        </InlineAlert>
      )}

      <Row className="g-4 mt-1">
        <Col lg={4}>
          <SneakerImage
            src={form.values.image}
            alt={form.values.model || "Sneaker preview"}
            variant="preview"
          />
          <Field
            form={form}
            name="image"
            label="Image URL"
            type="url"
            placeholder="https://"
            className="mt-3 mb-0"
            help="Filled in from the search, or paste your own."
          />
        </Col>
        <Col lg={8}>
          <h3 className="form-section-title">Product</h3>
          <Row>
            <Col sm={6}>
              <Field
                form={form}
                name="brand"
                label="Brand"
                required
                placeholder="Nike"
              />
            </Col>
            <Col sm={6}>
              <Field
                form={form}
                name="sku"
                label="SKU"
                required
                placeholder="DD1391-100"
              />
            </Col>
            <Col sm={12}>
              <Field
                form={form}
                name="model"
                label="Model"
                required
                placeholder='Dunk Low Retro "Panda"'
              />
            </Col>
            <Col sm={6}>
              <Field
                form={form}
                name="colorway"
                label="Colorway"
                required
                placeholder="White/Black"
              />
            </Col>
            <Col sm={3}>
              <Field
                form={form}
                name="size"
                label="Size"
                as="select"
                options={SIZE_OPTIONS}
                emptyOption="Select size"
                required
              />
            </Col>
            <Col sm={3}>
              <Field
                form={form}
                name="condition"
                label="Condition"
                as="select"
                options={CONDITIONS}
                required
              />
            </Col>
          </Row>
          <h3 className="form-section-title">Pricing and stock</h3>
          <Row>
            <Col sm={6} md={3}>
              <Field
                form={form}
                name="purchasePrice"
                label="Purchase price"
                type="number"
                min="0"
                step="0.01"
                required
              />
            </Col>
            <Col sm={6} md={3}>
              <Field
                form={form}
                name="listingPrice"
                label="Listing price"
                type="number"
                min="0"
                step="0.01"
                required
              />
            </Col>
            <Col sm={6} md={3}>
              <Field
                form={form}
                name="quantity"
                label="Quantity"
                type="number"
                min="0"
                step="1"
                required
              />
            </Col>
            <Col sm={6} md={3}>
              <Field
                form={form}
                name="status"
                label="Status"
                as="select"
                options={INVENTORY_STATUSES}
                required
              />
            </Col>
            <Col sm={6}>
              <Field
                form={form}
                name="purchaseDate"
                label="Purchase date"
                type="date"
                max={todayISO()}
                required
              />
            </Col>
            <Col sm={6}>
              <Field
                form={form}
                name="listingDate"
                label="Listing date"
                type="date"
                help="Set automatically when the status becomes Listed."
              />
            </Col>
          </Row>
          <Field
            form={form}
            name="description"
            label="Description"
            as="textarea"
            rows={3}
          />
          <Field
            form={form}
            name="notes"
            label="Notes"
            as="textarea"
            rows={2}
            placeholder="Storage location, flaws, accessories…"
            className="mb-0"
          />
          <Field
            form={form}
            name="Maintenance notes"
            label="Notes"
            as="textarea"
            rows={2}
            placeholder="Maintenance Notes"
            className="mb-0"
          />
        </Col>
      </Row>
    </FormModal>
  );
}

export function OrderFormModal({ record = {}, onHide, onSaved }) {
  const { data, settings, actions, notify, money } = useApp();
  const editing = Boolean(record.id);
  const [autoFee, setAutoFee] = useState(
    !editing && record.platformFee === undefined,
  );
  const feeRate = toNumber(settings.store.platformFee);

  const sneakerOptions = useMemo(
    () =>
      data.sneakers
        .filter(
          (sneaker) => isInStock(sneaker) || sneaker.id === record.sneakerId,
        )
        .map((sneaker) => ({
          value: sneaker.id,
          label: `${sneakerName(sneaker)} · ${formatSize(sneaker.size)} · ${sneaker.quantity} left`,
        })),
    [data.sneakers, record.sneakerId],
  );
  const customerOptions = useMemo(
    () =>
      [...data.customers]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((customer) => ({
          value: customer.id,
          label: `${customer.name} (${customer.email})`,
        })),
    [data.customers],
  );

  const initialSneaker = data.sneakers.find(
    (sneaker) => sneaker.id === record.sneakerId,
  );
  const initialPrice = record.salePrice ?? initialSneaker?.listingPrice ?? "";

  const rules = {
    customerId: {
      required: true,
      label: "Customer",
      custom: (value) =>
        data.customers.some((customer) => customer.id === value)
          ? ""
          : "Choose a customer from the list.",
    },
    sneakerId: {
      required: true,
      label: "Sneaker",
      custom: (value) =>
        data.sneakers.some((sneaker) => sneaker.id === value)
          ? ""
          : "Choose a sneaker from your inventory.",
    },
    orderDate: {
      required: true,
      type: "date",
      label: "Order date",
      custom: notInFuture("Order date"),
    },
    salePrice: {
      required: true,
      type: "number",
      min: 0.01,
      label: "Sale price",
    },
    shippingFee: {
      required: true,
      type: "number",
      min: 0,
      label: "Shipping fee",
    },
    platformFee: {
      required: true,
      type: "number",
      min: 0,
      label: "Platform fee",
      custom: (value, values) =>
        Number(value) > Number(values.salePrice)
          ? "Platform fee cannot be more than the sale price."
          : "",
    },
    paymentStatus: {
      required: true,
      label: "Payment status",
      custom: (value, values) => {
        if (value !== "Paid" || values.shippingStatus === "Cancelled")
          return "";
        if (record.inventoryApplied && record.sneakerId === values.sneakerId)
          return "";
        const chosen = data.sneakers.find(
          (item) => item.id === values.sneakerId,
        );
        return chosen && !isInStock(chosen)
          ? "This sneaker has no pairs left in stock, so the order cannot be Paid."
          : "";
      },
    },
    shippingStatus: {
      required: true,
      label: "Shipping status",
      custom: (value, values) =>
        value === "Cancelled" && values.paymentStatus === "Paid"
          ? "A cancelled order cannot be Paid. Set payment to Refunded instead."
          : (value === "Shipped" || value === "Delivered") &&
              (values.paymentStatus === "Failed" ||
                values.paymentStatus === "Refunded")
            ? `Orders with a ${values.paymentStatus.toLowerCase()} payment cannot be shipped.`
            : "",
    },
    notes: { label: "Notes", maxLength: 500 },
  };

  const form = useForm({
    initialValues: {
      customerId: record.customerId || "",
      sneakerId: record.sneakerId || "",
      orderDate: record.orderDate || todayISO(),
      salePrice: asText(initialPrice),
      shippingFee: asText(record.shippingFee ?? settings.store.shippingFee),
      platformFee: asText(
        record.platformFee ??
          (initialPrice === ""
            ? ""
            : Math.round(toNumber(initialPrice) * feeRate) / 100),
      ),
      paymentStatus: record.paymentStatus || "Pending",
      shippingStatus: record.shippingStatus || "Processing",
      notes: record.notes || "",
    },
    rules,
    onSubmit: async (values) => {
      await wait();
      const id = actions.save("order", {
        ...(editing ? { id: record.id } : {}),
        customerId: values.customerId,
        sneakerId: values.sneakerId,
        orderDate: values.orderDate,
        salePrice: Number(values.salePrice),
        shippingFee: Number(values.shippingFee),
        platformFee: Number(values.platformFee),
        paymentStatus: values.paymentStatus,
        shippingStatus: values.shippingStatus,
        notes: values.notes.trim(),
      });
      notify(editing ? `Order ${id} updated.` : `Order ${id} created.`);
      onSaved?.(id);
      onHide();
    },
  });

  function feeFor(price) {
    const amount = toNumber(price);
    return amount > 0 ? String(Math.round(amount * feeRate) / 100) : "";
  }

  function handleSneakerChange(event) {
    const sneaker = data.sneakers.find(
      (item) => item.id === event.target.value,
    );
    const patch = { sneakerId: event.target.value };
    if (sneaker && (!form.values.salePrice || autoFee)) {
      patch.salePrice = String(sneaker.listingPrice);
      if (autoFee) patch.platformFee = feeFor(sneaker.listingPrice);
    }
    form.patchValues(patch);
  }

  function handlePriceChange(event) {
    const patch = { salePrice: event.target.value };
    if (autoFee) patch.platformFee = feeFor(event.target.value);
    form.patchValues(patch);
  }

  function handleFeeChange(event) {
    setAutoFee(false);
    form.setValue("platformFee", event.target.value);
  }

  function useDefaultFee() {
    setAutoFee(true);
    form.setValue("platformFee", feeFor(form.values.salePrice));
  }

  const sneaker = data.sneakers.find(
    (item) => item.id === form.values.sneakerId,
  );
  const purchasePrice =
    editing &&
    record.sneakerId === form.values.sneakerId &&
    record.purchasePrice !== undefined
      ? record.purchasePrice
      : sneaker?.purchasePrice;
  const breakdown = profitBreakdown({
    salePrice: form.values.salePrice,
    purchasePrice,
    platformFee: form.values.platformFee,
    shippingFee: form.values.shippingFee,
  });

  return (
    <FormModal
      title={editing ? `Edit order ${record.id}` : "Create order"}
      onHide={onHide}
      form={form}
      submitLabel={editing ? "Save changes" : "Create order"}
      size="xl"
    >
      {sneakerOptions.length === 0 && (
        <InlineAlert variant="warning" title="No sneakers in stock">
          Every sneaker is sold out. <Link to="/inventory">Add inventory</Link>{" "}
          before creating an order.
        </InlineAlert>
      )}
      {customerOptions.length === 0 && (
        <InlineAlert variant="warning" title="No customers yet">
          <Link to="/customers">Add a customer</Link> before creating an order.
        </InlineAlert>
      )}
      <Row className="g-4">
        <Col lg={7}>
          <h3 className="form-section-title">Order</h3>
          <Field
            form={form}
            name="customerId"
            label="Customer"
            as="select"
            options={customerOptions}
            emptyOption="Select a customer"
            required
          />
          <Field
            form={form}
            name="sneakerId"
            label="Sneaker"
            as="select"
            options={sneakerOptions}
            emptyOption="Select a sneaker in stock"
            required
            onChange={handleSneakerChange}
            help="Only sneakers with pairs in stock are shown."
          />
          <Row>
            <Col sm={6}>
              <Field
                form={form}
                name="orderDate"
                label="Order date"
                type="date"
                max={todayISO()}
                required
              />
            </Col>
            <Col sm={6}>
              <Field
                form={form}
                name="salePrice"
                label="Sale price"
                type="number"
                min="0"
                step="0.01"
                required
                onChange={handlePriceChange}
              />
            </Col>
            <Col sm={6}>
              <Field
                form={form}
                name="shippingFee"
                label="Shipping cost"
                type="number"
                min="0"
                step="0.01"
                required
                help="What you pay to ship it."
              />
            </Col>
            <Col sm={6}>
              <Field
                form={form}
                name="platformFee"
                label="Platform fee"
                type="number"
                min="0"
                step="0.01"
                required
                onChange={handleFeeChange}
                help={
                  autoFee ? (
                    `Calculated at your default ${feeRate}%.`
                  ) : (
                    <button
                      type="button"
                      className="btn btn-link btn-sm p-0 align-baseline"
                      onClick={useDefaultFee}
                    >
                      Use the default {feeRate}%
                    </button>
                  )
                }
              />
            </Col>
            <Col sm={6}>
              <Field
                form={form}
                name="paymentStatus"
                label="Payment status"
                as="select"
                options={PAYMENT_STATUSES}
                required
              />
            </Col>
            <Col sm={6}>
              <Field
                form={form}
                name="shippingStatus"
                label="Shipping status"
                as="select"
                options={SHIPPING_STATUSES}
                required
              />
            </Col>
          </Row>
          <Field
            form={form}
            name="notes"
            label="Notes"
            as="textarea"
            rows={2}
            className="mb-0"
          />
        </Col>
        <Col lg={5}>
          <div className="order-form-summary">
            {sneaker ? (
              <div className="d-flex gap-3 align-items-center mb-3">
                <SneakerImage src={sneaker.image} alt={sneakerName(sneaker)} />
                <div className="min-w-0">
                  <div className="fw-semibold text-truncate">
                    {sneakerName(sneaker)}
                  </div>
                  <div className="small text-body-secondary">
                    {formatSize(sneaker.size)} · {sneaker.sku} · bought for{" "}
                    {money(purchasePrice)}
                  </div>
                </div>
              </div>
            ) : (
              <p className="small text-body-secondary">
                Select a sneaker to see the profit on this order.
              </p>
            )}
            <ProfitBreakdown
              breakdown={breakdown}
              money={money}
              title="Live profit"
            />
            <p className="small text-body-secondary mt-3 mb-0">
              <Icon name="info-circle" className="me-1" />
              When payment is Paid, Veyra takes one pair out of stock and
              updates the sneaker, the customer and your dashboard.
            </p>
          </div>
        </Col>
      </Row>
    </FormModal>
  );
}

export function CustomerFormModal({ record = {}, onHide, onSaved }) {
  const { data, actions, notify } = useApp();
  const editing = Boolean(record.id);
  const rules = {
    name: { required: true, label: "Full name", minLength: 2, maxLength: 80 },
    email: {
      required: true,
      type: "email",
      label: "Email",
      custom: (value) =>
        data.customers.some(
          (customer) =>
            customer.id !== record.id &&
            customer.email.toLowerCase() === value.trim().toLowerCase(),
        )
          ? "Another customer already uses this email."
          : "",
    },
    phone: { required: true, type: "phone", label: "Phone" },
    address: { required: true, label: "Address", minLength: 8, maxLength: 200 },
    notes: { label: "Notes", maxLength: 600 },
  };
  const form = useForm({
    initialValues: {
      name: record.name || "",
      email: record.email || "",
      phone: record.phone || "",
      address: record.address || "",
      notes: record.notes || "",
    },
    rules,
    onSubmit: async (values) => {
      await wait();
      const id = actions.save("customer", {
        ...(editing ? { id: record.id } : { createdAt: todayISO() }),
        name: values.name.trim(),
        email: values.email.trim().toLowerCase(),
        phone: values.phone.trim(),
        address: values.address.trim(),
        notes: values.notes.trim(),
      });
      notify(editing ? "Customer updated." : "Customer added.");
      onSaved?.(id);
      onHide();
    },
  });

  return (
    <FormModal
      title={editing ? `Edit ${record.name}` : "Add customer"}
      onHide={onHide}
      form={form}
      submitLabel={editing ? "Save changes" : "Add customer"}
    >
      <Row>
        <Col md={6}>
          <Field
            form={form}
            name="name"
            label="Full name"
            required
            autoComplete="name"
          />
        </Col>
        <Col md={6}>
          <Field
            form={form}
            name="email"
            label="Email"
            type="email"
            required
            autoComplete="email"
          />
        </Col>
        <Col md={6}>
          <Field
            form={form}
            name="phone"
            label="Phone"
            type="tel"
            required
            placeholder="+1 555 0100"
            autoComplete="tel"
          />
        </Col>
        <Col md={12}>
          <Field
            form={form}
            name="address"
            label="Address"
            as="textarea"
            rows={2}
            required
            autoComplete="street-address"
          />
        </Col>
        <Col md={12}>
          <Field
            form={form}
            name="notes"
            label="Notes"
            as="textarea"
            rows={3}
            className="mb-0"
          />
        </Col>
      </Row>
    </FormModal>
  );
}

export function TaskFormModal({ record = {}, onHide, onSaved }) {
  const { data, user, actions, notify } = useApp();
  const editing = Boolean(record.id);
  const createdDate = record.createdDate || todayISO();
  const assignees = [...new Set([user?.name, ...TEAM_MEMBERS].filter(Boolean))];
  const sneakerOptions = data.sneakers.map((sneaker) => ({
    value: sneaker.id,
    label: `${sneakerName(sneaker)} · ${formatSize(sneaker.size)}`,
  }));
  const rules = {
    title: { required: true, label: "Title", minLength: 3, maxLength: 120 },
    description: { label: "Description", maxLength: 1000 },
    status: { required: true, label: "Status" },
    priority: { required: true, label: "Priority" },
    dueDate: {
      required: true,
      type: "date",
      label: "Due date",
      custom: (value) =>
        value < createdDate
          ? "The due date cannot be before the day the task was created."
          : "",
    },
    assignee: { required: true, label: "Assigned user" },
    sneakerId: {
      label: "Related sneaker",
      custom: (value) =>
        value && !data.sneakers.some((sneaker) => sneaker.id === value)
          ? "That sneaker no longer exists."
          : "",
    },
  };
  const form = useForm({
    initialValues: {
      title: record.title || "",
      description: record.description || "",
      status: record.status || "To Do",
      priority: record.priority || "Medium",
      dueDate: record.dueDate || "",
      assignee: record.assignee || user?.name || TEAM_MEMBERS[0],
      sneakerId: record.sneakerId || "",
    },
    rules,
    onSubmit: async (values) => {
      await wait();
      const id = actions.save("task", {
        ...(editing ? { id: record.id } : {}),
        title: values.title.trim(),
        description: values.description.trim(),
        status: values.status,
        priority: values.priority,
        dueDate: values.dueDate,
        createdDate,
        assignee: values.assignee,
        sneakerId: values.sneakerId,
      });
      notify(editing ? "Task updated." : "Task created.");
      onSaved?.(id);
      onHide();
    },
  });

  return (
    <FormModal
      title={editing ? "Edit task" : "Create task"}
      onHide={onHide}
      form={form}
      submitLabel={editing ? "Save changes" : "Create task"}
    >
      <Field
        form={form}
        name="title"
        label="Title"
        required
        placeholder="Photograph new arrivals"
      />
      <Field
        form={form}
        name="description"
        label="Description"
        as="textarea"
        rows={3}
      />
      <Row>
        <Col sm={6}>
          <Field
            form={form}
            name="status"
            label="Status"
            as="select"
            options={TASK_STATUSES}
            required
          />
        </Col>
        <Col sm={6}>
          <Field
            form={form}
            name="priority"
            label="Priority"
            as="select"
            options={TASK_PRIORITIES}
            required
          />
        </Col>
        <Col sm={6}>
          <Field
            form={form}
            name="dueDate"
            label="Due date"
            type="date"
            min={createdDate}
            required
          />
        </Col>
        <Col sm={6}>
          <Field
            form={form}
            name="assignee"
            label="Assigned to"
            as="select"
            options={assignees}
            required
          />
        </Col>
      </Row>
      <Field
        form={form}
        name="sneakerId"
        label="Related sneaker"
        as="select"
        options={sneakerOptions}
        emptyOption="No related sneaker"
        className="mb-0"
      />
    </FormModal>
  );
}

export function ListingFormModal({ record = {}, onHide, onSaved }) {
  const { data, actions, notify, money } = useApp();
  const editing = Boolean(record.id);
  const sneakerOptions = data.sneakers
    .filter(
      (sneaker) =>
        !["Sold", "Shipped"].includes(sneaker.status) ||
        sneaker.id === record.sneakerId,
    )
    .map((sneaker) => ({
      value: sneaker.id,
      label: `${sneakerName(sneaker)} · ${formatSize(sneaker.size)} · ${sneaker.sku}`,
    }));
  const prefill = !editing
    ? data.sneakers.find((sneaker) => sneaker.id === record.sneakerId)
    : null;

  function defaultsFor(sneaker) {
    return {
      title: sneakerName(sneaker),
      description: [
        sneaker.description,
        `Size ${formatSize(sneaker.size)}, ${sneaker.condition.toLowerCase()} condition.`,
      ]
        .filter(Boolean)
        .join(" "),
      price: String(sneaker.listingPrice ?? ""),
      size: String(sneaker.size ?? ""),
      condition: sneaker.condition,
      images: sneaker.image || "",
    };
  }

  const rules = {
    sneakerId: {
      required: true,
      label: "Sneaker",
      custom: (value) =>
        data.sneakers.some((sneaker) => sneaker.id === value)
          ? ""
          : "Choose a sneaker from your inventory.",
    },
    title: { required: true, label: "Title", minLength: 5, maxLength: 120 },
    description: {
      required: true,
      label: "Description",
      minLength: 20,
      maxLength: 1500,
    },
    images: {
      label: "Images",
      custom: (value) => {
        const lines = value
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);
        const bad = lines.find((line) => !/^https?:\/\//i.test(line));
        if (bad)
          return "Each image must be a full URL starting with http:// or https://, one per line.";
        if (lines.length > 8) return "Add 8 images or fewer.";
        return "";
      },
    },
    price: { required: true, type: "number", min: 1, label: "Price" },
    size: { required: true, label: "Size" },
    condition: { required: true, label: "Condition" },
    platform: { required: true, label: "Platform" },
    status: { required: true, label: "Listing status" },
    dateListed: {
      required: true,
      type: "date",
      label: "Date listed",
      custom: notInFuture("Date listed"),
    },
  };

  const base = prefill ? defaultsFor(prefill) : {};
  const form = useForm({
    initialValues: {
      sneakerId: record.sneakerId || "",
      title: record.title || base.title || "",
      description: record.description || base.description || "",
      images: record.images ? record.images.join("\n") : base.images || "",
      price: asText(record.price ?? base.price ?? ""),
      size: asText(record.size ?? base.size ?? ""),
      condition: record.condition || base.condition || "New / Deadstock",
      platform: record.platform || "Veyra",
      status: record.status || "Active",
      dateListed: record.dateListed || todayISO(),
    },
    rules,
    onSubmit: async (values) => {
      await wait();
      const id = actions.save("listing", {
        ...(editing ? { id: record.id } : {}),
        sneakerId: values.sneakerId,
        title: values.title.trim(),
        description: values.description.trim(),
        images: values.images
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
        price: Number(values.price),
        size: Number(values.size),
        condition: values.condition,
        platform: values.platform,
        status: values.status,
        dateListed: values.dateListed,
      });
      notify(editing ? "Listing updated." : "Listing created.");
      onSaved?.(id);
      onHide();
    },
  });

  function handleSneakerChange(event) {
    const sneaker = data.sneakers.find(
      (item) => item.id === event.target.value,
    );
    if (!sneaker) {
      form.setValue("sneakerId", event.target.value);
      return;
    }
    form.patchValues({ sneakerId: sneaker.id, ...defaultsFor(sneaker) });
  }

  const images = form.values.images
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^https?:\/\//i.test(line));
  const sneaker = data.sneakers.find(
    (item) => item.id === form.values.sneakerId,
  );

  return (
    <FormModal
      title={editing ? "Edit listing" : "Create listing"}
      onHide={onHide}
      form={form}
      submitLabel={editing ? "Save changes" : "Create listing"}
      size="xl"
    >
      <Row className="g-4">
        <Col lg={7}>
          <Field
            form={form}
            name="sneakerId"
            label="Sneaker"
            as="select"
            options={sneakerOptions}
            emptyOption="Select a sneaker"
            required
            onChange={handleSneakerChange}
            help="Choosing a sneaker fills in the title, description, price, size, condition and image."
          />
          <Field form={form} name="title" label="Title" required />
          <Field
            form={form}
            name="description"
            label="Description"
            as="textarea"
            rows={4}
            required
          />
          <Row>
            <Col sm={4}>
              <Field
                form={form}
                name="price"
                label="Price"
                type="number"
                min="1"
                step="0.01"
                required
              />
            </Col>
            <Col sm={4}>
              <Field
                form={form}
                name="size"
                label="Size"
                as="select"
                options={SIZE_OPTIONS}
                emptyOption="Select size"
                required
              />
            </Col>
            <Col sm={4}>
              <Field
                form={form}
                name="condition"
                label="Condition"
                as="select"
                options={CONDITIONS}
                required
              />
            </Col>
            <Col sm={4}>
              <Field
                form={form}
                name="platform"
                label="Platform"
                as="select"
                options={PLATFORMS}
                required
              />
            </Col>
            <Col sm={4}>
              <Field
                form={form}
                name="status"
                label="Status"
                as="select"
                options={LISTING_STATUSES}
                required
              />
            </Col>
            <Col sm={4}>
              <Field
                form={form}
                name="dateListed"
                label="Date listed"
                type="date"
                max={todayISO()}
                required
              />
            </Col>
          </Row>
          <Field
            form={form}
            name="images"
            label="Image URLs"
            as="textarea"
            rows={3}
            placeholder="One image URL per line"
            className="mb-0"
          />
        </Col>
        <Col lg={5}>
          <div className="listing-form-preview">
            <div className="small text-body-secondary mb-2">Preview</div>
            <SneakerImage
              src={images[0] || sneaker?.image}
              alt={form.values.title}
              variant="preview"
            />
            {images.length > 1 && (
              <div className="d-flex gap-2 mt-2 flex-wrap">
                {images.slice(1, 5).map((image) => (
                  <SneakerImage key={image} src={image} alt="" />
                ))}
              </div>
            )}
            <div className="mt-3">
              <span className="platform-badge me-2">
                {form.values.platform}
              </span>
              <span className="small text-body-secondary">
                {formatSize(form.values.size)}
              </span>
            </div>
            <div className="fw-semibold mt-2">
              {form.values.title || "Listing title"}
            </div>
            <div className="fs-5 fw-bold">
              {form.values.price ? money(form.values.price) : "—"}
            </div>
          </div>
        </Col>
      </Row>
    </FormModal>
  );
}
