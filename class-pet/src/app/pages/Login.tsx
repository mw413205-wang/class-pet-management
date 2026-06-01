import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card } from "../components/ui/card";
import { Eye, EyeOff, Sparkles, Star, Heart, Palette } from "lucide-react";
import { ImageWithFallback } from "../components/figma/ImageWithFallback";
import { motion } from "motion/react";
import { useTheme } from "../contexts/ThemeContext";

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { style, toggleStyle } = useTheme();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#4ecdc4] via-[#95e1d3] to-[#ffd93d] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background decorations */}
      <motion.div
        className="absolute top-10 left-10 text-8xl opacity-20"
        animate={{ 
          y: [0, -30, 0],
          rotate: [0, 360]
        }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      >
        🐱
      </motion.div>
      <motion.div
        className="absolute top-20 right-20 text-7xl opacity-20"
        animate={{ 
          y: [0, 30, 0],
          rotate: [0, -360]
        }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      >
        🐰
      </motion.div>
      <motion.div
        className="absolute bottom-20 left-20 text-9xl opacity-20"
        animate={{ 
          y: [0, -20, 0],
          scale: [1, 1.1, 1]
        }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      >
        🐶
      </motion.div>
      <motion.div
        className="absolute bottom-10 right-10 text-8xl opacity-20"
        animate={{ 
          y: [0, 25, 0],
          rotate: [0, 15, -15, 0]
        }}
        transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
      >
        🦊
      </motion.div>

      {/* Floating stars */}
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute text-4xl"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            y: [0, -20, 0],
            opacity: [0.3, 0.6, 0.3],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 3 + Math.random() * 2,
            repeat: Infinity,
            delay: Math.random() * 2,
          }}
        >
          ⭐
        </motion.div>
      ))}

      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-8 items-center relative z-10">
        {/* Illustration side */}
        <motion.div 
          className="hidden lg:flex flex-col items-center justify-center space-y-6"
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
        >
          <motion.div 
            className="relative w-full max-w-lg"
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <div className="absolute -top-6 -left-6 w-16 h-16 bg-[#ffd93d] rounded-full flex items-center justify-center shadow-2xl">
              <span className="text-3xl">🎨</span>
            </div>
            <div className="absolute -bottom-6 -right-6 w-16 h-16 bg-[#ff6b9d] rounded-full flex items-center justify-center shadow-2xl">
              <span className="text-3xl">📚</span>
            </div>
            <ImageWithFallback
              src="https://images.unsplash.com/photo-1770996870183-97b943ab7e8d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaGluZXNlJTIwY2xhc3Nyb29tJTIwdGVhY2hpbmclMjBlbGVtZW50YXJ5fGVufDF8fHx8MTc3MjM3Nzc1NXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
              alt="classroom"
              className="rounded-[3rem] shadow-2xl border-8 border-white"
            />
          </motion.div>
          <motion.div 
            className="text-center space-y-3 bg-white/80 backdrop-blur-sm px-8 py-4 rounded-3xl shadow-xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex items-center justify-center gap-2">
              <Sparkles className="w-6 h-6 text-[#ffd93d]" />
              <h2 className="text-3xl font-bold bg-gradient-to-r from-[#4ecdc4] to-[#ff6b9d] bg-clip-text text-transparent">
                让成长看得见
              </h2>
              <Heart className="w-6 h-6 text-[#ff6b9d] fill-current" />
            </div>
            <p className="text-lg text-[#4a4a4a]">用爱陪伴每一位学生的成长旅程 🌈</p>
          </motion.div>
        </motion.div>

        {/* Login form side */}
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
        >
          <Card className="w-full max-w-md mx-auto p-8 shadow-2xl bg-white border-8 border-[#ffe5d9] relative overflow-hidden rounded-[3rem]">
            {/* Decorative corners */}
            <div className="absolute top-0 left-0 w-20 h-20 bg-gradient-to-br from-[#4ecdc4] to-transparent rounded-br-full opacity-50"></div>
            <div className="absolute bottom-0 right-0 w-20 h-20 bg-gradient-to-tl from-[#ff6b9d] to-transparent rounded-tl-full opacity-50"></div>

            <div className="space-y-6 relative z-10">
              {/* Logo and title */}
              <div className="text-center space-y-4">
                <motion.div 
                  className="inline-flex items-center justify-center relative"
                  whileHover={{ scale: 1.1, rotate: 360 }}
                  transition={{ duration: 0.6 }}
                >
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#4ecdc4] via-[#95e1d3] to-[#ffd93d] flex items-center justify-center shadow-2xl">
                    <span className="text-5xl">🐾</span>
                  </div>
                  <motion.div 
                    className="absolute -top-2 -right-2 w-10 h-10 bg-[#ffd93d] rounded-full flex items-center justify-center shadow-lg"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  >
                    <Star className="w-5 h-5 text-[#ff6b6b] fill-current" />
                  </motion.div>
                </motion.div>
                <div>
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-[#4ecdc4] to-[#ff6b9d] bg-clip-text text-transparent mb-2">
                    班级宠物园
                  </h1>
                  <div className="inline-flex items-center gap-2 bg-gradient-to-r from-[#ffe5d9] to-[#ffd9e8] px-4 py-2 rounded-full">
                    <span className="text-sm text-[#ff6b6b]">✨ 教师管理平台 ✨</span>
                  </div>
                </div>
              </div>

              {/* Login form */}
              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-[#4a4a4a] flex items-center gap-2">
                    <span className="text-xl">👤</span>
                    用户名
                  </Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="请输入用户名"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="h-14 bg-[#fff9f0] border-2 border-[#ffe5d9] rounded-2xl text-lg focus:border-[#4ecdc4] focus:ring-4 focus:ring-[#4ecdc4]/20"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-[#4a4a4a] flex items-center gap-2">
                    <span className="text-xl">🔒</span>
                    密码
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="请输入密码"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-14 bg-[#fff9f0] border-2 border-[#ffe5d9] rounded-2xl pr-12 text-lg focus:border-[#4ecdc4] focus:ring-4 focus:ring-[#4ecdc4]/20"
                      required
                    />
                    <motion.button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#4ecdc4] hover:text-[#ff6b9d] transition-colors"
                      whileHover={{ scale: 1.2 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      {showPassword ? (
                        <EyeOff className="w-6 h-6" />
                      ) : (
                        <Eye className="w-6 h-6" />
                      )}
                    </motion.button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <label className="flex items-center space-x-2 text-[#4a4a4a] cursor-pointer group">
                    <input
                      type="checkbox"
                      className="w-5 h-5 rounded-lg border-2 border-[#4ecdc4] text-[#4ecdc4] focus:ring-[#4ecdc4]"
                    />
                    <span className="group-hover:text-[#4ecdc4] transition-colors">记住密码</span>
                  </label>
                  <motion.a 
                    href="#" 
                    className="text-[#4ecdc4] hover:text-[#ff6b9d] transition-colors"
                    whileHover={{ scale: 1.05 }}
                  >
                    忘记密码？
                  </motion.a>
                </div>

                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    type="submit"
                    className="w-full h-14 bg-gradient-to-r from-[#4ecdc4] via-[#95e1d3] to-[#4ecdc4] hover:from-[#95e1d3] hover:to-[#4ecdc4] text-white text-lg rounded-2xl shadow-xl hover:shadow-2xl transition-all bg-[length:200%_100%] animate-gradient"
                  >
                    <span className="text-xl mr-2">🚀</span>
                    开始精彩旅程
                  </Button>
                </motion.div>
              </form>

              {/* Footer */}
              <div className="text-center pt-4 border-t-2 border-[#ffe5d9]">
                <div className="flex items-center justify-center gap-2 text-sm text-[#a0a0a0]">
                  <Heart className="w-4 h-4 text-[#ff6b9d] fill-current" />
                  <p>© 2026 班级宠物园 · 让教育更有爱</p>
                  <Sparkles className="w-4 h-4 text-[#ffd93d]" />
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>

      <style>{`
        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-gradient {
          animation: gradient 3s ease infinite;
        }
      `}</style>
    </div>
  );
}