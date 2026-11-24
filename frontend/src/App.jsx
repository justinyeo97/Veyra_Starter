import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppLayout, ProtectedRoute, PublicRoute } from './components/Layout'
import { AppProvider } from './context/AppContext'
import { ForgotPasswordPage, LoginPage, LogoutPage, ResetPasswordPage, SignupPage } from './pages/AuthPages'
import { AnalyticsPage, DashboardPage } from './pages/InsightsPages'
import { InventoryPage, ListingPreviewPage, ListingsPage, SneakerDetailsPage } from './pages/InventoryPages'
import { CustomerDetailsPage, CustomersPage, OrderDetailsPage, OrdersPage } from './pages/SalesPages'
import { NotFoundPage, NotificationsPage, SearchPage, SettingsPage, TasksPage } from './pages/WorkspacePages'

function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<PublicRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
          </Route>
          <Route path="/logout" element={<LogoutPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/listings/:id" element={<ListingPreviewPage />} />
            <Route element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/inventory/:id" element={<SneakerDetailsPage />} />
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/orders/:id" element={<OrderDetailsPage />} />
              <Route path="/tasks" element={<TasksPage />} />
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/customers/:id" element={<CustomerDetailsPage />} />
              <Route path="/listings" element={<ListingsPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/search" element={<SearchPage />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  )
}

export default App
