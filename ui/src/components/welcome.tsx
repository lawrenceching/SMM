import { Separator } from "./ui/separator"
import type { FC } from "react"

const Welcome: FC = () => {
    return (
      <div className={`flex justify-center items-center h-full w-full`}>
       <div>
       <div className="space-y-1">
        <h4 className="text-sm leading-none font-medium">Simple Media Manager</h4>
        <p className="text-muted-foreground text-sm">
          A simple media manager powered by AI.
        </p>
        </div>
        <Separator className="my-4" />
        <div className="flex h-5 items-center space-x-4 text-sm">
          <div><a target="_blank" href="https://github.com/lawrenceching/SMM">Github</a></div>
          <Separator orientation="vertical" />
          <div><a target="_blank" href="https://gitcode.com/lawrenceching/SMM">GitCode</a></div>
        </div>
       </div>
      </div>
    )
  }
  
  export default Welcome 