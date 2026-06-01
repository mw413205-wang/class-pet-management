import { useState } from "react";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Search, TrendingUp, Award, Sparkles, Star } from "lucide-react";
import { motion } from "motion/react";
import { useTheme, themeStyles } from "../contexts/ThemeContext";

// Mock student data
const mockStudents = [
  { id: 1, name: "李明", pet: "🐱", petName: "小猫咪", level: 3, points: 75, maxPoints: 100, badges: 5, group: "红组" },
  { id: 2, name: "王芳", pet: "🐰", petName: "小兔兔", level: 4, points: 45, maxPoints: 100, badges: 7, group: "蓝组" },
  { id: 3, name: "张伟", pet: "🐶", petName: "小狗狗", level: 2, points: 88, maxPoints: 100, badges: 3, group: "红组" },
  { id: 4, name: "刘洋", pet: "🦊", petName: "小狐狸", level: 3, points: 62, maxPoints: 100, badges: 6, group: "黄组" },
  { id: 5, name: "陈静", pet: "🐼", petName: "熊猫宝宝", level: 5, points: 92, maxPoints: 100, badges: 9, group: "蓝组" },
  { id: 6, name: "赵敏", pet: "🐨", petName: "考拉", level: 3, points: 55, maxPoints: 100, badges: 4, group: "绿组" },
  { id: 7, name: "孙涛", pet: "🦁", petName: "小狮子", level: 4, points: 78, maxPoints: 100, badges: 8, group: "红组" },
  { id: 8, name: "周慧", pet: "🐯", petName: "小老虎", level: 2, points: 34, maxPoints: 100, badges: 2, group: "黄组" },
  { id: 9, name: "吴刚", pet: "🐹", petName: "小仓鼠", level: 3, points: 69, maxPoints: 100, badges: 5, group: "蓝组" },
  { id: 10, name: "郑美", pet: "🦄", petName: "独角兽", level: 5, points: 95, maxPoints: 100, badges: 10, group: "绿组" },
  { id: 11, name: "钱强", pet: "🐸", petName: "青蛙王子", level: 2, points: 41, maxPoints: 100, badges: 3, group: "红组" },
  { id: 12, name: "孙丽", pet: "🦋", petName: "蝴蝶仙子", level: 4, points: 83, maxPoints: 100, badges: 7, group: "蓝组" },
];

const groupColors: Record<string, { cartoon: string; minimal: string }> = {
  "红组": { 
    cartoon: "bg-gradient-to-r from-[#ff6b9d] to-[#ff8fab] text-white shadow-lg",
    minimal: "bg-red-500 text-white"
  },
  "蓝组": { 
    cartoon: "bg-gradient-to-r from-[#4ecdc4] to-[#95e1d3] text-white shadow-lg",
    minimal: "bg-blue-500 text-white"
  },
  "黄组": { 
    cartoon: "bg-gradient-to-r from-[#ffd93d] to-[#ffe66d] text-[#4a4a4a] shadow-lg",
    minimal: "bg-yellow-500 text-gray-900"
  },
  "绿组": { 
    cartoon: "bg-gradient-to-r from-[#95e1d3] to-[#a8e6cf] text-[#4a4a4a] shadow-lg",
    minimal: "bg-green-500 text-white"
  },
};

export default function Dashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [celebratingStudent, setCelebratingStudent] = useState<number | null>(null);
  const { style } = useTheme();
  const theme = themeStyles[style];

  // Filter and sort students
  const filteredStudents = mockStudents
    .filter((student) =>
      student.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "level") return b.level - a.level;
      if (sortBy === "progress") return b.points - a.points;
      return 0;
    });

  const handleLevelUp = (studentId: number) => {
    setCelebratingStudent(studentId);
    setTimeout(() => setCelebratingStudent(null), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Title with decoration */}
      <motion.div 
        className="text-center py-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className={`inline-flex items-center gap-3 ${theme.cardBg} backdrop-blur-sm px-8 py-4 ${theme.cardRounded} ${theme.buttonShadow} ${theme.cardBorder}`}>
          {theme.enableEmojis && (
            <motion.span 
              className="text-4xl"
              animate={style === 'cartoon' ? { rotate: 360 } : {}}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              ⭐
            </motion.span>
          )}
          <h2 className={`text-3xl font-bold ${theme.titleGradient}`}>
            学生成长墙
          </h2>
          {theme.enableEmojis && (
            <motion.span 
              className="text-4xl"
              animate={style === 'cartoon' ? { rotate: -360 } : {}}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              🌟
            </motion.span>
          )}
        </div>
      </motion.div>

      {/* Toolbar */}
      <Card className={`p-5 ${theme.cardBg} backdrop-blur-sm ${theme.cardBorder} ${theme.buttonShadow} ${theme.cardRounded}`}>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-[#4ecdc4]" />
            <Input
              placeholder={theme.enableEmojis ? "🔍 搜索学生姓名..." : "搜索学生姓名..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`pl-12 h-14 text-lg ${theme.inputBg} ${theme.inputBorder} ${theme.inputRounded} focus:border-[#4ecdc4] focus:ring-4 focus:ring-[#4ecdc4]/20`}
            />
          </div>
          <div className="flex gap-3">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className={`w-[160px] h-14 ${theme.inputBg} ${theme.inputBorder} ${theme.inputRounded} text-lg`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={theme.cardRounded}>
                <SelectItem value="name">{theme.enableEmojis ? "📝 " : ""}按姓名排序</SelectItem>
                <SelectItem value="level">{theme.enableEmojis ? "⬆️ " : ""}按等级排序</SelectItem>
                <SelectItem value="progress">{theme.enableEmojis ? "📊 " : ""}按进度排序</SelectItem>
              </SelectContent>
            </Select>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button className={`h-14 px-6 text-lg ${theme.buttonPrimary} ${theme.buttonRounded} ${theme.buttonShadow}`}>
                {theme.enableEmojis && "✨ "}批量操作
              </Button>
            </motion.div>
          </div>
        </div>
      </Card>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <motion.div whileHover={{ scale: style === 'cartoon' ? 1.05 : 1.02, rotate: style === 'cartoon' ? 2 : 0 }} transition={{ type: "spring" }}>
          <Card className={`p-5 ${style === 'cartoon' ? 'bg-gradient-to-br from-[#4ecdc4] via-[#95e1d3] to-white' : 'bg-white'} ${theme.cardBorder} ${theme.buttonShadow} ${theme.cardRounded}`}>
            <div className="flex items-center gap-4">
              <motion.div 
                className={`w-16 h-16 ${theme.inputRounded} bg-white flex items-center justify-center shadow-lg`}
                animate={style === 'cartoon' ? { rotate: [0, 10, -10, 0] } : {}}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <TrendingUp className="w-8 h-8 text-[#4ecdc4]" />
              </motion.div>
              <div>
                <p className={`text-4xl font-bold ${style === 'cartoon' ? 'text-white' : 'text-gray-900'}`}>42</p>
                <p className={`text-sm ${style === 'cartoon' ? 'text-white/80' : 'text-gray-500'}`}>
                  总学生数{theme.enableEmojis && " 👥"}
                </p>
              </div>
            </div>
          </Card>
        </motion.div>
        <motion.div whileHover={{ scale: style === 'cartoon' ? 1.05 : 1.02, rotate: style === 'cartoon' ? -2 : 0 }} transition={{ type: "spring" }}>
          <Card className={`p-5 ${style === 'cartoon' ? 'bg-gradient-to-br from-[#ffd93d] via-[#ffe66d] to-white' : 'bg-white'} ${theme.cardBorder} ${theme.buttonShadow} ${theme.cardRounded}`}>
            <div className="flex items-center gap-4">
              <motion.div 
                className={`w-16 h-16 ${theme.inputRounded} bg-white flex items-center justify-center shadow-lg`}
                animate={style === 'cartoon' ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <Sparkles className="w-8 h-8 text-[#ffd93d]" />
              </motion.div>
              <div>
                <p className="text-4xl font-bold text-[#4a4a4a]">3.5</p>
                <p className="text-sm text-[#4a4a4a]/80">
                  平均等级{theme.enableEmojis && " ⬆️"}
                </p>
              </div>
            </div>
          </Card>
        </motion.div>
        <motion.div whileHover={{ scale: style === 'cartoon' ? 1.05 : 1.02, rotate: style === 'cartoon' ? 2 : 0 }} transition={{ type: "spring" }}>
          <Card className={`p-5 ${style === 'cartoon' ? 'bg-gradient-to-br from-[#ff6b9d] via-[#ff8fab] to-white' : 'bg-white'} ${theme.cardBorder} ${theme.buttonShadow} ${theme.cardRounded}`}>
            <div className="flex items-center gap-4">
              <motion.div 
                className={`w-16 h-16 ${theme.inputRounded} bg-white flex items-center justify-center shadow-lg`}
                animate={style === 'cartoon' ? { y: [0, -10, 0] } : {}}
                transition={{ duration: 1.8, repeat: Infinity }}
              >
                <Award className="w-8 h-8 text-[#ff6b9d]" />
              </motion.div>
              <div>
                <p className={`text-4xl font-bold ${style === 'cartoon' ? 'text-white' : 'text-gray-900'}`}>248</p>
                <p className={`text-sm ${style === 'cartoon' ? 'text-white/80' : 'text-gray-500'}`}>
                  总徽章数{theme.enableEmojis && " 🏆"}
                </p>
              </div>
            </div>
          </Card>
        </motion.div>
        <motion.div whileHover={{ scale: style === 'cartoon' ? 1.05 : 1.02, rotate: style === 'cartoon' ? -2 : 0 }} transition={{ type: "spring" }}>
          <Card className={`p-5 ${style === 'cartoon' ? 'bg-gradient-to-br from-[#c44569] via-[#ff6b9d] to-white' : 'bg-white'} ${theme.cardBorder} ${theme.buttonShadow} ${theme.cardRounded}`}>
            <div className="flex items-center gap-4">
              <motion.div 
                className={`w-16 h-16 ${theme.inputRounded} bg-white flex items-center justify-center text-3xl shadow-lg`}
                animate={style === 'cartoon' ? { rotate: 360 } : {}}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              >
                {theme.enableEmojis ? "🎉" : <Star className="w-8 h-8 text-[#c44569]" />}
              </motion.div>
              <div>
                <p className={`text-4xl font-bold ${style === 'cartoon' ? 'text-white' : 'text-gray-900'}`}>8</p>
                <p className={`text-sm ${style === 'cartoon' ? 'text-white/80' : 'text-gray-500'}`}>
                  本周升级{theme.enableEmojis && " 🎊"}
                </p>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Student Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredStudents.map((student, index) => (
          <motion.div
            key={student.id}
            initial={{ opacity: 0, scale: 0.8, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.05 }}
            whileHover={{ scale: style === 'cartoon' ? 1.05 : 1.02, rotate: style === 'cartoon' ? 2 : 0 }}
          >
            <Card className={`relative overflow-hidden ${theme.cardBg} ${theme.cardBorder} ${theme.buttonShadow} hover:shadow-2xl transition-all duration-300 ${theme.cardRounded}`}>
              {celebratingStudent === student.id && theme.enableDecorations && (
                <motion.div
                  className="absolute inset-0 pointer-events-none z-10"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {[...Array(10)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="absolute text-4xl"
                      initial={{
                        x: "50%",
                        y: "50%",
                        opacity: 1,
                      }}
                      animate={{
                        x: `${Math.random() * 100}%`,
                        y: `${Math.random() * 100}%`,
                        opacity: 0,
                      }}
                      transition={{ duration: 1.5 }}
                    >
                      {["🎉", "✨", "⭐", "🌟", "💫"][Math.floor(Math.random() * 5)]}
                    </motion.div>
                  ))}
                </motion.div>
              )}

              {/* Group tag */}
              <motion.div 
                className="absolute top-3 right-3 z-20"
                whileHover={{ scale: 1.1, rotate: style === 'cartoon' ? 5 : 0 }}
              >
                <Badge className={`${groupColors[student.group][style]} px-3 py-1 text-sm border-0 ${theme.badgeRounded}`}>
                  {student.group}
                </Badge>
              </motion.div>

              <div className="p-6 space-y-4">
                {/* Pet avatar */}
                <div className="flex flex-col items-center space-y-3">
                  <motion.div
                    className={`w-28 h-28 ${theme.cardRounded} ${style === 'cartoon' ? 'bg-gradient-to-br from-[#ffe5d9] to-[#ffd9e8]' : 'bg-gray-100'} flex items-center justify-center text-6xl ${theme.buttonShadow} relative`}
                    whileHover={style === 'cartoon' ? { 
                      rotate: [0, -15, 15, -15, 0],
                      scale: 1.15
                    } : { scale: 1.1 }}
                    transition={{ duration: 0.5 }}
                  >
                    {student.pet}
                    {theme.enableDecorations && (
                      <motion.div
                        className="absolute -top-2 -right-2 w-8 h-8 bg-[#ffd93d] rounded-full flex items-center justify-center shadow-lg"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                      >
                        <Star className="w-4 h-4 text-[#ff6b6b] fill-current" />
                      </motion.div>
                    )}
                  </motion.div>
                  <div className="text-center">
                    <h3 className="text-xl font-bold text-[#4a4a4a]">{student.name}</h3>
                    <p className="text-sm text-[#a0a0a0]">{student.petName}</p>
                  </div>
                </div>

                {/* Level badge */}
                <div className="flex items-center justify-center gap-2">
                  <motion.div 
                    className={`px-4 py-2 ${theme.badgeRounded} ${style === 'cartoon' ? 'bg-gradient-to-r from-[#ffd93d] to-[#ffe66d]' : 'bg-yellow-100'} text-[#4a4a4a] font-bold shadow-lg`}
                    whileHover={{ scale: 1.1 }}
                  >
                    {theme.enableEmojis && "⭐ "}等级 {student.level}
                  </motion.div>
                  <motion.button
                    onClick={() => handleLevelUp(student.id)}
                    className={`px-4 py-2 ${theme.badgeRounded} ${theme.buttonPrimary} text-white font-bold shadow-lg hover:shadow-xl transition-all`}
                    whileHover={{ scale: 1.1, rotate: style === 'cartoon' ? 5 : 0 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <Sparkles className="w-4 h-4 inline mr-1" />
                    加分
                  </motion.button>
                </div>

                {/* Progress bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#a0a0a0]">{theme.enableEmojis && "🌱 "}成长进度</span>
                    <span className="text-[#4ecdc4] font-bold">
                      {student.points}/{student.maxPoints}
                    </span>
                  </div>
                  <div className={`h-4 ${theme.inputBg} ${style === 'minimal' ? 'rounded-full' : 'rounded-full'} overflow-hidden ${theme.inputBorder}`}>
                    <motion.div
                      className={`h-full ${style === 'cartoon' ? 'bg-gradient-to-r from-[#4ecdc4] via-[#95e1d3] to-[#ffd93d]' : 'bg-[#4ecdc4]'} rounded-full`}
                      initial={{ width: 0 }}
                      animate={{ width: `${student.points}%` }}
                      transition={{ duration: 1, delay: index * 0.05 }}
                    />
                  </div>
                </div>

                {/* Badge count */}
                <motion.div 
                  className={`flex items-center justify-center gap-2 pt-3 border-t-2 ${style === 'cartoon' ? 'border-[#ffe5d9]' : 'border-gray-200'}`}
                  whileHover={{ scale: 1.05 }}
                >
                  <Award className="w-6 h-6 text-[#ffd93d]" />
                  <span className="text-sm text-[#a0a0a0]">获得徽章</span>
                  <span className="text-2xl font-bold text-[#4a4a4a]">{student.badges}</span>
                  {theme.enableEmojis && <span className="text-xl">🏆</span>}
                </motion.div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Empty state */}
      {filteredStudents.length === 0 && (
        <motion.div 
          className="flex flex-col items-center justify-center py-16 space-y-4"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <motion.div 
            className={`w-32 h-32 ${style === 'cartoon' ? 'rounded-full' : 'rounded-lg'} ${style === 'cartoon' ? 'bg-gradient-to-br from-[#ffe5d9] to-[#ffd9e8]' : 'bg-gray-100'} flex items-center justify-center text-6xl ${theme.buttonShadow}`}
            animate={style === 'cartoon' ? { rotate: [0, 10, -10, 0] } : {}}
            transition={{ duration: 2, repeat: Infinity }}
          >
            🔍
          </motion.div>
          <div className="text-center">
            <h3 className="text-2xl font-bold text-[#4a4a4a]">未找到学生</h3>
            <p className="text-lg text-[#a0a0a0]">请尝试其他搜索关键词{theme.enableEmojis && " 🤔"}</p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
