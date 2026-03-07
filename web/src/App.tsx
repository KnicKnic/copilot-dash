import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AdminLayout from "./components/AdminLayout";
import AdminRecentPage from "./pages/AdminRecentPage";
import AdminTreePage from "./pages/AdminTreePage";
import AdminConfigPage from "./pages/AdminConfigPage";
import AdminRunPage from "./pages/AdminRunPage";
import ViewRunPage from "./pages/ViewRunPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Admin section — with left sidebar */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="recent" replace />} />
          <Route path="recent" element={<AdminRecentPage />} />
          <Route path="tree" element={<AdminTreePage />} />
          <Route path="run/:id" element={<AdminRunPage />} />
          <Route path="config" element={<AdminConfigPage />} />
        </Route>

        {/* Run viewer — no sidebar, embeddable */}
        <Route path="/view/:id" element={<ViewRunPage />} />

        {/* Root redirect */}
        <Route path="/" element={<Navigate to="/admin/recent" replace />} />

        {/* 404 */}
        <Route
          path="*"
          element={
            <div className="flex items-center justify-center h-screen">
              <div className="text-center">
                <h1 className="text-4xl font-bold text-gray-300 mb-2">404</h1>
                <p className="text-gray-500">Page not found</p>
                <a
                  href="/admin/recent"
                  className="text-blue-600 hover:underline text-sm mt-4 inline-block"
                >
                  Go to Dashboard
                </a>
              </div>
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
