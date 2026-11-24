export const COLLECTIONS = {
  customers: {
    prefix: "CUS",
    fields: {
      id: "text",
      name: "text",
      email: "text",
      phone: "text",
      address: "text",
      notes: "text",
      createdAt: "date",
    },
  },
  sneakers: {
    prefix: "SNK",
    fields: {
      id: "text",
      brand: "text",
      model: "text",
      sku: "text",
      size: "num",
      colorway: "text",
      condition: "text",
      purchasePrice: "num",
      listingPrice: "num",
      quantity: "int",
      purchaseDate: "date",
      listingDate: "date",
      status: "text",
      image: "text",
      description: "text",
      notes: "text",
      history: "json",
      createdAt: "ts",
      maintenanceNotes: "text",
    },
  },
  orders: {
    prefix: "ORD",
    fields: {
      id: "text",
      customerId: "ref",
      sneakerId: "ref",
      sneakerLabel: "text",
      orderDate: "date",
      salePrice: "num",
      shippingFee: "num",
      platformFee: "num",
      purchasePrice: "num",
      paymentStatus: "text",
      shippingStatus: "text",
      notes: "text",
      inventoryApplied: "bool",
    },
  },
  tasks: {
    prefix: "TSK",
    fields: {
      id: "text",
      title: "text",
      description: "text",
      status: "text",
      priority: "text",
      dueDate: "date",
      createdDate: "date",
      assignee: "text",
      sneakerId: "ref",
    },
  },
  listings: {
    prefix: "LST",
    fields: {
      id: "text",
      sneakerId: "ref",
      title: "text",
      description: "text",
      images: "json",
      price: "num",
      size: "num",
      condition: "text",
      platform: "text",
      status: "text",
      dateListed: "date",
    },
  },
  notifications: {
    prefix: "NTF",
    fields: {
      id: "text",
      key: "text",
      type: "text",
      title: "text",
      message: "text",
      link: "text",
      read: "bool",
      createdAt: "ts",
    },
  },
};

export const UPSERT_ORDER = [
  "customers",
  "sneakers",
  "orders",
  "tasks",
  "listings",
  "notifications",
];

export const DELETE_ORDER = [...UPSERT_ORDER].reverse();

export function columnName(key) {
  return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

export function columnsOf(collection) {
  return Object.keys(COLLECTIONS[collection].fields).map(columnName);
}

function emptyToNull(value) {
  return value === undefined || value === null || value === "" ? null : value;
}

function toColumn(type, value) {
  switch (type) {
    case "num":
    case "int": {
      if (emptyToNull(value) === null) return null;
      const number = Number(value);
      if (!Number.isFinite(number)) return null;
      return type === "int" ? Math.trunc(number) : number;
    }
    case "bool":
      return Boolean(value);
    case "json":
      return Array.isArray(value) ? value : [];
    case "date":
    case "ts":
    case "ref":
      return emptyToNull(value);
    default:
      return value === undefined || value === null ? "" : String(value);
  }
}

function fromColumn(type, value) {
  switch (type) {
    case "num":
    case "int":
      return value === null ? null : Number(value);
    case "bool":
      return Boolean(value);
    case "json":
      return Array.isArray(value) ? value : [];
    case "date":
      if (value === null) return "";
      return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
    case "ts":
      return value === null ? "" : new Date(value).toISOString();
    default:
      return value === null ? "" : value;
  }
}

export function toRow(collection, record) {
  const row = {};
  for (const [key, type] of Object.entries(COLLECTIONS[collection].fields)) {
    row[columnName(key)] = toColumn(type, record[key]);
  }
  return row;
}

export function fromRow(collection, row) {
  const record = {};
  for (const [key, type] of Object.entries(COLLECTIONS[collection].fields)) {
    record[key] = fromColumn(type, row[columnName(key)]);
  }
  return record;
}
