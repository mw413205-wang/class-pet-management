import { createBrowserRouter } from "react-router";
import Login from "./pages/Login";
import DashboardLayout from "./layouts/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import ClassManagement from "./pages/ClassManagement";
import StudentManagement from "./pages/StudentManagement";
import RewardSystem from "./pages/RewardSystem";
import PetAssignment from "./pages/PetAssignment";
import BadgeWall from "./pages/BadgeWall";
import Settings from "./pages/Settings";
import RandomPicker from "./pages/RandomPicker";
import LuckyDraw from "./pages/LuckyDraw";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Login,
  },
  {
    path: "/dashboard",
    Component: DashboardLayout,
    children: [
      { index: true, Component: Dashboard },
      { path: "classes", Component: ClassManagement },
      { path: "students", Component: StudentManagement },
      { path: "random-picker", Component: RandomPicker },
      { path: "lucky-draw", Component: LuckyDraw },
      { path: "rewards", Component: RewardSystem },
      { path: "pets", Component: PetAssignment },
      { path: "badges", Component: BadgeWall },
      { path: "settings", Component: Settings },
    ],
  },
]);