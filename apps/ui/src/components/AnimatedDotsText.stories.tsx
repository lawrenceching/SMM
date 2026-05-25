import type { Meta, StoryObj } from "@storybook/react-vite"
import { AnimatedDotsText } from "./AnimatedDotsText"

const meta = {
  title: "Components/AnimatedDotsText",
  component: AnimatedDotsText,
  decorators: [
    (Story) => (
      <div className="flex flex-col items-center gap-10 py-8">
        <Story />
      </div>
    ),
  ],
  args: {
    text: "加载中",
    interval: 500,
    maxDots: 3,
    paused: false,
  },
} satisfies Meta<typeof AnimatedDotsText>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const FastInterval: Story = {
  name: "不同文本 / 400ms",
  args: {
    text: "正在处理",
    interval: 400,
    className: "text-base",
  },
  decorators: [
    (Story) => (
      <div className="flex flex-col items-center gap-2">
        <Story />
        <span className="text-xs tracking-wide text-muted-foreground">不同文本/400ms速度</span>
      </div>
    ),
  ],
}

export const English: Story = {
  name: "英文 / 600ms",
  args: {
    text: "Loading",
    interval: 600,
    className: "text-3xl",
  },
  decorators: [
    (Story) => (
      <div className="flex flex-col items-center gap-2">
        <Story />
        <span className="text-xs tracking-wide text-muted-foreground">英文/600ms速度</span>
      </div>
    ),
  ],
}

export const Small: Story = {
  args: {
    text: "加载中",
    className: "text-sm",
  },
}

export const Large: Story = {
  args: {
    text: "Loading",
    className: "text-3xl",
  },
}

export const Paused: Story = {
  args: {
    text: "加载中",
    paused: true,
  },
}

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col items-center gap-10 py-8">
      <div className="flex flex-col items-center gap-2">
        <AnimatedDotsText text="加载中" />
        <span className="text-xs tracking-wide text-muted-foreground">修复后的CSS驱动 (默认500ms)</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <AnimatedDotsText text="正在处理" interval={400} className="text-base" />
        <span className="text-xs tracking-wide text-muted-foreground">不同文本/400ms速度</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <AnimatedDotsText text="Loading" interval={600} className="text-3xl" />
        <span className="text-xs tracking-wide text-muted-foreground">英文/600ms速度</span>
      </div>
    </div>
  ),
}
