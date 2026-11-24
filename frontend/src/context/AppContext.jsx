import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { Button, Spinner } from "react-bootstrap";
import { AppContext } from "./useApp";
import { createDefaultSettings, createDemoData } from "../data/demoData";
import { api, ApiError, getToken, setToken } from "../services/api";
import { NOTIFICATION_TYPES } from "../utils/constants";
import {
  daysBetween,
  formatMoney,
  nowISO,
  sneakerName,
  todayISO,
} from "../utils/format";
import { isSale, isTaskOverdue } from "../utils/calculations";

const COLLECTIONS = {
  sneaker: { key: "sneakers", prefix: "SNK" },
  order: { key: "orders", prefix: "ORD" },
  customer: { key: "customers", prefix: "CUS" },
  task: { key: "tasks", prefix: "TSK" },
  listing: { key: "listings", prefix: "LST" },
  notification: { key: "notifications", prefix: "NTF" },
};

function nextId(prefix, items) {
  const highest = items.reduce((max, item) => {
    const number = Number(String(item.id).split("-").pop());
    return Number.isFinite(number) ? Math.max(max, number) : max;
  }, 1000);
  return `${prefix}-${highest + 1}`;
}

const DATA_KEYS = Object.values(COLLECTIONS).map(({ key }) => key);

function emptyData() {
  return Object.fromEntries(DATA_KEYS.map((key) => [key, []]));
}

function diffData(previous, next) {
  const changes = {};
  DATA_KEYS.forEach((key) => {
    const before = previous[key] || [];
    const after = next[key] || [];
    if (before === after) return;
    const beforeById = new Map(before.map((item) => [item.id, item]));
    const afterIds = new Set(after.map((item) => item.id));
    const upsert = after.filter((item) => {
      const old = beforeById.get(item.id);
      return old !== item && JSON.stringify(old) !== JSON.stringify(item);
    });
    const remove = before
      .filter((item) => !afterIds.has(item.id))
      .map((item) => item.id);
    if (upsert.length || remove.length) {
      changes[key] = { upsert, delete: remove };
    }
  });
  return Object.keys(changes).length ? changes : null;
}

function addNotification(data, settings, { type, title, message, link, key }) {
  const meta = NOTIFICATION_TYPES[type];
  if (meta && settings.notifications[meta.category] === false) return data;
  if (
    key &&
    data.notifications.some((notification) => notification.key === key)
  )
    return data;
  const notification = {
    id: nextId("NTF", data.notifications),
    key: key || `${type}-${Date.now()}`,
    type,
    title,
    message,
    link,
    read: false,
    createdAt: nowISO(),
  };
  return { ...data, notifications: [notification, ...data.notifications] };
}

function syncAutomaticNotifications(data, settings) {
  const today = todayISO();
  let next = data;
  data.tasks
    .filter((task) => isTaskOverdue(task, today))
    .forEach((task) => {
      next = addNotification(next, settings, {
        type: "overdue-task",
        key: `overdue-${task.id}-${task.dueDate}`,
        title: `Overdue: ${task.title}`,
        message: `This ${task.priority.toLowerCase()} priority task was due ${task.dueDate}.`,
        link: `/tasks?task=${task.id}`,
      });
    });
  data.orders
    .filter((order) => isSale(order) && order.shippingStatus === "Processing")
    .filter((order) => (daysBetween(order.orderDate, today) ?? 0) >= 2)
    .forEach((order) => {
      next = addNotification(next, settings, {
        type: "unshipped-order",
        key: `unshipped-${order.id}`,
        title: `${order.id} has not shipped`,
        message: `This paid order has been waiting ${daysBetween(order.orderDate, today)} days for shipping.`,
        link: `/orders/${order.id}`,
      });
    });
  return next;
}

function withStatus(sneaker, status, note) {
  if (status === sneaker.status && !note) return sneaker;
  const entry = {
    id: `${(sneaker.history?.length || 0) + 1}-${Date.now()}`,
    status,
    date: nowISO(),
    note: note || `Status changed from ${sneaker.status} to ${status}.`,
  };
  return { ...sneaker, status, history: [...(sneaker.history || []), entry] };
}

function replaceItem(items, item) {
  return items.map((current) => (current.id === item.id ? item : current));
}

function sellOne(data, settings, order) {
  const sneaker = data.sneakers.find((item) => item.id === order.sneakerId);
  if (!sneaker) return data;
  const quantity = Math.max(0, Number(sneaker.quantity) - 1);
  const shipped =
    order.shippingStatus === "Shipped" || order.shippingStatus === "Delivered";
  const status =
    quantity === 0 ? (shipped ? "Shipped" : "Sold") : sneaker.status;
  const note =
    quantity === 0
      ? `Last pair sold via ${order.id}.`
      : `1 pair sold via ${order.id}. ${quantity} left in stock.`;
  const updated = withStatus({ ...sneaker, quantity }, status, note);
  let next = { ...data, sneakers: replaceItem(data.sneakers, updated) };
  if (quantity === 0) {
    next = {
      ...next,
      listings: next.listings.map((listing) =>
        listing.sneakerId === sneaker.id && listing.status === "Active"
          ? { ...listing, status: "Sold" }
          : listing,
      ),
    };
    next = addNotification(next, settings, {
      type: "sold-sneaker",
      key: `sold-${sneaker.id}-${order.id}`,
      title: `Sold out: ${sneakerName(sneaker)}`,
      message: `Your last pair of ${sneaker.sku || sneakerName(sneaker)} sold via ${order.id}.`,
      link: `/inventory/${sneaker.id}`,
    });
  } else if (quantity <= 2) {
    next = addNotification(next, settings, {
      type: "low-inventory",
      key: `low-${sneaker.id}-${order.id}`,
      title: `Low stock: ${sneakerName(sneaker)}`,
      message: `Only ${quantity} ${quantity === 1 ? "pair" : "pairs"} of ${sneaker.sku || sneakerName(sneaker)} left.`,
      link: `/inventory/${sneaker.id}`,
    });
  }
  return next;
}

function restockOne(data, order) {
  const sneaker = data.sneakers.find((item) => item.id === order.sneakerId);
  if (!sneaker) return data;
  const quantity = Number(sneaker.quantity) + 1;
  const status =
    sneaker.status === "Sold" || sneaker.status === "Shipped"
      ? "Listed"
      : sneaker.status;
  const updated = withStatus(
    { ...sneaker, quantity },
    status,
    `1 pair returned to stock from ${order.id}.`,
  );
  return {
    ...data,
    sneakers: replaceItem(data.sneakers, updated),
    listings: data.listings.map((listing) =>
      listing.sneakerId === sneaker.id &&
      listing.status === "Sold" &&
      sneaker.quantity === 0
        ? { ...listing, status: "Active" }
        : listing,
    ),
  };
}

function syncShipping(data, order) {
  const sneaker = data.sneakers.find((item) => item.id === order.sneakerId);
  if (!sneaker || Number(sneaker.quantity) > 0) return data;
  const shipped =
    order.shippingStatus === "Shipped" || order.shippingStatus === "Delivered";
  if (shipped && sneaker.status === "Sold") {
    return {
      ...data,
      sneakers: replaceItem(
        data.sneakers,
        withStatus(sneaker, "Shipped", `${order.id} handed to the courier.`),
      ),
    };
  }
  if (!shipped && sneaker.status === "Shipped") {
    return {
      ...data,
      sneakers: replaceItem(
        data.sneakers,
        withStatus(sneaker, "Sold", `${order.id} moved back to processing.`),
      ),
    };
  }
  return data;
}

function saveOrder(data, settings, input) {
  const existing = data.orders.find((order) => order.id === input.id);
  const sneaker = data.sneakers.find((item) => item.id === input.sneakerId);
  const order = {
    ...existing,
    ...input,
    id: existing?.id || nextId("ORD", data.orders),
    purchasePrice:
      existing && existing.sneakerId === input.sneakerId
        ? existing.purchasePrice
        : Number(sneaker?.purchasePrice) || 0,
    sneakerLabel: sneaker
      ? sneakerName(sneaker)
      : existing?.sneakerLabel || "Deleted sneaker",
  };
  const wasApplied = Boolean(existing?.inventoryApplied);
  const willApply = isSale(order);
  let next = data;
  if (wasApplied && willApply && existing.sneakerId === order.sneakerId) {
    next = syncShipping(next, order);
  } else {
    if (wasApplied) next = restockOne(next, existing);
    if (willApply) {
      next = sellOne(next, settings, order);
      next = syncShipping(next, order);
    }
  }
  order.inventoryApplied = willApply;
  next = {
    ...next,
    orders: existing
      ? replaceItem(next.orders, order)
      : [order, ...next.orders],
  };
  const customer = next.customers.find((item) => item.id === order.customerId);
  if (!existing) {
    next = addNotification(next, settings, {
      type: "new-order",
      key: `new-${order.id}`,
      title: `New order ${order.id}`,
      message: `${customer?.name || "A customer"} ordered the ${order.sneakerLabel} for ${formatMoney(order.salePrice, settings.store.currency)}.`,
      link: `/orders/${order.id}`,
    });
  }
  if (
    order.paymentStatus === "Failed" &&
    existing?.paymentStatus !== "Failed"
  ) {
    next = addNotification(next, settings, {
      type: "failed-payment",
      key: `failed-${order.id}-${Date.now()}`,
      title: `Payment failed for ${order.id}`,
      message: `${customer?.name || "The customer"}'s payment for the ${order.sneakerLabel} did not go through.`,
      link: `/orders/${order.id}`,
    });
  }
  return { data: next, id: order.id };
}

function saveSneaker(data, input) {
  const existing = data.sneakers.find((item) => item.id === input.id);
  if (!existing) {
    const id = nextId("SNK", data.sneakers);
    const sneaker = {
      ...input,
      id,
      listingDate:
        input.listingDate || (input.status === "Listed" ? todayISO() : ""),
      createdAt: nowISO(),
      history: [
        {
          id: "1",
          status: input.status,
          date: nowISO(),
          note: `Added to inventory as ${input.status}.`,
        },
      ],
    };
    return { data: { ...data, sneakers: [sneaker, ...data.sneakers] }, id };
  }
  let sneaker = { ...existing, ...input, history: existing.history || [] };
  if (input.status !== existing.status) {
    sneaker = withStatus({ ...sneaker, status: existing.status }, input.status);
  }
  if (sneaker.status === "Listed" && !sneaker.listingDate)
    sneaker.listingDate = todayISO();
  return {
    data: { ...data, sneakers: replaceItem(data.sneakers, sneaker) },
    id: sneaker.id,
  };
}

function saveListing(data, input) {
  const existing = data.listings.find((item) => item.id === input.id);
  const listing = {
    ...existing,
    ...input,
    id: existing?.id || nextId("LST", data.listings),
  };
  let next = {
    ...data,
    listings: existing
      ? replaceItem(data.listings, listing)
      : [listing, ...data.listings],
  };
  const sneaker = next.sneakers.find((item) => item.id === listing.sneakerId);
  if (
    sneaker &&
    listing.status === "Active" &&
    ["Purchased", "Cleaning", "Ready to List"].includes(sneaker.status)
  ) {
    const updated = withStatus(
      {
        ...sneaker,
        listingDate: sneaker.listingDate || listing.dateListed || todayISO(),
      },
      "Listed",
      `Listed on ${listing.platform} at ${listing.price}.`,
    );
    next = { ...next, sneakers: replaceItem(next.sneakers, updated) };
  }
  return { data: next, id: listing.id };
}

function saveSimple(data, kind, input) {
  const { key, prefix } = COLLECTIONS[kind];
  const existing = data[key].find((item) => item.id === input.id);
  const item = {
    ...existing,
    ...input,
    id: existing?.id || nextId(prefix, data[key]),
  };
  return {
    data: {
      ...data,
      [key]: existing ? replaceItem(data[key], item) : [item, ...data[key]],
    },
    id: item.id,
  };
}

function deleteRecord(data, kind, id) {
  if (kind === "sneaker") {
    return {
      ...data,
      sneakers: data.sneakers.filter((item) => item.id !== id),
      listings: data.listings.filter((item) => item.sneakerId !== id),
      tasks: data.tasks.map((task) =>
        task.sneakerId === id ? { ...task, sneakerId: "" } : task,
      ),
    };
  }
  if (kind === "order") {
    const order = data.orders.find((item) => item.id === id);
    const next = order?.inventoryApplied ? restockOne(data, order) : data;
    return { ...next, orders: next.orders.filter((item) => item.id !== id) };
  }
  const { key } = COLLECTIONS[kind];
  return { ...data, [key]: data[key].filter((item) => item.id !== id) };
}

function runDataAction(data, settings, action) {
  switch (action.type) {
    case "save": {
      if (action.kind === "sneaker") return saveSneaker(data, action.record);
      if (action.kind === "order")
        return saveOrder(data, settings, action.record);
      if (action.kind === "listing") return saveListing(data, action.record);
      return saveSimple(data, action.kind, action.record);
    }
    case "delete":
      return { data: deleteRecord(data, action.kind, action.id) };
    case "notification/read":
      return {
        data: {
          ...data,
          notifications: data.notifications.map((item) =>
            action.ids.includes(item.id)
              ? { ...item, read: action.read ?? true }
              : item,
          ),
        },
      };
    case "notification/readAll":
      return {
        data: {
          ...data,
          notifications: data.notifications.map((item) => ({
            ...item,
            read: true,
          })),
        },
      };
    case "sneaker/image":
      return {
        data: {
          ...data,
          sneakers: data.sneakers.map((item) =>
            action.images[item.id]
              ? { ...item, image: action.images[item.id] }
              : item,
          ),
        },
      };
    case "reset":
      return { data: createDemoData() };
    default:
      return { data };
  }
}

function reducer(state, action) {
  if (action.scope === "data") {
    const result = runDataAction(state.data, state.settings, action);
    return {
      ...state,
      data: syncAutomaticNotifications(result.data, state.settings),
      lastSavedId: result.id,
    };
  }
  if (action.type === "settings/save") {
    const settings = { ...state.settings, [action.section]: action.values };
    return {
      ...state,
      settings,
      data: syncAutomaticNotifications(state.data, settings),
    };
  }
  if (action.type === "session/loaded") {
    return {
      ...state,
      status: "ready",
      error: "",
      user: action.user,
      settings: action.settings,
      data: syncAutomaticNotifications(action.data, action.settings),
    };
  }
  if (action.type === "session/cleared") {
    return { ...state, status: "ready", error: "", user: null, data: emptyData() };
  }
  if (action.type === "session/failed") {
    return { ...state, status: "error", error: action.error };
  }
  if (action.type === "session/loading") {
    return { ...state, status: "loading", error: "" };
  }
  if (action.type === "user/update") {
    return { ...state, user: action.user };
  }
  return state;
}

function initState() {
  return {
    status: getToken() ? "loading" : "ready",
    error: "",
    data: emptyData(),
    settings: createDefaultSettings(),
    user: null,
    lastSavedId: null,
  };
}

function LoadingScreen() {
  return (
    <div className="d-flex align-items-center justify-content-center min-vh-100 gap-2 text-body-secondary">
      <Spinner animation="border" size="sm" />
      Loading your store…
    </div>
  );
}

function ErrorScreen({ message, onRetry, onLogout }) {
  return (
    <div className="d-flex align-items-center justify-content-center min-vh-100 p-4">
      <div className="text-center" style={{ maxWidth: 440 }}>
        <h1 className="h4 mb-2">We could not load Veyra</h1>
        <p className="text-body-secondary mb-4">{message}</p>
        <div className="d-flex gap-2 justify-content-center">
          <Button variant="primary" onClick={onRetry}>
            Try again
          </Button>
          <Button variant="outline-secondary" onClick={onLogout}>
            Log out
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, initState);
  const [toasts, setToasts] = useState([]);
  const syncedData = useRef(null);
  const syncQueue = useRef(Promise.resolve());

  const notify = useCallback((message, variant = "success") => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((current) => [...current, { id, message, variant }]);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const clearSession = useCallback(() => {
    setToken("");
    syncedData.current = null;
    dispatch({ type: "session/cleared" });
  }, []);

  const loadSession = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) dispatch({ type: "session/loading" });
    try {
      const result = await api.bootstrap();
      syncedData.current = result.data;
      dispatch({ type: "session/loaded", ...result });
      return result.user;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        clearSession();
        return null;
      }
      if (quiet) {
        setToken("");
        throw error;
      }
      dispatch({ type: "session/failed", error: error.message });
      throw error;
    }
  }, [clearSession]);

  useEffect(() => {
    if (getToken()) loadSession().catch(() => {});
  }, [loadSession]);

  useEffect(() => {
    if (!syncedData.current) return;
    const changes = diffData(syncedData.current, state.data);
    syncedData.current = state.data;
    if (!changes) return;
    syncQueue.current = syncQueue.current
      .then(() => api.sync(changes))
      .catch((error) => {
        notify(`Your last change was not saved. ${error.message}`, "danger");
        if (error instanceof ApiError && error.status === 401) clearSession();
      });
  }, [state.data, notify, clearSession]);

  useEffect(() => {
    document.documentElement.setAttribute(
      "data-bs-theme",
      state.settings.theme === "dark" ? "dark" : "light",
    );
  }, [state.settings]);

  const user = state.user;

  const actions = useMemo(() => {
    function save(kind, record) {
      const result = runDataAction(state.data, state.settings, {
        type: "save",
        kind,
        record,
      });
      dispatch({ scope: "data", type: "save", kind, record });
      return result.id;
    }

    async function startSession(request) {
      const { token } = await request;
      setToken(token);
      const account = await loadSession({ quiet: true });
      if (!account) throw new Error("Could not start your session. Try again.");
      return account;
    }

    return {
      save,
      remove: (kind, id) =>
        dispatch({ scope: "data", type: "delete", kind, id }),
      markRead: (ids, read = true) =>
        dispatch({
          scope: "data",
          type: "notification/read",
          ids: Array.isArray(ids) ? ids : [ids],
          read,
        }),
      markAllRead: () =>
        dispatch({ scope: "data", type: "notification/readAll" }),
      setSneakerImages: (images) =>
        dispatch({ scope: "data", type: "sneaker/image", images }),
      resetDemoData: () => dispatch({ scope: "data", type: "reset" }),
      saveSettings: (section, values) => {
        dispatch({ type: "settings/save", section, values });
        api
          .saveSettings(section, values)
          .catch((error) =>
            notify(`Settings were not saved. ${error.message}`, "danger"),
          );
      },
      login: (email, password) =>
        startSession(api.login(email.trim().toLowerCase(), password)),
      signup: ({ name, email, password }) =>
        startSession(
          api.signup({
            name: name.trim(),
            email: email.trim().toLowerCase(),
            password,
          }),
        ),
      async requestPasswordReset(email) {
        const { code } = await api.forgotPassword(email.trim().toLowerCase());
        return code;
      },
      async resetPassword({ email, code, password }) {
        await api.resetPassword({
          email: email.trim().toLowerCase(),
          code: code.trim(),
          password,
        });
      },
      async updateProfile({ name, email, avatar }) {
        const result = await api.updateProfile({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          avatar,
        });
        dispatch({ type: "user/update", user: result.user });
        return result.user;
      },
      async logout() {
        await syncQueue.current;
        await api.logout().catch(() => {});
        clearSession();
      },
    };
  }, [state.data, state.settings, loadSession, clearSession, notify]);

  const money = useCallback(
    (value) => formatMoney(value, state.settings.store.currency),
    [state.settings.store.currency],
  );

  const value = useMemo(
    () => ({
      data: state.data,
      settings: state.settings,
      user,
      isAuthenticated: Boolean(user),
      actions,
      money,
      notify,
      toasts,
      dismissToast,
    }),
    [
      state.data,
      state.settings,
      user,
      actions,
      money,
      notify,
      toasts,
      dismissToast,
    ],
  );

  if (state.status === "loading" && !user) return <LoadingScreen />;
  if (state.status === "error") {
    return (
      <ErrorScreen
        message={state.error}
        onRetry={() => loadSession().catch(() => {})}
        onLogout={clearSession}
      />
    );
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
