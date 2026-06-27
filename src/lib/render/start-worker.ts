import { startWorker } from './worker'

startWorker().catch((err) => {
  console.error('Render worker failed to start:', err)
  process.exit(1)
})
