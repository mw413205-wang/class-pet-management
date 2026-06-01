import { useState, useEffect } from "react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { motion, AnimatePresence } from "motion/react";
import { Play, Square, RotateCcw, Trophy, History, X } from "lucide-react";
import { toast } from "sonner";

interface Student {
  id: number;
  name: string;
  pet: string;
}

const mockStudents: Student[] = [
  { id: 1, name: "李明", pet: "🐱" },
  { id: 2, name: "王芳", pet: "🐰" },
  { id: 3, name: "张伟", pet: "🐶" },
  { id: 4, name: "刘洋", pet: "🦊" },
  { id: 5, name: "陈静", pet: "🐼" },
  { id: 6, name: "赵敏", pet: "🐨" },
  { id: 7, name: "孙涛", pet: "🦁" },
  { id: 8, name: "周慧", pet: "🐯" },
  { id: 9, name: "吴刚", pet: "🐹" },
  { id: 10, name: "郑美", pet: "🦄" },
  { id: 11, name: "钱强", pet: "🐸" },
  { id: 12, name: "孙丽", pet: "🦋" },
  { id: 13, name: "黄磊", pet: "🦉" },
  { id: 14, name: "林娜", pet: "🐢" },
  { id: 15, name: "唐军", pet: "🐺" },
];

interface PickHistory {
  student: Student;
  time: string;
}

export default function RandomPicker() {
  const [isSpinning, setIsSpinning] = useState(false);
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [pickedStudents, setPickedStudents] = useState<number[]>([]);
  const [history, setHistory] = useState<PickHistory[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [spinSpeed, setSpinSpeed] = useState(50);

  const availableStudents = mockStudents.filter(
    (s) => !pickedStudents.includes(s.id)
  );

  // Random spinning effect
  useEffect(() => {
    if (isSpinning) {
      const interval = setInterval(() => {
        const randomStudent =
          availableStudents[Math.floor(Math.random() * availableStudents.length)];
        setCurrentStudent(randomStudent);
      }, spinSpeed);

      return () => clearInterval(interval);
    }
  }, [isSpinning, availableStudents, spinSpeed]);

  const handleStart = () => {
    if (availableStudents.length === 0) {
      toast.error("所有学生都已被点名！");
      return;
    }
    setIsSpinning(true);
    setSelectedStudent(null);
    setSpinSpeed(50);

    // Gradually slow down
    setTimeout(() => setSpinSpeed(100), 1000);
    setTimeout(() => setSpinSpeed(150), 2000);
    setTimeout(() => setSpinSpeed(200), 2500);
    setTimeout(() => {
      handleStop();
    }, 3000);
  };

  const handleStop = () => {
    setIsSpinning(false);
    if (currentStudent) {
      setSelectedStudent(currentStudent);
      setPickedStudents([...pickedStudents, currentStudent.id]);
      setHistory([
        {
          student: currentStudent,
          time: new Date().toLocaleTimeString("zh-CN"),
        },
        ...history,
      ]);
      toast.success(`🎉 点到了 ${currentStudent.name}！`);
    }
  };

  const handleReset = () => {
    setPickedStudents([]);
    setSelectedStudent(null);
    setCurrentStudent(null);
    setHistory([]);
    toast.success("已重置所有记录！");
  };

  const removeFromPicked = (studentId: number) => {
    setPickedStudents(pickedStudents.filter((id) => id !== studentId));
    toast.success("学生已移回可选列表");
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <motion.div
        className="text-center py-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="inline-flex items-center gap-3 bg-white/80 backdrop-blur-sm px-8 py-4 rounded-3xl shadow-xl border-4 border-[#4ecdc4]">
          <motion.span
            className="text-4xl"
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            🎲
          </motion.span>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-[#4ecdc4] to-[#ff6b9d] bg-clip-text text-transparent">
            随机点名器
          </h2>
          <motion.span
            className="text-4xl"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            ✨
          </motion.span>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Picker Area */}
        <div className="lg:col-span-2 space-y-6">
          {/* Display Area */}
          <Card className="p-8 bg-gradient-to-br from-white via-[#fff9f0] to-[#ffe5d9] border-4 border-[#4ecdc4] shadow-2xl rounded-3xl overflow-hidden relative">
            {/* Decorative background */}
            <div className="absolute inset-0 opacity-10">
              {[...Array(20)].map((_, i) => (
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
                  }}
                  transition={{
                    duration: 2 + Math.random() * 2,
                    repeat: Infinity,
                    delay: Math.random() * 2,
                  }}
                >
                  {["⭐", "🌟", "✨", "💫", "🎉"][Math.floor(Math.random() * 5)]}
                </motion.div>
              ))}
            </div>

            <div className="relative z-10 flex flex-col items-center justify-center min-h-[400px] space-y-8">
              <AnimatePresence mode="wait">
                {selectedStudent ? (
                  // Selected Student Display
                  <motion.div
                    key="selected"
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0, rotate: 180 }}
                    className="text-center space-y-6"
                  >
                    <motion.div
                      className="relative inline-block"
                      animate={{
                        y: [0, -20, 0],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    >
                      <div className="w-48 h-48 rounded-full bg-gradient-to-br from-[#ffd93d] via-[#ffe66d] to-[#ffd93d] flex items-center justify-center text-9xl shadow-2xl border-8 border-white">
                        {selectedStudent.pet}
                      </div>
                      <motion.div
                        className="absolute -top-4 -right-4 w-20 h-20 bg-gradient-to-br from-[#ff6b9d] to-[#ff8fab] rounded-full flex items-center justify-center shadow-xl"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                      >
                        <Trophy className="w-10 h-10 text-white" />
                      </motion.div>
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                    >
                      <div className="text-6xl font-bold bg-gradient-to-r from-[#4ecdc4] to-[#ff6b9d] bg-clip-text text-transparent mb-2">
                        {selectedStudent.name}
                      </div>
                      <div className="text-2xl text-[#ff6b6b]">🎉 恭喜被点名！🎉</div>
                    </motion.div>
                  </motion.div>
                ) : currentStudent ? (
                  // Spinning Display
                  <motion.div
                    key="spinning"
                    initial={{ scale: 1 }}
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 0.3, repeat: Infinity }}
                    className="text-center space-y-6"
                  >
                    <div className="w-40 h-40 rounded-full bg-gradient-to-br from-[#4ecdc4] to-[#95e1d3] flex items-center justify-center text-8xl shadow-2xl border-8 border-white">
                      {currentStudent.pet}
                    </div>
                    <div className="text-5xl font-bold text-[#4a4a4a]">
                      {currentStudent.name}
                    </div>
                  </motion.div>
                ) : (
                  // Initial Display
                  <motion.div
                    key="initial"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center space-y-6"
                  >
                    <motion.div
                      animate={{
                        rotate: 360,
                        scale: [1, 1.2, 1],
                      }}
                      transition={{
                        rotate: { duration: 4, repeat: Infinity, ease: "linear" },
                        scale: { duration: 2, repeat: Infinity },
                      }}
                      className="w-40 h-40 rounded-full bg-gradient-to-br from-[#ffe5d9] to-[#ffd9e8] flex items-center justify-center text-8xl shadow-2xl border-8 border-white"
                    >
                      🎯
                    </motion.div>
                    <div className="text-3xl font-bold text-[#a0a0a0]">
                      点击开始按钮开始点名
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Card>

          {/* Control Buttons */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                onClick={handleStart}
                disabled={isSpinning || availableStudents.length === 0}
                className="w-full h-20 text-xl bg-gradient-to-r from-[#4ecdc4] to-[#95e1d3] hover:from-[#95e1d3] hover:to-[#4ecdc4] rounded-2xl shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play className="w-8 h-8 mr-2" />
                开始点名
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                onClick={handleStop}
                disabled={!isSpinning}
                className="w-full h-20 text-xl bg-gradient-to-r from-[#ff6b9d] to-[#ff8fab] hover:from-[#ff8fab] hover:to-[#ff6b9d] rounded-2xl shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Square className="w-8 h-8 mr-2" />
                停止
              </Button>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="col-span-2 md:col-span-1"
            >
              <Button
                onClick={handleReset}
                variant="outline"
                className="w-full h-20 text-xl border-4 border-[#ffd93d] text-[#4a4a4a] hover:bg-[#ffd93d] rounded-2xl shadow-xl"
              >
                <RotateCcw className="w-8 h-8 mr-2" />
                重置
              </Button>
            </motion.div>
          </div>
        </div>

        {/* Side Panel */}
        <div className="space-y-6">
          {/* Statistics */}
          <Card className="p-6 bg-white border-4 border-[#ffe5d9] shadow-xl rounded-3xl">
            <h3 className="text-xl font-bold text-[#4a4a4a] mb-4 flex items-center gap-2">
              📊 统计信息
            </h3>
            <div className="space-y-4">
              <motion.div
                className="p-4 bg-gradient-to-r from-[#4ecdc4] to-[#95e1d3] rounded-2xl text-white"
                whileHover={{ scale: 1.05 }}
              >
                <p className="text-sm opacity-90">剩余学生</p>
                <p className="text-4xl font-bold">{availableStudents.length}</p>
              </motion.div>
              <motion.div
                className="p-4 bg-gradient-to-r from-[#ffd93d] to-[#ffe66d] rounded-2xl"
                whileHover={{ scale: 1.05 }}
              >
                <p className="text-sm text-[#4a4a4a] opacity-80">已点名</p>
                <p className="text-4xl font-bold text-[#4a4a4a]">
                  {pickedStudents.length}
                </p>
              </motion.div>
              <motion.div
                className="p-4 bg-gradient-to-r from-[#ff6b9d] to-[#ff8fab] rounded-2xl text-white"
                whileHover={{ scale: 1.05 }}
              >
                <p className="text-sm opacity-90">总学生数</p>
                <p className="text-4xl font-bold">{mockStudents.length}</p>
              </motion.div>
            </div>
          </Card>

          {/* History Button */}
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              onClick={() => setShowHistory(!showHistory)}
              className="w-full h-16 text-lg bg-gradient-to-r from-[#c44569] to-[#ff6b9d] hover:from-[#ff6b9d] hover:to-[#c44569] rounded-2xl shadow-xl"
            >
              <History className="w-6 h-6 mr-2" />
              {showHistory ? "隐藏" : "查看"}点名记录
            </Button>
          </motion.div>

          {/* Already Picked Students */}
          {pickedStudents.length > 0 && (
            <Card className="p-6 bg-white border-4 border-[#ffe5d9] shadow-xl rounded-3xl">
              <h3 className="text-lg font-bold text-[#4a4a4a] mb-4 flex items-center gap-2">
                ✅ 已点名学生
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {mockStudents
                  .filter((s) => pickedStudents.includes(s.id))
                  .map((student) => (
                    <motion.div
                      key={student.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center justify-between p-3 bg-[#fff9f0] rounded-2xl hover:bg-[#ffe5d9] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{student.pet}</span>
                        <span className="font-medium text-[#4a4a4a]">
                          {student.name}
                        </span>
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.2, rotate: 90 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => removeFromPicked(student.id)}
                        className="w-8 h-8 rounded-full bg-[#ff6b9d] flex items-center justify-center text-white hover:bg-[#ff8fab] transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </motion.button>
                    </motion.div>
                  ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* History Modal */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowHistory(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl shadow-2xl p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto border-4 border-[#4ecdc4]"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-3xl font-bold bg-gradient-to-r from-[#4ecdc4] to-[#ff6b9d] bg-clip-text text-transparent">
                  📜 点名历史记录
                </h3>
                <motion.button
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowHistory(false)}
                  className="w-12 h-12 rounded-full bg-[#ff6b9d] flex items-center justify-center text-white hover:bg-[#ff8fab] transition-colors"
                >
                  <X className="w-6 h-6" />
                </motion.button>
              </div>
              <div className="space-y-3">
                {history.length === 0 ? (
                  <div className="text-center py-16 text-[#a0a0a0]">
                    <div className="text-6xl mb-4">📝</div>
                    <p className="text-xl">暂无点名记录</p>
                  </div>
                ) : (
                  history.map((record, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center justify-between p-4 bg-gradient-to-r from-[#fff9f0] to-[#ffe5d9] rounded-2xl border-2 border-[#ffd93d]"
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-4xl">{record.student.pet}</span>
                        <div>
                          <p className="text-xl font-bold text-[#4a4a4a]">
                            {record.student.name}
                          </p>
                          <p className="text-sm text-[#a0a0a0]">{record.time}</p>
                        </div>
                      </div>
                      <div className="text-2xl">🎯</div>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
