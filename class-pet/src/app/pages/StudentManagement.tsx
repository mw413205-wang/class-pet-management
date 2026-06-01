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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Plus, Edit, Trash2, Upload } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { toast } from "sonner";

interface Student {
  id: number;
  name: string;
  pet: string;
  points: number;
  progress: number;
  group: string;
}

const mockStudents: Student[] = [
  { id: 1, name: "李明", pet: "🐱 小猫咪", points: 75, progress: 75, group: "红组" },
  { id: 2, name: "王芳", pet: "🐰 小兔兔", points: 45, progress: 45, group: "蓝组" },
  { id: 3, name: "张伟", pet: "🐶 小狗狗", points: 88, progress: 88, group: "红组" },
  { id: 4, name: "刘洋", pet: "🦊 小狐狸", points: 62, progress: 62, group: "黄组" },
  { id: 5, name: "陈静", pet: "🐼 熊猫宝宝", points: 92, progress: 92, group: "蓝组" },
  { id: 6, name: "赵敏", pet: "🐨 考拉", points: 55, progress: 55, group: "绿组" },
  { id: 7, name: "孙涛", pet: "🦁 小狮子", points: 78, progress: 78, group: "红组" },
  { id: 8, name: "周慧", pet: "🐯 小老虎", points: 34, progress: 34, group: "黄组" },
];

const groupColors: Record<string, string> = {
  "红组": "bg-[#fecaca] text-[#991b1b]",
  "蓝组": "bg-[#bfdbfe] text-[#1e40af]",
  "黄组": "bg-[#fef08a] text-[#854d0e]",
  "绿组": "bg-[#bbf7d0] text-[#166534]",
};

export default function StudentManagement() {
  const [students, setStudents] = useState<Student[]>(mockStudents);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isBatchUploadOpen, setIsBatchUploadOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    pet: "🐱 小猫咪",
    group: "红组",
  });

  const handleAddStudent = () => {
    if (formData.name.trim()) {
      const newStudent: Student = {
        id: Date.now(),
        name: formData.name,
        pet: formData.pet,
        points: 0,
        progress: 0,
        group: formData.group,
      };
      setStudents([...students, newStudent]);
      setFormData({ name: "", pet: "🐱 小猫咪", group: "红组" });
      setIsAddDialogOpen(false);
      toast.success("学生添加成功！");
    }
  };

  const handleEditStudent = () => {
    if (selectedStudent && formData.name.trim()) {
      setStudents(
        students.map((student) =>
          student.id === selectedStudent.id
            ? { ...student, name: formData.name, pet: formData.pet, group: formData.group }
            : student
        )
      );
      setIsEditDialogOpen(false);
      toast.success("学生信息已更新！");
    }
  };

  const handleDeleteStudent = (id: number) => {
    setStudents(students.filter((student) => student.id !== id));
    toast.success("学生已删除！");
  };

  const openEditDialog = (student: Student) => {
    setSelectedStudent(student);
    setFormData({
      name: student.name,
      pet: student.pet,
      group: student.group,
    });
    setIsEditDialogOpen(true);
  };

  const handleBatchUpload = () => {
    toast.success("批量导入功能演示：已导入5名学生");
    setIsBatchUploadOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl text-[#2d5f4e]">学生管理</h2>
          <p className="text-sm text-[#8e8e8e] mt-1">管理学生信息、分组和宠物分配</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isBatchUploadOpen} onOpenChange={setIsBatchUploadOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="h-11 border-[#5fb894] text-[#5fb894] hover:bg-[#e8f4ef] rounded-xl"
              >
                <Upload className="w-5 h-5 mr-2" />
                批量导入
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>批量导入学生</DialogTitle>
                <DialogDescription>
                  上传Excel文件批量添加学生信息
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="border-2 border-dashed border-[#e5e5e5] rounded-xl p-8 text-center hover:border-[#5fb894] transition-colors cursor-pointer">
                  <Upload className="w-12 h-12 mx-auto text-[#8e8e8e] mb-3" />
                  <p className="text-sm text-[#4a4a4a] mb-1">点击上传或拖拽文件</p>
                  <p className="text-xs text-[#8e8e8e]">支持 .xlsx, .xls 格式</p>
                </div>
                <div className="bg-[#e8f4ef] rounded-xl p-3 text-sm text-[#2d5f4e]">
                  <p className="mb-1">📋 Excel文件格式要求：</p>
                  <p className="text-xs">姓名 | 小组 | 宠物名称</p>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsBatchUploadOpen(false)}
                  className="rounded-xl"
                >
                  取消
                </Button>
                <Button
                  onClick={handleBatchUpload}
                  className="bg-gradient-to-r from-[#5fb894] to-[#7ec8e3] rounded-xl"
                >
                  确认导入
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="h-11 bg-gradient-to-r from-[#5fb894] to-[#7ec8e3] hover:from-[#4a9b7a] hover:to-[#6bb5cf] rounded-xl">
                <Plus className="w-5 h-5 mr-2" />
                添加学生
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>添加新学生</DialogTitle>
                <DialogDescription>填写学生基本信息</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="studentName">学生姓名</Label>
                  <Input
                    id="studentName"
                    placeholder="请输入学生姓名"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="h-11 bg-[#faf8f5] border-[#e5e5e5] rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="petSelect">宠物</Label>
                  <Select
                    value={formData.pet}
                    onValueChange={(value) => setFormData({ ...formData, pet: value })}
                  >
                    <SelectTrigger className="h-11 bg-[#faf8f5] border-[#e5e5e5] rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="🐱 小猫咪">🐱 小猫咪</SelectItem>
                      <SelectItem value="🐰 小兔兔">🐰 小兔兔</SelectItem>
                      <SelectItem value="🐶 小狗狗">🐶 小狗狗</SelectItem>
                      <SelectItem value="🦊 小狐狸">🦊 小狐狸</SelectItem>
                      <SelectItem value="🐼 熊猫宝宝">🐼 熊猫宝宝</SelectItem>
                      <SelectItem value="🐨 考拉">🐨 考拉</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="groupSelect">小组</Label>
                  <Select
                    value={formData.group}
                    onValueChange={(value) => setFormData({ ...formData, group: value })}
                  >
                    <SelectTrigger className="h-11 bg-[#faf8f5] border-[#e5e5e5] rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="红组">红组</SelectItem>
                      <SelectItem value="蓝组">蓝组</SelectItem>
                      <SelectItem value="黄组">黄组</SelectItem>
                      <SelectItem value="绿组">绿组</SelectItem>
                    </SelectContent>
                  </Select>
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
                  onClick={handleAddStudent}
                  className="bg-gradient-to-r from-[#5fb894] to-[#7ec8e3] rounded-xl"
                >
                  确认添加
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Student Table */}
      <Card className="bg-white border-0 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#faf8f5] border-b border-[#f0f0f0]">
                <TableHead className="text-[#4a4a4a]">姓名</TableHead>
                <TableHead className="text-[#4a4a4a]">宠物</TableHead>
                <TableHead className="text-[#4a4a4a]">积分</TableHead>
                <TableHead className="text-[#4a4a4a]">成长进度</TableHead>
                <TableHead className="text-[#4a4a4a]">小组</TableHead>
                <TableHead className="text-[#4a4a4a] text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((student) => (
                <TableRow key={student.id} className="border-b border-[#f5f3f0] hover:bg-[#fdfcfa]">
                  <TableCell className="text-[#2d5f4e]">{student.name}</TableCell>
                  <TableCell>{student.pet}</TableCell>
                  <TableCell>
                    <span className="text-[#5fb894]">{student.points} 分</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-[#f0f0f0] rounded-full overflow-hidden max-w-[120px]">
                        <div
                          className="h-full bg-gradient-to-r from-[#5fb894] to-[#7ec8e3]"
                          style={{ width: `${student.progress}%` }}
                        />
                      </div>
                      <span className="text-sm text-[#8e8e8e]">{student.progress}%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={`${groupColors[student.group]} border-0`}>
                      {student.group}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(student)}
                        className="text-[#5fb894] hover:text-[#4a9b7a] hover:bg-[#e8f4ef]"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteStudent(student.id)}
                        className="text-[#ef4444] hover:text-[#dc2626] hover:bg-[#fef2f2]"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Empty state */}
      {students.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 space-y-4">
          <div className="w-24 h-24 rounded-full bg-[#f5f3f0] flex items-center justify-center text-4xl">
            👥
          </div>
          <div className="text-center">
            <h3 className="text-lg text-[#4a4a4a]">还没有学生</h3>
            <p className="text-sm text-[#8e8e8e]">点击上方按钮添加您的第一个学生</p>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>编辑学生信息</DialogTitle>
            <DialogDescription>修改学生的基本信息</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editStudentName">学生姓名</Label>
              <Input
                id="editStudentName"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="h-11 bg-[#faf8f5] border-[#e5e5e5] rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editPetSelect">宠物</Label>
              <Select
                value={formData.pet}
                onValueChange={(value) => setFormData({ ...formData, pet: value })}
              >
                <SelectTrigger className="h-11 bg-[#faf8f5] border-[#e5e5e5] rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="🐱 小猫咪">🐱 小猫咪</SelectItem>
                  <SelectItem value="🐰 小兔兔">🐰 小兔兔</SelectItem>
                  <SelectItem value="🐶 小狗狗">🐶 小狗狗</SelectItem>
                  <SelectItem value="🦊 小狐狸">🦊 小狐狸</SelectItem>
                  <SelectItem value="🐼 熊猫宝宝">🐼 熊猫宝宝</SelectItem>
                  <SelectItem value="🐨 考拉">🐨 考拉</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editGroupSelect">小组</Label>
              <Select
                value={formData.group}
                onValueChange={(value) => setFormData({ ...formData, group: value })}
              >
                <SelectTrigger className="h-11 bg-[#faf8f5] border-[#e5e5e5] rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="红组">红组</SelectItem>
                  <SelectItem value="蓝组">蓝组</SelectItem>
                  <SelectItem value="黄组">黄组</SelectItem>
                  <SelectItem value="绿组">绿组</SelectItem>
                </SelectContent>
              </Select>
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
              onClick={handleEditStudent}
              className="bg-gradient-to-r from-[#5fb894] to-[#7ec8e3] rounded-xl"
            >
              保存更改
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
