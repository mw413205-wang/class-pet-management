import { useState } from "react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "../components/ui/dialog";
import { Gift, Plus, ShoppingCart, History, Sparkles } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { motion } from "motion/react";
import { toast } from "sonner";

interface Reward {
  id: number;
  name: string;
  icon: string;
  price: number;
  stock: number;
  description: string;
  category: string;
}

interface RedeemHistory {
  id: number;
  studentName: string;
  rewardName: string;
  price: number;
  date: string;
}

const mockRewards: Reward[] = [
  { id: 1, name: "表扬信", icon: "📜", price: 50, stock: 20, description: "一份精美的表扬信", category: "荣誉" },
  { id: 2, name: "小红花", icon: "🌺", price: 30, stock: 50, description: "一朵漂亮的小红花", category: "荣誉" },
  { id: 3, name: "作业减免卡", icon: "✨", price: 100, stock: 10, description: "免做一次作业", category: "特权" },
  { id: 4, name: "座位选择权", icon: "🪑", price: 80, stock: 5, description: "自由选择座位一周", category: "特权" },
  { id: 5, name: "铅笔", icon: "✏️", price: 20, stock: 100, description: "一支漂亮的铅笔", category: "文具" },
  { id: 6, name: "橡皮擦", icon: "🧽", price: 15, stock: 100, description: "可爱的橡皮擦", category: "文具" },
  { id: 7, name: "贴纸套装", icon: "🎨", price: 40, stock: 30, description: "一套精美贴纸", category: "文具" },
  { id: 8, name: "糖果", icon: "🍬", price: 25, stock: 60, description: "美味的糖果", category: "零食" },
];

const mockHistory: RedeemHistory[] = [
  { id: 1, studentName: "李明", rewardName: "小红花", price: 30, date: "2026-02-28" },
  { id: 2, studentName: "王芳", rewardName: "作业减免卡", price: 100, date: "2026-02-27" },
  { id: 3, studentName: "张伟", rewardName: "铅笔", price: 20, date: "2026-02-27" },
  { id: 4, studentName: "陈静", rewardName: "贴纸套装", price: 40, date: "2026-02-26" },
  { id: 5, studentName: "刘洋", rewardName: "座位选择权", price: 80, date: "2026-02-25" },
];

export default function RewardSystem() {
  const [rewards, setRewards] = useState<Reward[]>(mockRewards);
  const [history, setHistory] = useState<RedeemHistory[]>(mockHistory);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("全部");
  const [formData, setFormData] = useState({
    name: "",
    icon: "🎁",
    price: "",
    stock: "",
    description: "",
    category: "荣誉",
  });

  const categories = ["全部", "荣誉", "特权", "文具", "零食"];

  const filteredRewards =
    selectedCategory === "全部"
      ? rewards
      : rewards.filter((reward) => reward.category === selectedCategory);

  const handleAddReward = () => {
    if (formData.name.trim() && formData.price && formData.stock) {
      const newReward: Reward = {
        id: Date.now(),
        name: formData.name,
        icon: formData.icon,
        price: parseInt(formData.price),
        stock: parseInt(formData.stock),
        description: formData.description,
        category: formData.category,
      };
      setRewards([...rewards, newReward]);
      setFormData({
        name: "",
        icon: "🎁",
        price: "",
        stock: "",
        description: "",
        category: "荣誉",
      });
      setIsAddDialogOpen(false);
      toast.success("奖励添加成功！");
    }
  };

  const handleRedeem = (reward: Reward) => {
    if (reward.stock > 0) {
      setRewards(
        rewards.map((r) =>
          r.id === reward.id ? { ...r, stock: r.stock - 1 } : r
        )
      );
      const newHistory: RedeemHistory = {
        id: Date.now(),
        studentName: "当前学生",
        rewardName: reward.name,
        price: reward.price,
        date: new Date().toISOString().split("T")[0],
      };
      setHistory([newHistory, ...history]);
      toast.success(`成功兑换 ${reward.name}！`);
    } else {
      toast.error("库存不足！");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl text-[#2d5f4e]">小卖部</h2>
          <p className="text-sm text-[#8e8e8e] mt-1">管理奖励商品和兑换记录</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="h-11 bg-gradient-to-r from-[#5fb894] to-[#7ec8e3] hover:from-[#4a9b7a] hover:to-[#6bb5cf] rounded-xl">
              <Plus className="w-5 h-5 mr-2" />
              添加奖励
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>添加新奖励</DialogTitle>
              <DialogDescription>填写奖励物品信息</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="rewardName">奖励名称</Label>
                <Input
                  id="rewardName"
                  placeholder="例如: 小红花"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="h-11 bg-[#faf8f5] border-[#e5e5e5] rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rewardIcon">图标</Label>
                  <Input
                    id="rewardIcon"
                    placeholder="🎁"
                    value={formData.icon}
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                    className="h-11 bg-[#faf8f5] border-[#e5e5e5] rounded-xl text-center text-2xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">分类</Label>
                  <Input
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="h-11 bg-[#faf8f5] border-[#e5e5e5] rounded-xl"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">积分价格</Label>
                  <Input
                    id="price"
                    type="number"
                    placeholder="50"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="h-11 bg-[#faf8f5] border-[#e5e5e5] rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stock">库存数量</Label>
                  <Input
                    id="stock"
                    type="number"
                    placeholder="20"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    className="h-11 bg-[#faf8f5] border-[#e5e5e5] rounded-xl"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">描述</Label>
                <Input
                  id="description"
                  placeholder="奖励描述"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="h-11 bg-[#faf8f5] border-[#e5e5e5] rounded-xl"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsAddDialogOpen(false)}
                className="rounded-xl"
              >
                取消
              </Button>
              <Button
                onClick={handleAddReward}
                className="bg-gradient-to-r from-[#5fb894] to-[#7ec8e3] rounded-xl"
              >
                确认添加
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="rewards" className="space-y-6">
        <TabsList className="bg-[#faf8f5] p-1 rounded-xl">
          <TabsTrigger value="rewards" className="rounded-lg">
            <ShoppingCart className="w-4 h-4 mr-2" />
            奖励商品
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-lg">
            <History className="w-4 h-4 mr-2" />
            兑换记录
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rewards" className="space-y-6">
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

          {/* Rewards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredRewards.map((reward, index) => (
              <motion.div
                key={reward.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <Card className="bg-white border-0 shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group">
                  <div className="p-5 space-y-4">
                    {/* Icon */}
                    <div className="flex items-center justify-center">
                      <motion.div
                        className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#fff5e6] to-[#fef0f9] flex items-center justify-center text-4xl shadow-inner group-hover:scale-110 transition-transform duration-300"
                        whileHover={{ rotate: [0, -10, 10, -10, 0] }}
                      >
                        {reward.icon}
                      </motion.div>
                    </div>

                    {/* Info */}
                    <div className="text-center space-y-1">
                      <h3 className="text-lg text-[#2d5f4e]">{reward.name}</h3>
                      <p className="text-sm text-[#8e8e8e]">{reward.description}</p>
                    </div>

                    {/* Category badge */}
                    <div className="flex justify-center">
                      <Badge className="bg-[#e8f4ef] text-[#2d5f4e] border-0">
                        {reward.category}
                      </Badge>
                    </div>

                    {/* Price and stock */}
                    <div className="flex items-center justify-between pt-3 border-t border-[#f0f0f0]">
                      <div className="flex items-center gap-1">
                        <Sparkles className="w-4 h-4 text-[#ffd4a3]" />
                        <span className="text-lg text-[#2d5f4e]">{reward.price}</span>
                        <span className="text-sm text-[#8e8e8e]">积分</span>
                      </div>
                      <span className="text-sm text-[#8e8e8e]">
                        库存: {reward.stock}
                      </span>
                    </div>

                    {/* Redeem button */}
                    <Button
                      onClick={() => handleRedeem(reward)}
                      disabled={reward.stock === 0}
                      className="w-full h-10 bg-gradient-to-r from-[#5fb894] to-[#7ec8e3] hover:from-[#4a9b7a] hover:to-[#6bb5cf] rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {reward.stock > 0 ? "兑换" : "已售罄"}
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Empty state */}
          {filteredRewards.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <div className="w-24 h-24 rounded-full bg-[#f5f3f0] flex items-center justify-center text-4xl">
                🎁
              </div>
              <div className="text-center">
                <h3 className="text-lg text-[#4a4a4a]">暂无奖励</h3>
                <p className="text-sm text-[#8e8e8e]">该分类下还没有奖励物品</p>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <Card className="bg-white border-0 shadow-sm overflow-hidden">
            <div className="divide-y divide-[#f0f0f0]">
              {history.map((record) => (
                <div
                  key={record.id}
                  className="p-4 hover:bg-[#fdfcfa] transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#e8f4ef] to-[#f0fdf4] flex items-center justify-center">
                        <Gift className="w-6 h-6 text-[#5fb894]" />
                      </div>
                      <div>
                        <p className="text-[#2d5f4e]">{record.studentName}</p>
                        <p className="text-sm text-[#8e8e8e]">
                          兑换了 {record.rewardName}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[#2d5f4e]">-{record.price} 积分</p>
                      <p className="text-sm text-[#8e8e8e]">{record.date}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Empty state */}
          {history.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <div className="w-24 h-24 rounded-full bg-[#f5f3f0] flex items-center justify-center text-4xl">
                📜
              </div>
              <div className="text-center">
                <h3 className="text-lg text-[#4a4a4a]">暂无兑换记录</h3>
                <p className="text-sm text-[#8e8e8e]">还没有学生兑换奖励</p>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
