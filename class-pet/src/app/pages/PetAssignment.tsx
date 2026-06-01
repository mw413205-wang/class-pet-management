import { useState } from "react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import { Sparkles, Shuffle, ArrowRight, Star } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";

interface Pet {
  id: number;
  emoji: string;
  name: string;
  description: string;
  stages: string[];
  color: string;
}

interface StudentPet {
  id: number;
  studentName: string;
  pet: Pet;
  currentStage: number;
  progress: number;
}

const mockPets: Pet[] = [
  {
    id: 1,
    emoji: "🐱",
    name: "小猫咪",
    description: "可爱温顺的小猫，陪伴成长",
    stages: ["幼猫", "少年猫", "青年猫", "成年猫", "猫王"],
    color: "from-[#ffd4a3] to-[#f8b4d9]",
  },
  {
    id: 2,
    emoji: "🐰",
    name: "小兔兔",
    description: "活泼可爱的小兔子",
    stages: ["小兔", "跳跳兔", "快乐兔", "智慧兔", "兔神"],
    color: "from-[#f8b4d9] to-[#c4b5fd]",
  },
  {
    id: 3,
    emoji: "🐶",
    name: "小狗狗",
    description: "忠诚友善的小狗",
    stages: ["小狗", "乖狗", "聪明狗", "勇敢狗", "狗王"],
    color: "from-[#5fb894] to-[#7ec8e3]",
  },
  {
    id: 4,
    emoji: "🦊",
    name: "小狐狸",
    description: "聪明机智的小狐狸",
    stages: ["小狐", "灵狐", "智狐", "仙狐", "狐仙"],
    color: "from-[#7ec8e3] to-[#c4b5fd]",
  },
  {
    id: 5,
    emoji: "🐼",
    name: "熊猫宝宝",
    description: "珍贵可爱的国宝熊猫",
    stages: ["幼熊猫", "小熊猫", "青年熊猫", "成年熊猫", "熊猫仙"],
    color: "from-[#e8f4ef] to-[#ffd4a3]",
  },
  {
    id: 6,
    emoji: "🐨",
    name: "考拉",
    description: "慵懒可爱的考拉",
    stages: ["小考拉", "萌考拉", "乖考拉", "智慧考拉", "考拉王"],
    color: "from-[#c4b5fd] to-[#f8b4d9]",
  },
];

const mockStudentPets: StudentPet[] = [
  { id: 1, studentName: "李明", pet: mockPets[0], currentStage: 2, progress: 75 },
  { id: 2, studentName: "王芳", pet: mockPets[1], currentStage: 3, progress: 45 },
  { id: 3, studentName: "张伟", pet: mockPets[2], currentStage: 1, progress: 88 },
  { id: 4, studentName: "刘洋", pet: mockPets[3], currentStage: 2, progress: 62 },
  { id: 5, studentName: "陈静", pet: mockPets[4], currentStage: 4, progress: 92 },
  { id: 6, studentName: "赵敏", pet: mockPets[5], currentStage: 2, progress: 55 },
];

export default function PetAssignment() {
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);
  const [studentPets, setStudentPets] = useState<StudentPet[]>(mockStudentPets);
  const [isPetDetailOpen, setIsPetDetailOpen] = useState(false);

  const handleRandomAssign = () => {
    toast.success("已随机分配宠物给所有学生！");
  };

  const handleChangePet = (studentPet: StudentPet) => {
    if (studentPet.currentStage === 0) {
      toast.success(`可以为 ${studentPet.studentName} 更换宠物！`);
    } else {
      toast.error("只有在0级时才能更换宠物！");
    }
  };

  const openPetDetail = (pet: Pet) => {
    setSelectedPet(pet);
    setIsPetDetailOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl text-[#2d5f4e]">宠物分配</h2>
          <p className="text-sm text-[#8e8e8e] mt-1">为学生分配和管理成长宠物</p>
        </div>
        <Button
          onClick={handleRandomAssign}
          className="h-11 bg-gradient-to-r from-[#ffd4a3] to-[#f8b4d9] hover:from-[#ffcd8a] hover:to-[#f59ec1] text-[#8b5a00] rounded-xl"
        >
          <Shuffle className="w-5 h-5 mr-2" />
          随机分配
        </Button>
      </div>

      {/* Available Pets */}
      <div>
        <h3 className="text-lg text-[#2d5f4e] mb-4">可选宠物</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {mockPets.map((pet, index) => (
            <motion.div
              key={pet.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
            >
              <Card
                className="bg-white border-0 shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden group"
                onClick={() => openPetDetail(pet)}
              >
                <div className={`bg-gradient-to-br ${pet.color} p-4`}>
                  <motion.div
                    className="text-6xl text-center group-hover:scale-110 transition-transform duration-300"
                    whileHover={{ rotate: [0, -10, 10, -10, 0] }}
                  >
                    {pet.emoji}
                  </motion.div>
                </div>
                <div className="p-3 text-center">
                  <h4 className="text-sm text-[#2d5f4e] mb-1">{pet.name}</h4>
                  <p className="text-xs text-[#8e8e8e]">{pet.description}</p>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Student Pet Status */}
      <div>
        <h3 className="text-lg text-[#2d5f4e] mb-4">学生宠物状态</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {studentPets.map((studentPet) => (
            <Card
              key={studentPet.id}
              className="bg-white border-0 shadow-md hover:shadow-xl transition-all duration-300"
            >
              <div className="p-5 space-y-4">
                {/* Student and pet */}
                <div className="flex items-center gap-4">
                  <motion.div
                    className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${studentPet.pet.color} flex items-center justify-center text-3xl shadow-inner`}
                    whileHover={{ scale: 1.1, rotate: [0, -5, 5, -5, 0] }}
                  >
                    {studentPet.pet.emoji}
                  </motion.div>
                  <div className="flex-1">
                    <h4 className="text-[#2d5f4e]">{studentPet.studentName}</h4>
                    <p className="text-sm text-[#8e8e8e]">{studentPet.pet.name}</p>
                  </div>
                </div>

                {/* Current stage */}
                <div className="flex items-center justify-between">
                  <Badge className="bg-gradient-to-r from-[#5fb894] to-[#7ec8e3] text-white border-0">
                    {studentPet.pet.stages[studentPet.currentStage]}
                  </Badge>
                  <span className="text-sm text-[#8e8e8e]">
                    等级 {studentPet.currentStage + 1}
                  </span>
                </div>

                {/* Progress */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#8e8e8e]">升级进度</span>
                    <span className="text-[#5fb894]">{studentPet.progress}%</span>
                  </div>
                  <Progress value={studentPet.progress} className="h-2.5 bg-[#f0f0f0]">
                    <div
                      className="h-full bg-gradient-to-r from-[#5fb894] to-[#7ec8e3] rounded-full transition-all duration-500"
                      style={{ width: `${studentPet.progress}%` }}
                    />
                  </Progress>
                </div>

                {/* Stages timeline */}
                <div className="pt-3 border-t border-[#f0f0f0]">
                  <div className="flex items-center justify-between text-xs">
                    {studentPet.pet.stages.map((stage, index) => (
                      <div
                        key={index}
                        className={`flex flex-col items-center ${
                          index <= studentPet.currentStage
                            ? "text-[#5fb894]"
                            : "text-[#e5e5e5]"
                        }`}
                      >
                        {index <= studentPet.currentStage ? (
                          <Star className="w-4 h-4 fill-current mb-1" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border-2 border-current mb-1" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Change pet button */}
                <Button
                  onClick={() => handleChangePet(studentPet)}
                  variant="outline"
                  className="w-full rounded-xl border-[#e5e5e5] hover:bg-[#fff5e6] hover:text-[#8b5a00] hover:border-[#ffd4a3]"
                  disabled={studentPet.currentStage !== 0}
                >
                  <Shuffle className="w-4 h-4 mr-2" />
                  更换宠物
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Pet Detail Dialog */}
      <Dialog open={isPetDetailOpen} onOpenChange={setIsPetDetailOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>宠物详情</DialogTitle>
            <DialogDescription>查看宠物的成长阶段</DialogDescription>
          </DialogHeader>
          {selectedPet && (
            <div className="space-y-6 py-4">
              {/* Pet icon */}
              <div className="flex flex-col items-center space-y-3">
                <motion.div
                  className={`w-24 h-24 rounded-3xl bg-gradient-to-br ${selectedPet.color} flex items-center justify-center text-6xl shadow-lg`}
                  animate={{ rotate: [0, -5, 5, -5, 0] }}
                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
                >
                  {selectedPet.emoji}
                </motion.div>
                <div className="text-center">
                  <h3 className="text-xl text-[#2d5f4e]">{selectedPet.name}</h3>
                  <p className="text-sm text-[#8e8e8e]">{selectedPet.description}</p>
                </div>
              </div>

              {/* Growth stages */}
              <div className="space-y-3">
                <h4 className="text-sm text-[#4a4a4a]">成长阶段：</h4>
                {selectedPet.stages.map((stage, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 bg-[#faf8f5] rounded-xl"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-[#5fb894] to-[#7ec8e3] flex items-center justify-center text-white text-sm">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-[#2d5f4e]">{stage}</p>
                    </div>
                    {index < selectedPet.stages.length - 1 && (
                      <ArrowRight className="w-4 h-4 text-[#8e8e8e]" />
                    )}
                    {index === selectedPet.stages.length - 1 && (
                      <Sparkles className="w-4 h-4 text-[#ffd4a3]" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              onClick={() => setIsPetDetailOpen(false)}
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
