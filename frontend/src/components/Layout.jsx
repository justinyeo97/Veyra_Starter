import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  Dropdown,
  Form,
  Offcanvas,
  Toast,
  ToastContainer,
} from "react-bootstrap";
import {
  Link,
  Navigate,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useApp } from "../context/useApp";
import { globalSearch, isTaskOverdue } from "../utils/calculations";
import { NAV_ITEMS, NOTIFICATION_TYPES } from "../utils/constants";
import { formatRelative } from "../utils/format";
import { Avatar, Icon, SneakerImage } from "./UI";

const YEAR = new Date().getFullYear();

export function BrandMark({ size = 32 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      className="brand-mark"
    >
      <rect width="32" height="32" rx="9" fill="currentColor" />
      <path
        d="M8 10.5h4.2l3.8 9.3 3.8-9.3H24l-6.2 13.5h-3.6L8 10.5Z"
        fill="var(--brand-mark-ink)"
      />
    </svg>
  );
}

export function ProtectedRoute() {
  const { isAuthenticated } = useApp();
  const location = useLocation();
  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }
  return <Outlet />;
}

export function PublicRoute() {
  const { isAuthenticated } = useApp();
  const location = useLocation();
  if (isAuthenticated) {
    const from = location.state?.from;
    const target = from && !from.startsWith("/logout") ? from : "/";
    return <Navigate to={target} replace />;
  }
  return <Outlet />;
}

export function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="auth-page">
      <aside className="auth-aside">
        <div className="d-flex align-items-center gap-2 auth-brand">
          <BrandMark size={36} />
          <span>Veyra</span>
        </div>
        <div>
          <h2 className="auth-aside-title">
            Run your sneaker resale business from one place.
          </h2>
          <ul className="auth-points">
            <li>
              <Icon name="box-seam" /> Track every pair from purchase to
              delivery
            </li>
            <li>
              <Icon name="graph-up-arrow" /> See real profit after fees and
              shipping
            </li>
            <li>
              <Icon name="shop" /> List on Veyra, StockX, GOAT and eBay
            </li>
          </ul>
        </div>
        <p className="auth-aside-foot">© {YEAR} Veyra</p>
      </aside>
      <main className="auth-main">
        <div className="auth-card">
          <div className="d-flex align-items-center gap-2 mb-4 d-lg-none auth-brand-mobile">
            <BrandMark size={32} />
            <span>Veyra</span>
          </div>
          <h1 className="auth-title">{title}</h1>
          {subtitle && <p className="auth-subtitle">{subtitle}</p>}
          {children}
          {footer && <div className="auth-footer">{footer}</div>}
        </div>
      </main>
    </div>
  );
}

function SidebarNav({ onNavigate }) {
  const { data } = useApp();
  const unread = data.notifications.filter(
    (notification) => !notification.read,
  ).length;
  const overdue = data.tasks.filter((task) => isTaskOverdue(task)).length;
  const counts = { "/notifications": unread, "/tasks": overdue };
  return (
    <nav className="sidebar-nav" aria-label="Main">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/"}
          className={({ isActive }) =>
            `sidebar-link ${isActive ? "active" : ""}`
          }
          onClick={onNavigate}
        >
          <Icon name={item.icon} />
          <span className="flex-grow-1">{item.label}</span>
          {counts[item.to] > 0 && (
            <Badge
              pill
              bg={item.to === "/tasks" ? "danger" : "secondary"}
              className="sidebar-count"
            >
              {counts[item.to]}
            </Badge>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function GlobalSearch() {
  const { data } = useApp();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const results = useMemo(() => globalSearch(data, query, 4), [data, query]);

  function go(to) {
    setOpen(false);
    setQuery("");
    navigate(to);
  }

  function submit(event) {
    event.preventDefault();
    if (!query.trim()) return;
    go(`/search?q=${encodeURIComponent(query.trim())}`);
  }

  return (
    <Form className="global-search" role="search" onSubmit={submit}>
      <Icon name="search" className="global-search-icon" />
      <Form.Control
        type="search"
        value={query}
        placeholder="Search sneakers by brand, model or SKU…"
        aria-label="Search inventory"
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            event.currentTarget.blur();
          }
        }}
      />
      {open && query.trim() && (
        <div
          className="search-panel"
          onMouseDown={(event) => event.preventDefault()}
        >
          {results.length === 0 ? (
            <div className="search-empty">
              <Icon name="search" className="me-2" />
              No results for “{query.trim()}”
            </div>
          ) : (
            results.map((group) => (
              <div key={group.key} className="search-group">
                <div className="search-group-label">
                  <Icon name={group.icon} className="me-2" />
                  {group.label}
                  <span className="ms-auto">{group.total}</span>
                </div>
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="search-item"
                    onClick={() => go(item.to)}
                  >
                    {group.key === "inventory" || group.key === "listings" ? (
                      <SneakerImage src={item.image} alt="" variant="mini" />
                    ) : (
                      <span className="search-item-icon">
                        <Icon name={group.icon} />
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="search-item-title">{item.title}</span>
                      <span className="search-item-sub">{item.subtitle}</span>
                    </span>
                  </button>
                ))}
              </div>
            ))
          )}
          <button type="submit" className="search-all">
            See all results for “{query.trim()}”
            <Icon name="arrow-right" className="ms-2" />
          </button>
        </div>
      )}
    </Form>
  );
}

function NotificationMenu() {
  const { data, actions } = useApp();
  const navigate = useNavigate();
  const sorted = useMemo(
    () =>
      [...data.notifications].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      ),
    [data.notifications],
  );
  const unread = sorted.filter((notification) => !notification.read).length;

  function open(notification) {
    actions.markRead(notification.id);
    if (notification.link) navigate(notification.link);
  }

  return (
    <Dropdown align="end" className="notification-menu">
      <Dropdown.Toggle
        as={Button}
        variant="light"
        className="icon-button no-caret"
        aria-label={`Notifications, ${unread} unread`}
      >
        <Icon name="bell" />
        {unread > 0 && (
          <span className="icon-badge">{unread > 9 ? "9+" : unread}</span>
        )}
      </Dropdown.Toggle>
      <Dropdown.Menu className="notification-dropdown">
        <div className="notification-dropdown-head">
          <span className="fw-semibold">Notifications</span>
          <Button
            variant="link"
            size="sm"
            className="p-0"
            disabled={unread === 0}
            onClick={actions.markAllRead}
          >
            Mark all as read
          </Button>
        </div>
        {sorted.length === 0 && (
          <div className="p-4 text-center small text-body-secondary">
            You are all caught up.
          </div>
        )}
        {sorted.slice(0, 6).map((notification) => {
          const meta = NOTIFICATION_TYPES[notification.type] || {
            icon: "bell",
            tone: "gray",
          };
          return (
            <Dropdown.Item
              key={notification.id}
              className={`notification-item ${notification.read ? "" : "unread"}`}
              onClick={() => open(notification)}
            >
              <span className={`notification-icon tone-${meta.tone}`}>
                <Icon name={meta.icon} />
              </span>
              <span className="min-w-0 flex-grow-1">
                <span className="notification-title">{notification.title}</span>
                <span className="notification-text">
                  {notification.message}
                </span>
                <span className="notification-time">
                  {formatRelative(notification.createdAt)}
                </span>
              </span>
              {!notification.read && (
                <span className="unread-dot" aria-label="Unread" />
              )}
            </Dropdown.Item>
          );
        })}
        <Dropdown.Divider className="my-0" />
        <Dropdown.Item
          as={Link}
          to="/notifications"
          className="text-center small fw-semibold py-2"
        >
          View all notifications
        </Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown>
  );
}

function maskEmail(email) {
  if (!email) return "";
  const at = email.indexOf("@");
  if (at <= 0) return email;
  const local = email.slice(0, at);
  return `${local[0]}${"*".repeat(local.length - 1)}${email.slice(at)}`;
}

function ProfileMenu() {
  const { user } = useApp();
  return (
    <Dropdown align="end">
      <Dropdown.Toggle
        as={Button}
        variant="light"
        className="profile-toggle no-caret"
        aria-label="Account menu"
      >
        <Avatar name={user?.name} src={user?.avatar} size={32} />
        <span className="d-none d-xl-inline profile-name">{user?.name}</span>
        <Icon name="chevron-down" className="d-none d-xl-inline small" />
      </Dropdown.Toggle>
      <Dropdown.Menu className="profile-dropdown">
        <div className="px-3 py-2">
          <div className="fw-semibold text-truncate">{user?.name}</div>
          <div className="small text-body-secondary text-truncate">
            {maskEmail(user?.email)}
          </div>
        </div>
        <Dropdown.Divider />
        <Dropdown.Item as={Link} to="/settings">
          <Icon name="person" className="me-2" />
          Profile and settings
        </Dropdown.Item>
        <Dropdown.Item as={Link} to="/notifications">
          <Icon name="bell" className="me-2" />
          Notifications
        </Dropdown.Item>
        <Dropdown.Divider />
        <Dropdown.Item as={Link} to="/logout" className="text-danger">
          <Icon name="box-arrow-right" className="me-2" />
          Log out
        </Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown>
  );
}

function Toasts() {
  const { toasts, dismissToast } = useApp();
  return (
    <ToastContainer
      position="bottom-end"
      className="p-3 toast-stack"
      containerPosition="fixed"
    >
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          onClose={() => dismissToast(toast.id)}
          delay={3500}
          autohide
          bg={toast.variant === "danger" ? "danger" : undefined}
        >
          <Toast.Body className="d-flex align-items-center gap-2">
            <Icon
              name={
                toast.variant === "danger"
                  ? "exclamation-octagon"
                  : "check-circle-fill"
              }
              className={toast.variant === "danger" ? "" : "text-success"}
            />
            <span className="flex-grow-1">{toast.message}</span>
            <button
              type="button"
              className="btn-close btn-close-sm"
              aria-label="Close"
              onClick={() => dismissToast(toast.id)}
            />
          </Toast.Body>
        </Toast>
      ))}
    </ToastContainer>
  );
}

export function AppLayout() {
  const { settings } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="app-shell">
      <aside className="sidebar-wrap">
        <Offcanvas
          show={menuOpen}
          onHide={() => setMenuOpen(false)}
          responsive="lg"
          className="sidebar"
          aria-label="Navigation"
        >
          <Offcanvas.Header closeButton className="sidebar-header">
            <Offcanvas.Title
              as={Link}
              to="/"
              className="sidebar-brand"
              onClick={() => setMenuOpen(false)}
            >
              <BrandMark />
              <span>Veyra</span>
            </Offcanvas.Title>
          </Offcanvas.Header>
          <Offcanvas.Body className="sidebar-body">
            <Link to="/" className="sidebar-brand d-none d-lg-flex">
              <BrandMark />
              <span>Veyra</span>
            </Link>
            <SidebarNav onNavigate={() => setMenuOpen(false)} />
            <div className="sidebar-store">
              <span className="sidebar-store-icon">
                <Icon name="shop-window" />
              </span>
              <div className="min-w-0">
                <div className="small text-body-secondary">Store</div>
                <div className="fw-semibold text-truncate">
                  {settings.store.name}
                </div>
              </div>
            </div>
          </Offcanvas.Body>
        </Offcanvas>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <Button
            variant="light"
            className="icon-button d-lg-none"
            onClick={() => setMenuOpen(true)}
            aria-label="Open navigation"
          >
            <Icon name="list" />
          </Button>
          <div className="topbar-store d-none d-md-flex">
            <Icon name="shop" />
            <span className="text-truncate">{settings.store.name}</span>
          </div>
          <GlobalSearch />
          <div className="topbar-actions">
            <NotificationMenu />
            <ProfileMenu />
          </div>
        </header>
        <main className="app-content">
          <Outlet />
        </main>
      </div>
      <Toasts />
    </div>
  );
}

export function StandaloneShell({ children }) {
  return (
    <>
      {children}
      <Toasts />
    </>
  );
}
