import { debugLogger } from '../lib/debugLogger';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export interface CreateNotificationParams {
  userId: string;
  title: string;
  message: string;
  type: 'application' | 'contract' | 'message' | 'dispute' | 'system';
  link?: string;
}

export const notificationService = {
  async create(params: CreateNotificationParams): Promise<boolean> {
    try {
      await addDoc(collection(db, 'notifications'), {
        userId: params.userId,
        title: params.title,
        message: params.message,
        type: params.type,
        link: params.link || '',
        read: false,
        createdAt: serverTimestamp()
      });
      return true;
    } catch (error) {
      debugLogger.error('Error creating notification:', error);
      handleFirestoreError(error, OperationType.WRITE, 'notifications');
      return false;
    }
  },

  async notifyNewApplication(employerId: string, workerName: string, jobTitle: string, applicationId: string) {
    return this.create({
      userId: employerId,
      title: 'Yangi ariza',
      message: `${workerName} "${jobTitle}" ishiga ariza yubordi`,
      type: 'application',
      link: `/employer/applicants?highlight=${applicationId}`
    });
  },

  async notifyApplicationAccepted(workerId: string, jobTitle: string) {
    return this.create({
      userId: workerId,
      title: 'Ariza qabul qilindi',
      message: `Sizning "${jobTitle}" ishiga arizangiz qabul qilindi!`,
      type: 'application',
      link: '/worker/applications'
    });
  },

  async notifyApplicationRejected(workerId: string, jobTitle: string) {
    return this.create({
      userId: workerId,
      title: 'Ariza rad etildi',
      message: `Sizning "${jobTitle}" ishiga arizangiz rad etildi`,
      type: 'application',
      link: '/worker/applications'
    });
  },

  async notifyNewContract(userId: string, role: 'worker' | 'employer', jobTitle: string, contractId: string) {
    return this.create({
      userId,
      title: 'Yangi shartnoma',
      message: `"${jobTitle}" ishi uchun yangi shartnoma yaratildi`,
      type: 'contract',
      link: role === 'worker' ? `/worker/contracts/${contractId}` : `/employer/contracts/${contractId}`
    });
  },

  async notifyNewMessage(receiverId: string, senderName: string, messagePreview: string) {
    return this.create({
      userId: receiverId,
      title: 'Yangi xabar',
      message: `${senderName}: ${messagePreview.substring(0, 50)}...`,
      type: 'message',
      link: '/chat'
    });
  },

  async notifyContractSigned(userId: string, role: 'worker' | 'employer', jobTitle: string) {
    return this.create({
      userId,
      title: 'Shartnoma imzolandi',
      message: `"${jobTitle}" ishi uchun shartnoma ${role === 'worker' ? 'ish beruvchi' : 'ishchi'} tomonidan imzolandi`,
      type: 'contract',
      link: role === 'worker' ? '/worker/contracts' : '/employer/contracts'
    });
  },

  async notifyContractCompleted(userId: string, jobTitle: string, amount: number) {
    return this.create({
      userId,
      title: 'Shartnoma yakunlandi',
      message: `"${jobTitle}" ishi yakunlandi. Summa: ${amount.toLocaleString()} so'm`,
      type: 'contract',
      link: '/contracts'
    });
  },

  async notifyVerificationApproved(userId: string) {
    return this.create({
      userId,
      title: 'Tasdiqlash muvaffaqiyatli',
      message: 'Sizning hisobingiz tasdiqlandi!',
      type: 'system',
      link: '/my-profile'
    });
  },

  async notifyVerificationRejected(userId: string, reason: string) {
    return this.create({
      userId,
      title: 'Tasdiqlash rad etildi',
      message: `Sabab: ${reason}`,
      type: 'system',
      link: '/verification'
    });
  }
};
