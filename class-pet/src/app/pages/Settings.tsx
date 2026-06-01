import { useState } from "react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { Save, RotateCcw, Palette, Trophy, Target } from "lucide-react";
import { toast } from "sonner";

export default function Settings() {
  const [systemName, setSystemName] = useState("班级宠物园");
  const [colorScheme, setColorScheme] = useState("jade");
  const [enableAnimations, setEnableAnimations] = useState(true);
  const [enableNotifications, setEnableNotifications] = useState(true);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);

  // Growth stage thresholds
  const [stage1Points, setStage1Points] = useState("50");
  const [stage2Points, setStage2Points] = useState("100");
  const [stage3Points, setStage3Points] = useState("150");
  const [stage4Points, setStage4Points] = useState("200");

  const colorSchemes = [
    { id: "jade", name: "翡翠绿", color: "bg-[#5fb894]" },
    { id: "sky", name: "天空蓝", color: "bg-[#7ec8e3]" },
    { id: "peach", name: "蜜桃橙", color: "bg-[#ffd4a3]" },
    { id: "pink", name: "樱花粉", color: "bg-[#f8b4d9]" },
    { id: "lavender", name: "薰衣紫", color: "bg-[#c4b5fd]" },
  ];

  const handleSaveSettings = () => {
    toast.success("设置已保存！");
  };

  const handleResetProgress = () => {
    toast.success("所有班级进度已重置！");
    setIsResetDialogOpen(false);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-2xl text-[#2d5f4e]">系统设置</h2>
        <p className="text-sm text-[#8e8e8e] mt-1">管理系统配置和个性化选项</p>
      </div>

      {/* Basic Settings */}
      <Card className="p-6 bg-white border-0 shadow-sm space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-[#f0f0f0]">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#5fb894] to-[#7ec8e3] flex items-center justify-center">
            <Target className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg text-[#2d5f4e]">基础设置</h3>
            <p className="text-sm text-[#8e8e8e]">配置系统基本信息</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="systemName">系统名称</Label>
            <Input
              id="systemName"
              value={systemName}
              onChange={(e) => setSystemName(e.target.value)}
              className="h-11 bg-[#faf8f5] border-[#e5e5e5] rounded-xl"
              placeholder="班级宠物园"
            />
            <p className="text-xs text-[#8e8e8e]">此名称将显示在登录页面和系统顶部</p>
          </div>

          <div className="space-y-3">
            <Label>显示设置</Label>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 bg-[#faf8f5] rounded-xl">
                <div>
                  <p className="text-sm text-[#2d5f4e]">启用动画效果</p>
                  <p className="text-xs text-[#8e8e8e]">显示过渡动画和悬停效果</p>
                </div>
                <Switch
                  checked={enableAnimations}
                  onCheckedChange={setEnableAnimations}
                />
              </div>
              <div className="flex items-center justify-between p-4 bg-[#faf8f5] rounded-xl">
                <div>
                  <p className="text-sm text-[#2d5f4e]">启用通知提醒</p>
                  <p className="text-xs text-[#8e8e8e]">接收系统消息和提醒</p>
                </div>
                <Switch
                  checked={enableNotifications}
                  onCheckedChange={setEnableNotifications}
                />
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Color Scheme */}
      <Card className="p-6 bg-white border-0 shadow-sm space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-[#f0f0f0]">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ffd4a3] to-[#f8b4d9] flex items-center justify-center">
            <Palette className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg text-[#2d5f4e]">主题配色</h3>
            <p className="text-sm text-[#8e8e8e]">选择系统的主题配色方案</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {colorSchemes.map((scheme) => (
            <button
              key={scheme.id}
              onClick={() => setColorScheme(scheme.id)}
              className={`p-4 rounded-xl border-2 transition-all ${
                colorScheme === scheme.id
                  ? "border-[#5fb894] bg-[#e8f4ef]"
                  : "border-[#e5e5e5] hover:border-[#5fb894]"
              }`}
            >
              <div className={`w-full h-12 ${scheme.color} rounded-lg mb-2 shadow-sm`}></div>
              <p className="text-sm text-[#4a4a4a]">{scheme.name}</p>
            </button>
          ))}
        </div>
      </Card>

      {/* Growth Stages Configuration */}
      <Card className="p-6 bg-white border-0 shadow-sm space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-[#f0f0f0]">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#f8b4d9] to-[#c4b5fd] flex items-center justify-center">
            <Trophy className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg text-[#2d5f4e]">成长阶段配置</h3>
            <p className="text-sm text-[#8e8e8e]">设置每个成长阶段所需的积分</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="stage1">阶段 1 → 2 所需积分</Label>
            <Input
              id="stage1"
              type="number"
              value={stage1Points}
              onChange={(e) => setStage1Points(e.target.value)}
              className="h-11 bg-[#faf8f5] border-[#e5e5e5] rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="stage2">阶段 2 → 3 所需积分</Label>
            <Input
              id="stage2"
              type="number"
              value={stage2Points}
              onChange={(e) => setStage2Points(e.target.value)}
              className="h-11 bg-[#faf8f5] border-[#e5e5e5] rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="stage3">阶段 3 → 4 所需积分</Label>
            <Input
              id="stage3"
              type="number"
              value={stage3Points}
              onChange={(e) => setStage3Points(e.target.value)}
              className="h-11 bg-[#faf8f5] border-[#e5e5e5] rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="stage4">阶段 4 → 5 所需积分</Label>
            <Input
              id="stage4"
              type="number"
              value={stage4Points}
              onChange={(e) => setStage4Points(e.target.value)}
              className="h-11 bg-[#faf8f5] border-[#e5e5e5] rounded-xl"
            />
          </div>
        </div>

        <div className="bg-[#e8f4ef] rounded-xl p-4 text-sm text-[#2d5f4e]">
          <p className="mb-1">💡 提示：</p>
          <p className="text-xs">修改积分阈值后，将应用于所有新创建的宠物成长进度</p>
        </div>
      </Card>

      {/* Danger Zone */}
      <Card className="p-6 bg-white border-0 shadow-sm space-y-6 border-l-4 border-l-[#ef4444]">
        <div className="flex items-center gap-3 pb-4 border-b border-[#f0f0f0]">
          <div className="w-10 h-10 rounded-xl bg-[#ef4444] flex items-center justify-center">
            <RotateCcw className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg text-[#ef4444]">危险操作</h3>
            <p className="text-sm text-[#8e8e8e]">请谨慎执行以下操作</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-[#fef2f2] rounded-xl border border-[#fecaca]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="text-sm text-[#ef4444] mb-1">重置所有班级进度</h4>
                <p className="text-xs text-[#8e8e8e]">
                  此操作将清除所有学生的成长进度、积分和徽章数据，且无法恢复
                </p>
              </div>
              <Button
                onClick={() => setIsResetDialogOpen(true)}
                variant="destructive"
                className="rounded-xl bg-[#ef4444] hover:bg-[#dc2626] shrink-0"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                重置进度
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          className="h-11 rounded-xl border-[#e5e5e5]"
          onClick={() => toast.info("设置已取消")}
        >
          取消
        </Button>
        <Button
          onClick={handleSaveSettings}
          className="h-11 bg-gradient-to-r from-[#5fb894] to-[#7ec8e3] hover:from-[#4a9b7a] hover:to-[#6bb5cf] rounded-xl"
        >
          <Save className="w-5 h-5 mr-2" />
          保存设置
        </Button>
      </div>

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#ef4444]">
              ⚠️ 确认重置所有进度？
            </AlertDialogTitle>
            <AlertDialogDescription>
              此操作将清除所有班级的学生成长进度、积分和徽章数据。
              <br />
              <br />
              <span className="text-[#ef4444]">此操作不可撤销，请谨慎操作！</span>
              <br />
              <br />
              如果您确定要继续，请点击"确认重置"按钮。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetProgress}
              className="bg-[#ef4444] hover:bg-[#dc2626] rounded-xl"
            >
              确认重置
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
