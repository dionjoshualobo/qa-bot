/**
 * Message templates and constants
 */

export const MESSAGES = {
  QUESTION_TEMPLATE: (questionId: string, text: string) => `❓ Anonymous Question

ID: ${questionId}

${text}

Reply to this message to answer.`,

  REPLY_TO_ASKER: (
    questionId: string,
    replyId: string,
    senderName: string,
    text: string,
  ) => `New reply on ${questionId}

${replyId} • ${senderName}
${text}`,

  REPLY_TO_ASKER_ANONYMOUS: (
    questionId: string,
    replyId: string,
    text: string,
  ) => `New reply on ${questionId}

${replyId}
${text}`,

  ERROR_NOT_A_REPLY: 'Please reply to a question or reply message to participate in the thread.',
  ERROR_QUESTION_NOT_FOUND: 'Could not find the original question for this reply.',
  ERROR_GENERIC: 'An error occurred while processing your message. Please try again.',

  SUCCESS_QUESTION_POSTED: (questionId: string) =>
    `Your question has been posted anonymously as ${questionId}.`,

  REPLY_TEMPLATE: (questionId: string, replyId: string, text: string) => `↩️ Reply to ${questionId}

ID: ${replyId}

${text}`,

  SUCCESS_REPLY_FORWARDED: (replyId: string) =>
    `Your reply (${replyId}) has been posted anonymously.`,

  HELP: `📖 How to use this bot

• Use /q or /question followed by your question to post it anonymously to the group.
  Example: /q What time is the meeting?

• Any replies to your question will be posted back in this chat.

• To reply to someone's response, swipe right on the message (or use the Reply option) and send your reply. It will not work if you do not reply to it.

• Use /exit to close this session. After /exit, replies will not be posted back and forth between the group and DM.

• If you plan to reply in the group directly, use /exit first to avoid confusion.

• Use /repo to get the source code repository link for this bot.`,

  SESSION_ENDED: `Session ended. You will no longer receive replies in this DM.

To start a new session, send a new question with /q or /question.`,

  SESSION_ACTIVE: `You already have an active session. Use /exit to close it before starting a new one.`,

  EXIT_MESSAGE: (text: string) => `👋 ${text}`,

  REPO: `You can find the source code for this bot here:\nhttps://github.com/dionjoshualobo/qa-bot/`,

  PENDING_QUESTION_PREVIEW: (askerJid: string, text: string) => `📝 Question submitted for review

From: ${askerJid}

${text}

Reply with approve or reject`,

  SUCCESS_QUESTION_SUBMITTED: `Your question has been submitted for review and will be posted once approved.`,

  APPROVED_NOTIFY_OWNER: (questionId: string) => `✅ Approved and posted ${questionId} to group.`,

  REJECTED_NOTIFY_ASKER: `Your question was not approved by the admin.`,

  REJECTED_NOTIFY_OWNER: (questionText: string, reason: string) =>
    `❌ Rejected question: "${questionText}"${reason ? `\nReason: ${reason}` : ''}`,

  INVALID_APPROVAL_RESPONSE:
    'Invalid response. Reply with "approve" or "reject" (optionally followed by a reason).',
};

export const QUESTION_ID_PREFIX = 'Q';
export const REPLY_ID_SEPARATOR = '.';
