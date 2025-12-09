import { Button } from "@/components/ui/button"
import type { AppConfig } from "@core/types"

const appConfig: AppConfig = {
  version: "0.0.1"
}

function App() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center">
      <div className="flex-1"></div>
      <Button>Click me</Button>
      <div className="h-[30px] w-full bg-gray-400 flex">
        <div className="flex-1"></div>
        <div className="max-w-[60px]">{appConfig.version}</div>
      </div>
    </div>
  )
}

export default App