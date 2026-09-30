import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { DashboardLayout } from './layouts/DashboardLayout'
import { BlogDetailPage } from './pages/BlogDetailPage'
import { ComingSoonPage } from './pages/ComingSoonPage'
import { CreateBlogPage } from './pages/CreateBlogPage'
import { DashboardPage } from './pages/DashboardPage'
import { LoginPage } from './pages/LoginPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="blogs/new" element={<CreateBlogPage />} />
              <Route path="blogs/:id" element={<BlogDetailPage />} />
              <Route path="blogs" element={<ComingSoonPage title="All Blogs" description="Every blog in your workspace." />} />
              <Route path="drafts" element={<ComingSoonPage title="Drafts" description="Blogs you saved to finish later." />} />
              <Route
                path="voice-profiles"
                element={<ComingSoonPage title="Voice Profiles" description="Reusable tone, persona and writing rules." />}
              />
              <Route path="settings" element={<ComingSoonPage title="Settings" description="Workspace and model settings." />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
