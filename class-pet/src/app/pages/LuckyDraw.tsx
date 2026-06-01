import { useState, useEffect } from "react";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { motion, AnimatePresence } from "motion/react";
import {
  Play,
  Square,
  RotateCcw,
  Plus,
  X,
  Gift,
  Trophy,
  Sparkles,
  Edit,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

interface Prize {
  id: number;
  name: string;
  emoji: string;
  quantity: number;
  probability: number;
  color: string;
}

interface Winner {
  prize: Prize;
  time: string;
}

const defaultPrizes: Prize[] = [
  { id: 1, name: "超级大奖", emoji: "🏆", quantity: 1, probability: 5, color: "from-[#ffd93d] to-[#ffe66d]" },
  { id: 2, name: "一等奖", emoji: "🎖️", quantity: 3, probability: 10, color: "from-[#ff6b9d] to-[#ff8fab]" },
  { id: 3, name: "二等奖", emoji: "🎁", quantity: 5, probability: 20, color: "from-[#4ecdc4] to-[#95e1d3]" },
  { id: 4, name: "三等奖", emoji: "🎉", quantity: 10, probability: 30, color: "from-[#95e1d3] to-[#a8e6cf]" },
  { id: 5, name: "参与奖", emoji: "🌟", quantity: 30, probability: 35, color: "from-[#ffe5d9] to-[#ffd9e8]" },
];

export default function LuckyDraw() {
  const [prizes, setPrizes] = useState<Prize[]>(defaultPrizes);
  const [isSpinning, setIsSpinning] = useState(false);
  const [currentPrize, setCurrentPrize] = useState<Prize | null>(null);
  const [selectedPrize, setSelectedPrize] = useState<Prize | null>(null);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [showAddPrize, setShowAddPrize] = useState(false);
  const [spinSpeed, setSpinSpeed] = useState(50);
  const [rotation, setRotation] = useState(0);
  const [newPrize, setNewPrize] = useState({
    name: "",
    emoji: "🎁",
    quantity: 1,
    probability: 10,
  });

  const emojiOptions = ["🏆", "🎖️", "🎁", "🎉", "🌟", "🎊", "🎈", "🎀", "💎", "👑", "🌈", "⭐"];

  // Spinning effect
  useEffect(() => {
    if (isSpinning) {
      const interval = setInterval(() => {
        const randomPrize = prizes[Math.floor(Math.random() * prizes.length)];
        setCurrentPrize(randomPrize);
        setRotation((prev) => prev + 30);
      }, spinSpeed);

      return () => clearInterval(interval);
    }
  }, [isSpinning, prizes, spinSpeed]);

  const selectPrizeByProbability = () => {
    const totalProbability = prizes.reduce((sum, p) => sum + p.probability, 0);
    let random = Math.random() * totalProbability;

    for (const prize of prizes) {
      if (random < prize.probability) {
        return prize;
      }
      random -= prize.probability;
    }
    return prizes[prizes.length - 1];
  };

  const handleStart = () => {
    if (prizes.length === 0) {
      toast.error("请先添加奖品！");
      return;
    }

    setIsSpinning(true);
    setSelectedPrize(null);
    setSpinSpeed(50);

    // Gradually slow down
    setTimeout(() => setSpinSpeed(80), 1000);
    setTimeout(() => setSpinSpeed(120), 2000);
    setTimeout(() => setSpinSpeed(160), 2500);
    setTimeout(() => {
      handleStop();
    }, 3500);
  };

  const handleStop = () => {
    setIsSpinning(false);
    const wonPrize = selectPrizeByProbability();
    setSelectedPrize(wonPrize);
    setWinners([
      {
        prize: wonPrize,
        time: new Date().toLocaleTimeString("zh-CN"),
      },
      ...winners,
    ]);
    
    // Update quantity
    setPrizes(prizes.map(p => 
      p.id === wonPrize.id ? { ...p, quantity: Math.max(0, p.quantity - 1) } : p
    ));
    
    toast.success(`🎉 恭喜抽中 ${wonPrize.name}！`);
  };

  const handleReset = () => {
    setPrizes(defaultPrizes);
    setSelectedPrize(null);
    setCurrentPrize(null);
    setWinners([]);
    toast.success("已重置所有数据！");
  };

  const handleAddPrize = () => {
    if (!newPrize.name) {
      toast.error("请输入奖品名称！");
      return;
    }

    const newId = Math.max(...prizes.map(p => p.id), 0) + 1;
    const colorOptions = [
      "from-[#ffd93d] to-[#ffe66d]",
      "from-[#ff6b9d] to-[#ff8fab]",
      "from-[#4ecdc4] to-[#95e1d3]",
      "from-[#95e1d3] to-[#a8e6cf]",
      "from-[#ffe5d9] to-[#ffd9e8]",
    ];
    const randomColor = colorOptions[Math.floor(Math.random() * colorOptions.length)];

    setPrizes([
      ...prizes,
      {
        id: newId,
        ...newPrize,
        color: randomColor,
      },
    ]);

    setNewPrize({ name: "", emoji: "🎁", quantity: 1, probability: 10 });
    setShowAddPrize(false);
    toast.success("奖品添加成功！");
  };

  const handleDeletePrize = (id: number) => {
    if (prizes.length <= 1) {
      toast.error("至少需要保留一个奖品！");
      return;
    }
    setPrizes(prizes.filter(p => p.id !== id));
    toast.success("奖品已删除！");
  };

  const totalQuantity = prizes.reduce((sum, p) => sum + p.quantity, 0);
  const totalProbability = prizes.reduce((sum, p) => sum + p.probability, 0);

  return (
    <div className="space-y-6">
      {/* Title */}
      <motion.div
        className="text-center py-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="inline-flex items-center gap-3 bg-white/80 backdrop-blur-sm px-8 py-4 rounded-3xl shadow-xl border-4 border-[#ff6b9d]">
          <motion.span
            className="text-4xl"
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            🎁
          </motion.span>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-[#ff6b9d] to-[#ffd93d] bg-clip-text text-transparent">
            幸运抽奖
          </h2>
          <motion.span
            className="text-4xl"
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            ✨
          </motion.span>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Draw Area */}
        <div className="lg:col-span-2 space-y-6">
          {/* Wheel Display */}
          <Card className="p-8 bg-gradient-to-br from-white via-[#fff9f0] to-[#ffe5d9] border-4 border-[#ff6b9d] shadow-2xl rounded-3xl overflow-hidden relative">
            {/* Confetti background */}
            <div className="absolute inset-0 opacity-10">
              {[...Array(30)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute text-3xl"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                  }}
                  animate={{
                    y: [0, -30, 0],
                    opacity: [0.3, 0.8, 0.3],
                    rotate: [0, 360],
                  }}
                  transition={{
                    duration: 3 + Math.random() * 2,
                    repeat: Infinity,
                    delay: Math.random() * 2,
                  }}
                >
                  {["🎉", "🎊", "🎈", "✨", "⭐"][Math.floor(Math.random() * 5)]}
                </motion.div>
              ))}
            </div>

            <div className="relative z-10 flex flex-col items-center justify-center min-h-[450px] space-y-8">
              <AnimatePresence mode="wait">
                {selectedPrize ? (
                  // Winner Display
                  <motion.div
                    key="winner"
                    initial={{ scale: 0, rotate: -360 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0, rotate: 360 }}
                    className="text-center space-y-6"
                  >
                    <motion.div
                      className="relative inline-block"
                      animate={{
                        y: [0, -30, 0],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    >
                      <div className={`w-56 h-56 rounded-full bg-gradient-to-br ${selectedPrize.color} flex items-center justify-center text-9xl shadow-2xl border-8 border-white relative overflow-hidden`}>
                        <motion.div
                          className="absolute inset-0 bg-white"
                          initial={{ scale: 0, opacity: 0.5 }}
                          animate={{ scale: 3, opacity: 0 }}
                          transition={{ duration: 1 }}
                        />
                        {selectedPrize.emoji}
                      </div>
                      <motion.div
                        className="absolute -top-6 -right-6 w-24 h-24 bg-gradient-to-br from-[#ffd93d] to-[#ffe66d] rounded-full flex items-center justify-center shadow-xl"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                      >
                        <Trophy className="w-12 h-12 text-white" />
                      </motion.div>
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                    >
                      <div className="text-6xl font-bold bg-gradient-to-r from-[#ff6b9d] to-[#ffd93d] bg-clip-text text-transparent mb-3">
                        {selectedPrize.name}
                      </div>
                      <div className="text-3xl text-[#ff6b6b]">🎊 恭喜中奖！🎊</div>
                    </motion.div>
                  </motion.div>
                ) : currentPrize ? (
                  // Spinning Display
                  <motion.div
                    key="spinning"
                    animate={{ rotate: rotation }}
                    className="text-center space-y-6"
                  >
                    <div className={`w-48 h-48 rounded-full bg-gradient-to-br ${currentPrize.color} flex items-center justify-center text-9xl shadow-2xl border-8 border-white`}>
                      {currentPrize.emoji}
                    </div>
                    <div className="text-5xl font-bold text-[#4a4a4a]">
                      {currentPrize.name}
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
                        scale: [1, 1.1, 1],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                      }}
                      className="w-48 h-48 rounded-full bg-gradient-to-br from-[#ffe5d9] to-[#ffd9e8] flex items-center justify-center text-9xl shadow-2xl border-8 border-white"
                    >
                      🎯
                    </motion.div>
                    <div className="text-3xl font-bold text-[#a0a0a0]">
                      点击开始按钮开始抽奖
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
                disabled={isSpinning || prizes.length === 0}
                className="w-full h-20 text-xl bg-gradient-to-r from-[#ff6b9d] to-[#ff8fab] hover:from-[#ff8fab] hover:to-[#ff6b9d] rounded-2xl shadow-xl disabled:opacity-50"
              >
                <Play className="w-8 h-8 mr-2" />
                开始抽奖
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                onClick={handleStop}
                disabled={!isSpinning}
                className="w-full h-20 text-xl bg-gradient-to-r from-[#4ecdc4] to-[#95e1d3] hover:from-[#95e1d3] hover:to-[#4ecdc4] rounded-2xl shadow-xl disabled:opacity-50"
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
                className="p-4 bg-gradient-to-r from-[#ff6b9d] to-[#ff8fab] rounded-2xl text-white"
                whileHover={{ scale: 1.05 }}
              >
                <p className="text-sm opacity-90">奖品总数</p>
                <p className="text-4xl font-bold">{totalQuantity}</p>
              </motion.div>
              <motion.div
                className="p-4 bg-gradient-to-r from-[#4ecdc4] to-[#95e1d3] rounded-2xl text-white"
                whileHover={{ scale: 1.05 }}
              >
                <p className="text-sm opacity-90">中奖人数</p>
                <p className="text-4xl font-bold">{winners.length}</p>
              </motion.div>
              <motion.div
                className="p-4 bg-gradient-to-r from-[#ffd93d] to-[#ffe66d] rounded-2xl"
                whileHover={{ scale: 1.05 }}
              >
                <p className="text-sm text-[#4a4a4a] opacity-80">奖品种类</p>
                <p className="text-4xl font-bold text-[#4a4a4a]">{prizes.length}</p>
              </motion.div>
            </div>
          </Card>

          {/* Add Prize Button */}
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              onClick={() => setShowAddPrize(!showAddPrize)}
              className="w-full h-16 text-lg bg-gradient-to-r from-[#c44569] to-[#ff6b9d] hover:from-[#ff6b9d] hover:to-[#c44569] rounded-2xl shadow-xl"
            >
              <Plus className="w-6 h-6 mr-2" />
              {showAddPrize ? "取消添加" : "添加奖品"}
            </Button>
          </motion.div>
        </div>
      </div>

      {/* Prize List */}
      <Card className="p-6 bg-white border-4 border-[#ffe5d9] shadow-xl rounded-3xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-[#4a4a4a] flex items-center gap-2">
            🎁 奖品池
          </h3>
          <Badge className="text-lg px-4 py-2 bg-gradient-to-r from-[#4ecdc4] to-[#95e1d3] rounded-full">
            总概率: {totalProbability}%
          </Badge>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {prizes.map((prize, index) => (
            <motion.div
              key={prize.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ scale: 1.05, y: -5 }}
            >
              <Card className={`relative p-5 bg-gradient-to-br ${prize.color} border-4 border-white shadow-lg rounded-3xl overflow-hidden`}>
                <motion.button
                  whileHover={{ scale: 1.2, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleDeletePrize(prize.id)}
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/80 flex items-center justify-center hover:bg-white transition-colors z-10"
                >
                  <X className="w-4 h-4 text-[#ff6b6b]" />
                </motion.button>

                <div className="text-center space-y-3">
                  <motion.div 
                    className="text-6xl"
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    {prize.emoji}
                  </motion.div>
                  <div>
                    <h4 className="text-lg font-bold text-[#4a4a4a]">{prize.name}</h4>
                    <div className="flex items-center justify-center gap-2 mt-2">
                      <Badge className="bg-white/80 text-[#4a4a4a]">
                        剩余 {prize.quantity}
                      </Badge>
                      <Badge className="bg-white/80 text-[#4a4a4a]">
                        {prize.probability}%
                      </Badge>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </Card>

      {/* Add Prize Modal */}
      <AnimatePresence>
        {showAddPrize && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowAddPrize(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full border-4 border-[#4ecdc4]"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-3xl font-bold bg-gradient-to-r from-[#4ecdc4] to-[#ff6b9d] bg-clip-text text-transparent">
                  ➕ 添加新奖品
                </h3>
                <motion.button
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowAddPrize(false)}
                  className="w-10 h-10 rounded-full bg-[#ff6b9d] flex items-center justify-center text-white"
                >
                  <X className="w-5 h-5" />
                </motion.button>
              </div>

              <div className="space-y-5">
                <div>
                  <Label className="text-lg mb-2">奖品名称</Label>
                  <Input
                    value={newPrize.name}
                    onChange={(e) => setNewPrize({ ...newPrize, name: e.target.value })}
                    placeholder="例如：一等奖"
                    className="h-12 text-lg rounded-2xl border-2"
                  />
                </div>

                <div>
                  <Label className="text-lg mb-2">选择图标</Label>
                  <div className="grid grid-cols-6 gap-2">
                    {emojiOptions.map((emoji) => (
                      <motion.button
                        key={emoji}
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setNewPrize({ ...newPrize, emoji })}
                        className={`w-12 h-12 text-3xl rounded-2xl transition-all ${
                          newPrize.emoji === emoji
                            ? "bg-gradient-to-r from-[#4ecdc4] to-[#95e1d3] shadow-lg"
                            : "bg-[#fff9f0] hover:bg-[#ffe5d9]"
                        }`}
                      >
                        {emoji}
                      </motion.button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-lg mb-2">数量</Label>
                    <Input
                      type="number"
                      min="1"
                      value={newPrize.quantity}
                      onChange={(e) => setNewPrize({ ...newPrize, quantity: parseInt(e.target.value) || 1 })}
                      className="h-12 text-lg rounded-2xl border-2"
                    />
                  </div>
                  <div>
                    <Label className="text-lg mb-2">概率(%)</Label>
                    <Input
                      type="number"
                      min="1"
                      max="100"
                      value={newPrize.probability}
                      onChange={(e) => setNewPrize({ ...newPrize, probability: parseInt(e.target.value) || 10 })}
                      className="h-12 text-lg rounded-2xl border-2"
                    />
                  </div>
                </div>

                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    onClick={handleAddPrize}
                    className="w-full h-14 text-lg bg-gradient-to-r from-[#4ecdc4] to-[#95e1d3] hover:from-[#95e1d3] hover:to-[#4ecdc4] rounded-2xl shadow-xl"
                  >
                    <Gift className="w-6 h-6 mr-2" />
                    确认添加
                  </Button>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Winners History */}
      {winners.length > 0 && (
        <Card className="p-6 bg-white border-4 border-[#ffe5d9] shadow-xl rounded-3xl">
          <h3 className="text-2xl font-bold text-[#4a4a4a] mb-6 flex items-center gap-2">
            🏆 中奖记录
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
            {winners.map((winner, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`p-4 bg-gradient-to-r ${winner.prize.color} rounded-2xl border-2 border-white shadow-lg`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-4xl">{winner.prize.emoji}</span>
                  <div className="flex-1">
                    <p className="text-lg font-bold text-[#4a4a4a]">
                      {winner.prize.name}
                    </p>
                    <p className="text-sm text-[#a0a0a0]">{winner.time}</p>
                  </div>
                  <Sparkles className="w-6 h-6 text-[#ffd93d]" />
                </div>
              </motion.div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
