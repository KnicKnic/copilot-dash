import { NavLink, Outlet } from "react-router-dom";
import { useSocket } from "../useSocket";

const navItems = [
  { to: "/admin/recent", label: "Recent Runs", icon: "🕐" },
  { to: "/admin/tree", label: "Tree View", icon: "🌳" },
  { to: "/admin/config", label: "Configuration", icon: "⚙️" },
];

export default function AdminLayout() {
  const { connected } = useSocket();

  return (
    <div className="flex h-screen">
      {/* Left Sidebar */}
      <aside className="w-60 bg-gray-900 text-gray-100 flex flex-col flex-shrink-0">
        {/* Logo */}
        <div className="p-4 border-b border-gray-700">
          <h1 className="text-lg font-bold flex items-center gap-2">
            🚀 Copilot Dash
          </h1>
          <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-400">
            <span
              className={`w-2 h-2 rounded-full ${
                connected ? "bg-green-400" : "bg-red-400"
              }`}
            />
            {connected ? "Connected" : "Disconnected"}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  isActive
                    ? "bg-gray-800 text-white border-r-2 border-blue-500"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`
              }
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 text-xs text-gray-500">
          Copilot Dash v1.0
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
