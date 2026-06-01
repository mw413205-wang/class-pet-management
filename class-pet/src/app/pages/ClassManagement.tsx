import { useState } from "react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "../components/ui/dialog";
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
import { Users, Plus, Edit, Trash2, RotateCcw } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";

interface Class {
  id: number;
  name: string;
  studentCount: number;
  color: string;
}

const mockClasses: Class[] = [
  { id: 1, name: "三年级(1)班", studentCount: 42, color: "from-[#5fb894] to-[#7ec8e3]" },
  { id: 2, name: "三年级(2)班", studentCount: 38, color: "from-[#ffd4a3] to-[#f8b4d9]" },
  { id: 3, name: "三年级(3)班", studentCount: 40, color: "from-[#c4b5fd] to-[#7ec8e3]" },
  { id: 4, name: "三年级(4)班", studentCount: 36, color: "from-[#f8b4d9] to-[#c4b5fd]" },
];

export default function ClassManagement() {
  const [classes, setClasses] = useState<Class[]>(mockClasses);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [newClassName, setNewClassName] = useState("");

  const handleAddClass = () => {
    if (newClassName.trim()) {
      const newClass: Class = {
        id: Date.now(),
        name: newClassName,
        studentCount: 0,
        color: "from-[#5fb894] to-[#7ec8e3]",
      };
      setClasses([...classes, newClass]);
      setNewClassName("");
      setIsAddDialogOpen(false);
      toast.success("班级添加成功！");
    }
  };

  const handleEditClass = () => {
    if (selectedClass && newClassName.trim()) {
      setClasses(
        classes.map((cls) =>
          cls.id === selectedClass.id ? { ...cls, name: newClassName } : cls
        )
      );
      setIsEditDialogOpen(false);
      setNewClassName("");
      toast.success("班级名称已更新！");
    }
  };

  const handleDeleteClass = () => {
    if (selectedClass) {
      setClasses(classes.filter((cls) => cls.id !== selectedClass.id));
      setIsDeleteDialogOpen(false);
      toast.success("班级已删除！");
    }
  };

  const handleResetClass = () => {
    if (selectedClass) {
      toast.success("班级进度已重置！");
      setIsResetDialogOpen(false);
    }
  };

  const openEditDialog = (cls: Class) => {
    setSelectedClass(cls);
    setNewClassName(cls.name);
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (cls: Class) => {
    setSelectedClass(cls);
    setIsDeleteDialogOpen(true);
  };

  const openResetDialog = (cls: Class) => {
    setSelectedClass(cls);
    setIsResetDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl text-[#2d5f4e]">班级管理</h2>
          <p className="text-sm text-[#8e8e8e] mt-1">管理您的所有班级和学生数据</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="h-11 bg-gradient-to-r from-[#5fb894] to-[#7ec8e3] hover:from-[#4a9b7a] hover:to-[#6bb5cf] rounded-xl">
              <Plus className="w-5 h-5 mr-2" />
              添加班级
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>添加新班级</DialogTitle>
              <DialogDescription>输入班级名称以创建新的班级</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="className">班级名称</Label>
                <Input
                  id="className"
                  placeholder="例如: 四年级(1)班"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
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
                onClick={handleAddClass}
                className="bg-gradient-to-r from-[#5fb894] to-[#7ec8e3] rounded-xl"
              >
                确认添加
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Class Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {classes.map((cls, index) => (
          <motion.div
            key={cls.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
          >
            <Card className="overflow-hidden bg-white border-0 shadow-md hover:shadow-xl transition-all duration-300">
              {/* Gradient header */}
              <div className={`bg-gradient-to-r ${cls.color} p-6 text-white`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <Users className="w-6 h-6" />
                  </div>
                  <div className="text-right">
                    <p className="text-3xl">{cls.studentCount}</p>
                    <p className="text-sm opacity-90">学生</p>
                  </div>
                </div>
                <h3 className="text-xl">{cls.name}</h3>
              </div>

              {/* Action buttons */}
              <div className="p-4 space-y-2">
                <Button
                  variant="outline"
                  className="w-full rounded-xl border-[#e5e5e5] hover:bg-[#e8f4ef] hover:text-[#2d5f4e] hover:border-[#5fb894]"
                  onClick={() => openEditDialog(cls)}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  编辑班级
                </Button>
                <Button
                  variant="outline"
                  className="w-full rounded-xl border-[#e5e5e5] hover:bg-[#fff5e6] hover:text-[#8b5a00] hover:border-[#ffd4a3]"
                  onClick={() => openResetDialog(cls)}
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  重置进度
                </Button>
                <Button
                  variant="outline"
                  className="w-full rounded-xl border-[#e5e5e5] hover:bg-[#fef2f2] hover:text-[#ef4444] hover:border-[#ef4444]"
                  onClick={() => openDeleteDialog(cls)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  删除班级
                </Button>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Empty state */}
      {classes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 space-y-4">
          <div className="w-24 h-24 rounded-full bg-[#f5f3f0] flex items-center justify-center text-4xl">
            📚
          </div>
          <div className="text-center">
            <h3 className="text-lg text-[#4a4a4a]">还没有班级</h3>
            <p className="text-sm text-[#8e8e8e]">点击上方按钮添加您的第一个班级</p>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>编辑班级</DialogTitle>
            <DialogDescription>修改班级名称</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editClassName">班级名称</Label>
              <Input
                id="editClassName"
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                className="h-11 bg-[#faf8f5] border-[#e5e5e5] rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              className="rounded-xl"
            >
              取消
            </Button>
            <Button
              onClick={handleEditClass}
              className="bg-gradient-to-r from-[#5fb894] to-[#7ec8e3] rounded-xl"
            >
              保存更改
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除班级？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作将永久删除"{selectedClass?.name}"及其所有学生数据。此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteClass}
              className="bg-[#ef4444] hover:bg-[#dc2626] rounded-xl"
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认重置进度？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作将重置"{selectedClass?.name}"所有学生的成长进度和徽章。此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetClass}
              className="bg-[#ffd4a3] hover:bg-[#ffcd8a] text-[#8b5a00] rounded-xl"
            >
              确认重置
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
