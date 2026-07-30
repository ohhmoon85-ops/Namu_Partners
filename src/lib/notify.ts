import { decrypt } from "./crypto";
import { logNotification } from "./store";
import { maskPhone } from "./format";
import type { Application } from "./types";

/**
 * 알림 발송 (기획서 4.3 자리 비움 허용 / 6장 알림 연동)
 *
 * NOTIFY_PROVIDER 환경변수로 채널을 선택한다.
 *   - console (기본) : 실제 발송 없이 서버 로그 + 발송 이력만 남긴다.
 *   - kakao          : 카카오 알림톡 API 호출 (실패 시 SMS 폴백)
 *   - sms            : SMS API 호출
 *
 * 운영 전환 시 아래 sendAlimtalk / sendSms 의 엔드포인트 규격만
 * 계약한 발송 대행사 스펙에 맞추면 된다.
 */

export type NotifyTemplate = "queue_ready" | "status_changed";

interface NotifyResult {
  ok: boolean;
  channel: "alimtalk" | "sms" | "console";
  detail: string;
}

function buildMessage(template: NotifyTemplate, app: Application, name: string): string {
  switch (template) {
    case "queue_ready":
      return [
        `[나무파트너스] ${name}님, 접수 순서가 도래했습니다.`,
        `접수번호: ${app.ticket}`,
        `신청 상품: ${app.productName}`,
        `진행 상태는 접수조회 페이지에서 확인하실 수 있습니다.`,
      ].join("\n");
    case "status_changed":
      return [
        `[나무파트너스] ${name}님, 접수 진행상태가 변경되었습니다.`,
        `접수번호: ${app.ticket}`,
        `현재 단계: ${app.status}`,
      ].join("\n");
  }
}

async function sendAlimtalk(phone: string, message: string): Promise<NotifyResult> {
  const url = process.env.KAKAO_ALIMTALK_API_URL;
  const apiKey = process.env.KAKAO_ALIMTALK_API_KEY;
  const senderKey = process.env.KAKAO_ALIMTALK_SENDER_KEY;
  const templateCode = process.env.KAKAO_ALIMTALK_TEMPLATE_QUEUE_READY;

  if (!url || !apiKey || !senderKey || !templateCode) {
    return {
      ok: false,
      channel: "alimtalk",
      detail: "알림톡 환경변수 미설정",
    };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        senderKey,
        templateCode,
        recipientList: [{ recipientNo: phone, content: message }],
      }),
    });
    return {
      ok: res.ok,
      channel: "alimtalk",
      detail: res.ok ? "발송 성공" : `발송 실패 (HTTP ${res.status})`,
    };
  } catch (error) {
    return {
      ok: false,
      channel: "alimtalk",
      detail: `발송 예외: ${(error as Error).message}`,
    };
  }
}

async function sendSms(phone: string, message: string): Promise<NotifyResult> {
  const url = process.env.SMS_API_URL;
  const apiKey = process.env.SMS_API_KEY;
  const sender = process.env.SMS_SENDER_NUMBER;

  if (!url || !apiKey || !sender) {
    return { ok: false, channel: "sms", detail: "SMS 환경변수 미설정" };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ sender, to: phone, text: message }),
    });
    return {
      ok: res.ok,
      channel: "sms",
      detail: res.ok ? "발송 성공" : `발송 실패 (HTTP ${res.status})`,
    };
  } catch (error) {
    return {
      ok: false,
      channel: "sms",
      detail: `발송 예외: ${(error as Error).message}`,
    };
  }
}

/** 단건 발송 — 수신 동의하지 않은 건은 발송하지 않는다. */
export async function notifyApplicant(
  app: Application,
  template: NotifyTemplate
): Promise<void> {
  if (!app.notifyOptIn) return;

  const phone = decrypt(app.phoneEnc);
  const name = decrypt(app.nameEnc) || "고객";
  if (!phone) return;

  const message = buildMessage(template, app, name);
  const provider = process.env.NOTIFY_PROVIDER || "console";

  let result: NotifyResult;
  if (provider === "kakao") {
    result = await sendAlimtalk(phone, message);
    if (!result.ok) {
      const fallback = await sendSms(phone, message);
      // 폴백까지 실패하면 알림톡 실패 사유를 함께 남긴다.
      result = fallback.ok
        ? fallback
        : { ...fallback, detail: `${result.detail} → SMS 폴백: ${fallback.detail}` };
    }
  } else if (provider === "sms") {
    result = await sendSms(phone, message);
  } else {
    console.info(
      `[notify:console] ${maskPhone(phone)} 앞으로 발송 예정\n${message}`
    );
    result = { ok: true, channel: "console", detail: "콘솔 출력(개발 모드)" };
  }

  await logNotification({
    applicationId: app.id,
    ticket: app.ticket,
    channel: result.channel,
    template,
    ok: result.ok,
    detail: result.detail,
  });
}

/**
 * 대기열 소진으로 접수 확정된 건들에 순서 도래 알림을 보낸다.
 * 폴링 응답을 지연시키지 않도록 호출 측에서 await 하지 않고 실행할 수 있다.
 */
export async function notifyServed(apps: Application[]): Promise<void> {
  for (const app of apps) {
    try {
      await notifyApplicant(app, "queue_ready");
    } catch (error) {
      console.error(`[notify] ${app.ticket} 발송 실패`, error);
    }
  }
}
