import { useMemo, useState } from "react";
import {
  Button,
  Card,
  Col,
  Dropdown,
  Form,
  Nav,
  Row,
  Tab,
} from "react-bootstrap";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  DataTable,
  RowActions,
  TablePagination,
} from "../components/DataTable";
import { TaskFormModal } from "../components/EntityForms";
import { Field, FormStatus, SubmitButton } from "../components/FormFields";
import { BrandMark } from "../components/Layout";
import {
  Avatar,
  ConfirmModal,
  EmptyState,
  Icon,
  InlineAlert,
  PageHeader,
  SectionCard,
  SneakerImage,
  StatusBadge,
  ViewToggle,
} from "../components/UI";
import { useApp } from "../context/useApp";
import {
  globalSearch,
  indexById,
  isTaskOverdue,
  matchesQuery,
  paginate,
  sortItems,
} from "../utils/calculations";
import {
  CURRENCIES,
  NOTIFICATION_TYPES,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from "../utils/constants";
import {
  addDays,
  formatDate,
  formatDateTime,
  formatRelative,
  sneakerName,
  todayISO,
} from "../utils/format";
import { useForm, wait } from "../utils/validation";

const PRIORITY_RANK = { Urgent: 0, High: 1, Medium: 2, Low: 3 };

const DUE_FILTERS = [
  { key: "", label: "Any due date" },
  { key: "overdue", label: "Overdue" },
  { key: "today", label: "Due today" },
  { key: "week", label: "Due in the next 7 days" },
  { key: "later", label: "Due later" },
];

const TASK_SORTS = [
  {
    key: "due-asc",
    label: "Due soonest",
    get: (task) => task.dueDate,
    direction: "asc",
  },
  {
    key: "due-desc",
    label: "Due latest",
    get: (task) => task.dueDate,
    direction: "desc",
  },
  {
    key: "priority",
    label: "Priority",
    get: (task) => `${PRIORITY_RANK[task.priority]}-${task.dueDate}`,
    direction: "asc",
  },
  {
    key: "created",
    label: "Newest",
    get: (task) => task.createdDate + task.id,
    direction: "desc",
  },
  {
    key: "title",
    label: "Title A–Z",
    get: (task) => task.title.toLowerCase(),
    direction: "asc",
  },
];

function matchesDue(task, due, today) {
  if (!due) return true;
  if (due === "overdue") return isTaskOverdue(task, today);
  if (task.status === "Completed") return false;
  if (due === "today") return task.dueDate === today;
  if (due === "week")
    return task.dueDate > today && task.dueDate <= addDays(today, 7);
  if (due === "later") return task.dueDate > addDays(today, 7);
  return true;
}

function TaskCard({
  task,
  sneaker,
  today,
  onToggle,
  onEdit,
  onDelete,
  onMove,
}) {
  const overdue = isTaskOverdue(task, today);
  return (
    <Card
      className={`task-card ${task.status === "Completed" ? "done" : ""} ${overdue ? "overdue" : ""}`}
    >
      <Card.Body>
        <div className="d-flex gap-2 align-items-start">
          <Form.Check
            className="mt-1"
            checked={task.status === "Completed"}
            onChange={() => onToggle(task)}
            aria-label={
              task.status === "Completed"
                ? `Mark ${task.title} as not done`
                : `Complete ${task.title}`
            }
          />
          <div className="min-w-0 flex-grow-1">
            <button
              type="button"
              className="task-card-title"
              onClick={() => onEdit(task)}
            >
              {task.title}
            </button>
            {task.description && (
              <p className="task-card-text">{task.description}</p>
            )}
          </div>
          <Dropdown align="end">
            <Dropdown.Toggle
              variant="link"
              size="sm"
              className="no-caret p-0 text-body-secondary"
              aria-label={`Actions for ${task.title}`}
            >
              <Icon name="three-dots" />
            </Dropdown.Toggle>
            <Dropdown.Menu>
              <Dropdown.Item onClick={() => onEdit(task)}>
                <Icon name="pencil" className="me-2" />
                Edit
              </Dropdown.Item>
              {TASK_STATUSES.filter((status) => status !== task.status).map(
                (status) => (
                  <Dropdown.Item
                    key={status}
                    onClick={() => onMove(task, status)}
                  >
                    <Icon name="arrow-right-circle" className="me-2" />
                    Move to {status}
                  </Dropdown.Item>
                ),
              )}
              <Dropdown.Divider />
              <Dropdown.Item
                className="text-danger"
                onClick={() => onDelete(task)}
              >
                <Icon name="trash" className="me-2" />
                Delete
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        </div>
        <div className="d-flex flex-wrap gap-2 mt-3 align-items-center">
          <StatusBadge status={task.priority} />
          {overdue && <StatusBadge status="Overdue" />}
          <span
            className={`small ${overdue ? "text-danger fw-semibold" : "text-body-secondary"}`}
          >
            <Icon name="calendar3" className="me-1" />
            {formatDate(task.dueDate)}
          </span>
        </div>
        <div className="d-flex justify-content-between align-items-center mt-3 gap-2">
          <span className="d-flex align-items-center gap-2 small min-w-0">
            <Avatar name={task.assignee} size={24} />
            <span className="text-truncate">{task.assignee}</span>
          </span>
          {sneaker && (
            <Link
              to={`/inventory/${sneaker.id}`}
              className="small text-truncate task-sneaker-link"
            >
              <Icon name="box-seam" className="me-1" />
              {sneaker.sku}
            </Link>
          )}
        </div>
      </Card.Body>
    </Card>
  );
}

export function TasksPage() {
  const { data, actions, notify } = useApp();
  const [params, setParams] = useSearchParams();
  const requestedTask = params.get("task");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [due, setDue] = useState(
    DUE_FILTERS.some((item) => item.key === params.get("due"))
      ? params.get("due")
      : "",
  );
  const [sneakerFilter, setSneakerFilter] = useState("");
  const [sortKey, setSortKey] = useState("due-asc");
  const [view, setView] = useState("list");
  const [editing, setEditing] = useState(() =>
    requestedTask
      ? data.tasks.find((task) => task.id === requestedTask) || null
      : null,
  );
  const [missingTask, setMissingTask] = useState(() =>
    requestedTask && !data.tasks.some((task) => task.id === requestedTask)
      ? requestedTask
      : "",
  );
  const [deleting, setDeleting] = useState(null);
  const today = todayISO();
  const sneakersById = useMemo(() => indexById(data.sneakers), [data.sneakers]);
  const sneakerOptions = useMemo(
    () =>
      data.sneakers.filter((sneaker) =>
        data.tasks.some((task) => task.sneakerId === sneaker.id),
      ),
    [data.sneakers, data.tasks],
  );

  const rows = useMemo(() => {
    const sort = TASK_SORTS.find((item) => item.key === sortKey);
    return sortItems(
      data.tasks.filter(
        (task) =>
          matchesQuery(query, [
            task.title,
            task.description,
            task.assignee,
            task.id,
            sneakersById[task.sneakerId]?.sku,
          ]) &&
          (!status || task.status === status) &&
          (!priority || task.priority === priority) &&
          matchesDue(task, due, today) &&
          (!sneakerFilter ||
            (sneakerFilter === "none"
              ? !task.sneakerId
              : task.sneakerId === sneakerFilter)),
      ),
      sort.get,
      sort.direction,
    );
  }, [
    data.tasks,
    query,
    status,
    priority,
    due,
    sneakerFilter,
    sortKey,
    today,
    sneakersById,
  ]);

  const overdueCount = data.tasks.filter((task) =>
    isTaskOverdue(task, today),
  ).length;
  const openCount = data.tasks.filter(
    (task) => task.status !== "Completed",
  ).length;

  function closeEditor() {
    setEditing(null);
    if (requestedTask) setParams({}, { replace: true });
  }

  function toggle(task) {
    const next = task.status === "Completed" ? "To Do" : "Completed";
    actions.save("task", { ...task, status: next });
    notify(
      next === "Completed"
        ? `"${task.title}" completed.`
        : `"${task.title}" reopened.`,
    );
  }

  function move(task, nextStatus) {
    actions.save("task", { ...task, status: nextStatus });
    notify(`"${task.title}" moved to ${nextStatus}.`);
  }

  function confirmDelete() {
    actions.remove("task", deleting.id);
    notify("Task deleted.");
    setDeleting(null);
  }

  function clearFilters() {
    setQuery("");
    setStatus("");
    setPriority("");
    setDue("");
    setSneakerFilter("");
  }

  const columns = [
    {
      key: "done",
      label: <span className="visually-hidden">Complete</span>,
      render: (task) => (
        <RowActions>
          <Form.Check
            checked={task.status === "Completed"}
            onChange={() => toggle(task)}
            aria-label={
              task.status === "Completed"
                ? `Reopen ${task.title}`
                : `Complete ${task.title}`
            }
          />
        </RowActions>
      ),
    },
    {
      key: "title",
      label: "Task",
      sortValue: (task) => task.title.toLowerCase(),
      render: (task) => (
        <div className="min-w-0">
          <div
            className={`fw-semibold text-truncate table-name ${task.status === "Completed" ? "text-decoration-line-through text-body-secondary" : ""}`}
          >
            {task.title}
          </div>
          <div className="small text-body-secondary text-truncate table-name">
            {task.description || "No description"}
          </div>
        </div>
      ),
    },
    {
      key: "priority",
      label: "Priority",
      sortValue: (task) => PRIORITY_RANK[task.priority],
      render: (task) => <StatusBadge status={task.priority} />,
    },
    {
      key: "status",
      label: "Status",
      hideBelow: "sm",
      render: (task) => <StatusBadge status={task.status} />,
    },
    {
      key: "due",
      label: "Due",
      sortValue: (task) => task.dueDate,
      render: (task) =>
        isTaskOverdue(task, today) ? (
          <span className="text-danger fw-semibold text-nowrap">
            <Icon name="alarm" className="me-1" />
            {formatDate(task.dueDate)}
          </span>
        ) : (
          <span className="text-nowrap">{formatDate(task.dueDate)}</span>
        ),
    },
    {
      key: "assignee",
      label: "Assigned to",
      hideBelow: "lg",
      render: (task) => task.assignee,
    },
    {
      key: "sneaker",
      label: "Sneaker",
      hideBelow: "xl",
      render: (task) =>
        sneakersById[task.sneakerId] ? (
          <RowActions>
            <Link
              to={`/inventory/${task.sneakerId}`}
              className="text-truncate d-inline-block table-name"
            >
              {sneakerName(sneakersById[task.sneakerId])}
            </Link>
          </RowActions>
        ) : (
          <span className="text-body-secondary">—</span>
        ),
    },
    {
      key: "actions",
      label: <span className="visually-hidden">Actions</span>,
      align: "end",
      render: (task) => (
        <RowActions>
          <Button
            size="sm"
            variant="light"
            onClick={() => setEditing(task)}
            title="Edit"
            aria-label={`Edit ${task.title}`}
          >
            <Icon name="pencil" />
          </Button>
          <Button
            size="sm"
            variant="light"
            className="text-danger"
            onClick={() => setDeleting(task)}
            title="Delete"
            aria-label={`Delete ${task.title}`}
          >
            <Icon name="trash" />
          </Button>
        </RowActions>
      ),
    },
  ];

  const empty = (
    <EmptyState
      icon="check2-square"
      title={data.tasks.length ? "No tasks match" : "No tasks yet"}
      message={
        data.tasks.length
          ? "Try a different search or clear the filters."
          : "Create a task to keep track of cleaning, shipping and listing work."
      }
      action={
        data.tasks.length ? (
          <Button variant="outline-secondary" onClick={clearFilters}>
            Clear filters
          </Button>
        ) : (
          <Button variant="primary" onClick={() => setEditing({})}>
            Create task
          </Button>
        )
      }
    />
  );

  return (
    <>
      <PageHeader
        title="Tasks"
        subtitle={`${openCount} open · ${overdueCount} overdue`}
        actions={
          <Button variant="primary" onClick={() => setEditing({})}>
            <Icon name="plus-lg" className="me-1" />
            Create task
          </Button>
        }
      />
      {missingTask && (
        <InlineAlert variant="warning" onClose={() => setMissingTask("")}>
          Task {missingTask} could not be found. It may have been deleted.
        </InlineAlert>
      )}
      <Card className="section-card mb-4">
        <Card.Body>
          <div className="toolbar">
            <div className="toolbar-search">
              <Icon name="search" />
              <Form.Control
                type="search"
                placeholder="Search tasks or assignees"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Search tasks"
              />
            </div>
            <Form.Select
              className="toolbar-filter"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              aria-label="Filter by status"
            >
              <option value="">Any status</option>
              {TASK_STATUSES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </Form.Select>
            <Form.Select
              className="toolbar-filter"
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
              aria-label="Filter by priority"
            >
              <option value="">Any priority</option>
              {TASK_PRIORITIES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </Form.Select>
            <Form.Select
              className="toolbar-filter"
              value={due}
              onChange={(event) => setDue(event.target.value)}
              aria-label="Filter by due date"
            >
              {DUE_FILTERS.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </Form.Select>
            <Form.Select
              className="toolbar-filter"
              value={sneakerFilter}
              onChange={(event) => setSneakerFilter(event.target.value)}
              aria-label="Filter by related sneaker"
            >
              <option value="">Any sneaker</option>
              <option value="none">No related sneaker</option>
              {sneakerOptions.map((sneaker) => (
                <option key={sneaker.id} value={sneaker.id}>
                  {sneakerName(sneaker)}
                </option>
              ))}
            </Form.Select>
            <Form.Select
              className="toolbar-sort"
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value)}
              aria-label="Sort tasks"
            >
              {TASK_SORTS.map((item) => (
                <option key={item.key} value={item.key}>
                  Sort: {item.label}
                </option>
              ))}
            </Form.Select>
            <ViewToggle
              value={view}
              onChange={setView}
              options={[
                { value: "list", label: "List view", icon: "list-check" },
                { value: "board", label: "Board view", icon: "kanban" },
              ]}
            />
          </div>
        </Card.Body>
      </Card>

      {view === "list" ? (
        <SectionCard flush>
          <DataTable
            key={JSON.stringify([
              query,
              status,
              priority,
              due,
              sneakerFilter,
              sortKey,
            ])}
            columns={columns}
            rows={rows}
            onRowClick={setEditing}
            label="tasks"
            empty={<div className="p-3">{empty}</div>}
          />
        </SectionCard>
      ) : rows.length === 0 ? (
        <SectionCard>{empty}</SectionCard>
      ) : (
        <Row className="g-3">
          {TASK_STATUSES.map((column) => {
            const tasks = rows.filter((task) => task.status === column);
            return (
              <Col key={column} lg={4}>
                <div className="board-column">
                  <div className="board-column-head">
                    <StatusBadge status={column} />
                    <span className="small text-body-secondary">
                      {tasks.length}
                    </span>
                  </div>
                  <div className="d-grid gap-2">
                    {tasks.length === 0 && (
                      <div className="board-empty">No tasks</div>
                    )}
                    {tasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        sneaker={sneakersById[task.sneakerId]}
                        today={today}
                        onToggle={toggle}
                        onEdit={setEditing}
                        onDelete={setDeleting}
                        onMove={move}
                      />
                    ))}
                  </div>
                </div>
              </Col>
            );
          })}
        </Row>
      )}

      {editing && <TaskFormModal record={editing} onHide={closeEditor} />}
      <ConfirmModal
        show={Boolean(deleting)}
        title="Delete this task?"
        message={deleting ? `"${deleting.title}" will be removed.` : ""}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}

export function NotificationsPage() {
  const { data, actions } = useApp();
  const navigate = useNavigate();
  const [filter, setFilter] = useState("all");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);

  const sorted = useMemo(
    () =>
      [...data.notifications].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      ),
    [data.notifications],
  );
  const rows = sorted.filter(
    (notification) =>
      (filter === "all" || !notification.read) &&
      (!type || notification.type === type),
  );
  const view = paginate(rows, page, 10);
  const unread = sorted.filter((notification) => !notification.read).length;

  function open(notification) {
    actions.markRead(notification.id);
    if (notification.link) navigate(notification.link);
  }

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle={unread ? `${unread} unread` : "You are all caught up."}
        actions={
          <Button
            variant="outline-secondary"
            onClick={actions.markAllRead}
            disabled={unread === 0}
          >
            <Icon name="check2-all" className="me-1" />
            Mark all as read
          </Button>
        }
      />
      <Card className="section-card mb-4">
        <Card.Body className="d-flex flex-wrap gap-2 align-items-center justify-content-between">
          <div
            className="segmented"
            role="tablist"
            aria-label="Notification filter"
          >
            {[
              { key: "all", label: "All", count: sorted.length },
              { key: "unread", label: "Unread", count: unread },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={filter === item.key}
                className={filter === item.key ? "active" : ""}
                onClick={() => {
                  setFilter(item.key);
                  setPage(1);
                }}
              >
                {item.label}
                <span className="segmented-count">{item.count}</span>
              </button>
            ))}
          </div>
          <Form.Select
            className="toolbar-filter"
            value={type}
            onChange={(event) => {
              setType(event.target.value);
              setPage(1);
            }}
            aria-label="Filter by type"
          >
            <option value="">All types</option>
            {Object.entries(NOTIFICATION_TYPES).map(([key, meta]) => (
              <option key={key} value={key}>
                {meta.label}
              </option>
            ))}
          </Form.Select>
        </Card.Body>
      </Card>
      <SectionCard flush>
        {rows.length === 0 ? (
          <div className="p-3">
            <EmptyState
              icon="bell-slash"
              title={
                filter === "unread"
                  ? "No unread notifications"
                  : "No notifications"
              }
              message="New orders, sold-out sneakers, failed payments and overdue tasks show up here."
            />
          </div>
        ) : (
          <>
            <div className="list-rows">
              {view.items.map((notification) => {
                const meta = NOTIFICATION_TYPES[notification.type] || {
                  icon: "bell",
                  tone: "gray",
                  label: "Notification",
                };
                return (
                  <div
                    key={notification.id}
                    className={`list-row notification-row ${notification.read ? "" : "unread"}`}
                  >
                    <span className={`list-icon tone-${meta.tone}`}>
                      <Icon name={meta.icon} />
                    </span>
                    <button
                      type="button"
                      className="notification-row-body"
                      onClick={() => open(notification)}
                    >
                      <span className="d-flex flex-wrap align-items-center gap-2">
                        <span className="fw-semibold">
                          {notification.title}
                        </span>
                        <span className="platform-badge">{meta.label}</span>
                      </span>
                      <span className="d-block small text-body-secondary mt-1">
                        {notification.message}
                      </span>
                      <span
                        className="d-block small text-body-secondary mt-1"
                        title={formatDateTime(notification.createdAt)}
                      >
                        {formatRelative(notification.createdAt)}
                      </span>
                    </button>
                    <Button
                      size="sm"
                      variant="light"
                      onClick={() =>
                        actions.markRead(notification.id, !notification.read)
                      }
                      title={
                        notification.read ? "Mark as unread" : "Mark as read"
                      }
                      aria-label={
                        notification.read
                          ? `Mark ${notification.title} as unread`
                          : `Mark ${notification.title} as read`
                      }
                    >
                      <Icon
                        name={notification.read ? "envelope" : "envelope-open"}
                      />
                    </Button>
                  </div>
                );
              })}
            </div>
            <TablePagination
              page={view.page}
              pageCount={view.pageCount}
              total={rows.length}
              pageSize={10}
              onChange={setPage}
              label="notifications"
            />
          </>
        )}
      </SectionCard>
    </>
  );
}

function SettingsForm({
  form,
  children,
  onCancel,
  submitLabel = "Save changes",
}) {
  return (
    <Form noValidate onSubmit={form.handleSubmit}>
      {children}
      <FormStatus form={form} />
      <div className="d-flex gap-2 justify-content-end border-top pt-3 mt-2">
        <Button
          variant="outline-secondary"
          onClick={onCancel}
          disabled={form.submitting}
        >
          Cancel
        </Button>
        <SubmitButton form={form}>{submitLabel}</SubmitButton>
      </div>
    </Form>
  );
}

function ProfileSettings() {
  const { user, actions, notify } = useApp();
  const [fileError, setFileError] = useState("");
  const saved = {
    name: user?.name || "",
    email: user?.email || "",
    avatar: user?.avatar || "",
  };
  const form = useForm({
    initialValues: saved,
    rules: {
      name: { required: true, label: "Name", minLength: 2, maxLength: 80 },
      email: { required: true, type: "email", label: "Email" },
      avatar: { type: "url", label: "Profile image" },
    },
    onSubmit: async (values) => {
      await wait();
      await actions.updateProfile(values);
      notify("Profile saved.");
    },
  });

  function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    setFileError("");
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setFileError("Choose an image file (JPG, PNG, WebP or GIF).");
      return;
    }
    if (file.size > 1024 * 1024) {
      setFileError("Choose an image smaller than 1 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => form.setValue("avatar", String(reader.result));
    reader.onerror = () =>
      setFileError("That image could not be read. Try another file.");
    reader.readAsDataURL(file);
  }

  return (
    <SettingsForm form={form} onCancel={() => form.reset(saved)}>
      <div className="d-flex align-items-center gap-3 mb-4 flex-wrap">
        <Avatar name={form.values.name} src={form.values.avatar} size={72} />
        <div>
          <Form.Label
            htmlFor="avatar-file"
            className="btn btn-outline-secondary btn-sm mb-0"
          >
            <Icon name="upload" className="me-1" />
            Upload photo
          </Form.Label>
          <Form.Control
            id="avatar-file"
            type="file"
            accept="image/*"
            className="d-none"
            onChange={handleFile}
          />
          {form.values.avatar && (
            <Button
              variant="link"
              size="sm"
              className="text-danger"
              onClick={() => form.setValue("avatar", "")}
            >
              Remove
            </Button>
          )}
          <div className="small text-body-secondary mt-1">
            JPG, PNG or WebP, up to 1 MB.
          </div>
          {fileError && (
            <div className="small text-danger mt-1">{fileError}</div>
          )}
        </div>
      </div>
      <Row>
        <Col md={6}>
          <Field
            form={form}
            name="name"
            label="Name"
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
            help="You log in with this email."
          />
        </Col>
      </Row>
      <Field
        form={form}
        name="avatar"
        label="Profile image URL"
        placeholder="https://"
        help="Or paste a link to an image."
        onChange={(event) => form.setValue("avatar", event.target.value)}
        disabled={form.values.avatar.startsWith("data:")}
      />
    </SettingsForm>
  );
}

function StoreSettings() {
  const { settings, actions, notify } = useApp();
  const saved = {
    name: settings.store.name,
    description: settings.store.description,
    currency: settings.store.currency,
    shippingFee: String(settings.store.shippingFee),
    platformFee: String(settings.store.platformFee),
  };
  const form = useForm({
    initialValues: saved,
    rules: {
      name: {
        required: true,
        label: "Store name",
        minLength: 2,
        maxLength: 60,
      },
      description: { label: "Store description", maxLength: 300 },
      currency: { required: true, label: "Currency" },
      shippingFee: {
        required: true,
        type: "number",
        min: 0,
        max: 1000,
        label: "Default shipping fee",
      },
      platformFee: {
        required: true,
        type: "number",
        min: 0,
        max: 50,
        label: "Default platform fee",
      },
    },
    onSubmit: async (values) => {
      await wait();
      actions.saveSettings("store", {
        name: values.name.trim(),
        description: values.description.trim(),
        currency: values.currency,
        shippingFee: Number(values.shippingFee),
        platformFee: Number(values.platformFee),
      });
      notify("Store settings saved.");
    },
  });
  return (
    <SettingsForm form={form} onCancel={() => form.reset(saved)}>
      <Field form={form} name="name" label="Store name" required />
      <Field
        form={form}
        name="description"
        label="Store description"
        as="textarea"
        rows={3}
        help="Shown on your customer-facing listing pages."
      />
      <Row>
        <Col md={4}>
          <Field
            form={form}
            name="currency"
            label="Currency"
            as="select"
            options={CURRENCIES.map((item) => ({
              value: item.code,
              label: item.label,
            }))}
            required
          />
        </Col>
        <Col md={4}>
          <Field
            form={form}
            name="shippingFee"
            label="Default shipping fee"
            type="number"
            min="0"
            step="0.01"
            required
            help="Used for new orders and estimates."
          />
        </Col>
        <Col md={4}>
          <Field
            form={form}
            name="platformFee"
            label="Default platform fee"
            type="number"
            min="0"
            max="50"
            step="0.1"
            suffix="%"
            required
            help="Percentage of the sale price."
          />
        </Col>
      </Row>
    </SettingsForm>
  );
}

function NotificationSettings() {
  const { settings, actions, notify } = useApp();
  const saved = { ...settings.notifications };
  const form = useForm({
    initialValues: saved,
    rules: {},
    onSubmit: async (values) => {
      await wait();
      actions.saveSettings("notifications", values);
      notify("Notification settings saved.");
    },
  });
  const options = [
    {
      name: "orders",
      label: "Order notifications",
      help: "New orders and paid orders that have not shipped.",
    },
    {
      name: "inventory",
      label: "Inventory notifications",
      help: "Low stock and sneakers that sell out.",
    },
    {
      name: "tasks",
      label: "Task notifications",
      help: "Tasks that pass their due date.",
    },
    {
      name: "payments",
      label: "Payment notifications",
      help: "Payments that fail.",
    },
  ];
  return (
    <SettingsForm form={form} onCancel={() => form.reset(saved)}>
      {options.map((option) => (
        <div key={option.name} className="setting-toggle">
          <div>
            <div className="fw-semibold">{option.label}</div>
            <div className="small text-body-secondary">{option.help}</div>
          </div>
          <Form.Check
            type="switch"
            id={`toggle-${option.name}`}
            name={option.name}
            checked={Boolean(form.values[option.name])}
            onChange={form.handleChange}
            aria-label={option.label}
            disabled={form.submitting}
          />
        </div>
      ))}
    </SettingsForm>
  );
}

function AppearanceSettings() {
  const { settings, actions, notify } = useApp();
  const saved = { theme: settings.theme };
  const form = useForm({
    initialValues: saved,
    rules: { theme: { required: true, label: "Theme" } },
    onSubmit: async (values) => {
      await wait(300);
      actions.saveSettings("theme", values.theme);
      notify(`${values.theme === "dark" ? "Dark" : "Light"} mode on.`);
    },
  });
  return (
    <SettingsForm form={form} onCancel={() => form.reset(saved)}>
      <Row className="g-3 mb-3" role="radiogroup" aria-label="Theme">
        {[
          { value: "light", label: "Light mode", icon: "sun" },
          { value: "dark", label: "Dark mode", icon: "moon-stars" },
        ].map((option) => (
          <Col sm={6} key={option.value}>
            <label
              className={`theme-option ${form.values.theme === option.value ? "selected" : ""}`}
            >
              <input
                type="radio"
                name="theme"
                value={option.value}
                checked={form.values.theme === option.value}
                onChange={form.handleChange}
                className="visually-hidden"
              />
              <span className={`theme-swatch theme-swatch-${option.value}`}>
                <span />
                <span />
                <span />
              </span>
              <span className="d-flex align-items-center gap-2 fw-semibold mt-2">
                <Icon name={option.icon} />
                {option.label}
                {form.values.theme === option.value && (
                  <Icon name="check-circle-fill" className="ms-auto" />
                )}
              </span>
            </label>
          </Col>
        ))}
      </Row>
    </SettingsForm>
  );
}

function DataSettings() {
  const { actions, notify } = useApp();
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <p className="text-body-secondary">
        Veyra saves everything in this browser&apos;s local storage. Resetting
        replaces your inventory, orders, customers, tasks, listings and
        notifications with fresh demo data. Your account and settings stay.
      </p>
      <Button variant="outline-danger" onClick={() => setConfirming(true)}>
        <Icon name="arrow-counterclockwise" className="me-1" />
        Reset demo data
      </Button>
      <ConfirmModal
        show={confirming}
        title="Reset all store data?"
        message="Every change you made to inventory, orders, customers, tasks, listings and notifications will be replaced with the demo data."
        confirmLabel="Reset data"
        onConfirm={async () => {
          await wait(400);
          actions.resetDemoData();
          notify("Demo data restored.");
          setConfirming(false);
        }}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}

export function SettingsPage() {
  const sections = [
    {
      key: "profile",
      label: "Profile",
      icon: "person",
      title: "Profile",
      subtitle: "Your name, email and photo.",
      body: <ProfileSettings />,
    },
    {
      key: "store",
      label: "Store",
      icon: "shop",
      title: "Store",
      subtitle: "Your store details and default fees.",
      body: <StoreSettings />,
    },
    {
      key: "notifications",
      label: "Notifications",
      icon: "bell",
      title: "Notifications",
      subtitle: "Choose which alerts Veyra creates.",
      body: <NotificationSettings />,
    },
    {
      key: "appearance",
      label: "Appearance",
      icon: "palette",
      title: "Appearance",
      subtitle: "Choose light or dark mode.",
      body: <AppearanceSettings />,
    },
    {
      key: "data",
      label: "Data",
      icon: "database",
      title: "Data",
      subtitle: "Manage the data stored in this browser.",
      body: <DataSettings />,
    },
  ];
  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Manage your profile, store and preferences."
      />
      <Tab.Container defaultActiveKey="profile" mountOnEnter unmountOnExit>
        <Row className="g-4">
          <Col md={3}>
            <Nav variant="pills" className="flex-md-column settings-nav">
              {sections.map((section) => (
                <Nav.Item key={section.key}>
                  <Nav.Link eventKey={section.key}>
                    <Icon name={section.icon} className="me-2" />
                    {section.label}
                  </Nav.Link>
                </Nav.Item>
              ))}
            </Nav>
          </Col>
          <Col md={9}>
            <Tab.Content>
              {sections.map((section) => (
                <Tab.Pane key={section.key} eventKey={section.key}>
                  <SectionCard
                    title={section.title}
                    subtitle={section.subtitle}
                  >
                    {section.body}
                  </SectionCard>
                </Tab.Pane>
              ))}
            </Tab.Content>
          </Col>
        </Row>
      </Tab.Container>
    </>
  );
}

export function SearchPage() {
  const { data } = useApp();
  const [params, setParams] = useSearchParams();
  const query = params.get("q") || "";
  const [text, setText] = useState(query);
  const groups = useMemo(() => globalSearch(data, query, 0), [data, query]);
  const total = groups.reduce((sum, group) => sum + group.total, 0);

  function submit(event) {
    event.preventDefault();
    setParams(text.trim() ? { q: text.trim() } : {});
  }

  return (
    <>
      <PageHeader
        title="Search"
        subtitle={
          query
            ? `${total} results for “${query}”`
            : "Search inventory by sneaker brand, model, SKU, colorway or status."
        }
      />
      <Form onSubmit={submit} className="mb-4" role="search">
        <div className="toolbar-search search-page-input">
          <Icon name="search" />
          <Form.Control
            type="search"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Search inventory"
            aria-label="Search inventory"
          />
          <Button type="submit" variant="primary">
            Search
          </Button>
        </div>
      </Form>
      {!query ? (
        <SectionCard>
          <EmptyState
            icon="search"
            title="Start typing to search"
            message="Try a sneaker brand, model, SKU, colorway or status."
          />
        </SectionCard>
      ) : groups.length === 0 ? (
        <SectionCard>
          <EmptyState
            icon="search"
            title="No results"
            message={`Nothing matched “${query}”. Check the spelling or try a shorter search.`}
          />
        </SectionCard>
      ) : (
        <Row className="g-4">
          {groups.map((group) => (
            <Col lg={6} key={group.key}>
              <SectionCard
                title={group.label}
                subtitle={`${group.total} ${group.total === 1 ? "result" : "results"}`}
                flush
              >
                <div className="list-rows">
                  {group.items.map((item) => (
                    <Link key={item.id} to={item.to} className="list-row">
                      {group.key === "inventory" || group.key === "listings" ? (
                        <SneakerImage src={item.image} alt="" />
                      ) : (
                        <span className="list-icon tone-gray">
                          <Icon name={group.icon} />
                        </span>
                      )}
                      <div className="min-w-0 flex-grow-1">
                        <div className="fw-semibold text-truncate">
                          {item.title}
                        </div>
                        <div className="small text-body-secondary text-truncate">
                          {item.subtitle}
                        </div>
                      </div>
                      <Icon
                        name="chevron-right"
                        className="text-body-secondary"
                      />
                    </Link>
                  ))}
                </div>
              </SectionCard>
            </Col>
          ))}
        </Row>
      )}
    </>
  );
}

export function NotFoundPage() {
  const { isAuthenticated } = useApp();
  return (
    <div className="not-found">
      <div className="not-found-card">
        <BrandMark size={44} />
        <div className="not-found-code">404</div>
        <h1 className="h3">Page not found</h1>
        <p className="text-body-secondary">
          The page you are looking for does not exist or has moved.
        </p>
        <div className="d-flex gap-2 justify-content-center flex-wrap">
          <Button
            as={Link}
            to={isAuthenticated ? "/" : "/login"}
            variant="primary"
          >
            {isAuthenticated ? "Go to dashboard" : "Go to log in"}
          </Button>
          {isAuthenticated && (
            <Button as={Link} to="/inventory" variant="outline-secondary">
              View inventory
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
