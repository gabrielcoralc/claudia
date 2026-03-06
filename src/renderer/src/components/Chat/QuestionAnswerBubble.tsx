import React from 'react'
import { CheckCircle, User } from 'lucide-react'
import type { QuestionAnswerTurn } from '../../utils/messageGrouper'

interface Props {
  turn: QuestionAnswerTurn
}

export default function QuestionAnswerBubble({ turn }: Props): React.JSX.Element {
  return (
    <div className="flex gap-3 animate-fade-in flex-row-reverse">
      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 bg-green-900/50">
        <User size={14} className="text-green-400" />
      </div>

      <div className="flex-1 max-w-3xl flex flex-col gap-2 items-end">
        <div className="bg-green-950/30 border border-green-600/40 rounded-2xl rounded-tr-sm px-4 py-3 max-w-full">
          {turn.answers.map((entry, i) => (
            <div key={i} className={i > 0 ? 'mt-3 pt-3 border-t border-green-700/20' : ''}>
              <p className="text-xs text-green-400/70 mb-1">{entry.question}</p>
              <div className="flex items-center gap-1.5">
                <CheckCircle size={13} className="text-green-400 shrink-0" />
                <span className="text-sm text-green-300 font-medium">{entry.answer}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
