// hanya untuk coba coba saja, silahkan di hapus jika ingin

import delay from "delay"

/* eslint-disable @typescript-eslint/no-empty-function */
import { Listr } from "listr2"
import { Logger } from "listr2/dist/utils/logger"

interface Ctx {
  skip: boolean
}

const logger = new Logger({ useIcons: false })

async function main (): Promise<void> {
    await new Listr(
      [
        {
            title: "Some type errors",
            task: async (_, task): Promise<void> => {
                await delay(1000)
                task.output = "test"
    
                await delay(1000)
                // const retry = task.isRetrying()
                // if (retry?.count as number > 0) {
                //   task.output = `I am self aware that I am retrying for the ${retry?.count as number}th time.`
                // }
    
                await delay(1000)
                throw new Error("This type can not be assigned to type with, oh noes")
            },
            retry: 3,
            options: {
                persistentOutput: true
            },
        }
      ],
      { exitOnError: false,
        exitAfterRollback: true }
    ).run()
  
    await new Listr(
      [
        {
          title: "Some type errors",
          task: async (_, task): Promise<void> => {
            await delay(1000)
            task.output = "test"
  
            await delay(1000)
            const retry = task.isRetrying()
            if (retry?.count as number > 0) {
              task.output = `Last error was, i can further process it: ${retry?.withError as number}`
            }
  
            await delay(1000)
            throw new Error("This type can not be assigned to type with, oh noes")
          },
          retry: 3
        }
      ],
      { exitOnError: false }
    ).run()
  }
  
  main()
  