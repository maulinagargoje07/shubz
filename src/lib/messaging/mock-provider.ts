/**
 * A provider that writes to the messages table and makes no network call.
 * SCAFFOLD ONLY — this is what the app uses until WhatsApp is connected, so
 * message-sending code paths can be exercised end to end without sending
 * anything to a real person.
 */

import { eq } from "drizzle-orm"

import { db } from "@/db"
import { messages } from "@/db/schema"
import { newId } from "@/lib/ids"
import type {
  MessageStatusResult,
  MessagingProvider,
  SendTemplateInput,
  SendTemplateResult,
  WebhookResult,
} from "./provider"

export class MockMessagingProvider implements MessagingProvider {
  readonly name = "mock"

  async sendTemplate(input: SendTemplateInput): Promise<SendTemplateResult> {
    const now = new Date()

    // onConflictDoNothing on the idempotency key: a retry with the same key
    // returns the original row rather than creating a second message. This is
    // the behaviour a real provider must also have.
    const [row] = await db
      .insert(messages)
      .values({
        id: newId(),
        contactId: input.contactId,
        campaignId: input.campaignId ?? null,
        templateId: input.templateId ?? null,
        direction: "OUTBOUND",
        channel: "WHATSAPP",
        idempotencyKey: input.idempotencyKey,
        bodyText: `[mock] ${input.templateName}`,
        payload: {
          provider: "mock",
          templateName: input.templateName,
          language: input.language,
          variables: input.variables,
          toPhoneE164: input.toPhoneE164,
        },
        status: "SENT",
        queuedAt: now,
        sentAt: now,
      })
      .onConflictDoNothing({ target: messages.idempotencyKey })
      .returning()

    if (!row) {
      const existing = await db.query.messages.findFirst({
        where: eq(messages.idempotencyKey, input.idempotencyKey),
      })
      return existing
        ? { ok: true, messageId: existing.id, wamid: existing.wamid, status: existing.status }
        : {
            ok: false,
            messageId: null,
            errorCode: "MOCK_INSERT_FAILED",
            errorMessage: "Could not record the message",
          }
    }

    return { ok: true, messageId: row.id, wamid: null, status: "SENT" }
  }

  async getStatus(messageId: string): Promise<MessageStatusResult | null> {
    const row = await db.query.messages.findFirst({ where: eq(messages.id, messageId) })
    if (!row) return null

    return {
      status: row.status,
      wamid: row.wamid,
      deliveredAt: row.deliveredAt,
      readAt: row.readAt,
      errorCode: row.errorCode,
      errorMessage: row.errorMessage,
    }
  }

  async handleWebhook(): Promise<WebhookResult> {
    // Nothing calls back to a provider that never sent anything.
    return { signatureValid: true, processed: 0 }
  }
}

export const mockMessagingProvider = new MockMessagingProvider()
