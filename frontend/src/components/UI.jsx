import { useState } from "react";
import {
  Alert,
  Button,
  ButtonGroup,
  Card,
  Dropdown,
  Modal,
  Spinner,
} from "react-bootstrap";
import { DATE_RANGES, STATUS_TONES } from "../utils/constants";
import { formatPercent, initials } from "../utils/format";

export function Icon({ name, className = "", label }) {
  return (
    <i
      className={`bi bi-${name} ${className}`}
      aria-hidden={label ? undefined : true}
      aria-label={label}
    />
  );
}

export function PageHeader({ title, subtitle, actions, back }) {
  return (
    <div className="page-header">
      <div className="min-w-0">
        {back}
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function SectionCard({
  title,
  subtitle,
  action,
  children,
  className = "",
  bodyClassName = "",
  flush = false,
}) {
  return (
    <Card className={`section-card ${className}`}>
      {(title || action) && (
        <Card.Header className="section-card-header">
          <div className="min-w-0">
            <h2 className="section-title">{title}</h2>
            {subtitle && <p className="section-subtitle">{subtitle}</p>}
          </div>
          {action}
        </Card.Header>
      )}
      {flush ? (
        children
      ) : (
        <Card.Body className={bodyClassName}>{children}</Card.Body>
      )}
    </Card>
  );
}

export function StatCard({ label, value, icon, hint, tone = "gray", onClick }) {
  const content = (
    <Card.Body className="stat-card-body">
      <div className="d-flex justify-content-between align-items-start gap-2">
        <span className="stat-label">{label}</span>
        {icon && (
          <span className={`stat-icon tone-${tone}`}>
            <Icon name={icon} />
          </span>
        )}
      </div>
      <div className="stat-value">{value}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </Card.Body>
  );
  if (onClick) {
    return (
      <Card
        as="button"
        type="button"
        className="stat-card stat-card-button text-start w-100"
        onClick={onClick}
      >
        {content}
      </Card>
    );
  }
  return <Card className="stat-card h-100">{content}</Card>;
}

export function StatusBadge({ status, label, className = "" }) {
  const tone = STATUS_TONES[status] || "gray";
  return (
    <span className={`status-badge tone-${tone} ${className}`}>
      {label || status}
    </span>
  );
}

export function EmptyState({
  icon = "inbox",
  title,
  message,
  action,
  compact = false,
}) {
  return (
    <div className={`empty-state ${compact ? "compact" : ""}`}>
      <span className="empty-icon">
        <Icon name={icon} />
      </span>
      <h3 className="empty-title">{title}</h3>
      {message && <p className="empty-message">{message}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function LoadingState({ label = "Loading…", compact = false }) {
  return (
    <div className={`loading-state ${compact ? "compact" : ""}`} role="status">
      <Spinner animation="border" size={compact ? "sm" : undefined} />
      <span>{label}</span>
    </div>
  );
}

export function InlineAlert({
  variant = "danger",
  title,
  children,
  onRetry,
  onClose,
  className = "",
}) {
  const icons = {
    danger: "exclamation-octagon",
    warning: "exclamation-triangle",
    info: "info-circle",
    success: "check-circle",
  };
  return (
    <Alert
      variant={variant}
      className={`inline-alert ${className}`}
      dismissible={Boolean(onClose)}
      onClose={onClose}
    >
      <div className="d-flex gap-2 align-items-start">
        <Icon name={icons[variant] || "info-circle"} className="mt-1" />
        <div className="flex-grow-1 min-w-0">
          {title && <div className="fw-semibold">{title}</div>}
          {children && <div className="small">{children}</div>}
          {onRetry && (
            <Button
              size="sm"
              variant={`outline-${variant}`}
              className="mt-2"
              onClick={onRetry}
            >
              <Icon name="arrow-clockwise" className="me-1" />
              Try again
            </Button>
          )}
        </div>
      </div>
    </Alert>
  );
}

export function ConfirmModal({
  show,
  title,
  message,
  confirmLabel = "Delete",
  onConfirm,
  onCancel,
  variant = "danger",
}) {
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal show={show} onHide={busy ? undefined : onCancel} centered>
      <Modal.Header closeButton={!busy}>
        <Modal.Title as="h2" className="h5 mb-0">
          {title}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="mb-0 text-body-secondary">{message}</p>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button variant={variant} onClick={confirm} disabled={busy}>
          {busy && <Spinner animation="border" size="sm" className="me-2" />}
          {confirmLabel}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export function SneakerImage({
  src,
  alt = "",
  className = "",
  variant = "thumb",
}) {
  const [failedSrc, setFailedSrc] = useState("");
  if (!src || failedSrc === src) {
    return (
      <div
        className={`sneaker-image sneaker-image-${variant} sneaker-image-fallback ${className}`}
        role="img"
        aria-label={alt || "No image available"}
      >
        <Icon name="image" />
        {variant !== "thumb" && <span>No image</span>}
      </div>
    );
  }
  return (
    <div className={`sneaker-image sneaker-image-${variant} ${className}`}>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onError={() => setFailedSrc(src)}
      />
    </div>
  );
}

export function Avatar({ name, src, size = 36 }) {
  const [failedSrc, setFailedSrc] = useState("");
  const style = {
    width: size,
    height: size,
    fontSize: Math.max(11, size * 0.38),
  };
  if (src && failedSrc !== src) {
    return (
      <img
        className="avatar"
        src={src}
        alt={name}
        style={style}
        onError={() => setFailedSrc(src)}
      />
    );
  }
  return (
    <span className="avatar avatar-initials" style={style} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export function ProfitBreakdown({
  breakdown,
  money,
  title = "Profit breakdown",
  note,
}) {
  const rows = [
    { label: "Gross revenue", value: money(breakdown.gross) },
    { label: "Purchase cost", value: `− ${money(breakdown.cost)}` },
    { label: "Platform fees", value: `− ${money(breakdown.platformFee)}` },
    { label: "Shipping cost", value: `− ${money(breakdown.shippingFee)}` },
  ];
  const positive = breakdown.net >= 0;
  return (
    <div className="profit-breakdown">
      {title && <div className="profit-title">{title}</div>}
      <dl className="mb-0">
        {rows.map((row) => (
          <div className="profit-row" key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
        <div className="profit-row profit-total">
          <dt>Net profit</dt>
          <dd className={positive ? "text-success" : "text-danger"}>
            {money(breakdown.net)}
          </dd>
        </div>
        <div className="profit-row">
          <dt>Profit margin</dt>
          <dd className={positive ? "text-success" : "text-danger"}>
            {formatPercent(breakdown.margin)}
          </dd>
        </div>
      </dl>
      {note && <p className="profit-note">{note}</p>}
    </div>
  );
}

export function DateRangeControl({ value, onChange }) {
  const current =
    DATE_RANGES.find((range) => range.key === value) || DATE_RANGES[2];
  return (
    <>
      <ButtonGroup
        className="d-none d-md-inline-flex date-range-group"
        aria-label="Date range"
      >
        {DATE_RANGES.map((range) => (
          <Button
            key={range.key}
            variant={range.key === value ? "primary" : "outline-secondary"}
            size="sm"
            onClick={() => onChange(range.key)}
            aria-pressed={range.key === value}
          >
            {range.label}
          </Button>
        ))}
      </ButtonGroup>
      <Dropdown className="d-md-none">
        <Dropdown.Toggle variant="outline-secondary" size="sm">
          <Icon name="calendar3" className="me-2" />
          {current.label}
        </Dropdown.Toggle>
        <Dropdown.Menu>
          {DATE_RANGES.map((range) => (
            <Dropdown.Item
              key={range.key}
              active={range.key === value}
              onClick={() => onChange(range.key)}
            >
              {range.label}
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown>
    </>
  );
}

export function DetailList({ items }) {
  return (
    <dl className="detail-list">
      {items.map((item) => (
        <div className="detail-item" key={item.label}>
          <dt>{item.label}</dt>
          <dd>
            {item.value === "" ||
            item.value === null ||
            item.value === undefined
              ? "—"
              : item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function ViewToggle({ value, onChange, options }) {
  return (
    <ButtonGroup size="sm" aria-label="Change view">
      {options.map((option) => (
        <Button
          key={option.value}
          variant={value === option.value ? "primary" : "outline-secondary"}
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          title={option.label}
        >
          <Icon name={option.icon} />
          <span className="visually-hidden">{option.label}</span>
        </Button>
      ))}
    </ButtonGroup>
  );
}
