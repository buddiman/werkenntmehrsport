import { HashRouter, Route, Routes } from 'react-router-dom'
import { AuthGate } from './auth/AuthGate'
import { Layout } from './components/Layout'
import { AdminPage } from './pages/AdminPage'
import { HistoryPage } from './pages/HistoryPage'
import { HomePage } from './pages/HomePage'
import { LeaderboardPage } from './pages/LeaderboardPage'
import { MatchesPage } from './pages/MatchesPage'
import { MyPredictionsPage } from './pages/MyPredictionsPage'
import { ProfilePage } from './pages/ProfilePage'

// HashRouter: GitHub Pages has no server-side rewrites, so deep links must
// live in the URL fragment (/#/leaderboard) to survive a page refresh.
export default function App() {
  return (
    <AuthGate>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="matches" element={<MatchesPage />} />
            <Route path="my-predictions" element={<MyPredictionsPage />} />
            <Route path="leaderboard" element={<LeaderboardPage />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="admin" element={<AdminPage />} />
            <Route path="*" element={<HomePage />} />
          </Route>
        </Routes>
      </HashRouter>
    </AuthGate>
  )
}
