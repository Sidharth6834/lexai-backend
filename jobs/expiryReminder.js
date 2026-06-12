import cron from 'node-cron';
import Document from '../models/Document.js';
import User from '../models/User.js';
import { sendExpiryReminderEmail } from '../utils/emailService.js';

/**
 * Initializes and schedules the daily document expiration checking job
 */
const startExpiryReminderJob = () => {
  // Cron schedule: '0 9 * * *' (Every day at 9:00 AM)
  cron.schedule('0 9 * * *', async () => {
    console.log('Running daily document expiry check...');
    try {
      const now = new Date();
      const in30Days = new Date();
      in30Days.setDate(in30Days.getDate() + 30);

      // Find documents expiring within 30 days where emailSent is false
      // Only check fully analyzed and complete documents
      const expiringDocs = await Document.find({
        expiryDate: { $gte: now, $lte: in30Days },
        emailSent: false,
        status: 'complete'
      });

      console.log(`Found ${expiringDocs.length} documents expiring in the next 30 days with pending alerts.`);

      for (const doc of expiringDocs) {
        try {
          // Fetch user details
          const user = await User.findById(doc.userId);
          if (!user || !user.email) {
            console.log(`Skipping doc ${doc._id}: User or user email not found.`);
            continue;
          }

          // Calculate days left
          const diffTime = doc.expiryDate.getTime() - now.getTime();
          const daysLeft = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

          console.log(`Sending expiry reminder for "${doc.name}" to ${user.email} (${daysLeft} days left).`);
          
          await sendExpiryReminderEmail(user.email, user.name || 'User', doc, daysLeft);

          // Mark emailSent as true
          doc.emailSent = true;
          await doc.save();
        } catch (emailErr) {
          console.error(`Failed to send expiry email for doc ${doc._id}:`, emailErr.message);
        }
      }
    } catch (err) {
      console.error('Error in document expiry check job:', err.message);
    }
  });
  
  console.log('LexAI Expiry Reminder Cron Job scheduled (daily at 9:00 AM).');
};

export default startExpiryReminderJob;
