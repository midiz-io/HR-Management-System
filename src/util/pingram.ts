/**
 * Utility for sending notifications via Pingram API
 */

const PINGRAM_API_URL = "https://api.pingram.io/send";
const PINGRAM_BEARER_TOKEN = "pingram_sk_eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJrZXlfMjgyM2ZlYWM4M2Y4OGFhZjAxZDMyNDYwNDNhMWZlMDMiLCJ2ZXJzaW9uIjoxLCJhY2NvdW50SWQiOiJzaXFsb203MnZ0bnVlaWUzYXF0cno3b3JlaSIsImtleVR5cGUiOiJzZWNyZXQiLCJlbnZpcm9ubWVudElkIjoic2lxbG9tNzJ2dG51ZWllM2FxdHJ6N29yZWkifQ.uugtBt5qdgNtWzLEZpoNjbPHDfm5uzKo-HixFKNGhY8";

export interface PingramNotification {
  to: {
    id: string;
    email: string;
    number: string;
  };
  email?: {
    subject: string;
    html: string;
  };
  sms?: {
    message: string;
  };
  mobile_push?: {
    title: string;
    message: string;
  };
  web_push?: {
    title: string;
    message: string;
    icon?: string;
    url?: string;
  };
}

export async function sendPingramNotification(payload: PingramNotification) {
  try {
    const response = await fetch(PINGRAM_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${PINGRAM_BEARER_TOKEN}`,
      },
      body: JSON.stringify({
        type: "tsf", // As per user provided curl
        ...payload
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to send notification via Pingram");
    }

    return await response.json();
  } catch (error) {
    console.error("Pingram Notification Error:", error);
    throw error;
  }
}

export const createAttendanceReminder = (user: { firstName: string; email: string; phoneNumber?: string }) => {
  const name = user.firstName || "Employee";
  const email = user.email;
  const number = user.phoneNumber || "+94743664450"; // Default as per user request if missing? Or use dynamic.

  return {
    to: {
      id: email,
      email: email,
      number: number,
    },
    email: {
      subject: "Attendance Reminder",
      html: `<p>Hello ${name},</p><p>This is a friendly reminder to mark your attendance for today. Please check-in to your assigned work location.</p><p>Regards,<br/>AttendX Team</p>`
    },
    sms: {
      message: `Hello ${name}, Reminder: Please mark your attendance today. - AttendX`
    },
    mobile_push: {
      title: "Attendance Reminder",
      message: `Hi ${name}, don't forget to mark your attendance today!`
    },
    web_push: {
      title: "Attendance Reminder",
      message: `Hi ${name}, don't forget to mark your attendance today!`,
      icon: "https://example.com/icon.png",
      url: "https://geofencing-attendance.vercel.app/dashboard"
    }
  };
};
