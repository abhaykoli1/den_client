import { Navigate, Route, Routes } from 'react-router-dom'
import { hasAppAccess, useAuth } from './context/AuthContext'
import { ClubProvider } from './context/ClubContext'
import Layout from './components/Layout'
import LoginScreen from './components/LoginScreen'
import SubscriptionOnboardingScreen from './components/SubscriptionOnboardingScreen'
import TablesScreen from './components/TablesScreen'
import PlayersScreen from './components/PlayersScreen'
import DueDeskScreen from './components/DueDeskScreen'
import ItemsScreen from './components/ItemsScreen'
import ExpensesScreen from './components/ExpensesScreen'
import FinanceScreen from './components/FinanceScreen'
import TournamentsScreen from './components/TournamentsScreen'
import ItemBillsScreen from './components/ItemBillsScreen'
import FramesScreen from './components/FramesScreen'
import LogsScreen from './components/LogsScreen'
import AdminScreen from './components/AdminScreen'
import DayCloseScreen from './components/DayCloseScreen'
import TeamScreen from './components/TeamScreen'
import SettingsScreen from './components/SettingsScreen'
import SupportScreen from './components/SupportScreen'
import PrivacyScreen from './components/PrivacyScreen'
import TermsScreen from './components/TermsScreen'
import MasterAdminScreen from './components/MasterAdminScreen'
import { Card, EmptyState, FullLoader } from './components/ui'

/** Staff accounts never see the money-admin surfaces — bounce them home. */
function AdminOnly({ children }: { children: JSX.Element }) {
  const { user } = useAuth()
  if (user?.role === 'staff') {
    return (
      <Card>
        <EmptyState
          title="Admin area — owner access required"
          hint="Revenue, finance, expenses and team sirf club owner dekhte hain. Aap billing, players, due desk, items aur tournaments handle kar sakte ho."
        />
      </Card>
    )
  }
  return children
}

export default function App() {
  const { status, user } = useAuth()

  if (status === 'loading') return <FullLoader label="Restoring session…" />
  if (!user) return <LoginScreen />
  if (!hasAppAccess(user)) return <SubscriptionOnboardingScreen />

  return (
    <ClubProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/tables" element={<TablesScreen />} />
          <Route path="/players" element={<PlayersScreen />} />
          <Route path="/due-desk" element={<DueDeskScreen />} />
          <Route path="/items" element={<ItemsScreen />} />
          <Route path="/item-bills" element={<ItemBillsScreen />} />
          <Route path="/frames" element={<FramesScreen />} />
          <Route path="/logs" element={<LogsScreen />} />
          <Route path="/expenses" element={<AdminOnly><ExpensesScreen /></AdminOnly>} />
          <Route path="/finance" element={<AdminOnly><FinanceScreen /></AdminOnly>} />
          <Route path="/tournaments" element={<TournamentsScreen />} />
          <Route path="/admin" element={<AdminOnly><AdminScreen /></AdminOnly>} />
          <Route path="/day-close" element={<AdminOnly><DayCloseScreen /></AdminOnly>} />
          <Route path="/team" element={<AdminOnly><TeamScreen /></AdminOnly>} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="/support" element={<SupportScreen />} />
          <Route path="/privacy" element={<PrivacyScreen />} />
          <Route path="/terms" element={<TermsScreen />} />
          <Route path="/master" element={<MasterAdminScreen />} />
          <Route path="*" element={<Navigate to="/tables" replace />} />
        </Route>
      </Routes>
    </ClubProvider>
  )
}
