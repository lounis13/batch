import { createFileRoute } from '@tanstack/react-router'
import { JobsList } from '@/features/jobs'

export const Route = createFileRoute('/')({
  component: App,
})

function App() {
  return (
    <>
      <JobsList />
    </>
  )
}
