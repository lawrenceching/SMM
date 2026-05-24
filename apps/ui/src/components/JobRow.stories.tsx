import type { Meta, StoryObj } from "@storybook/react-vite"
import { JobRow } from "./JobRow"

const meta = {
  title: "Components/JobRow",
  component: JobRow,
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
} satisfies Meta<typeof JobRow>

export default meta
type Story = StoryObj<typeof meta>

export const Transcribing: Story = {
  args: { jobType: "transcribing" },
}

export const Translating: Story = {
  args: { jobType: "translating" },
}

export const Synthesising: Story = {
  args: { jobType: "synthesising" },
}

export const Processing: Story = {
  args: { jobType: "processing" },
}
