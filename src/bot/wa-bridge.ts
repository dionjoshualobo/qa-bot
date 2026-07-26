/**
 * Low-level WhatsApp Web bridge
 * Bypasses whatsapp-web.js entirely — uses raw WhatsApp Web internal APIs.
 * whatsapp-web.js 1.34.7 is broken with current WhatsApp Web (missing internal functions).
 */

import { getClient } from './client.js';
import { logger } from '../utils/logger.js';

function getPage() {
  return (getClient() as any).pupPage;
}

export async function waSendText(chatId: string, text: string): Promise<string> {
  const page = getPage();
  const msgId: string = await page.evaluate(
    async (chatId: string, text: string) => {
      // @ts-expect-error running in browser context via puppeteer
      const Chat = window.require('WAWebCollections').Chat;
      // @ts-expect-error running in browser context via puppeteer
      const MsgKey = window.require('WAWebMsgKey');
      // @ts-expect-error running in browser context via puppeteer
      const MsgCollection = window.require('WAWebCollections').Msg;
      // @ts-expect-error running in browser context via puppeteer
      const SendAction = window.require('WAWebSendMsgChatAction');
      // @ts-expect-error running in browser context via puppeteer
      const WidFactory = window.require('WAWebWidFactory');

      const chat = Chat.get(chatId);
      if (!chat) throw new Error(`Chat ${chatId} not found`);

      // Build sender identity
      const meUser = WidFactory.maybeGetUserWid?.() || WidFactory.getMaybeMePnUser?.();
      const meLid = WidFactory.maybeGetMeLidUser?.() || WidFactory.getMaybeMeLidUser?.();
      const from = chat.id?.isLid?.() ? meLid : meUser;

      // Group addressing
      let participant;
      if (chat.id?.isGroup?.()) {
        participant = WidFactory.asUserWidOrThrow(from);
      }

      const newId = await MsgKey.newId();
      const newMsgKey = new MsgKey({
        from,
        to: chat.id,
        id: newId,
        participant: participant || undefined,
        selfDir: 'out',
      });

      const message = {
        id: newMsgKey,
        ack: 0,
        body: text,
        from,
        to: chat.id,
        local: true,
        self: 'out',
        t: Math.floor(Date.now() / 1000),
        isNewMsg: true,
        type: 'chat',
      };

      const [msgPromise] = SendAction.addAndSendMsgToChat(chat, message);
      await msgPromise;

      return newMsgKey._serialized;
    },
    chatId,
    text,
  );
  logger.wa.debug(`Sent message ${msgId} to ${chatId}`);
  return msgId;
}

export async function waEditMessage(msgId: string, text: string): Promise<void> {
  const page = getPage();
  await page.evaluate(
    async (msgId: string, text: string) => {
      // @ts-expect-error running in browser context via puppeteer
      const MsgCollection = window.require('WAWebCollections').Msg;
      // @ts-expect-error running in browser context via puppeteer
      const EditAction = window.require('WAWebSendMessageEditAction');

      const msg = MsgCollection.get(msgId)
        || (await MsgCollection.getMessagesById([msgId]))?.messages?.[0];
      if (!msg) throw new Error(`Message ${msgId} not found`);

      await EditAction.sendEditMessage(msg, { text });
    },
    msgId,
    text,
  );
  logger.wa.debug(`Edited message ${msgId}`);
}

export async function waReplyToMessage(
  chatId: string,
  replyToMsgId: string,
  text: string,
): Promise<string> {
  const page = getPage();
  const msgId: string = await page.evaluate(
    async (chatId: string, quotedMessageId: string, text: string) => {
      // @ts-expect-error running in browser context via puppeteer
      const Chat = window.require('WAWebCollections').Chat;
      // @ts-expect-error running in browser context via puppeteer
      const Msg = window.require('WAWebCollections').Msg;
      // @ts-expect-error running in browser context via puppeteer
      const MsgKey = window.require('WAWebMsgKey');
      // @ts-expect-error running in browser context via puppeteer
      const SendAction = window.require('WAWebSendMsgChatAction');
      // @ts-expect-error running in browser context via puppeteer
      const WidFactory = window.require('WAWebWidFactory');
      // @ts-expect-error running in browser context via puppeteer
      const ReplyUtils = window.require('WAWebMsgReply');

      const chat = Chat.get(chatId);
      if (!chat) throw new Error(`Chat ${chatId} not found`);

      // Get quoted message context
      let quotedMsg = Msg.get(quotedMessageId);
      if (!quotedMsg) {
        quotedMsg = (await Msg.getMessagesById([quotedMessageId]))?.messages?.[0];
      }
      let quotedMsgOptions = {};
      if (quotedMsg && ReplyUtils) {
        const canReply = ReplyUtils.canReplyMsg?.(quotedMsg.unsafe?.()) ?? quotedMsg.canReply?.();
        if (canReply) {
          quotedMsgOptions = quotedMsg.msgContextInfo?.(chat) || {};
        }
      }

      const meUser = WidFactory.maybeGetUserWid?.() || WidFactory.getMaybeMePnUser?.();
      const meLid = WidFactory.maybeGetMeLidUser?.() || WidFactory.getMaybeMeLidUser?.();
      const from = chat.id?.isLid?.() ? meLid : meUser;

      let participant;
      if (chat.id?.isGroup?.()) {
        participant = WidFactory.asUserWidOrThrow(from);
      }

      const newId = await MsgKey.newId();
      const newMsgKey = new MsgKey({
        from,
        to: chat.id,
        id: newId,
        participant: participant || undefined,
        selfDir: 'out',
      });

      const message = {
        id: newMsgKey,
        ack: 0,
        body: text,
        from,
        to: chat.id,
        local: true,
        self: 'out',
        t: Math.floor(Date.now() / 1000),
        isNewMsg: true,
        type: 'chat',
        ...quotedMsgOptions,
      };

      const [msgPromise] = SendAction.addAndSendMsgToChat(chat, message);
      await msgPromise;

      return newMsgKey._serialized;
    },
    chatId,
    replyToMsgId,
    text,
  );
  logger.wa.debug(`Sent reply ${msgId} to ${chatId} (quoting ${replyToMsgId})`);
  return msgId;
}

export async function waGetQuotedMessageId(messageId: string): Promise<string | null> {
  const page = getPage();
  return await page.evaluate(
    async (msgId: string) => {
      // @ts-expect-error running in browser context via puppeteer
      const Msg = window.require('WAWebCollections').Msg;
      // @ts-expect-error running in browser context via puppeteer
      const QuotedUtils = window.require('WAWebQuotedMsgModelUtils');

      const msg = Msg.get(msgId)
        || (await Msg.getMessagesById([msgId]))?.messages?.[0];
      if (!msg) return null;
      const quoted = QuotedUtils.getQuotedMsgObj(msg);
      return quoted?.id?._serialized ?? null;
    },
    messageId,
  );
}

export async function waGetContactName(contactId: string): Promise<string> {
  const page = getPage();
  return await page.evaluate(
    async (contactId: string) => {
      // @ts-expect-error running in browser context via puppeteer
      const Contact = window.require('WAWebCollections').Contact;
      const contact = await Contact.find(contactId);
      return contact?.pushname || contact?.name || 'Anonymous';
    },
    contactId,
  );
}

export async function waIsGroupMember(groupId: string, contactId: string): Promise<boolean> {
  const page = getPage();
  return await page.evaluate(
    (groupId: string, contactId: string) => {
      // @ts-expect-error running in browser context via puppeteer
      const chat = window.require('WAWebCollections').Chat.get(groupId);
      if (!chat || !chat.groupMetadata) return false;
      // @ts-expect-error running in browser context via puppeteer
      const wid = window.require('WAWebWidFactory').createWid(contactId);
      return chat.groupMetadata.participants.some((p: any) => p.id.equals(wid));
    },
    groupId,
    contactId,
  );
}
