import type { Meta, StoryObj } from "@storybook/react-vite"
import { EmptyAssociatedFileRow } from "./EmptyAssociatedFileRow"

const meta = {
  title: "Components/EmptyAssociatedFileRow",
  component: EmptyAssociatedFileRow,
  decorators: [
    (Story) => (
      <div className="w-[720px] rounded-md border bg-card p-4">
        <div
          role="table"
          style={{
            display: "grid",
            gridTemplateColumns: "40px 64px 1fr 128px 64px 32px",
          }}
          className="w-full text-xs"
        >
          <Story />
        </div>
      </div>
    ),
  ],
} satisfies Meta<typeof EmptyAssociatedFileRow>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
