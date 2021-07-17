import Head from 'next/head'
import Timetable from '../components/Timetable'

export default function Home() {
  return (
    <div className="container mx-auto">
      <Head>
        <title>Create Next App</title>
        <meta name="description" content="Generated by create next app" />
      </Head>

      <main className="py-20">
        <Timetable />
      </main>
    </div>
  )
}
