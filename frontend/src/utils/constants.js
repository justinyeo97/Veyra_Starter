export const INVENTORY_STATUSES = ['Purchased', 'Cleaning', 'Ready to List', 'Listed', 'Sold', 'Shipped']

export const IN_STOCK_STATUSES = ['Purchased', 'Cleaning', 'Ready to List', 'Listed']

export const CONDITIONS = ['New / Deadstock', 'Like New', 'Used - Excellent', 'Used - Good', 'Used - Fair']

export const SIZES = Array.from({ length: 23 }, (_, index) => 4 + index * 0.5)

export const PAYMENT_STATUSES = ['Pending', 'Paid', 'Refunded', 'Failed']

export const SHIPPING_STATUSES = ['Processing', 'Shipped', 'Delivered', 'Cancelled']

export const TASK_STATUSES = ['To Do', 'In Progress', 'Completed']

export const TASK_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent']

export const LISTING_STATUSES = ['Draft', 'Active', 'Sold', 'Archived']

export const PLATFORMS = ['Veyra', 'StockX', 'GOAT', 'eBay']

export const TEAM_MEMBERS = ['Alex Tan', 'Jordan Lee', 'Priya Nair', 'Marcus Wong']

export const CURRENCIES = [
  { code: 'USD', label: 'US Dollar (USD)' },
  { code: 'EUR', label: 'Euro (EUR)' },
  { code: 'GBP', label: 'British Pound (GBP)' },
  { code: 'SGD', label: 'Singapore Dollar (SGD)' },
  { code: 'MYR', label: 'Malaysian Ringgit (MYR)' },
  { code: 'AUD', label: 'Australian Dollar (AUD)' },
  { code: 'JPY', label: 'Japanese Yen (JPY)' },
]

export const DATE_RANGES = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: '90d', label: 'Last 90 days' },
  { key: 'year', label: 'This year' },
]

export const NOTIFICATION_TYPES = {
  'new-order': { label: 'New order', icon: 'bag-check', tone: 'blue', category: 'orders' },
  'unshipped-order': { label: 'Unshipped order', icon: 'truck', tone: 'amber', category: 'orders' },
  'overdue-task': { label: 'Overdue task', icon: 'alarm', tone: 'red', category: 'tasks' },
  'low-inventory': { label: 'Low inventory', icon: 'box-seam', tone: 'amber', category: 'inventory' },
  'sold-sneaker': { label: 'Sneaker sold', icon: 'tag', tone: 'green', category: 'inventory' },
  'failed-payment': { label: 'Failed payment', icon: 'credit-card-2-front', tone: 'red', category: 'payments' },
}

export const STATUS_TONES = {
  Purchased: 'gray',
  Cleaning: 'teal',
  'Ready to List': 'amber',
  Listed: 'blue',
  Sold: 'green',
  Shipped: 'violet',
  Pending: 'amber',
  Paid: 'green',
  Refunded: 'gray',
  Failed: 'red',
  Processing: 'amber',
  Delivered: 'green',
  Cancelled: 'red',
  'To Do': 'gray',
  'In Progress': 'blue',
  Completed: 'green',
  Low: 'gray',
  Medium: 'blue',
  High: 'amber',
  Urgent: 'red',
  Draft: 'gray',
  Active: 'green',
  Archived: 'violet',
  Overdue: 'red',
}

export const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: 'grid-1x2' },
  { to: '/inventory', label: 'Inventory', icon: 'box-seam' },
  { to: '/orders', label: 'Orders', icon: 'receipt' },
  { to: '/tasks', label: 'Tasks', icon: 'check2-square' },
  { to: '/customers', label: 'Customers', icon: 'people' },
  { to: '/listings', label: 'Listings', icon: 'shop' },
  { to: '/analytics', label: 'Analytics', icon: 'graph-up-arrow' },
  { to: '/notifications', label: 'Notifications', icon: 'bell' },
  { to: '/settings', label: 'Settings', icon: 'gear' },
]

export const CHART_COLORS = ['#111827', '#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0d9488', '#db2777']

export const PAGE_SIZE = 10
