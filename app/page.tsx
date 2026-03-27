import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">مُعلِّم اللغات</h1>
        <p className="text-gray-500 mb-8 text-sm">تعلم التركية والإنجليزية مع ذكاء اصطناعي يتكيّف معك</p>

        <div className="grid grid-cols-2 gap-4">
          <Link
            href="/chat?language=turkish"
            className="flex flex-col items-center gap-2 p-6 bg-white rounded-2xl shadow-sm border border-gray-100 hover:border-indigo-300 hover:shadow-md transition-all"
          >
            <span className="text-4xl">🇹🇷</span>
            <span className="font-semibold text-gray-800">اللغة التركية</span>
            <span className="text-xs text-gray-400">Türkçe</span>
          </Link>

          <Link
            href="/chat?language=english"
            className="flex flex-col items-center gap-2 p-6 bg-white rounded-2xl shadow-sm border border-gray-100 hover:border-indigo-300 hover:shadow-md transition-all"
          >
            <span className="text-4xl">🇬🇧</span>
            <span className="font-semibold text-gray-800">اللغة الإنجليزية</span>
            <span className="text-xs text-gray-400">English</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
