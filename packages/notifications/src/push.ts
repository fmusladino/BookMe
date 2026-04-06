import webPush from "web-push";

// Inicialización lazy para evitar crasheos en build/dev sin credenciales VAPID
let _configured = false;

function ensureVapid() {
  if (_configured) return;
  const subject = process.env["VAPID_SUBJECT"];
  const publicKey = process.env["NEXT_PUBLIC_VAPID_PUBLIC_KEY"];
  const privateKey = process.env["VAPID_PRIVATE_KEY"];

  if (!subject || !publicKey || !privateKey || publicKey === "placeholder") {
    throw new Error("Web Push no configurado: VAPID keys requeridas");
  }

  webPush.setVapidDetails(subject, publicKey, privateKey);
  _configured = true;
}

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  url?: string;
}

// Envía push al profesional cuando un paciente reserva (Standard+)
export async function sendPushNotification(
  subscription: PushSubscriptionData,
  payload: PushNotificationPayload
) {
  ensureVapid();
  return webPush.sendNotification(
    subscription,
    JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon ?? "/icons/icon-192x192.png",
      data: { url: payload.url ?? "/" },
    })
  );
}

export function buildNewBookingPush(
  patientName: string,
  dateStr: string
): PushNotificationPayload {
  return {
    title: "Nueva reserva",
    body: `${patientName} reservó un turno para ${dateStr}`,
    url: "/agenda",
  };
}
