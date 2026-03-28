export interface QuizData {
  question: string
  options: { letter: string; text: string }[]
  correct: string
}

export function parseQuiz(content: string): { quiz: QuizData | null; cleanContent: string } {
  const quizMatch = content.match(/\[QUIZ\]([\s\S]*?)\[\/QUIZ\]/i)
  if (!quizMatch) return { quiz: null, cleanContent: content }

  const raw = quizMatch[1].trim()
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean)

  const questionLine = lines.find(l => l.startsWith('السؤال:'))
  const question = questionLine?.replace('السؤال:', '').trim() ?? ''

  const options: { letter: string; text: string }[] = []
  for (const line of lines) {
    const match = line.match(/^([A-D]):\s*(.+)/)
    if (match) options.push({ letter: match[1], text: match[2].trim() })
  }

  const correctLine = lines.find(l => l.startsWith('CORRECT:'))
  const correct = correctLine?.replace('CORRECT:', '').trim().toUpperCase() ?? ''

  const cleanContent = content.replace(quizMatch[0], '').trim()

  if (!question || options.length < 2 || !correct) {
    return { quiz: null, cleanContent }
  }

  return { quiz: { question, options, correct }, cleanContent }
}
