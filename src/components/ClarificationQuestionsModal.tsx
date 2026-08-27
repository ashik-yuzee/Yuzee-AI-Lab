import React from "react";
import { useTokenLab } from "../context/TokenLabContext";
import { X, HelpCircle } from "lucide-react";
import { ClarificationQuestionsCard, ClarificationAnswer } from "./ClarificationQuestionsCard";

export const ClarificationQuestionsModal: React.FC = () => {
  const {
    pendingClarificationQuestions,
    setPendingClarificationQuestions,
    sendMessage,
    hasDeferredMessage,
    proceedWithDeferredMessage,
    clearDeferredMessage,
  } = useTokenLab();

  if (!pendingClarificationQuestions) return null;

  const { questions, bridgeMessage } = pendingClarificationQuestions;

  const handleSubmit = (answers: ClarificationAnswer[]) => {
    const lines = answers
      .filter(a => a.selected_values.length > 0 || a.self_input)
      .map(a => `• ${a.dimension.replace(/_/g, " ")}: ${a.self_input || a.selected_values.join(", ")}`);
    const displayText = lines.join("\n") || "Submitted answers";

    const questionAnswers = answers.map((a, i) => ({
      question_id: a.question_id,
      dimension: a.dimension,
      selected_values: a.selected_values,
      self_input: a.self_input,
      answered_at_turn: i + 1,
    }));

    clearDeferredMessage();
    setPendingClarificationQuestions(null);
    sendMessage({ message: displayText, userQuestionAnswers: questionAnswers });
  };

  // X button: if there's a deferred original message, proceed with it; otherwise skip with text.
  const handleSkip = () => {
    if (hasDeferredMessage) {
      proceedWithDeferredMessage();
    } else {
      setPendingClarificationQuestions(null);
      sendMessage("Skip — proceed with what you know");
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white w-full sm:rounded-2xl sm:max-w-lg shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] sm:max-h-[85vh] overflow-hidden rounded-t-2xl">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0 rounded-t-2xl">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center text-white shadow-xs">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">A few quick questions</h2>
              <p className="text-[11px] text-slate-500">Your answers help Oala give much better guidance</p>
            </div>
          </div>
          <button
            onClick={handleSkip}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/50 transition-colors cursor-pointer"
            title="Skip questions"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <ClarificationQuestionsCard
            questions={questions}
            bridgeMessage={bridgeMessage}
            onSubmit={handleSubmit}
          />
        </div>

        {/* Escape hatch */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 shrink-0">
          <div className="flex flex-wrap gap-2">
            {["Skip this for now", "I am not sure yet", "Show me a simple path first", "Tell me what Yuzee can do"].map(label => (
              <button
                key={label}
                onClick={() => {
                  if (label === "Skip this for now" && hasDeferredMessage) {
                    proceedWithDeferredMessage();
                  } else {
                    clearDeferredMessage();
                    setPendingClarificationQuestions(null);
                    sendMessage(label);
                  }
                }}
                className="px-2.5 py-1 text-[11px] text-slate-500 hover:text-slate-800 border border-slate-200 hover:border-slate-300 rounded-lg bg-white transition-colors cursor-pointer"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
