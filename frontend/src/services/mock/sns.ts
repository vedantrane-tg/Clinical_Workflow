import type { NotificationService } from "@/services/aws/interfaces";
import { delay } from "./latency";

/** mockSNSService() — replace with snsService() publishing to an SNS topic. */
export const mockSNSService: NotificationService = {
  async publishReferralNotification(referral) {
    await delay(70);
    return { messageId: `sns-${referral.referral_id.toLowerCase()}-${Date.now()}` };
  },
};