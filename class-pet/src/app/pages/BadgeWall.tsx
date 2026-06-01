import { useState } from "react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Award, Download, FileText, Image as ImageIcon, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";

interface Badge {
  id: number;
  name: string;
  icon: string;
  description: string;
  earnedBy: string[];
  color: string;
  category: string;
}

const mockBadges: Badge[] = [
  {
    id: 1,
    name: "优秀学生",
    icon: "⭐",
    description: "表现优秀，成绩突出",
    earnedBy: ["李明", "王芳", "陈静"],
    color: "from-[#ffd4a3] to-[#f8b4d9]",
    category: "学习",
  },
  {
    id: 2,
    name: "进步之星",
    icon: "🌟",
    description: "进步显著，值得鼓励",
    earnedBy: ["张伟", "刘洋", "赵敏", "周慧"],
    color: "from-[#5fb894] to-[#7ec8e3]",
    category: "学习",
  },
  {
    id: 3,
    name: "团队之星",
    icon: "🤝",
    description: "善于合作，团队精神",
    earnedBy: ["孙涛", "吴刚"],
    color: "from-[#7ec8e3] to-[#c4b5fd]",
    category: "品德",
  },
  {
    id: 4,
    name: "创意达人",
    icon: "🎨",
    description: "富有创意，想象力丰富",
    earnedBy: ["王芳", "郑美"],
    color: "from-[#f8b4d9] to-[#c4b5fd]",
    category: "特长",
  },
  {
    id: 5,
    name: "运动健将",
    icon: "🏃",
    description: "热爱运动，体育优秀",
    earnedBy: ["孙涛", "钱强"],
    color: "from-[#c4b5fd] to-[#ffd4a3]",
    category: "特长",
  },
  {
    id: 6,
    name: "阅读之星",
    icon: "📚",
    description: "热爱阅读，知识丰富",
    earnedBy: ["陈静", "孙丽"],
    color: "from-[#e8f4ef] to-[#7ec8e3]",
    category: "学习",
  },
  {
    id: 7,
    name: "助人为乐",
    icon: "❤️",
    description: "乐于助人，品德优秀",
    earnedBy: ["李明", "赵敏", "吴刚"],
    color: "from-[#ffd4a3] to-[#7ec8e3]",
    category: "品德",
  },
  {
    id: 8,
    name: "毕业徽章",
    icon: "🎓",
    description: "完成所有成长阶段",
    earnedBy: ["陈静", "郑美"],
    color: "from-[#f8b4d9] to-[#ffd4a3]",
    category: "成就",
  },
];

export default function BadgeWall() {
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);
  const [isBadgeDetailOpen, setIsBadgeDetailOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState("pdf");
  const [exportType, setExportType] = useState("student");
  const [selectedCategory, setSelectedCategory] = useState("全部");

  const categories = ["全部", "学习", "品德", "特长", "成就"];

  const filteredBadges =
    selectedCategory === "全部"
      ? mockBadges
      : mockBadges.filter((badge) => badge.category === selectedCategory);

  const openBadgeDetail = (badge: Badge) => {
    setSelectedBadge(badge);
    setIsBadgeDetailOpen(true);
  };

  const handleExport = () => {
    toast.success(`正在导出${exportFormat.toUpperCase()}格式的徽章证书...`);
    setIsExportDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl text-[#2d5f4e]">徽章墙</h2>
          <p className="text-sm text-[#8e8e8e] mt-1">查看和管理学生获得的成就徽章</p>
        </div>
        <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
          <Button
            onClick={() => setIsExportDialogOpen(true)}
            className="h-11 bg-gradient-to-r from-[#5fb894] to-[#7ec8e3] hover:from-[#4a9b7a] hover:to-[#6bb5cf] rounded-xl"
          >
            <Download className="w-5 h-5 mr-2" />
            导出证书
          </Button>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>导出徽章证书</DialogTitle>
              <DialogDescription>
                选择导出格式和类型
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm text-[#4a4a4a]">导出类型</label>
                <Select value={exportType} onValueChange={setExportType}>
                  <SelectTrigger className="h-11 bg-[#faf8f5] border-[#e5e5e5] rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">单个学生</SelectItem>
                    <SelectItem value="class">全班学生</SelectItem>
                    <SelectItem value="badge">特定徽章</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-[#4a4a4a]">导出格式</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setExportFormat("pdf")}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      exportFormat === "pdf"
                        ? "border-[#5fb894] bg-[#e8f4ef]"
                        : "border-[#e5e5e5] hover:border-[#5fb894]"
                    }`}
                  >
                    <FileText className="w-8 h-8 mx-auto mb-2 text-[#ef4444]" />
                    <p className="text-sm text-[#4a4a4a]">PDF</p>
                  </button>
                  <button
                    onClick={() => setExportFormat("png")}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      exportFormat === "png"
                        ? "border-[#5fb894] bg-[#e8f4ef]"
                        : "border-[#e5e5e5] hover:border-[#5fb894]"
                    }`}
                  >
                    <ImageIcon className="w-8 h-8 mx-auto mb-2 text-[#7ec8e3]" />
                    <p className="text-sm text-[#4a4a4a]">PNG</p>
                  </button>
                </div>
              </div>
              <div className="bg-[#fff5e6] rounded-xl p-3 text-sm text-[#8b5a00]">
                <p className="mb-1">💡 提示：</p>
                <p className="text-xs">证书将包含学生信息、徽章名称和获得日期</p>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsExportDialogOpen(false)}
                className="rounded-xl"
              >
                取消
              </Button>
              <Button
                onClick={handleExport}
                className="bg-gradient-to-r from-[#5fb894] to-[#7ec8e3] rounded-xl"
              >
                确认导出
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-gradient-to-br from-[#e8f4ef] to-white border-0 shadow-sm">
          <div className="text-center">
            <p className="text-3xl text-[#2d5f4e] mb-1">{mockBadges.length}</p>
            <p className="text-sm text-[#8e8e8e]">���章种类</p>
          </div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-[#fff5e6] to-white border-0 shadow-sm">
          <div className="text-center">
            <p className="text-3xl text-[#8b5a00] mb-1">
              {mockBadges.reduce((acc, badge) => acc + badge.earnedBy.length, 0)}
            </p>
            <p className="text-sm text-[#8e8e8e]">已颁发</p>
          </div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-[#fef0f9] to-white border-0 shadow-sm">
          <div className="text-center">
            <p className="text-3xl text-[#be185d] mb-1">12</p>
            <p className="text-sm text-[#8e8e8e]">本周新增</p>
          </div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-[#f5f3ff] to-white border-0 shadow-sm">
          <div className="text-center">
            <p className="text-3xl text-[#7c3aed] mb-1">
              {new Set(mockBadges.flatMap((b) => b.earnedBy)).size}
            </p>
            <p className="text-sm text-[#8e8e8e]">获奖学生</p>
          </div>
        </Card>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        {categories.map((category) => (
          <Button
            key={category}
            variant={selectedCategory === category ? "default" : "outline"}
            onClick={() => setSelectedCategory(category)}
            className={`rounded-xl ${
              selectedCategory === category
                ? "bg-gradient-to-r from-[#5fb894] to-[#7ec8e3]"
                : "border-[#e5e5e5] hover:bg-[#e8f4ef]"
            }`}
          >
            {category}
          </Button>
        ))}
      </div>

      {/* Badge Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {filteredBadges.map((badge, index) => (
          <motion.div
            key={badge.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
          >
            <Card
              className="bg-white border-0 shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden group"
              onClick={() => openBadgeDetail(badge)}
            >
              <div className={`bg-gradient-to-br ${badge.color} p-6`}>
                <motion.div
                  className="text-6xl text-center group-hover:scale-110 transition-transform duration-300"
                  whileHover={{ rotate: [0, -10, 10, -10, 0] }}
                >
                  {badge.icon}
                </motion.div>
              </div>
              <div className="p-5 space-y-3">
                <div className="text-center">
                  <h3 className="text-lg text-[#2d5f4e] mb-1">{badge.name}</h3>
                  <p className="text-sm text-[#8e8e8e]">{badge.description}</p>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-[#f0f0f0]">
                  <div className="flex items-center gap-1">
                    <Award className="w-4 h-4 text-[#ffd4a3]" />
                    <span className="text-sm text-[#8e8e8e]">已颁发</span>
                  </div>
                  <span className="text-lg text-[#2d5f4e]">{badge.earnedBy.length}</span>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Empty state */}
      {filteredBadges.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 space-y-4">
          <div className="w-24 h-24 rounded-full bg-[#f5f3f0] flex items-center justify-center text-4xl">
            🏆
          </div>
          <div className="text-center">
            <h3 className="text-lg text-[#4a4a4a]">暂无徽章</h3>
            <p className="text-sm text-[#8e8e8e]">该分类下还没有徽章</p>
          </div>
        </div>
      )}

      {/* Badge Detail Dialog */}
      <Dialog open={isBadgeDetailOpen} onOpenChange={setIsBadgeDetailOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>徽章详情</DialogTitle>
            <DialogDescription>查看获得该徽章的学生</DialogDescription>
          </DialogHeader>
          {selectedBadge && (
            <div className="space-y-6 py-4">
              {/* Badge icon */}
              <div className="flex flex-col items-center space-y-3">
                <motion.div
                  className={`w-24 h-24 rounded-3xl bg-gradient-to-br ${selectedBadge.color} flex items-center justify-center text-6xl shadow-lg`}
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  {selectedBadge.icon}
                </motion.div>
                <div className="text-center">
                  <h3 className="text-xl text-[#2d5f4e]">{selectedBadge.name}</h3>
                  <p className="text-sm text-[#8e8e8e]">{selectedBadge.description}</p>
                </div>
              </div>

              {/* Earned by students */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm text-[#4a4a4a]">获得学生：</h4>
                  <span className="text-sm text-[#5fb894]">
                    共 {selectedBadge.earnedBy.length} 人
                  </span>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {selectedBadge.earnedBy.map((student, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-3 bg-[#faf8f5] rounded-xl"
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#5fb894] to-[#7ec8e3] flex items-center justify-center text-white text-sm">
                        {student.charAt(0)}
                      </div>
                      <p className="text-[#2d5f4e]">{student}</p>
                      <Sparkles className="w-4 h-4 text-[#ffd4a3] ml-auto" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              onClick={() => setIsBadgeDetailOpen(false)}
              className="bg-gradient-to-r from-[#5fb894] to-[#7ec8e3] rounded-xl"
            >
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
