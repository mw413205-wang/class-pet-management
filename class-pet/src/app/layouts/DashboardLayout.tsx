import { Outlet, useNavigate, useLocation } from "react-router";
import { 
  Home, 
  Users, 
  GraduationCap, 
  ShoppingBag, 
  Sparkles, 
  Award, 
  Settings,
  LogOut,
  Bell,
  Star,
  Heart,
  Gift,
  Palette
} from "lucide-react";
import { Button } from "../components/ui/button";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { motion } from "motion/react";
import { useTheme, themeStyles } from "../contexts/ThemeContext";

const navigation = [
  { name: "学生墙", path: "/dashboard", icon: Home, emoji: "🏠" },
  { name: "班级管理", path: "/dashboard/classes", icon: Users, emoji: "📚" },
  { name: "学生管理", path: "/dashboard/students", icon: GraduationCap, emoji: "👨‍🎓" },
  { name: "随机点名", path: "/dashboard/random-picker", icon: Sparkles, emoji: "🎲" },
  { name: "幸运抽奖", path: "/dashboard/lucky-draw", icon: Gift, emoji: "🎁" },
  { name: "小卖部", path: "/dashboard/rewards", icon: ShoppingBag, emoji: "🏪" },
  { name: "宠物分配", path: "/dashboard/pets", icon: Sparkles, emoji: "🐾" },
  { name: "徽章墙", path: "/dashboard/badges", icon: Award, emoji: "🏆" },
  { name: "系统设置", path: "/dashboard/settings", icon: Settings, emoji: "⚙️" },
];

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [notificationCount] = useState(3);
  const { style, toggleStyle } = useTheme();
  const theme = themeStyles[style];

  const handleLogout = () => {
    navigate("/");
  };

  const isActive = (path: string) => {
    if (path === "/dashboard") {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className={`min-h-screen ${theme.background}`}>
      {/* Decorative elements - only in cartoon mode */}
      {theme.enableDecorations && (
        <>
          <div className="fixed top-10 left-10 text-6xl opacity-20 animate-bounce" style={{ animationDuration: '3s' }}>
            ⭐
          </div>
          <div className="fixed top-20 right-20 text-5xl opacity-20 animate-bounce" style={{ animationDuration: '4s', animationDelay: '1s' }}>
            🌈
          </div>
          <div className="fixed bottom-20 left-20 text-5xl opacity-20 animate-bounce" style={{ animationDuration: '5s', animationDelay: '2s' }}>
            🎈
          </div>
          <div className="fixed bottom-10 right-10 text-6xl opacity-20 animate-bounce" style={{ animationDuration: '3.5s', animationDelay: '0.5s' }}>
            ✨
          </div>
        </>
      )}

      {/* Top Navigation Bar */}
      <header className={`sticky top-0 z-50 ${theme.cardBg} backdrop-blur-lg ${theme.headerShadow} ${theme.headerBorder}`}>
        <div className="max-w-[1800px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Logo */}
            <motion.div 
              className="flex items-center gap-3 cursor-pointer"
              whileHover={{ scale: 1.05 }}
              onClick={() => navigate("/dashboard")}
            >
              <div className="relative">
                <div className={`w-14 h-14 ${theme.buttonRounded} ${theme.buttonPrimary} flex items-center justify-center ${theme.buttonShadow} ${style === 'cartoon' ? 'transform rotate-12' : ''}`}>
                  <span className={`text-3xl ${style === 'cartoon' ? 'transform -rotate-12' : ''}`}>🐾</span>
                </div>
                {theme.enableDecorations && (
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-[#ffd93d] rounded-full flex items-center justify-center shadow-lg">
                    <Star className="w-3 h-3 text-[#ff6b6b] fill-current" />
                  </div>
                )}
              </div>
              <div>
                <h1 className={`text-2xl font-bold ${theme.titleGradient}`}>
                  班级宠物园
                </h1>
                <p className="text-xs text-[#ff6b6b]">
                  {theme.enableEmojis ? '✨ 让成长看得见 ✨' : '让成长看得见'}
                </p>
              </div>
            </motion.div>

            {/* Navigation Menu */}
            <nav className="hidden lg:flex items-center gap-2">
              {navigation.map((item) => {
                const active = isActive(item.path);
                return (
                  <motion.button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`relative px-5 py-3 ${theme.buttonRounded} transition-all ${
                      active
                        ? `${theme.buttonPrimary} text-white ${theme.buttonShadow} ${style === 'cartoon' ? 'scale-105' : ''}`
                        : `text-[#4a4a4a] hover:bg-gray-100 ${style === 'cartoon' ? 'hover:scale-105' : ''}`
                    }`}
                    whileHover={{ y: style === 'cartoon' ? -2 : 0 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <div className="flex items-center gap-2">
                      {theme.enableEmojis && <span className="text-xl">{item.emoji}</span>}
                      <span className="text-sm font-medium">{item.name}</span>
                    </div>
                    {active && theme.enableDecorations && (
                      <motion.div
                        className="absolute -top-1 -right-1 w-5 h-5 bg-[#ffd93d] rounded-full flex items-center justify-center shadow-lg"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      >
                        <Sparkles className="w-3 h-3 text-[#ff6b6b]" />
                      </motion.div>
                    )}
                  </motion.button>
                );
              })}
            </nav>

            {/* Right side actions */}
            <div className="flex items-center gap-3">
              {/* Theme Toggle */}
              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={toggleStyle}
                  className={`relative w-12 h-12 ${theme.buttonRounded} ${style === 'cartoon' ? 'bg-gradient-to-br from-[#ffd93d] to-[#ffe66d]' : 'bg-gray-100'} hover:shadow-xl`}
                  title={style === 'cartoon' ? '切换到简洁模式' : '切换到卡通模式'}
                >
                  <Palette className="w-6 h-6 text-[#4a4a4a]" />
                </Button>
              </motion.div>

              {/* Notification */}
              <motion.div whileHover={{ scale: 1.1, rotate: style === 'cartoon' ? 15 : 0 }} whileTap={{ scale: 0.9 }}>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className={`relative w-12 h-12 ${theme.buttonRounded} ${style === 'cartoon' ? 'bg-gradient-to-br from-[#ffe5d9] to-[#ffd9e8]' : 'bg-gray-100'} hover:shadow-xl`}
                >
                  <Bell className="w-6 h-6 text-[#ff6b9d]" />
                  {notificationCount > 0 && (
                    <motion.span 
                      className={`absolute -top-1 -right-1 w-6 h-6 bg-[#ff6b6b] ${theme.badgeRounded} flex items-center justify-center text-white text-xs shadow-lg`}
                      animate={style === 'cartoon' ? { scale: [1, 1.2, 1] } : {}}
                      transition={{ duration: 1, repeat: Infinity }}
                    >
                      {notificationCount}
                    </motion.span>
                  )}
                </Button>
              </motion.div>

              {/* User menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <motion.button 
                    className={`flex items-center gap-3 px-4 py-2 ${theme.buttonRounded} ${style === 'cartoon' ? 'bg-gradient-to-r from-[#ffd93d] to-[#ffd93d]/80' : 'bg-[#ffd93d]'} hover:shadow-xl transition-all`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <div className="relative">
                      <div className={`w-10 h-10 ${style === 'cartoon' ? 'rounded-full' : 'rounded-lg'} ${style === 'cartoon' ? 'bg-gradient-to-br from-[#ff6b9d] to-[#c44569]' : 'bg-[#ff6b9d]'} flex items-center justify-center text-white shadow-lg`}>
                        <span className="text-lg">👩‍🏫</span>
                      </div>
                      {theme.enableDecorations && (
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#4ecdc4] rounded-full flex items-center justify-center shadow-md">
                          <Heart className="w-3 h-3 text-white fill-current" />
                        </div>
                      )}
                    </div>
                    <div className="hidden md:block text-left">
                      <p className="text-sm font-medium text-[#4a4a4a]">张老师</p>
                      <p className="text-xs text-[#ff6b6b]">三年级(1)班</p>
                    </div>
                  </motion.button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className={`w-48 ${theme.cardRounded}`}>
                  <DropdownMenuItem className={theme.buttonRounded}>
                    <Settings className="w-4 h-4 mr-2" />
                    个人设置
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className={`text-[#ff6b6b] ${theme.buttonRounded}`}>
                    <LogOut className="w-4 h-4 mr-2" />
                    退出登录
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Mobile navigation */}
        <div className="lg:hidden border-t border-gray-200 px-2 pb-2 overflow-x-auto">
          <div className="flex gap-2 min-w-max py-2">
            {navigation.map((item) => {
              const active = isActive(item.path);
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`flex flex-col items-center gap-1 px-4 py-2 ${theme.buttonRounded} transition-all min-w-[80px] ${
                    active
                      ? `${theme.buttonPrimary} text-white ${theme.buttonShadow}`
                      : "text-[#4a4a4a] hover:bg-gray-100"
                  }`}
                >
                  {theme.enableEmojis && <span className="text-2xl">{item.emoji}</span>}
                  <span className="text-xs">{item.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="max-w-[1800px] mx-auto p-4 md:p-6 lg:p-8 relative z-10">
        <Outlet />
      </main>

      {/* Floating decoration - only in cartoon mode */}
      {theme.enableDecorations && (
        <div className="fixed bottom-5 right-5 pointer-events-none">
          <motion.div
            animate={{ 
              y: [0, -20, 0],
              rotate: [0, 10, -10, 0]
            }}
            transition={{ 
              duration: 4, 
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="text-8xl opacity-30"
          >
            🎨
          </motion.div>
        </div>
      )}
    </div>
  );
}
