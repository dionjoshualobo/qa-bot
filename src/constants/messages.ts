/**
 * Message templates and constants
 */

export const MESSAGES = {
  QUESTION_TEMPLATE: (questionId: string, text: string) => `━━━━━━━━━━━━━━━━━━

❓ Anonymous Question

ID: ${questionId}

${text}

Reply to THIS message to answer.

━━━━━━━━━━━━━━━━━━`,

  REPLY_TO_ASKER: (questionId: string, replyId: string, senderName: string, text: string) => `Anonymous reply to ${questionId}

${replyId} - ${senderName}:
${text}`,

  REPLY_TO_ASKER_ANONYMOUS: (questionId: string, replyId: string, text: string) => `Anonymous reply to ${questionId}

${replyId}:
${text}`,

  ERROR_NOT_A_REPLY: 'Please reply to a question or reply message to participate in the thread.',
  ERROR_QUESTION_NOT_FOUND: 'Could not find the original question for this reply.',
  ERROR_GENERIC: 'An error occurred while processing your message. Please try again.',
  
  SUCCESS_QUESTION_POSTED: (questionId: string) => `Your question has been posted anonymously as ${questionId}.`,
};

export const QUESTION_ID_PREFIX = 'Q';
export const REPLY_ID_SEPARATOR = '.';
